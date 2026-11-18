-- PAPERWORLD V5 TASK ENGINE v1 / additive cutover preparation.
-- This file is intentionally inert on installation (engine='pilot').
-- Existing pilot workflows, shared budgets and effects remain untouched.
alter table public.paperworld_autonomous_controller_v5
 add column if not exists engine text not null default 'pilot'
 check (engine in ('pilot','v1','off'));
alter table public.paperworld_autonomous_missions_v5
 add column if not exists engine text
 check (engine is null or engine in ('pilot','v1')),
 add column if not exists spec jsonb
 check (spec is null or jsonb_typeof(spec)='object'),
 add column if not exists report jsonb
 check (report is null or jsonb_typeof(report)='object');
alter table public.paperworld_autonomous_events_v5
 add column if not exists actor text not null default 'system'
 check (actor in ('system','cron','dispatcher','render','operator'));
alter table public.paperworld_autonomous_effects_v5
 add column if not exists external_id text,
 add column if not exists external_url text,
 add column if not exists confirmed_at timestamptz,
 add column if not exists evidence jsonb not null default '{}'::jsonb
  check (jsonb_typeof(evidence)='object'),
 add column if not exists reconcile_attempts integer not null default 0
  check (reconcile_attempts between 0 and 12);
alter table public.paperworld_autonomous_missions_v5
 drop constraint if exists paperworld_autonomous_missions_v5_status_check;
alter table public.paperworld_autonomous_missions_v5
 add constraint paperworld_autonomous_missions_v5_status_check
 check (status in ('draft','planned','queued','running','working','verifying',
  'needs_you','paused_budget','completed','failed','cancelled'));
-- No old table or function dropped.
create or replace function public.paperworld_v5_set_engine(
 p_engine text,p_reason text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare old_engine text;
begin
 if p_engine not in ('pilot','v1','off') or
    p_reason is null or length(btrim(p_reason)) not between 8 and 300 then
  return false;
 end if;
 select engine into old_engine from public.paperworld_autonomous_controller_v5
 where singleton=true for update;
 if not found then return false; end if;
 if old_engine=p_engine then return true; end if;
 update public.paperworld_autonomous_controller_v5 set engine=p_engine
 where singleton=true;
 -- Controller-level switches are not tied to an arbitrary owner mission.
 -- Audited in postgres logs; cannot forge a mission ownership record.
 raise log 'paperworld_v5_engine_changed: % -> %, reason supplied',old_engine,p_engine;
 return true;
end $$;
revoke all on function public.paperworld_v5_set_engine(text,text) from public,anon,authenticated;
grant execute on function public.paperworld_v5_set_engine(text,text) to service_role;

-- Spec is accepted only for one of two registered coding projects.
-- The strict JS validator rejects more shapes before reaching this function;
-- SQL repeats security-critical project and path restrictions.
create or replace function public.paperworld_v5_plan_task(p_mission uuid,p_spec jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare paths text[];
declare required text[];
declare acceptance text[];
declare path text;
declare role text;
declare repo text;
begin
 if p_spec is null or jsonb_typeof(p_spec)<>'object' or
    octet_length(p_spec::text)>7000 or
    p_spec->>'projectId' not in ('listening','pokemon') or
    jsonb_typeof(p_spec->'acceptance')<>'array' or
    jsonb_typeof(p_spec->'allowedPaths')<>'array' or
    jsonb_typeof(p_spec->'requiredTests')<>'array' or
    coalesce(jsonb_array_length(p_spec->'acceptance'),0) not between 1 and 5 or
    coalesce(jsonb_array_length(p_spec->'requiredTests'),0) not between 1 and 10 or
    coalesce(jsonb_array_length(p_spec->'allowedPaths'),0) not between 1 and 8 or
    (p_spec->>'maxFiles') !~ '^[1-9]$|^10$' or
    length(btrim(coalesce(p_spec->>'title',''))) not between 1 and 120 or
    length(btrim(coalesce(p_spec->>'summary',''))) not between 1 and 800
 then raise notice 'V1_PLAN_DIAGNOSTIC_1'; return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=p_mission for update;
 if not found or m.status<>'draft' or m.project_id<>p_spec->>'projectId'
  or m.project_id not in ('pokemon','listening') then raise notice 'V1_PLAN_DIAGNOSTIC_2'; return false; end if;
 role:=case m.project_id when 'pokemon' then 'pokemon-director'
  else 'listening-director' end;
 repo:=case m.project_id when 'pokemon' then 'mr-tanq/pokemon-echoes'
  else 'mr-tanq/concerts' end;
 if p_spec->>'directorId' is distinct from role or
   p_spec->>'repository' is distinct from repo or
   p_spec->>'noAutoMerge' is distinct from 'true' or
   p_spec->>'noAutoDeploy' is distinct from 'true'
 then raise notice 'V1_PLAN_DIAGNOSTIC_3'; return false; end if;
 select array_agg(value) into paths
  from jsonb_array_elements_text(p_spec->'allowedPaths') value;
 select array_agg(value) into required
  from jsonb_array_elements_text(p_spec->'requiredTests') value;
 select array_agg(value) into acceptance
  from jsonb_array_elements_text(p_spec->'acceptance') value;
 if exists(select 1 from unnest(paths) p
   where p !~ '^[A-Za-z0-9_./-]{2,160}$' or
    p like '/%' or p like '%..%' or p like '%//%' or
    p like '.github/%' or p like '.paperworld/%' or
    p like 'assets/%' or p like 'addons/%' or
    (m.project_id='pokemon' and
      not (p like 'scripts/%' or p like 'scenes/%' or p like 'tests/%')) or
    (m.project_id='listening' and
      not (p like 'js/%' or p like 'css/%' or p like 'tests/%' or p like 'scripts/%' or
       p like 'workers/%' or p like 'server/%')))
 or exists(select 1 from unnest(required) t
   where t !~ '^[A-Za-z][A-Za-z0-9_.-]{1,79}$' or
    (m.project_id='pokemon' and t not in ('godot_smoke','battle_damage')) or
    (m.project_id='listening' and t not in
     ('festival_revisit','festival_discovery','identity_profile','setlist_resolver')))
 or exists(select 1 from unnest(acceptance) t
   where length(btrim(t)) not between 1 and 240)
 then raise notice 'V1_PLAN_DIAGNOSTIC_4'; return false; end if;
 update public.paperworld_autonomous_missions_v5
 set engine='v1',status='planned',spec=p_spec,updated_at=now()
 where id=p_mission;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,event_type,payload,actor)
 values(m.id,m.owner_id,'task_planned',jsonb_build_object(
  'project',m.project_id,'title',p_spec->>'title'),'render');
 return true;
end $$;
revoke all on function public.paperworld_v5_plan_task(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.paperworld_v5_plan_task(uuid,jsonb) to service_role;

create or replace function public.paperworld_v5_queue_task(p_mission uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare cfg public.paperworld_autonomous_controller_v5%rowtype;
declare role text;declare repo text;declare names text[]:=
 array['create_issue','start_agent','await_agent','verify','report'];
declare ix integer;
begin
 select * into m from public.paperworld_autonomous_missions_v5
 where id=p_mission for update;
 if not found or m.engine<>'v1' or m.status<>'planned' or
    m.project_id not in ('listening','pokemon') or m.spec is null then
  return false;
 end if;
 select * into cfg from public.paperworld_autonomous_controller_v5
 where singleton=true for update;
 if not found or cfg.engine<>'v1' or cfg.dispatch_enabled is not true
 then return false; end if;
 role:=case m.project_id when 'pokemon' then 'pokemon-director'
 else 'listening-director' end;
 repo:=case m.project_id when 'pokemon' then 'mr-tanq/pokemon-echoes'
 else 'mr-tanq/concerts' end;
 if exists(select 1 from public.paperworld_autonomous_steps_v5 where mission_id=p_mission)
 then return false; end if;
 for ix in 1..5 loop
  insert into public.paperworld_autonomous_steps_v5
  (mission_id,owner_id,seq,role_id,capability,state,idempotency_key,input,max_attempts)
  values(m.id,m.owner_id,ix,role,names[ix],
   case when ix=1 then 'ready' else 'pending' end,
   'task-v1:'||m.id::text||':'||ix::text,
   jsonb_build_object('project',m.project_id,'repository',repo,
    'effectKey','task-v1:'||m.id::text||':'||ix::text),3);
 end loop;
 update public.paperworld_autonomous_missions_v5
 set status='queued',policy=policy||'{"maxAiCalls":1,"executionMode":"task_v1"}'::jsonb,
 updated_at=now() where id=m.id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,event_type,payload,actor)
 values(m.id,m.owner_id,'task_queued',jsonb_build_object('project',m.project_id),'render');
 return true;
end $$;
revoke all on function public.paperworld_v5_queue_task(uuid) from public,anon,authenticated;
grant execute on function public.paperworld_v5_queue_task(uuid) to service_role;

-- Isolated v1 claim. Never consumes pilot steps or effects already reserved.
create or replace function public.paperworld_v5_claim_task_step(
 p_worker uuid,p_lease_seconds integer default 600)
returns table(step_id uuid,mission_id uuid,owner_id uuid,role_id text,
 capability text,step_input jsonb,attempt_number integer)
language plpgsql security invoker set search_path=public as $$
declare selected public.paperworld_autonomous_steps_v5%rowtype;
begin
 if p_worker is null or p_lease_seconds not between 60 and 900 then
  return;
 end if;
 if not exists(select 1 from public.paperworld_autonomous_controller_v5
   where singleton=true and engine='v1' and dispatch_enabled=true)
 then return; end if;
 select s.* into selected from public.paperworld_autonomous_steps_v5 s
 join public.paperworld_autonomous_missions_v5 m
  on m.id=s.mission_id and m.owner_id=s.owner_id
 where m.engine='v1' and m.status in ('queued','running','working','verifying')
  and s.state='ready' and s.run_after<=now() and s.attempts<s.max_attempts
  and s.capability in ('create_issue','start_agent','await_agent','verify','report')
  and (
    not exists(select 1 from public.paperworld_autonomous_effects_v5 e
     where e.step_id=s.id)
    or (s.capability='verify' and exists(
      select 1 from public.paperworld_autonomous_effects_v5 e
      where e.step_id=s.id and e.kind='dispatch_verify' and e.state='started'))
   )
  and not exists(select 1 from public.paperworld_autonomous_steps_v5 p
   where p.mission_id=s.mission_id and p.seq<s.seq and
    p.state not in ('succeeded','skipped'))
 order by s.run_after,s.created_at,s.id
 for update of s,m skip locked limit 1;
 if not found then return; end if;
 update public.paperworld_autonomous_steps_v5
 set state='leased',lease_owner=p_worker,
  lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
  attempts=attempts+1,started_at=coalesce(started_at,now())
 where id=selected.id;
 update public.paperworld_autonomous_missions_v5
 set status=case when status='queued' then 'running' else status end,
 updated_at=now() where id=selected.mission_id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload,actor)
 values(selected.mission_id,selected.owner_id,selected.id,'task_step_leased',
  jsonb_build_object('capability',selected.capability),'dispatcher');
 return query select selected.id,selected.mission_id,selected.owner_id,
 selected.role_id,selected.capability,selected.input,selected.attempts+1;
end $$;
revoke all on function public.paperworld_v5_claim_task_step(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_claim_task_step(uuid,integer)
 to service_role;

-- This migration deliberately does not touch cron, activate v1, or alter
-- begin_effect's production budget implementation. Those need the separately
-- verified dispatcher and reconciliation implementation before cutover.
