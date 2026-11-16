-- Dispatch v1: safely prove offline progress without misreporting simulation
-- as real AI or GitHub work. One explicit simulation step per cron tick.
create or replace function public.paperworld_v5_run_simulation_once()
returns jsonb language plpgsql security invoker set search_path=public
as $$
declare
 s public.paperworld_autonomous_steps_v5%rowtype;
 worker uuid:=gen_random_uuid();
 key text;
 reserved text;
begin
 select step.* into s from public.paperworld_autonomous_steps_v5 step
 join public.paperworld_autonomous_missions_v5 mission
  on mission.id=step.mission_id and mission.owner_id=step.owner_id
 where step.state='ready' and step.run_after<=now()
   and step.capability='dry_run'
   and step.attempts<step.max_attempts
   and mission.status in ('queued','running')
   and mission.policy->>'executionMode'='simulation'
   and step.input->>'simulation'='true'
   and not exists (select 1 from public.paperworld_autonomous_effects_v5 ef
     where ef.step_id=step.id)
   and not exists(select 1 from public.paperworld_autonomous_steps_v5 earlier
     where earlier.mission_id=step.mission_id and earlier.seq<step.seq
       and earlier.state not in ('succeeded','skipped'))
 order by step.run_after,step.created_at for update of step skip locked limit 1;
 if not found then return '{"status":"idle","simulated":true}'::jsonb; end if;
 update public.paperworld_autonomous_steps_v5 set
  state='leased',lease_owner=worker,lease_expires_at=now()+interval '10 minutes',
  attempts=attempts+1,started_at=now()
 where id=s.id;
 update public.paperworld_autonomous_missions_v5
 set status='running',updated_at=now() where id=s.mission_id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(s.mission_id,s.owner_id,s.id,'step_leased',
  '{"simulation":true,"source":"cron"}'::jsonb);
 key:='simulation:'||s.id::text;
 reserved:=public.paperworld_v5_begin_effect(s.id,worker,key,'dry_run','dry_run');
 if reserved<>'reserved' then
  perform public.paperworld_v5_fail_step(s.id,worker,'simulation_dispatch_refused',false);
  return jsonb_build_object('status','blocked','simulated',true);
 end if;
 if not public.paperworld_v5_confirm_effect(key,worker,
  '{"simulation":true,"externalCalls":0}'::jsonb,true) then
  raise exception 'simulation_effect_confirmation_failed';
 end if;
 if not public.paperworld_v5_complete_step(s.id,worker,
  '{"simulation":true,"performedRealWork":false,"externalCalls":0}'::jsonb)
 then raise exception 'simulation_completion_failed'; end if;
 return jsonb_build_object('status','simulation_completed',
  'missionId',s.mission_id,'simulated',true,'aiCalls',0);
end $$;
revoke all on function public.paperworld_v5_run_simulation_once()
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_run_simulation_once() to service_role;


create or replace function public.paperworld_v5_controller_tick()
returns jsonb
language plpgsql security invoker set search_path=public
as $$
declare
  recovered int:=0;
  ready_count int:=0;
  blocked_count int:=0;
  simulation_result jsonb;
begin
  -- Only one database supervisor tick may run at a time.
  if not pg_try_advisory_xact_lock(534128, 5) then
    return jsonb_build_object('skipped','concurrent');
  end if;
  recovered:=public.paperworld_v5_reclaim_expired();
  simulation_result:=public.paperworld_v5_run_simulation_once();

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
    'aiCalls',0,'externalActions',0,
    'simulation',simulation_result);
end $$;
