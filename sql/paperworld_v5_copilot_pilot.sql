-- V5 Copilot Pro Pilot: one existing issue, one external-session intent.
-- This does not enable dispatch. Requires explicit service-role configuration.
-- NO background caller/credential is installed by this migration.
create unique index if not exists paperworld_copilot_pilot_issue_unique
on public.paperworld_autonomous_steps_v5
(owner_id,role_id,(input->>'issueNumber'))
where capability='start_agent';

create or replace function public.paperworld_v5_queue_copilot_pilot(
 p_mission uuid,p_issue integer default 1)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare config public.paperworld_autonomous_controller_v5%rowtype;
begin
 if p_mission is null or p_issue<>1 then return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=p_mission for update;
 if not found or m.status<>'draft' or m.project_id<>'pokemon' or
  coalesce((m.policy->>'maxAiCalls')::int,-1)<>0 or
  coalesce((m.policy->>'additionalSpendUsd')::numeric,-1)<>0
 then return false; end if;
 select * into config from public.paperworld_autonomous_controller_v5
 where singleton=true for update;
 if not found or config.dispatch_enabled is not true or
  not 'copilot_agent'=any(config.live_adapters) or
  config.credit_snapshot is null or
  config.credit_snapshot_at<now()-interval '24 hours' or
  config.credit_snapshot>=config.credit_stop_at or
  config.sessions_per_day<1 or config.sessions_per_mission<1
 then return false; end if;
 -- One fixed, audited pilot; general plans can be added only after a live pass.
 insert into public.paperworld_autonomous_steps_v5
 (mission_id,owner_id,seq,role_id,capability,state,idempotency_key,input,max_attempts)
 values(p_mission,m.owner_id,1,'pokemon-director','start_agent','ready',
  'copilot:pilot:'||m.id::text,
  jsonb_build_object('issueNumber',p_issue,'repository','mr-tanq/pokemon-echoes',
    'effectKey','copilot:'||m.id::text),1);
 update public.paperworld_autonomous_missions_v5 set
  status='queued',updated_at=now(),
  policy=(m.policy||jsonb_build_object('maxAiCalls',1,
   'executionMode','copilot_pilot','issueNumber',p_issue))
 where id=p_mission;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,event_type,payload)
 values(p_mission,m.owner_id,'copilot_pilot_queued',
  jsonb_build_object('issueNumber',p_issue,'repository','mr-tanq/pokemon-echoes',
   'status','awaiting_external_dispatch'));
 return true;
exception when unique_violation then
 return false;
end $$;

-- This claim variant is fenced to Copilot's one source repo and only
-- the specific first pilot. A scheduled SQL simulation cannot claim it.
create or replace function public.paperworld_v5_claim_copilot_pilot(
 p_worker uuid,p_seconds integer default 600)
returns table(step_id uuid,mission_id uuid,owner_id uuid,issue_number integer,effect_key text)
language plpgsql security invoker set search_path=public
as $$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare config public.paperworld_autonomous_controller_v5%rowtype;
begin
 if p_worker is null or p_seconds not between 60 and 900 then return; end if;
 select * into config from public.paperworld_autonomous_controller_v5
 where singleton=true;
 if not found or config.dispatch_enabled is not true
 or not 'copilot_agent'=any(config.live_adapters) then return; end if;
 select st.* into s from public.paperworld_autonomous_steps_v5 st
 join public.paperworld_autonomous_missions_v5 mi on
  mi.id=st.mission_id and mi.owner_id=st.owner_id
 where st.state='ready' and st.capability='start_agent'
  and st.attempts<st.max_attempts and st.run_after<=now()
  and st.input->>'repository'='mr-tanq/pokemon-echoes'
  and st.input->>'issueNumber'='1'
  and mi.project_id='pokemon'
  and mi.status in ('queued','running')
  and mi.policy->>'executionMode'='copilot_pilot'
  and not exists(select 1 from public.paperworld_autonomous_effects_v5 e
   where e.step_id=st.id)
 order by st.created_at
 for update of st skip locked limit 1;
 if not found then return; end if;
 update public.paperworld_autonomous_steps_v5 set
 state='leased',lease_owner=p_worker,
 lease_expires_at=now()+make_interval(secs=>p_seconds),
 attempts=attempts+1,started_at=now() where id=s.id;
 update public.paperworld_autonomous_missions_v5 set
 status='running',updated_at=now() where id=s.mission_id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(s.mission_id,s.owner_id,s.id,'copilot_step_claimed',
  '{"session_limit":1,"repository":"mr-tanq/pokemon-echoes"}'::jsonb);
 return query select s.id,s.mission_id,s.owner_id,
  (s.input->>'issueNumber')::integer,s.input->>'effectKey';
end $$;

-- Mark uncertain API outcome safely; never recreate the same session.
create or replace function public.paperworld_v5_mark_copilot_uncertain(
 p_key text,p_worker uuid)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare e public.paperworld_autonomous_effects_v5%rowtype;
declare s public.paperworld_autonomous_steps_v5%rowtype;
begin
 if p_key is null or p_worker is null then return false; end if;
 select * into e from public.paperworld_autonomous_effects_v5
 where effect_key=p_key and adapter='copilot_agent' and kind='start_agent'
  and state in ('intent','started') for update;
 if not found then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=e.step_id and lease_owner=p_worker and state in ('leased','running')
 and lease_expires_at>now() for update;
 if not found then return false; end if;
 update public.paperworld_autonomous_effects_v5 set
 state='uncertain',updated_at=now() where effect_key=p_key;
 update public.paperworld_autonomous_steps_v5 set state='failed',
 lease_owner=null,lease_expires_at=null,finished_at=now() where id=s.id;
 update public.paperworld_autonomous_missions_v5 set
 status='needs_you',last_error='copilot_assignment_uncertain',
 updated_at=now() where id=e.mission_id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(e.mission_id,e.owner_id,e.step_id,'copilot_assignment_uncertain',
  jsonb_build_object('effectKey',p_key,'neverRetry',true));
 return true;
end $$;

revoke all on function public.paperworld_v5_queue_copilot_pilot(uuid,integer),
 public.paperworld_v5_claim_copilot_pilot(uuid,integer),
 public.paperworld_v5_mark_copilot_uncertain(text,uuid)
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_queue_copilot_pilot(uuid,integer),
 public.paperworld_v5_claim_copilot_pilot(uuid,integer),
 public.paperworld_v5_mark_copilot_uncertain(text,uuid)
 to service_role;
