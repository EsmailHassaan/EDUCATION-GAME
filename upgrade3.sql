-- شغّل هذا الملف مرة واحدة فقط في Supabase > SQL Editor (بعد upgrade2.sql)
alter table quizzes add column practice boolean default true;      -- ظاهر في بنك الاختبارات للطلاب
alter table sessions add column solo boolean default false;
alter table players add column g0 float8 default 0;               -- موضع الانطلاق (لعدالة الترتيب)
alter table profiles add column solo_day date, add column solo_n int default 0;

create function practice_list() returns json language sql security definer set search_path=public as $$
 select coalesce(json_agg(json_build_object('id',q.id,'title',q.title,'n',(select count(*) from questions where quiz_id=q.id)) order by q.created_at desc),'[]'::json)
 from quizzes q where q.practice and exists(select 1 from questions where quiz_id=q.id) $$;

create function start_solo(p_name text,p_pin text,p_quiz uuid) returns json language plpgsql security definer set search_path=public as $$
declare f profiles; s sessions; p players; v_o uuid; v_n int; v_c jsonb; v_i int;
 v_nm text[]:=array['🤖 برق','🤖 صقر','🤖 نمر','🤖 ريح','🤖 سهم']; v_l int[]:=array[1,3,0,4,2];
begin
 f:=prof_get(p_name,p_pin);
 select owner into v_o from quizzes where id=p_quiz and practice;
 select count(*) into v_n from questions where quiz_id=p_quiz;
 if v_o is null or v_n=0 then return json_build_object('error','الاختبار غير متاح'); end if;
 insert into sessions(quiz_id,owner,code,total,track,solo) values(p_quiz,v_o,'s'||substr(md5(random()::text),1,9),v_n,(random()*3)::int,true) returning * into s;
 v_c:=(f.garage->(f.sel::text))||jsonb_build_object('id',f.sel);
 insert into players(session_id,name,car,lane,d0,g0,spd) values(s.id,f.name,v_c,2,0,0,75+3*(v_c->>'e')::int+6*f.sel) returning * into p;
 for v_i in 1..5 loop
  insert into players(session_id,name,car,lane,d0,g0,spd) values(s.id,v_nm[v_i],
   jsonb_build_object('id',(random()*3)::int,'c',(array['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7'])[v_i],'e',0,'t',0,'s',0,'g',0,'bot','1'),
   v_l[v_i],-35*((v_i+1)/2),-35*((v_i+1)/2),95);
 end loop;
 return json_build_object('pid',p.id,'sid',s.id,'name',p.name);
end $$;

-- في التدريب الفردي: الطالب نفسه يحرّك الأسئلة (السؤال التالي فور الإجابة أو انتهاء الوقت)
create function solo_next(p_player uuid,p_qi int) returns void language plpgsql security definer set search_path=public as $$
declare p players; s sessions; v_t float8:=now_s();
begin
 select * into p from players where id=p_player;
 select * into s from sessions where id=p.session_id;
 if not s.solo or s.qi<>p_qi or s.state='finished' then return; end if;
 if s.qi+1>=s.total then
  update sessions set state='finished' where id=s.id;
  update players set d0=ppos(d0,t0,spd,bu,su,sf,v_t)-g0,t0=v_t,spd=0,bu=0,su=0 where session_id=s.id;
 else
  update sessions set state='question',qi=s.qi+1,started_at=now() where id=s.id;
  if s.qi=-1 then update players set t0=v_t where session_id=s.id;
  else update players set d0=ppos(d0,t0,spd,bu,su,sf,v_t),t0=v_t,spd=greatest(60,least(170,spd+(random()*40-14))) where session_id=s.id and car->>'bot'='1';
  end if;
 end if;
end $$;

-- انطلاق متباعد ومتدرج، والترتيب النهائي يحسب التقدم من موضع الانطلاق
create or replace function join_session(p_code text,p_name text,p_pin text) returns json language plpgsql security definer set search_path=public as $$
declare s sessions; f profiles; p players; v_n int; v_c jsonb; v_d float8;
begin
 f:=prof_get(p_name,p_pin);
 select * into s from sessions where code=p_code and state<>'finished' and not solo;
 if not found then return json_build_object('error','رمز اللعبة غير صحيح أو انتهت اللعبة'); end if;
 select * into p from players where session_id=s.id and name=f.name;
 if not found then
  select count(*) into v_n from players where session_id=s.id;
  v_d:=-(v_n/5)*75-(v_n%2)*35; v_c:=(f.garage->(f.sel::text))||jsonb_build_object('id',f.sel);
  insert into players(session_id,name,car,lane,d0,g0,t0,spd)
   values(s.id,f.name,v_c,v_n%5,v_d,v_d,case when s.state='lobby' then null else now_s() end,75+3*(v_c->>'e')::int+6*f.sel) returning * into p;
 end if;
 return json_build_object('pid',p.id,'sid',s.id,'name',p.name);
end $$;

create or replace function host_set(p_session uuid,p_state text,p_qi int) returns void language plpgsql security definer set search_path=public as $$
declare v_old text; v_t float8:=now_s();
begin
 select state into v_old from sessions where id=p_session and owner=auth.uid();
 if not found then raise exception 'غير مصرح'; end if;
 update sessions set state=p_state,qi=p_qi,started_at=case when p_state='question' then now() else started_at end where id=p_session;
 if v_old='lobby' and p_state='question' then update players set t0=v_t where session_id=p_session; end if;
 if p_state='finished' and v_old<>'finished' then
  update players set d0=ppos(d0,t0,spd,bu,su,sf,v_t)-g0,t0=v_t,spd=0,bu=0,su=0 where session_id=p_session;
  update profiles pf set coins=coins+b.bn from
   (select name,(array[300,200,100])[row_number() over(order by d0 desc)] bn from players where session_id=p_session order by d0 desc limit 3) b
   where pf.name=b.name;
 end if;
end $$;

-- الإجابة: في التدريب الفردي 5 عملات (حتى 100 يومياً) والنيترو للإجابة السريعة فقط
create or replace function submit_answer(p_player uuid,p_choice int,p_qi int,p_map int[] default null) returns json language plpgsql security definer set search_path=public as $$
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
  if s.solo then
   update profiles set solo_n=case when solo_day=current_date then solo_n else 0 end,solo_day=current_date where name=p.name;
   update profiles set coins=coins+least(5,greatest(0,100-solo_n)),solo_n=solo_n+least(5,greatest(0,100-solo_n)) where name=p.name;
  else
   update profiles set coins=coins+20 where name=p.name;
  end if;
  if v_rank<3 and (not s.solo or v_ms<r.secs*400) then
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
