-- V1 execution functions, additive to paperworld_v5_task_engine_v1.sql.
-- Not applied to production before a full offline integration pass.
alter table public.paperworld_autonomous_effects_v5
 drop constraint if exists paperworld_autonomous_effects_v5_kind_check;
alter table public.paperworld_autonomous_effects_v5
 add constraint paperworld_autonomous_effects_v5_kind_check
 check(kind in ('create_issue','start_agent','dispatch_verify','dry_run'));
alter table public.paperworld_autonomous_effects_v5
 drop constraint if exists paperworld_autonomous_effects_v5_check;
alter table public.paperworld_autonomous_effects_v5
 add constraint paperworld_autonomous_effects_v5_check
 check ((adapter='dry_run' and kind='dry_run' and sessions=0)
 or (adapter='copilot_agent' and kind='start_agent' and sessions=1)
 or (adapter='copilot_agent' and kind in ('create_issue','dispatch_verify') and sessions=0));

-- An uncertain external call is never retried just because a lease ends.
-- The next dispatcher invocation inspects GitHub evidence first.
create or replace function public.paperworld_v5_mark_task_uncertain(
 p_key text,p_worker uuid,p_reason text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare e public.paperworld_autonomous_effects_v5%rowtype;
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
begin
 if p_key is null or p_worker is null or
  p_reason is null or length(p_reason) not between 5 and 100 then return false; end if;
 select * into e from public.paperworld_autonomous_effects_v5
 where effect_key=p_key and state in ('intent','started') for update;
 if not found then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=e.step_id and lease_owner=p_worker
  and state in ('leased','running') and lease_expires_at>now() for update;
 if not found then return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=e.mission_id and engine='v1' for update;
 if not found or s.mission_id<>m.id then return false; end if;
 update public.paperworld_autonomous_effects_v5
 set state='uncertain',updated_at=now() where effect_key=p_key;
 update public.paperworld_autonomous_steps_v5
 set state='failed',lease_owner=null,lease_expires_at=null,
  finished_at=now() where id=s.id;
 update public.paperworld_autonomous_missions_v5
 set status='working',last_error='external_result_unconfirmed',
  updated_at=now() where id=m.id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload,actor)
 values(m.id,m.owner_id,s.id,'task_effect_uncertain',
  jsonb_build_object('effectKey',p_key,'reason',p_reason,
   'neverRepeatCall',true),'dispatcher');
 return true;
end $$;
revoke all on function public.paperworld_v5_mark_task_uncertain(text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_mark_task_uncertain(text,uuid,text)
 to service_role;

create or replace function public.paperworld_v5_reconcile_task_effect(
 p_key text,p_outcome text,p_evidence jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
declare e public.paperworld_autonomous_effects_v5%rowtype;
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
begin
 if p_key is null or p_outcome not in ('confirmed','unresolved') or
  p_evidence is null or jsonb_typeof(p_evidence)<>'object' or
  octet_length(p_evidence::text)>2500 then return false; end if;
 select * into e from public.paperworld_autonomous_effects_v5
 where effect_key=p_key and adapter='copilot_agent' and
  state in ('uncertain','started') for update;
 if not found then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=e.step_id for update;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=e.mission_id and engine='v1' for update;
 if not found or m.status not in ('working','needs_you','queued','running') or
   s.state not in ('failed','ready','leased') or s.mission_id<>m.id
 then return false; end if;
 if p_outcome='unresolved' then
  update public.paperworld_autonomous_effects_v5
  set reconcile_attempts=reconcile_attempts+1,updated_at=now()
  where effect_key=p_key and reconcile_attempts<6;
  if e.reconcile_attempts>=5 then
   update public.paperworld_autonomous_missions_v5
    set status='needs_you',last_error='external_effect_unconfirmed',
    updated_at=now() where id=m.id;
  end if;
  return false;
 end if;
 -- Caller must have fetched the positive evidence from the allowlisted repo.
 -- 'absent' is NEVER sufficient to confirm a paid Copilot start.
 if p_evidence->>'proof' not in ('issue_marker_and_number','issue_marker_and_copilot_assignee',
  'trusted_workflow_run_id') or
  (e.kind='start_agent' and
   p_evidence->>'proof'<>'issue_marker_and_copilot_assignee') or
  (e.kind='create_issue' and
   p_evidence->>'proof'<>'issue_marker_and_number') or
  (e.kind='dispatch_verify' and
   p_evidence->>'proof'<>'trusted_workflow_run_id') or
  length(coalesce(p_evidence->>'externalId','')) not between 1 and 80
 then return false; end if;
 update public.paperworld_autonomous_effects_v5
 set state='done',evidence=p_evidence,external_id=p_evidence->>'externalId',
 external_url=p_evidence->>'externalUrl',confirmed_at=now(),updated_at=now()
 where effect_key=p_key;
 update public.paperworld_autonomous_steps_v5
 set state='succeeded',output=p_evidence,lease_owner=null,
 lease_expires_at=null,finished_at=now() where id=s.id;
 update public.paperworld_autonomous_steps_v5 next
 set state='ready',run_after=now()
 where id=(select id from public.paperworld_autonomous_steps_v5
  where mission_id=m.id and seq>s.seq and state='pending'
   order by seq limit 1);
 update public.paperworld_autonomous_missions_v5
 set status='working',last_error=null,current_step=s.seq,updated_at=now()
 where id=m.id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload,actor)
 values(m.id,m.owner_id,s.id,'task_effect_reconciled',
  jsonb_build_object('effectKey',p_key,'kind',e.kind,
   'neverRetried',true),'dispatcher');
 return true;
end $$;
revoke all on function public.paperworld_v5_reconcile_task_effect(text,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_reconcile_task_effect(text,text,jsonb)
 to service_role;

-- Task polls may defer after a confirmed verification dispatch, never after
-- an uncertain Copilot assignment. The verification run itself is not retried.
create or replace function public.paperworld_v5_defer_task_step(
 p_step uuid,p_worker uuid,p_seconds integer,p_observation jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare e public.paperworld_autonomous_effects_v5%rowtype;
begin
 if p_step is null or p_worker is null or p_seconds not between 60 and 3600 or
  p_observation is null or jsonb_typeof(p_observation)<>'object' or
  octet_length(p_observation::text)>4000 then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=p_step and lease_owner=p_worker
 and lease_expires_at>now() and state in ('leased','running') for update;
 if not found or s.capability not in ('await_agent','verify') then return false; end if;
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
end $$;
revoke all on function public.paperworld_v5_defer_task_step(uuid,uuid,integer,jsonb)
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_defer_task_step(uuid,uuid,integer,jsonb)
 to service_role;

-- Generic task step lifecycle. Completion is intentionally gated;
-- it cannot be reached by the old pilot completion path.
create or replace function public.paperworld_v5_finish_task_step(
 p_step uuid,p_worker uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare e public.paperworld_autonomous_effects_v5%rowtype;
declare previous jsonb;
declare next_seq int;
declare next_status text;
begin
 if p_step is null or p_worker is null or p_result is null or
  jsonb_typeof(p_result)<>'object' or
  octet_length(p_result::text)>8000 then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=p_step and lease_owner=p_worker and
 state in ('leased','running') and lease_expires_at>now() for update;
 if not found then return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=s.mission_id and engine='v1' for update;
 if not found or m.status not in ('queued','running','working','verifying') then
  return false; end if;
 if s.capability in ('create_issue','start_agent') then
  select * into e from public.paperworld_autonomous_effects_v5
   where step_id=s.id and state='done';
  if not found or (s.capability='start_agent' and e.sessions<>1)
   then return false; end if;
 elsif s.capability='await_agent' then
  if p_result->>'completion' not in ('trusted_signal','conservative_fallback') or
    p_result->>'stableHead' is distinct from 'true' or
    p_result->>'headSha' !~ '^[a-f0-9]{40}$' then return false; end if;
 elsif s.capability='verify' then
  select * into e from public.paperworld_autonomous_effects_v5
   where step_id=s.id and kind='dispatch_verify' and state='done';
  if not found or p_result->>'verification' is distinct from 'trusted' or
    p_result->>'headSha' !~ '^[a-f0-9]{40}$' or
    length(coalesce(p_result->>'runId',''))<1
  then return false; end if;
 elsif s.capability='report' then
  select output into previous from public.paperworld_autonomous_steps_v5
  where mission_id=m.id and capability='verify' and state='succeeded';
  if previous->>'verification' is distinct from 'trusted' or
   previous->>'headSha' is distinct from p_result->>'headSha' or
   p_result->>'headStillCurrent' is distinct from 'true'
  then return false; end if;
 else return false; end if;
 update public.paperworld_autonomous_steps_v5
 set state='succeeded',output=p_result,lease_owner=null,
 lease_expires_at=null,finished_at=now() where id=s.id;
 update public.paperworld_autonomous_steps_v5 next
 set state='ready',run_after=now()
 where id=(select id from public.paperworld_autonomous_steps_v5
 where mission_id=m.id and seq>s.seq and state='pending'
  order by seq limit 1);
 next_status:=case when s.capability='await_agent' then 'verifying'
  when s.capability='report' then 'completed' else 'working' end;
 update public.paperworld_autonomous_missions_v5
 set status=next_status,current_step=s.seq,updated_at=now(),
 report=case when s.capability='report' then p_result else report end
 where id=m.id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload,actor)
 values(m.id,m.owner_id,s.id,
  case when s.capability='report' then 'task_completed' else 'task_step_done' end,
  jsonb_build_object('step',s.capability),'dispatcher');
 return true;
end $$;
revoke all on function public.paperworld_v5_finish_task_step(uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_finish_task_step(uuid,uuid,jsonb)
 to service_role;
