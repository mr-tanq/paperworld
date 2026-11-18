-- Shared effect reservation and confirmation: one source of truth for pilot and v1.
-- The same existing controller row and effect table count both engines' sessions.
CREATE OR REPLACE FUNCTION public.paperworld_v5_begin_effect(p_step uuid, p_worker uuid, p_key text, p_adapter text, p_kind text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare conf public.paperworld_autonomous_controller_v5%rowtype;
declare sessions int:=case when p_adapter='copilot_agent' and p_kind='start_agent' then 1 else 0 end;
declare daily int;declare monthly int;declare per_mission int;
begin
 if p_step is null or p_worker is null or
  p_key is null or length(p_key) not between 8 and 160 or
  p_adapter not in ('copilot_agent','dry_run') or
  (p_adapter='copilot_agent' and p_kind not in ('create_issue','start_agent','dispatch_verify')) or
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
 if not found or m.status not in ('queued','running','working','verifying') then return 'denied'; end if;
 if p_adapter='copilot_agent' and (
   conf.dispatch_enabled is not true or
   (coalesce(m.engine,'pilot')='pilot' and conf.engine<>'pilot') or
   (m.engine='v1' and conf.engine<>'v1') or
   coalesce(m.engine,'pilot') not in ('pilot','v1')
 ) then return 'denied'; end if;
 if exists(select 1 from public.paperworld_autonomous_effects_v5
    where step_id=s.id or effect_key=p_key) then return 'uncertain'; end if;
 if p_adapter='copilot_agent' then
  if not p_adapter=any(conf.live_adapters) or
   m.project_id not in ('pokemon','listening') or
   s.capability not in ('create_issue','start_agent','dispatch_verify') or
   (not coalesce(conf.allow_unmetered_copilot,false) and (
    conf.credit_snapshot is null or conf.credit_snapshot_at is null or
    conf.credit_snapshot>=conf.credit_stop_at or
    conf.credit_snapshot_at<now()-interval '24 hours'))
  then
   update public.paperworld_autonomous_missions_v5 set
    status='paused_budget',updated_at=now() where id=m.id;
   return 'budget_denied';
  end if;
  select count(*) into daily from public.paperworld_autonomous_effects_v5 e
   where e.sessions=1 and e.state<>'denied'
    and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  select count(*) into monthly from public.paperworld_autonomous_effects_v5 e
   where e.sessions=1 and e.state<>'denied'
    and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  select count(*) into per_mission from public.paperworld_autonomous_effects_v5 e
   where e.mission_id=m.id and e.sessions=1 and e.state<>'denied';
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
end $function$
;

CREATE OR REPLACE FUNCTION public.paperworld_v5_confirm_effect(p_key text, p_worker uuid, p_reference jsonb, p_done boolean DEFAULT true)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  external_ref=p_reference,
  external_id=coalesce(p_reference->>'externalId',p_reference->>'issueNumber',
   p_reference->>'runId'),
  external_url=coalesce(p_reference->>'externalUrl',p_reference->>'prUrl',
   p_reference->>'runUrl'),
  confirmed_at=now(),evidence=p_reference,updated_at=now() where effect_key=p_key;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(e.mission_id,e.owner_id,e.step_id,'effect_confirmed',
  jsonb_build_object('effectKey',e.effect_key,'done',p_done));
 return true;
end $function$
;
