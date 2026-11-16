-- V5 safe autonomous supervisor: PostgreSQL-only. No OAuth, API calls,
-- AI model usage, spending, repository writes, or unreviewed tasks.
-- Supabase Cron executes this function every five minutes while DB is active.
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.paperworld_autonomous_controller_v5 (
 singleton boolean primary key default true check(singleton=true),
 last_tick_at timestamptz,
 tick_count bigint not null default 0 check(tick_count>=0),
 recovered_steps bigint not null default 0 check(recovered_steps>=0),
 ready_steps integer not null default 0 check(ready_steps>=0),
 waiting_missions integer not null default 0 check(waiting_missions>=0),
 last_error text
);
alter table public.paperworld_autonomous_controller_v5 enable row level security;
revoke all on public.paperworld_autonomous_controller_v5 from anon,authenticated;
insert into public.paperworld_autonomous_controller_v5(singleton) values(true)
on conflict(singleton) do nothing;

-- This helper is deliberately INVOKER and inaccessible to browser roles.
-- An expired lease is reclaimed by the existing audited replay function.
-- Exhausted work is moved to needs_you, NEVER restarted or treated as done.
create or replace function public.paperworld_v5_controller_tick()
returns jsonb
language plpgsql security invoker set search_path=public
as $$
declare
  recovered int:=0;
  ready_count int:=0;
  blocked_count int:=0;
begin
  -- Only one database supervisor tick may run at a time.
  if not pg_try_advisory_xact_lock(534128, 5) then
    return jsonb_build_object('skipped','concurrent');
  end if;
  recovered:=public.paperworld_v5_reclaim_expired();

  with affected as (
    update public.paperworld_autonomous_missions_v5 m
    set status='needs_you',
      last_error='worker_attempts_exhausted',
      updated_at=now()
    where m.status in ('queued','running')
      and exists (
        select 1 from public.paperworld_autonomous_steps_v5 s
        where s.mission_id=m.id and s.owner_id=m.owner_id
          and s.state='failed' and s.attempts>=s.max_attempts
      )
    returning m.id,m.owner_id
  )
  insert into public.paperworld_autonomous_events_v5(
    mission_id,owner_id,event_type,payload)
  select id,owner_id,'mission_needs_you',
     '{"reason":"worker_attempts_exhausted"}'::jsonb from affected;

  select count(*) into ready_count
  from public.paperworld_autonomous_steps_v5 s
  join public.paperworld_autonomous_missions_v5 m
    on m.id=s.mission_id and m.owner_id=s.owner_id
  where s.state='ready' and s.run_after<=now()
    and s.attempts<s.max_attempts
    and m.status in ('queued','running');

  select count(*) into blocked_count
  from public.paperworld_autonomous_missions_v5
  where status in ('needs_you','paused_budget');

  update public.paperworld_autonomous_controller_v5 set
    last_tick_at=now(),
    tick_count=tick_count+1,
    recovered_steps=recovered_steps+recovered,
    ready_steps=ready_count,
    waiting_missions=blocked_count,
    last_error=null
  where singleton=true;

  return jsonb_build_object('recovered',recovered,
    'ready',ready_count,'waiting',blocked_count,
    'aiCalls',0,'externalActions',0);
end $$;

revoke all on function public.paperworld_v5_controller_tick()
  from public,anon,authenticated;
grant execute on function public.paperworld_v5_controller_tick() to service_role;

-- A named job is deliberately idempotent. Cron performs DB housekeeping,
-- but DOES NOT take work or invoke a paid/unverified execution connector.
select cron.schedule(
 'paperworld-v5-safe-controller',
 '*/5 * * * *',
 'select public.paperworld_v5_controller_tick()'
);
