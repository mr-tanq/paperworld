-- Synthetic PostgreSQL test for sql/paperworld_phase5_routines_do_work.sql.
-- NEVER run against a real Supabase project.
\set ON_ERROR_STOP on
\ir fixtures/routine-loop-fixture.sql
\ir ../../sql/paperworld_routine_loop_release_v1.sql

-- Live controller columns this migration reads, and a copy of the live
-- plan_task validation (2026-11-20). queue_task is reduced to its status change.
CREATE TABLE public.paperworld_autonomous_controller_v5 (singleton boolean PRIMARY KEY DEFAULT true,
 engine text NOT NULL DEFAULT 'v1', dispatch_enabled boolean NOT NULL DEFAULT true);
INSERT INTO public.paperworld_autonomous_controller_v5 DEFAULT VALUES;
CREATE TABLE public.paperworld_autonomous_events_v5 (mission_id uuid, owner_id uuid, step_id uuid,
 event_type text, payload jsonb, actor text);
CREATE FUNCTION public.paperworld_v5_plan_task(p_mission uuid, p_spec jsonb) RETURNS boolean
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare paths text[]; declare required text[]; declare acceptance text[];
declare role text; declare repo text;
begin
 if p_spec is null or jsonb_typeof(p_spec)<>'object' or octet_length(p_spec::text)>7000 or
    p_spec->>'projectId' not in ('listening','pokemon') or
    jsonb_typeof(p_spec->'acceptance')<>'array' or jsonb_typeof(p_spec->'allowedPaths')<>'array' or
    jsonb_typeof(p_spec->'requiredTests')<>'array' or
    coalesce(jsonb_array_length(p_spec->'acceptance'),0) not between 1 and 5 or
    coalesce(jsonb_array_length(p_spec->'requiredTests'),0) not between 1 and 10 or
    coalesce(jsonb_array_length(p_spec->'allowedPaths'),0) not between 1 and 8 or
    (p_spec->>'maxFiles') !~ '^[1-9]$|^10$' or
    length(btrim(coalesce(p_spec->>'title',''))) not between 1 and 120 or
    length(btrim(coalesce(p_spec->>'summary',''))) not between 1 and 800
 then return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5 where id=p_mission for update;
 if not found or m.status<>'draft' or m.project_id<>p_spec->>'projectId' then return false; end if;
 role:=case m.project_id when 'pokemon' then 'pokemon-director' else 'listening-director' end;
 repo:=case m.project_id when 'pokemon' then 'mr-tanq/pokemon-echoes' else 'mr-tanq/concerts' end;
 if p_spec->>'directorId' is distinct from role or p_spec->>'repository' is distinct from repo or
   p_spec->>'noAutoMerge' is distinct from 'true' or p_spec->>'noAutoDeploy' is distinct from 'true'
 then return false; end if;
 select array_agg(value) into paths from jsonb_array_elements_text(p_spec->'allowedPaths') value;
 select array_agg(value) into required from jsonb_array_elements_text(p_spec->'requiredTests') value;
 select array_agg(value) into acceptance from jsonb_array_elements_text(p_spec->'acceptance') value;
 if exists(select 1 from unnest(paths) p where p !~ '^[A-Za-z0-9_./-]{2,160}$' or
    (m.project_id='pokemon' and not (p like 'scripts/%' or p like 'scenes/%' or p like 'tests/%')) or
    (m.project_id='listening' and not (p like 'js/%' or p like 'css/%' or p like 'tests/%' or
     p like 'scripts/%' or p like 'workers/%' or p like 'server/%')))
 or exists(select 1 from unnest(required) t where
    (m.project_id='pokemon' and t not in ('godot_smoke','battle_damage')) or
    (m.project_id='listening' and t not in ('festival_revisit','festival_discovery','identity_profile','setlist_resolver')))
 or exists(select 1 from unnest(acceptance) t where length(btrim(t)) not between 1 and 240)
 then return false; end if;
 update public.paperworld_autonomous_missions_v5 set engine='v1',status='planned',spec=p_spec where id=p_mission;
 return true;
end $function$;
CREATE FUNCTION public.paperworld_v5_queue_task(p_mission uuid) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT goal FROM public.paperworld_autonomous_missions_v5 WHERE id=p_mission) LIKE '%QUEUE_FAILS%'
 THEN RAISE EXCEPTION 'synthetic queue failure'; END IF;
 UPDATE public.paperworld_autonomous_missions_v5 SET status='queued',
  policy=policy||'{"maxAiCalls":1,"executionMode":"task_v1"}' WHERE id=p_mission AND status='planned';
 RETURN FOUND;
END $$;

\ir ../../sql/paperworld_phase5_routines_do_work.sql
\ir ../../sql/paperworld_phase5_routines_do_work.sql

INSERT INTO public.paperworld_routines_v1(id,owner_id,thread_id,project_id,goal,enabled,day_of_week,local_hour,local_minute)
VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','listening','Έλεγξε ότι βρίσκονται οι συναυλίες',true,1,9,0),
('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','studio','Ιδέες για νέο τραγούδι',true,1,9,0),
('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','listening','QUEUE_FAILS check',true,1,9,0),
('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','wellbeing','Ιδιωτική άσκηση γονάτου',true,1,9,0);
-- Make all three due at the same genuine local slot.
DO $$
DECLARE slot timestamptz:=date_trunc('minute',now())-interval '5 minutes';
DECLARE loc timestamp:=slot AT TIME ZONE 'Europe/Amsterdam';
BEGIN
 UPDATE paperworld_routines_v1 SET day_of_week=extract(dow FROM loc)::int,
  local_hour=extract(hour FROM loc)::int,local_minute=extract(minute FROM loc)::int;
 UPDATE paperworld_routines_v1 SET next_review_at=slot;
END $$;

DO $$
DECLARE c record; m record; txt text;
BEGIN
 SELECT * INTO c FROM paperworld_autonomous_controller_v5;
 ASSERT c.routines_start_work,'owner switch applied';
 PERFORM paperworld_v5_unified_tick();
 -- Listening: a real queued mission with a validated brief.
 SELECT mi.* INTO m FROM paperworld_autonomous_missions_v5 mi JOIN paperworld_routine_slots_v1 s ON s.mission_id=mi.id
  WHERE s.routine_id='33333333-3333-4333-8333-333333333333';
 ASSERT m.status='queued' AND m.engine='v1','coding routine queued: '||m.status;
 ASSERT m.spec->>'repository'='mr-tanq/concerts' AND m.spec->>'title' LIKE 'Εβδομαδιαίος έλεγχος: %'
  AND m.spec->>'summary' LIKE '%add or improve one small automated test%','brief: '||m.spec;
 SELECT content INTO txt FROM paperworld_agent_messages WHERE id=md5(m.id::text||':routine_due')::uuid;
 ASSERT txt LIKE '%ξεκίνησα την εβδομαδιαία εργασία%','started message: '||txt;
 -- Studio: stays review-only.
 SELECT mi.* INTO m FROM paperworld_autonomous_missions_v5 mi JOIN paperworld_routine_slots_v1 s ON s.mission_id=mi.id
  WHERE s.routine_id='66666666-6666-4666-8666-666666666666';
 ASSERT m.status='draft' AND m.spec IS NULL,'studio stays a draft';
 SELECT content INTO txt FROM paperworld_agent_messages WHERE id=md5(m.id::text||':routine_due')::uuid;
 ASSERT txt LIKE '%δεν ξεκινά τίποτα χωρίς εσένα%','studio message: '||txt;
 -- A queue failure falls back to the draft; the slot is kept, nothing is half-queued.
 SELECT mi.* INTO m FROM paperworld_autonomous_missions_v5 mi JOIN paperworld_routine_slots_v1 s ON s.mission_id=mi.id
  WHERE s.routine_id='77777777-7777-4777-8777-777777777777';
 ASSERT m.status='draft' AND m.spec IS NULL,'failure rolled back to draft: '||m.status;
 -- Exactly once per slot, and every routine advanced.
 PERFORM paperworld_v5_unified_tick();
 ASSERT (SELECT count(*) FROM paperworld_routine_slots_v1)=4,'exactly once';
 SELECT content INTO txt FROM paperworld_agent_messages a JOIN paperworld_routine_slots_v1 s
  ON a.id=md5(s.mission_id::text||':routine_due')::uuid WHERE s.routine_id='88888888-8888-4888-8888-888888888888';
 ASSERT txt LIKE '%Ο Dave: ήρθε η ώρα για το πρόγραμμά σου%' AND txt NOT LIKE '%γονάτου%','Dave reminder is private: '||txt;
 ASSERT NOT EXISTS(SELECT 1 FROM paperworld_routines_v1 WHERE next_review_at<=now()),'all advanced';
END $$;

-- Switch off → coding routines go back to review-only drafts.
UPDATE paperworld_autonomous_controller_v5 SET routines_start_work=false;
DO $$
DECLARE slot timestamptz:=date_trunc('minute',now())-interval '3 minutes';
DECLARE loc timestamp:=slot AT TIME ZONE 'Europe/Amsterdam';
DECLARE m record;
BEGIN
 UPDATE paperworld_routines_v1 SET day_of_week=extract(dow FROM loc)::int,local_hour=extract(hour FROM loc)::int,
  local_minute=extract(minute FROM loc)::int WHERE id='33333333-3333-4333-8333-333333333333';
 UPDATE paperworld_routines_v1 SET next_review_at=slot WHERE id='33333333-3333-4333-8333-333333333333';
 PERFORM paperworld_v5_unified_tick();
 SELECT mi.* INTO m FROM paperworld_autonomous_missions_v5 mi JOIN paperworld_routine_slots_v1 s ON s.mission_id=mi.id
  WHERE s.routine_id='33333333-3333-4333-8333-333333333333' AND s.scheduled_at=slot;
 ASSERT m.status='draft','switch off keeps drafts: '||coalesce(m.status,'none');
END $$;
SELECT 'Phase 5 routines integration passed' AS result;
