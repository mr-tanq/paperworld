-- V1 crash recovery: a lost response must reconcile the existing effect,
-- never pause as a human issue and never issue a second paid assignment.
-- Original pilot treatment preserved via engine='pilot' branch.
CREATE OR REPLACE FUNCTION public.paperworld_v5_reclaim_expired()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
 ), v1_recovery as (
  update public.paperworld_autonomous_missions_v5 m
  set status=case when m.status='verifying' then 'verifying' else 'working' end,
      last_error='task_effect_reconciliation_pending',updated_at=now()
  where m.id in (select r.mission_id from recovered r
   join public.paperworld_autonomous_effects_v5 e on e.step_id=r.id
   where r.state='failed')
   and m.engine='v1'
   and m.status in ('queued','running','working','verifying')
  returning m.id
 ), blocked as (
  update public.paperworld_autonomous_missions_v5 m
  set status='needs_you',last_error='effect_requires_reconciliation',
   updated_at=now()
  where m.id in (select mission_id from recovered where state='failed')
   and (
     (coalesce(m.engine,'pilot')='pilot' and m.status in ('queued','running'))
     or (m.engine='v1' and m.status in ('queued','running','working','verifying')
       and not exists (
         select 1 from recovered r
         join public.paperworld_autonomous_effects_v5 e on e.step_id=r.id
         where r.mission_id=m.id and r.state='failed'
       ))
   )
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
end $function$
;

-- The monitor now sees 'uncertain' effects even when their originating step
-- lease was reclaimed. No new scheduler, quota row, or effect key is created.
