-- DISPATCH V1: guarded mission lifecycle and irreversible external effect outbox.
-- Every function runs as INVOKER, granted only to service_role. NO model
-- execution or paid provider is enabled by this migration.
alter table public.paperworld_autonomous_controller_v5
 add column if not exists dispatch_enabled boolean not null default false,
 add column if not exists live_adapters text[] not null default '{}'::text[],
 add column if not exists sessions_per_day integer not null default 1,
 add column if not exists sessions_per_month integer not null default 10,
 add column if not exists sessions_per_mission integer not null default 1,
 add column if not exists credit_snapshot integer,
 add column if not exists credit_snapshot_at timestamptz,
 add column if not exists credit_stop_at integer not null default 1050;
alter table public.paperworld_autonomous_controller_v5
 add constraint pw_v5_budget_limits check (
  sessions_per_day between 0 and 10 and sessions_per_month between 0 and 100
  and sessions_per_mission between 0 and 3
  and credit_stop_at between 0 and 1500
  and (credit_snapshot is null or credit_snapshot between 0 and 150000));
-- No activation in migration, including during redeploy.
update public.paperworld_autonomous_controller_v5
set dispatch_enabled=false,live_adapters='{}'::text[];

create table if not exists public.paperworld_autonomous_effects_v5 (
 effect_key text primary key check(length(effect_key) between 8 and 160),
 step_id uuid not null references public.paperworld_autonomous_steps_v5(id) on delete cascade,
 mission_id uuid not null,
 owner_id uuid not null,
 adapter text not null check(adapter in ('copilot_agent','dry_run')),
 kind text not null check(kind in ('start_agent','dispatch_verify','dry_run')),
 state text not null default 'intent'
  check(state in ('intent','started','done','uncertain','denied')),
 external_ref jsonb not null default '{}'::jsonb check(jsonb_typeof(external_ref)='object'),
 sessions integer not null check(sessions in (0,1)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(mission_id,owner_id) references public.paperworld_autonomous_missions_v5(id,owner_id)
  on delete cascade,
 unique(step_id,kind),
 check ((adapter='dry_run' and kind='dry_run' and sessions=0)
   or (adapter='copilot_agent' and kind='start_agent' and sessions=1)
   or (adapter='copilot_agent' and kind='dispatch_verify' and sessions=0))
);
create index if not exists pw_effects_mission_v5
 on public.paperworld_autonomous_effects_v5(mission_id,created_at);
create index if not exists pw_effects_budget_v5
 on public.paperworld_autonomous_effects_v5(created_at)
 where sessions=1 and state<>'denied';
alter table public.paperworld_autonomous_effects_v5 enable row level security;
revoke all on public.paperworld_autonomous_effects_v5 from anon,authenticated;
grant select on public.paperworld_autonomous_effects_v5 to authenticated;
create policy pw_effect_owner_read_v5 on public.paperworld_autonomous_effects_v5
 for select to authenticated using ((select auth.uid())=owner_id);

-- No arbitrary JSON plans can grant execution: trusted server chooses fixed
-- deterministic template. The simulated path NEVER claims to do real work.
create or replace function public.paperworld_v5_queue_mission(
 p_mission uuid,p_mode text default 'simulation')
returns boolean language plpgsql security invoker set search_path=public
as $$
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare role text;
begin
 if p_mode<>'simulation' then return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=p_mission for update;
 if not found or m.status<>'draft' or
  coalesce((m.policy->>'maxAiCalls')::integer,-1)<>0 or
  coalesce((m.policy->>'additionalSpendUsd')::numeric,-1)<>0
 then return false; end if;
 role:=case m.project_id
  when 'pokemon' then 'pokemon-director'
  when 'listening' then 'listening-director'
  when 'studio' then 'studio-director'
  when 'wellbeing' then 'wellbeing-director'
  else null end;
 if role is null then return false; end if;
 insert into public.paperworld_autonomous_steps_v5
 (mission_id,owner_id,seq,role_id,capability,state,
  idempotency_key,input,max_attempts)
 values(p_mission,m.owner_id,1,role,'dry_run','ready',
  'sim:'||m.id::text||':1',
  jsonb_build_object('simulation',true,'goal',m.goal,'project',m.project_id),2);
 update public.paperworld_autonomous_missions_v5 set
  status='queued',updated_at=now(),policy=m.policy||
   '{"executionMode":"simulation"}'::jsonb
 where id=p_mission;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,event_type,payload)
 values(p_mission,m.owner_id,'mission_queued',
  '{"simulation":true,"aiCalls":0}'::jsonb);
 return true;
end $$;

-- Strict seq ordering and single active step per mission.
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

create or replace function public.paperworld_v5_heartbeat(
 p_step uuid,p_worker uuid,p_lease_seconds integer default 600)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare count_updated int;
begin
 if p_step is null or p_worker is null or
  p_lease_seconds<60 or p_lease_seconds>900 then return false; end if;
 update public.paperworld_autonomous_steps_v5
  set lease_expires_at=now()+make_interval(secs=>p_lease_seconds)
 where id=p_step and lease_owner=p_worker
  and lease_expires_at>now() and state in ('leased','running');
 get diagnostics count_updated=row_count;
 return count_updated=1;
end $$;

create or replace function public.paperworld_v5_defer_step(
 p_step uuid,p_worker uuid,p_seconds integer default 300)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare s public.paperworld_autonomous_steps_v5%rowtype;
begin
 if p_step is null or p_worker is null or
  p_seconds<60 or p_seconds>3600 then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=p_step and lease_owner=p_worker
 and lease_expires_at>now() and state in ('leased','running') for update;
 if not found then return false; end if;
 -- A started or uncertain side effect can never become executable again.
 if exists(select 1 from public.paperworld_autonomous_effects_v5
  where step_id=p_step) then return false; end if;
 update public.paperworld_autonomous_steps_v5
  set state='ready',attempts=greatest(0,attempts-1),
   run_after=now()+make_interval(secs=>p_seconds),
   lease_owner=null,lease_expires_at=null
 where id=p_step;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(s.mission_id,s.owner_id,s.id,'step_deferred',
  jsonb_build_object('seconds',p_seconds));
 return true;
end $$;

create or replace function public.paperworld_v5_fail_step(
 p_step uuid,p_worker uuid,p_reason text,p_retryable boolean default false)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare retry boolean;
begin
 if p_step is null or p_worker is null or
  p_reason is null or length(p_reason) not between 1 and 160 then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=p_step and lease_owner=p_worker
  and lease_expires_at>now() and state in ('leased','running') for update;
 if not found then return false; end if;
 retry:=coalesce(p_retryable,false) and s.attempts<s.max_attempts
  and not exists(select 1 from public.paperworld_autonomous_effects_v5
   where step_id=p_step);
 update public.paperworld_autonomous_steps_v5
 set state=case when retry then 'ready' else 'failed' end,
  run_after=now()+make_interval(secs=>least(1800,120*s.attempts)),
  lease_owner=null,lease_expires_at=null,finished_at=case when retry then null else now() end
 where id=p_step;
 if not retry then
  update public.paperworld_autonomous_missions_v5 set
   status='needs_you',last_error=left(p_reason,160),updated_at=now()
  where id=s.mission_id;
 end if;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(s.mission_id,s.owner_id,s.id,'step_failed',
  jsonb_build_object('retry',retry,'reason',p_reason));
 return true;
end $$;

-- Budget and external-side-effect intent are inserted ATOMICALLY.
-- IMPORTANT: uncertain or intent effects NEVER allow a second provider call.
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

create or replace function public.paperworld_v5_confirm_effect(
 p_key text,p_worker uuid,p_reference jsonb,p_done boolean default true)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare e public.paperworld_autonomous_effects_v5%rowtype;
declare s public.paperworld_autonomous_steps_v5%rowtype;
begin
 if p_worker is null or p_reference is null or
  jsonb_typeof(p_reference)<>'object' or
  octet_length(p_reference::text)>4000 then return false; end if;
 select * into e from public.paperworld_autonomous_effects_v5
  where effect_key=p_key and state in ('intent','started','uncertain') for update;
 if not found then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
  where id=e.step_id and lease_owner=p_worker and
   state in ('leased','running') and lease_expires_at>now() for update;
 if not found then return false; end if;
 update public.paperworld_autonomous_effects_v5 set
  state=case when p_done then 'done' else 'started' end,
  external_ref=p_reference,updated_at=now() where effect_key=p_key;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(e.mission_id,e.owner_id,e.step_id,'effect_confirmed',
  jsonb_build_object('effectKey',e.effect_key,'done',p_done));
 return true;
end $$;

-- Uncertain status is NOT a retry. It always leads to inspection or
-- trusted reconciliation, never to a second start operation.
create or replace function public.paperworld_v5_reclaim_expired()
returns integer language plpgsql security invoker set search_path=public
as $$
declare changed int;
begin
 with recovered as (
  update public.paperworld_autonomous_steps_v5 s
  set state=case
   when exists(select 1 from public.paperworld_autonomous_effects_v5 e
     where e.step_id=s.id) then 'failed'
   when s.attempts>=s.max_attempts then 'failed'
   else 'ready' end,
   run_after=now()+make_interval(secs=>least(1800,120*s.attempts)),
   lease_owner=null,lease_expires_at=null,finished_at=case when
     s.attempts>=s.max_attempts or exists(select 1
       from public.paperworld_autonomous_effects_v5 e where e.step_id=s.id)
     then now() else null end
  where s.state in ('leased','running') and s.lease_expires_at<now()
  returning s.id,s.mission_id,s.owner_id,s.attempts,s.state
 ), uncertain as (
  update public.paperworld_autonomous_effects_v5 e
  set state='uncertain',updated_at=now()
  where e.step_id in (select id from recovered) and
   e.state in ('intent','started')
  returning e.step_id
 ), blocked as (
  update public.paperworld_autonomous_missions_v5 m
  set status='needs_you',last_error='effect_requires_reconciliation',
   updated_at=now()
  where m.id in (select mission_id from recovered where state='failed')
   and m.status in ('queued','running')
  returning m.id
 ), audit as (
  insert into public.paperworld_autonomous_events_v5
  (mission_id,owner_id,step_id,event_type,payload)
  select mission_id,owner_id,id,'step_lease_expired',
   jsonb_build_object('attempt',attempts,'new_state',state,
    'reconciliationRequired',exists(select 1
      from public.paperworld_autonomous_effects_v5 e
      where e.step_id=recovered.id))
  from recovered returning id
 )
 select count(*) into changed from audit;
 return changed;
end $$;

-- Never return browser authority through a PUBLIC EXECUTE grant.
revoke all on function public.paperworld_v5_queue_mission(uuid,text),
 public.paperworld_v5_claim_step(uuid,integer),
 public.paperworld_v5_complete_step(uuid,uuid,jsonb),
 public.paperworld_v5_heartbeat(uuid,uuid,integer),
 public.paperworld_v5_defer_step(uuid,uuid,integer),
 public.paperworld_v5_fail_step(uuid,uuid,text,boolean),
 public.paperworld_v5_begin_effect(uuid,uuid,text,text,text),
 public.paperworld_v5_confirm_effect(text,uuid,jsonb,boolean),
 public.paperworld_v5_reclaim_expired()
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_queue_mission(uuid,text),
 public.paperworld_v5_claim_step(uuid,integer),
 public.paperworld_v5_complete_step(uuid,uuid,jsonb),
 public.paperworld_v5_heartbeat(uuid,uuid,integer),
 public.paperworld_v5_defer_step(uuid,uuid,integer),
 public.paperworld_v5_fail_step(uuid,uuid,text,boolean),
 public.paperworld_v5_begin_effect(uuid,uuid,text,text,text),
 public.paperworld_v5_confirm_effect(text,uuid,jsonb,boolean),
 public.paperworld_v5_reclaim_expired() to service_role;
