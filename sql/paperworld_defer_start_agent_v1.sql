-- PAPERWORLD 2026-11-24: "one Developer at a time per repository".
-- The Task Engine waits at start_agent while another task of the same project
-- is still being worked on. That wait (a deferral) was only allowed for
-- await_agent/verify, so the waiting task was retried until it failed.
-- Allow start_agent too, but ONLY before its external effect exists (nothing
-- has been sent to GitHub yet). Everything else is unchanged.
create or replace function public.paperworld_v5_defer_task_step(p_step uuid, p_worker uuid, p_seconds integer, p_observation jsonb)
 returns boolean
 language plpgsql
 set search_path to 'public'
as $function$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare e public.paperworld_autonomous_effects_v5%rowtype;
begin
 if p_step is null or p_worker is null or p_seconds not between 60 and 3600 or
  p_observation is null or jsonb_typeof(p_observation)<>'object' or
  octet_length(p_observation::text)>4000 then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=p_step and lease_owner=p_worker
 and lease_expires_at>now() and state in ('leased','running') for update;
 if not found or s.capability not in ('start_agent','await_agent','verify') then return false; end if;
 select * into e from public.paperworld_autonomous_effects_v5
 where step_id=s.id for update;
 if found and not (s.capability='verify' and e.kind='dispatch_verify'
   and e.state='started') then return false; end if;
 update public.paperworld_autonomous_steps_v5
 set state='ready',attempts=greatest(0,attempts-1),
 run_after=now()+make_interval(secs=>p_seconds),
 output=p_observation,lease_owner=null,lease_expires_at=null
 where id=s.id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload,actor)
 values(s.mission_id,s.owner_id,s.id,'task_poll_deferred',
 jsonb_build_object('seconds',p_seconds,'capability',s.capability),'dispatcher');
 return true;
end $function$;
