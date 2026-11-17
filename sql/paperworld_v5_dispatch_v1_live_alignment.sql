-- Corrects first live dry-run migration before any missions are queued.
alter table public.paperworld_autonomous_effects_v5 drop constraint paperworld_autonomous_effects_v5_check;
alter table public.paperworld_autonomous_effects_v5 add constraint paperworld_autonomous_effects_v5_check check(
(adapter='dry_run' and kind='dry_run' and sessions=0)
or (adapter='copilot_agent' and kind='start_agent' and sessions=1)
or (adapter='copilot_agent' and kind='dispatch_verify' and sessions=0));

create or replace function public.paperworld_v5_claim_step(
 p_worker uuid,p_lease_seconds integer default 600)
returns table(step_id uuid,mission_id uuid,owner_id uuid,
 role_id text,capability text,step_input jsonb,attempt_number integer)
language plpgsql security invoker set search_path=public
as $$
declare target public.paperworld_autonomous_steps_v5%rowtype;
begin
 if p_worker is null or p_lease_seconds<60 or p_lease_seconds>900 then
  raise exception 'invalid_worker_lease';
 end if;
 select s.* into target
 from public.paperworld_autonomous_steps_v5 s
 join public.paperworld_autonomous_missions_v5 m
   on m.id=s.mission_id and m.owner_id=s.owner_id
 where s.state='ready' and s.run_after<=now()
  and s.attempts<s.max_attempts and m.status in ('queued','running')
  and not exists (select 1 from public.paperworld_autonomous_steps_v5 earlier
    where earlier.mission_id=s.mission_id and earlier.seq<s.seq
      and earlier.state not in ('succeeded','skipped'))
  and not exists (select 1 from public.paperworld_autonomous_steps_v5 active
    where active.mission_id=s.mission_id and active.id<>s.id
      and active.state in ('leased','running'))
  and not exists (select 1 from public.paperworld_autonomous_effects_v5 e
    where e.step_id=s.id)
 order by s.run_after,s.created_at,s.id
 for update of s,m skip locked limit 1;
 if not found then return; end if;
 update public.paperworld_autonomous_steps_v5 s set state='leased',
  lease_owner=p_worker,
  lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
  attempts=s.attempts+1,started_at=now()
 where s.id=target.id;
 update public.paperworld_autonomous_missions_v5 m
 set status='running',updated_at=now() where m.id=target.mission_id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(target.mission_id,target.owner_id,target.id,'step_leased',
  jsonb_build_object('attempt',target.attempts+1,'role',target.role_id));
 return query select target.id,target.mission_id,target.owner_id,
  target.role_id,target.capability,target.input,target.attempts+1;
end $$;

create or replace function public.paperworld_v5_complete_step(
 p_step uuid,p_worker uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare promoted int;
begin
 if p_step is null or p_worker is null or p_result is null
  or jsonb_typeof(p_result)<>'object' or
  octet_length(p_result::text)>12000 then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=p_step and lease_owner=p_worker and state in ('leased','running')
  and lease_expires_at>now() for update;
 if not found then return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=s.mission_id for update;
 if m.status not in ('queued','running') then return false; end if;
 if exists (select 1 from public.paperworld_autonomous_effects_v5 e
   where e.step_id=s.id and e.state<>'done') then return false; end if;
 update public.paperworld_autonomous_steps_v5
 set state='succeeded',output=p_result,lease_owner=null,
 lease_expires_at=null,finished_at=now() where id=s.id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(s.mission_id,s.owner_id,s.id,'step_succeeded',
  jsonb_build_object('attempt',s.attempts,
  'simulation',coalesce((m.policy->>'executionMode')='simulation',false)));
 update public.paperworld_autonomous_steps_v5 next
 set state='ready',run_after=now()
 where next.id=(select id from public.paperworld_autonomous_steps_v5
  where mission_id=s.mission_id and state='pending'
    and seq>s.seq order by seq limit 1);
 get diagnostics promoted=row_count;
 if promoted=0 and not exists (
  select 1 from public.paperworld_autonomous_steps_v5
  where mission_id=s.mission_id and state not in ('succeeded','skipped'))
 then
  update public.paperworld_autonomous_missions_v5
   set status='completed',updated_at=now(),current_step=s.seq
   where id=s.mission_id;
  insert into public.paperworld_autonomous_events_v5
   (mission_id,owner_id,event_type,payload)
  values(s.mission_id,s.owner_id,'mission_completed',
   jsonb_build_object('simulation',
    coalesce((m.policy->>'executionMode')='simulation',false)));
 else
  update public.paperworld_autonomous_missions_v5
    set current_step=s.seq,updated_at=now() where id=s.mission_id;
 end if;
 return true;
end $$;

create or replace function public.paperworld_v5_begin_effect(
 p_step uuid,p_worker uuid,p_key text,p_adapter text,p_kind text)
returns text language plpgsql security invoker set search_path=public
as $$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare conf public.paperworld_autonomous_controller_v5%rowtype;
declare sessions int:=case when p_adapter='copilot_agent' and p_kind='start_agent' then 1 else 0 end;
declare daily int;declare monthly int;declare per_mission int;
begin
 if p_step is null or p_worker is null or
  p_key is null or length(p_key) not between 8 and 160 or
  p_adapter not in ('copilot_agent','dry_run') or
  (p_adapter='copilot_agent' and p_kind not in ('start_agent','dispatch_verify')) or
  (p_adapter='dry_run' and p_kind<>'dry_run')
 then return 'denied'; end if;
 select * into s from public.paperworld_autonomous_steps_v5
  where id=p_step and lease_owner=p_worker and
  state in ('leased','running') and lease_expires_at>now()
  for update;
 if not found then return 'denied'; end if;
 select * into m from public.paperworld_autonomous_missions_v5
  where id=s.mission_id for update;
 select * into conf from public.paperworld_autonomous_controller_v5
  where singleton=true for update;
 if not found or m.status not in ('queued','running') then return 'denied'; end if;
 if p_adapter='copilot_agent' and conf.dispatch_enabled is not true then return 'denied'; end if;
 if exists(select 1 from public.paperworld_autonomous_effects_v5
    where step_id=s.id or effect_key=p_key) then return 'uncertain'; end if;
 if p_adapter='copilot_agent' then
  if not p_adapter=any(conf.live_adapters) or
   m.project_id not in ('pokemon','listening') or
   s.capability not in ('start_agent','dispatch_verify') or
   conf.credit_snapshot is null or conf.credit_snapshot_at is null or
   conf.credit_snapshot>=conf.credit_stop_at or
   conf.credit_snapshot_at<now()-interval '24 hours'
  then
   update public.paperworld_autonomous_missions_v5 set
    status='paused_budget',updated_at=now() where id=m.id;
   return 'budget_denied';
  end if;
  select count(*) into daily from public.paperworld_autonomous_effects_v5
   where sessions=1 and state<>'denied'
    and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  select count(*) into monthly from public.paperworld_autonomous_effects_v5
   where sessions=1 and state<>'denied'
    and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  select count(*) into per_mission from public.paperworld_autonomous_effects_v5
   where mission_id=m.id and sessions=1 and state<>'denied';
  if daily>=conf.sessions_per_day or monthly>=conf.sessions_per_month
   or per_mission>=conf.sessions_per_mission or
   m.ai_calls_used>=coalesce((m.policy->>'maxAiCalls')::integer,0)
  then
   update public.paperworld_autonomous_missions_v5 set
     status='paused_budget',updated_at=now() where id=m.id;
   return 'budget_denied';
  end if;
 else
  if coalesce((m.policy->>'executionMode'),'')<>'simulation' or
   s.capability<>'dry_run' or s.input->>'simulation'<>'true'
  then return 'denied'; end if;
 end if;
 insert into public.paperworld_autonomous_effects_v5
 (effect_key,step_id,mission_id,owner_id,adapter,kind,state,sessions)
 values(p_key,s.id,s.mission_id,s.owner_id,p_adapter,p_kind,'intent',sessions);
 if sessions=1 then
  update public.paperworld_autonomous_missions_v5
   set ai_calls_used=ai_calls_used+1,updated_at=now() where id=m.id;
 end if;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(s.mission_id,s.owner_id,s.id,'effect_intent',
  jsonb_build_object('effectKey',p_key,'adapter',p_adapter,'sessions',sessions));
 return 'reserved';
end $$;
