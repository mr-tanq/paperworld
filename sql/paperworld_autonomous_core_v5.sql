-- V5 shared autonomous mission core. None of the tables trigger AI or
-- GitHub work. Roles are project-scoped. An authenticated user can propose
-- missions, but only the trusted backend may queue or execute work.
create table if not exists public.paperworld_autonomous_missions_v5 (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 thread_id uuid not null,
 project_id text not null check(project_id in ('listening','pokemon','studio','wellbeing')),
 goal text not null check(length(btrim(goal)) between 1 and 1200),
 status text not null default 'draft' check(status in
  ('draft','queued','running','needs_you','paused_budget','completed','failed','cancelled')),
 policy jsonb not null default '{}'::jsonb check(jsonb_typeof(policy)='object'),
 current_step integer not null default 0 check(current_step between 0 and 8),
 ai_calls_used integer not null default 0 check(ai_calls_used between 0 and 8),
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(thread_id,owner_id) references public.paperworld_agent_threads(id,owner_id),
 unique(id,owner_id)
);
create table if not exists public.paperworld_autonomous_steps_v5 (
 id uuid primary key default gen_random_uuid(),
 mission_id uuid not null,
 owner_id uuid not null,
 seq integer not null check(seq between 1 and 8),
 role_id text not null check(role_id in ('matt','listening-director','pokemon-director','studio-director','wellbeing-director','listening-developer','pokemon-developer','studio-creative','wellbeing-research')),
 capability text not null check(length(capability) between 1 and 60),
 state text not null default 'pending' check(state in
  ('pending','ready','leased','running','succeeded','retry_wait','failed','skipped')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 max_attempts integer not null default 2 check(max_attempts between 1 and 3),
 lease_owner uuid,
 lease_expires_at timestamptz,
 run_after timestamptz not null default now(),
 idempotency_key text not null check(length(idempotency_key) between 8 and 160),
 input jsonb not null default '{}'::jsonb check(jsonb_typeof(input)='object'),
 output jsonb not null default '{}'::jsonb check(jsonb_typeof(output)='object'),
 started_at timestamptz,
 finished_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(mission_id,owner_id) references public.paperworld_autonomous_missions_v5(id,owner_id) on delete cascade,
 unique(mission_id,seq),unique(owner_id,idempotency_key),
 check ((state in ('leased','running') and lease_owner is not null and lease_expires_at is not null)
  or (state not in ('leased','running') and lease_owner is null and lease_expires_at is null))
);
create table if not exists public.paperworld_autonomous_events_v5 (
 id bigint generated always as identity primary key,
 mission_id uuid not null,
 owner_id uuid not null,
 step_id uuid,
 event_type text not null check(length(event_type) between 1 and 64),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 occurred_at timestamptz not null default now(),
 foreign key(mission_id,owner_id) references public.paperworld_autonomous_missions_v5(id,owner_id) on delete cascade
);
create index if not exists autonomous_steps_dispatch_v5 on public.paperworld_autonomous_steps_v5(state,run_after)
 where state='ready';
create index if not exists autonomous_steps_lease_v5 on public.paperworld_autonomous_steps_v5(lease_expires_at)
 where state in ('leased','running');
create index if not exists autonomous_missions_owner_v5 on public.paperworld_autonomous_missions_v5(owner_id,created_at desc);
create index if not exists autonomous_events_mission_v5 on public.paperworld_autonomous_events_v5(mission_id,id);
alter table public.paperworld_autonomous_missions_v5 enable row level security;
alter table public.paperworld_autonomous_steps_v5 enable row level security;
alter table public.paperworld_autonomous_events_v5 enable row level security;
revoke all on public.paperworld_autonomous_missions_v5,public.paperworld_autonomous_steps_v5,public.paperworld_autonomous_events_v5 from anon,authenticated;
grant select on public.paperworld_autonomous_missions_v5,public.paperworld_autonomous_steps_v5,public.paperworld_autonomous_events_v5 to authenticated;
create policy autonomous_missions_read_v5 on public.paperworld_autonomous_missions_v5
 for select to authenticated using ((select auth.uid())=owner_id);
create policy autonomous_steps_read_v5 on public.paperworld_autonomous_steps_v5
 for select to authenticated using ((select auth.uid())=owner_id);
create policy autonomous_events_read_v5 on public.paperworld_autonomous_events_v5
 for select to authenticated using ((select auth.uid())=owner_id);
-- Atomic worker lease functions, callable only by service_role. No browser
-- grants, no untrusted SQL and no automatic retries or model calls.
create or replace function public.paperworld_v5_claim_step(p_worker uuid, p_lease_seconds integer default 600)
returns table(step_id uuid,mission_id uuid,owner_id uuid,role_id text,capability text,step_input jsonb,attempt_number integer)
language plpgsql security invoker set search_path=public
as $$
declare target public.paperworld_autonomous_steps_v5%rowtype;
begin
 if p_worker is null or p_lease_seconds<60 or p_lease_seconds>900 then
  raise exception 'invalid_worker_lease';
 end if;
 select s.* into target from public.paperworld_autonomous_steps_v5 s
 join public.paperworld_autonomous_missions_v5 m on m.id=s.mission_id
 where s.state='ready' and s.run_after<=now() and s.attempts<s.max_attempts
  and m.status in ('queued','running')
 order by s.run_after,s.created_at,s.id
 for update of s skip locked limit 1;
 if not found then return; end if;
 update public.paperworld_autonomous_steps_v5 s set
  state='leased',lease_owner=p_worker,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
  attempts=s.attempts+1,started_at=now()
 where s.id=target.id;
 update public.paperworld_autonomous_missions_v5 m set status='running',updated_at=now()
 where m.id=target.mission_id;
 insert into public.paperworld_autonomous_events_v5(mission_id,owner_id,step_id,event_type,payload)
 values(target.mission_id,target.owner_id,target.id,'step_leased',
  jsonb_build_object('attempt',target.attempts+1,'role',target.role_id));
 return query select target.id,target.mission_id,target.owner_id,target.role_id,
  target.capability,target.input,target.attempts+1;
end $$;
revoke all on function public.paperworld_v5_claim_step(uuid,integer) from public,anon,authenticated;
grant execute on function public.paperworld_v5_claim_step(uuid,integer) to service_role;
create or replace function public.paperworld_v5_complete_step(p_step uuid,p_worker uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare target public.paperworld_autonomous_steps_v5%rowtype;
begin
 if p_step is null or p_worker is null or p_result is null or
  jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>12000
 then return false; end if;
 select * into target from public.paperworld_autonomous_steps_v5
 where id=p_step and lease_owner=p_worker and state in ('leased','running')
  and lease_expires_at>now()
 for update;
 if not found then return false; end if;
 update public.paperworld_autonomous_steps_v5 set state='succeeded',output=p_result,
  lease_owner=null,lease_expires_at=null,finished_at=now()
 where id=p_step;
 insert into public.paperworld_autonomous_events_v5(mission_id,owner_id,step_id,event_type,payload)
 values(target.mission_id,target.owner_id,target.id,'step_succeeded',jsonb_build_object('attempt',target.attempts));
 return true;
end $$;
revoke all on function public.paperworld_v5_complete_step(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.paperworld_v5_complete_step(uuid,uuid,jsonb) to service_role;
create or replace function public.paperworld_v5_reclaim_expired()
returns integer language plpgsql security invoker set search_path=public
as $$
declare changed integer;
begin
 with recovered as (
  update public.paperworld_autonomous_steps_v5 s
  set state=case when s.attempts>=s.max_attempts then 'failed' else 'ready' end,
   run_after=now()+make_interval(secs=>least(1800,120*s.attempts)),
   lease_owner=null,lease_expires_at=null
  where s.state in ('leased','running') and s.lease_expires_at<now()
  returning s.id,s.mission_id,s.owner_id,s.attempts,s.state
 ), audit as (
  insert into public.paperworld_autonomous_events_v5(mission_id,owner_id,step_id,event_type,payload)
  select mission_id,owner_id,id,'step_lease_expired',jsonb_build_object('attempt',attempts,'new_state',state)
  from recovered returning id
 )
 select count(*) into changed from audit;
 return changed;
end $$;
revoke all on function public.paperworld_v5_reclaim_expired() from public,anon,authenticated;
grant execute on function public.paperworld_v5_reclaim_expired() to service_role;
