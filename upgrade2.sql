-- شغّل هذا الملف مرة واحدة فقط في Supabase > SQL Editor (بعد upgrade.sql)
alter table questions add column kind text default 'mc'; -- mc | tf | fill | match

drop function if exists cur_q(uuid);
create function cur_q(sid uuid) returns table(qi int,q text,kind text,opts jsonb,correct int,secs int) language sql stable security definer set search_path=public as $$
 select r.rn::int,r.q,r.kind,r.opts,r.correct,r.secs from sessions s join (select *,row_number() over(partition by quiz_id order by pos,id)-1 rn from questions) r on r.quiz_id=s.quiz_id and r.rn=s.qi where s.id=sid $$;
revoke execute on function cur_q(uuid) from public,anon,authenticated;

-- أسئلة التوصيل: الخادم يخلط العمود الأيمن بترتيب ثابت ولا يرسل الأزواج الصحيحة
create or replace function get_question(p_session uuid) returns json language plpgsql security definer set search_path=public as $$
declare s sessions; r record; v_el numeric;
begin
 select * into s from sessions where id=p_session;
 if not found or s.state<>'question' then return null; end if;
 select * into r from cur_q(p_session);
 v_el:=round(extract(epoch from now()-s.started_at)*1000);
 if r.kind='match' then
  return json_build_object('qi',r.qi,'q',r.q,'kind','match','secs',r.secs,'elapsed_ms',v_el,
   'lefts',(select json_agg(t.e->0 order by t.o) from jsonb_array_elements(r.opts) with ordinality t(e,o)),
   'rights',(select json_agg(e->1 order by md5(s.id::text||r.qi||(e->>1))) from jsonb_array_elements(r.opts) e));
 end if;
 return json_build_object('qi',r.qi,'q',r.q,'kind',r.kind,'opts',r.opts,'secs',r.secs,'elapsed_ms',v_el);
end $$;

drop function if exists submit_answer(uuid,int);
create function submit_answer(p_player uuid,p_choice int,p_qi int,p_map int[] default null) returns json language plpgsql security definer set search_path=public as $$
declare p players; s sessions; r record; v_ms int; v_ok boolean; v_pts int:=0; v_rank int; v_t float8:=now_s(); v_v uuid;
 v_boost boolean:=false; v_hit boolean:=false; v_e int; v_ti int; v_g int; v_rs text[]; v_i int;
begin
 select * into p from players where id=p_player;
 if not found then return json_build_object('error','تم إخراجك من اللعبة'); end if;
 select * into s from sessions where id=p.session_id;
 if s.state<>'question' or p_qi is distinct from s.qi then return json_build_object('error','انتهى وقت هذا السؤال'); end if;
 select * into r from cur_q(s.id);
 v_ms:=round(extract(epoch from now()-s.started_at)*1000);
 if v_ms>r.secs*1000+1500 then return json_build_object('error','انتهى وقت هذا السؤال'); end if;
 if r.kind='match' then
  select array_agg(e->>1 order by md5(s.id::text||r.qi||(e->>1))) into v_rs from jsonb_array_elements(r.opts) e;
  v_ok:=(p_map is not null and array_length(p_map,1)=jsonb_array_length(r.opts));
  if v_ok then
   for v_i in 0..jsonb_array_length(r.opts)-1 loop
    if p_map[v_i+1] is null or p_map[v_i+1]<0 or p_map[v_i+1]>=array_length(v_rs,1) or v_rs[p_map[v_i+1]+1] is distinct from (r.opts->v_i->>1) then v_ok:=false; end if;
   end loop;
  end if;
 else v_ok:=(p_choice=r.correct); end if;
 select count(*) into v_rank from answers where session_id=s.id and qi=s.qi and ok;
 begin
  insert into answers(session_id,player_id,qi,choice,ok,ms) values(s.id,p.id,s.qi,coalesce(p_choice,-1),v_ok,v_ms);
 exception when unique_violation then return json_build_object('error','أجبت على هذا السؤال من قبل');
 end;
 update players set d0=ppos(d0,t0,spd,bu,su,sf,v_t),t0=v_t where id=p.id returning * into p;
 v_e:=(p.car->>'e')::int; v_ti:=(p.car->>'t')::int; v_g:=(p.car->>'g')::int;
 if v_ok then
  v_pts:=500+round(500*greatest(0,1-v_ms/(r.secs*1000.0)))+least(p.streak,5)*50;
  update players set score=score+v_pts,streak=streak+1,spd=least(spd+15+2*v_g,220+10*v_e) where id=p.id;
  update profiles set coins=coins+20 where name=p.name;
  if v_rank<3 then
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
  update players set streak=0,spd=greatest(50,spd-(20-2*v_ti)) where id=p.id;
 end if;
 return json_build_object('ok',v_ok,'pts',v_pts,'boost',v_boost,'hit',v_hit);
end $$;

-- سرعة البداية 75 بدل 60
create or replace function join_session(p_code text,p_name text,p_pin text) returns json language plpgsql security definer set search_path=public as $$
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
   values(s.id,f.name,v_c,v_n%5,-(v_n/5)*35,case when s.state='lobby' then null else now_s() end,75+3*(v_c->>'e')::int+6*f.sel) returning * into p;
 end if;
 return json_build_object('pid',p.id,'sid',s.id,'name',p.name);
end $$;

-- مراجعة الأخطاء: لا تعمل إلا بعد انتهاء السباق
create function my_review(p_player uuid) returns json language plpgsql security definer set search_path=public as $$
declare p players; s sessions;
begin
 select * into p from players where id=p_player;
 select * into s from sessions where id=p.session_id;
 if s.state<>'finished' then return '[]'::json; end if;
 return coalesce((select json_agg(json_build_object('q',r.q,'kind',r.kind,
   'mine',case when r.kind<>'match' and a.choice>=0 then r.opts->>a.choice else null end,
   'right',case when r.kind<>'match' then r.opts->>r.correct else (select string_agg((e->>0)||' ← '||(e->>1),' | ') from jsonb_array_elements(r.opts) e) end) order by r.rn)
  from (select *,row_number() over(order by pos,id)-1 rn from questions where quiz_id=s.quiz_id) r
  left join answers a on a.player_id=p.id and a.qi=r.rn
  where r.rn<=s.qi and coalesce(a.ok,false)=false),'[]'::json);
end $$;
