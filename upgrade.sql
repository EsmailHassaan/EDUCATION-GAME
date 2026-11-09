-- شغّل هذا الملف مرة واحدة فقط في Supabase > SQL Editor (بعد setup.sql)
alter table sessions add column track int default 0;
alter table players add column d0 float8 default 0, add column t0 float8, add column spd float8 default 60,
  add column bu float8 default 0, add column su float8 default 0, add column sf float8 default 0.5,
  add column lane int default 0, add column car jsonb;

create table profiles(name text primary key, pin text not null, coins int default 300, owned int[] default '{0}', sel int default 0,
  garage jsonb default '{"0":{"c":"#ef4444","e":0,"t":0,"s":0,"g":0}}');
alter table profiles enable row level security; -- لا سياسات: الوصول عبر الدوال فقط

create function now_s() returns float8 language sql as $$ select extract(epoch from clock_timestamp())::float8 $$;

-- موضع السيارة = المسافة المقطوعة مع احتساب النيترو (+40) والإبطاء (×معامل) خلال نافذتيهما
create function ppos(d0 float8,t0 float8,sp float8,bu float8,su float8,sf float8,t float8) returns float8 language plpgsql immutable as $$
declare a float8:=t0; b float8; d float8:=d0; ks float8[];
begin
 if t0 is null then return d0; end if;
 select coalesce(array_agg(x order by x),'{}'::float8[]) into ks from unnest(array[bu,su]) x where x>t0 and x<t;
 ks:=ks||t;
 foreach b in array ks loop
  d:=d+(sp+case when (a+b)/2<bu then 40 else 0 end)*case when (a+b)/2<su then sf else 1 end*(b-a); a:=b;
 end loop;
 return d;
end $$;

create function prof_get(p_name text,p_pin text) returns profiles language plpgsql security definer set search_path=public as $$
declare f profiles; v_h text:=md5(p_pin||'edu-salt');
begin
 p_name:=left(trim(p_name),20);
 if p_name='' or p_pin !~ '^\d{4}$' then raise exception 'اكتب اسمك ورمزاً سرياً من 4 أرقام'; end if;
 select * into f from profiles where name=p_name;
 if not found then insert into profiles(name,pin) values(p_name,v_h) returning * into f;
 elsif f.pin<>v_h then raise exception 'الرمز السري خاطئ'; end if;
 return f;
end $$;
revoke execute on function prof_get(text,text) from public,anon,authenticated;

create function shop(p_name text,p_pin text,p_act text,p_car int,p_arg text) returns json language plpgsql security definer set search_path=public as $$
declare f profiles; v_lv int; v_cost int; v_pr int[]:=array[0,1500,4000,9000,20000];
begin
 f:=prof_get(p_name,p_pin);
 if p_act='buy' then
  if p_car not between 0 and 4 or p_car=any(f.owned) then raise exception 'غير ممكن'; end if;
  if f.coins<v_pr[p_car+1] then raise exception 'رصيدك لا يكفي'; end if;
  update profiles set coins=coins-v_pr[p_car+1],owned=owned||p_car,sel=p_car,
   garage=garage||jsonb_build_object(p_car::text,'{"c":"#3b82f6","e":0,"t":0,"s":0,"g":0}'::jsonb) where name=f.name;
 elsif p_act='sel' then
  if not p_car=any(f.owned) then raise exception 'لا تملك هذه السيارة'; end if;
  update profiles set sel=p_car where name=f.name;
 elsif p_act='up' then
  if not p_car=any(f.owned) or p_arg not in('e','t','s','g') then raise exception 'غير ممكن'; end if;
  v_lv:=(f.garage->p_car::text->>p_arg)::int; v_cost:=250*(v_lv+1);
  if v_lv>=5 then raise exception 'وصلت للحد الأقصى'; end if;
  if f.coins<v_cost then raise exception 'رصيدك لا يكفي'; end if;
  update profiles set coins=coins-v_cost,garage=jsonb_set(garage,array[p_car::text,p_arg],to_jsonb(v_lv+1)) where name=f.name;
 elsif p_act='color' then
  if not p_car=any(f.owned) or p_arg !~ '^#[0-9a-fA-F]{6}$' then raise exception 'غير ممكن'; end if;
  update profiles set garage=jsonb_set(garage,array[p_car::text,'c'],to_jsonb(p_arg)) where name=f.name;
 end if;
 select * into f from profiles where name=f.name;
 return json_build_object('coins',f.coins,'owned',f.owned,'sel',f.sel,'garage',f.garage);
end $$;

drop function if exists join_session(text,text,text);
create function join_session(p_code text,p_name text,p_pin text) returns json language plpgsql security definer set search_path=public as $$
declare s sessions; f profiles; p players; v_n int; v_c jsonb;
begin
 f:=prof_get(p_name,p_pin);
 select * into s from sessions where code=p_code and state<>'finished';
 if not found then return json_build_object('error','رمز اللعبة غير صحيح أو انتهت اللعبة'); end if;
 select * into p from players where session_id=s.id and name=f.name;
 if not found then
  select count(*) into v_n from players where session_id=s.id;
  v_c:=(f.garage->(f.sel::text))||jsonb_build_object('id',f.sel);
  insert into players(session_id,name,car,lane,d0,t0,spd)
   values(s.id,f.name,v_c,v_n%5,-(v_n/5)*35,case when s.state='lobby' then null else now_s() end,60+3*(v_c->>'e')::int+6*f.sel) returning * into p;
 end if;
 return json_build_object('pid',p.id,'sid',s.id,'name',p.name);
end $$;

create or replace function submit_answer(p_player uuid,p_choice int) returns json language plpgsql security definer set search_path=public as $$
declare p players; s sessions; r record; v_ms int; v_ok boolean; v_pts int:=0; v_rank int; v_t float8:=now_s(); v_v uuid;
 v_boost boolean:=false; v_hit boolean:=false; v_e int; v_ti int; v_g int;
begin
 select * into p from players where id=p_player;
 if not found then return json_build_object('error','تم إخراجك من اللعبة'); end if;
 select * into s from sessions where id=p.session_id;
 if s.state<>'question' then return json_build_object('error','انتهى الوقت'); end if;
 select * into r from cur_q(s.id);
 v_ms:=round(extract(epoch from now()-s.started_at)*1000);
 if v_ms>r.secs*1000+1500 then return json_build_object('error','انتهى الوقت'); end if;
 v_ok:=(p_choice=r.correct);
 select count(*) into v_rank from answers where session_id=s.id and qi=s.qi and ok;
 begin
  insert into answers(session_id,player_id,qi,choice,ok,ms) values(s.id,p.id,s.qi,p_choice,v_ok,v_ms);
 exception when unique_violation then return json_build_object('error','أجبت على هذا السؤال من قبل');
 end;
 update players set d0=ppos(d0,t0,spd,bu,su,sf,v_t),t0=v_t where id=p.id returning * into p;
 v_e:=(p.car->>'e')::int; v_ti:=(p.car->>'t')::int; v_g:=(p.car->>'g')::int;
 if v_ok then
  v_pts:=500+round(500*greatest(0,1-v_ms/(r.secs*1000.0)))+least(p.streak,5)*50;
  update players set score=score+v_pts,streak=streak+1,spd=least(spd+15+2*v_g,200+10*v_e) where id=p.id;
  update profiles set coins=coins+20 where name=p.name;
  if v_rank<3 then -- أسرع ثلاثة: نيترو 4 ثوانٍ + ضربة للسيارة التي أمامك
   v_boost:=true;
   update players set bu=v_t+4 where id=p.id;
   select id into v_v from players where session_id=s.id and id<>p.id and ppos(d0,t0,spd,bu,su,sf,v_t)>p.d0
    order by ppos(d0,t0,spd,bu,su,sf,v_t) limit 1;
   if v_v is not null then
    update players set d0=ppos(d0,t0,spd,bu,su,sf,v_t),t0=v_t,su=v_t+4-0.4*(car->>'t')::int,sf=0.5+0.04*(car->>'s')::int,hit=hit+1 where id=v_v;
    v_hit:=true;
   end if;
  end if;
 else
  update players set streak=0,spd=greatest(40,spd-(20-2*v_ti)) where id=p.id;
 end if;
 return json_build_object('ok',v_ok,'pts',v_pts,'boost',v_boost,'hit',v_hit);
end $$;

create or replace function host_set(p_session uuid,p_state text,p_qi int) returns void language plpgsql security definer set search_path=public as $$
declare v_old text; v_t float8:=now_s();
begin
 select state into v_old from sessions where id=p_session and owner=auth.uid();
 if not found then raise exception 'غير مصرح'; end if;
 update sessions set state=p_state,qi=p_qi,started_at=case when p_state='question' then now() else started_at end where id=p_session;
 if v_old='lobby' and p_state='question' then update players set t0=v_t where session_id=p_session; end if;
 if p_state='finished' and v_old<>'finished' then
  update players set d0=ppos(d0,t0,spd,bu,su,sf,v_t),t0=v_t,spd=0,bu=0,su=0 where session_id=p_session;
  update profiles pf set coins=coins+b.bn from
   (select name,(array[300,200,100])[row_number() over(order by d0 desc)] bn from players where session_id=p_session order by d0 desc limit 3) b
   where pf.name=b.name;
 end if;
end $$;
