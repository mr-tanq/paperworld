-- Synthetic PostgreSQL 17 test. Never connect this to a real Supabase project.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
-- PostgreSQL roles are cluster-wide. Another CI database already initialized
-- anon/authenticated in this same throwaway service instance.
DO $routine_roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated')
 THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')
 THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role')
 THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $routine_roles$;
ALTER ROLE service_role BYPASSRLS;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.paperworld_agent_threads (
 id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 agent_id text NOT NULL,
 PRIMARY KEY (id,owner_id)
);
CREATE TABLE public.paperworld_autonomous_missions_v5 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 thread_id uuid NOT NULL,
 project_id text NOT NULL,
 goal text NOT NULL,
 status text NOT NULL DEFAULT 'draft',
 policy jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id),
 FOREIGN KEY(thread_id,owner_id)
 REFERENCES public.paperworld_agent_threads(id,owner_id)
);
CREATE TABLE public.paperworld_autonomous_steps_v5 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid,
 state text NOT NULL DEFAULT 'ready'
);
CREATE FUNCTION public.paperworld_v5_controller_tick()
 RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"state":"controller_ok"}'::jsonb $$;
CREATE FUNCTION public.paperworld_v5_unified_wakeup()
 RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"state":"no_due_work"}'::jsonb $$;
CREATE FUNCTION public.paperworld_v5_notify_matt()
 RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"state":"notifications_preserved"}'::jsonb $$;
CREATE FUNCTION public.paperworld_v5_unified_tick()
 RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"state":"preexisting"}'::jsonb $$;
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.paperworld_agent_threads(id,owner_id,agent_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','matt'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','matt');
COMMIT;

\ir ../../sql/paperworld_routine_loop_v1_REVIEW_ONLY.sql
\ir ../../sql/paperworld_routine_loop_v2_REVIEW_ONLY.sql

-- Validate exact zero-budget constraints and service-only writes.
DO $$
BEGIN
 IF has_table_privilege('authenticated','public.paperworld_routines_v1','INSERT')
  OR has_table_privilege('authenticated','public.paperworld_routines_v1','UPDATE')
  OR has_table_privilege('authenticated','public.paperworld_routine_slots_v1','INSERT')
  OR has_function_privilege('authenticated',
   'public.paperworld_v1_stage_routine_draft(uuid,timestamptz)','EXECUTE')
  OR has_function_privilege('anon',
   'public.paperworld_v1_review_due_routines()','EXECUTE')
 THEN RAISE EXCEPTION 'unauthorized routine write permission'; END IF;
 IF NOT has_table_privilege('authenticated','public.paperworld_routines_v1','SELECT')
  OR NOT has_function_privilege('service_role',
   'public.paperworld_v1_stage_routine_draft(uuid,timestamptz)','EXECUTE')
 THEN RAISE EXCEPTION 'expected scoped privileges missing'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.paperworld_routines_v1'::regclass)
  OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.paperworld_routine_slots_v1'::regclass)
 THEN RAISE EXCEPTION 'routine RLS absent'; END IF;
END $$;

-- Role bypasses RLS only for synthetic service-side writes.
INSERT INTO public.paperworld_routines_v1
 (id,owner_id,thread_id,project_id,goal,enabled,
  day_of_week,hour_utc,minute_utc,next_review_at)
SELECT '33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'listening','Review gigs',false,
 EXTRACT(DOW FROM slot AT TIME ZONE 'UTC')::int,
 EXTRACT(HOUR FROM slot AT TIME ZONE 'UTC')::int,
 EXTRACT(MINUTE FROM slot AT TIME ZONE 'UTC')::int,
 slot
FROM (SELECT date_trunc('minute',now())-interval '5 minutes' AS slot) t;
INSERT INTO public.paperworld_routines_v1
 (id,owner_id,thread_id,project_id,goal,enabled,
  day_of_week,hour_utc,minute_utc,next_review_at)
VALUES ('44444444-4444-4444-8444-444444444444',
 '22222222-2222-4222-8222-222222222222',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'pokemon','Owner two private schedule',false,1,11,30,null);

-- Disabled routines never stage work.
DO $$
DECLARE response jsonb;
BEGIN
 response:=public.paperworld_v5_unified_tick();
 IF response->'routines'->>'staged'<>'0'
  OR (SELECT count(*) FROM public.paperworld_autonomous_missions_v5)<>0
 THEN RAISE EXCEPTION 'disabled routine staged work'; END IF;
 IF response->'notifications'->>'state'<>'notifications_preserved'
 THEN RAISE EXCEPTION 'Matt notification stage lost'; END IF;
END $$;

UPDATE public.paperworld_routines_v1 SET enabled=true
 WHERE id='33333333-3333-4333-8333-333333333333';
DO $$
DECLARE first jsonb; second jsonb; next_review timestamptz;
DECLARE old_slot timestamptz;
BEGIN
 SELECT next_review_at INTO old_slot FROM public.paperworld_routines_v1
 WHERE id='33333333-3333-4333-8333-333333333333';
 first:=public.paperworld_v5_unified_tick();
 second:=public.paperworld_v5_unified_tick();
 IF first->'routines'->>'staged'<>'1' OR second->'routines'->>'staged'<>'0'
 THEN RAISE EXCEPTION 'expected exactly one weekly stage: %, %',first,second; END IF;
 IF first->'notifications'->>'state'<>'notifications_preserved'
  OR second->'notifications'->>'state'<>'notifications_preserved'
 THEN RAISE EXCEPTION 'Matt notifications did not survive both ticks'; END IF;
 IF (SELECT count(*) FROM public.paperworld_autonomous_missions_v5)<>1
  OR (SELECT count(*) FROM public.paperworld_routine_slots_v1)<>1
  OR (SELECT count(*) FROM public.paperworld_autonomous_steps_v5)<>0
 THEN RAISE EXCEPTION 'routine caused duplicate/paid/runnable work'; END IF;
 IF (SELECT status FROM public.paperworld_autonomous_missions_v5 LIMIT 1)<>'draft'
  OR (SELECT (policy->>'maxAiCalls')::int FROM public.paperworld_autonomous_missions_v5 LIMIT 1)<>0
  OR (SELECT (policy->>'additionalSpendUsd')::numeric FROM public.paperworld_autonomous_missions_v5 LIMIT 1)<>0
 THEN RAISE EXCEPTION 'unexpected execution status or spend'; END IF;
 SELECT next_review_at INTO next_review FROM public.paperworld_routines_v1
 WHERE id='33333333-3333-4333-8333-333333333333';
 IF next_review<>old_slot+interval '7 days'
 THEN RAISE EXCEPTION 'next slot not advanced by exactly one week'; END IF;
 IF public.paperworld_v1_stage_routine_draft(
  '33333333-3333-4333-8333-333333333333',old_slot) IS NOT NULL
 THEN RAISE EXCEPTION 'old slot was staged a second time'; END IF;
END $$;

-- Wrong slots must not change the next review or create a mission.
DO $$
DECLARE slot timestamptz; response uuid;
BEGIN
 SELECT next_review_at INTO slot FROM public.paperworld_routines_v1
 WHERE id='33333333-3333-4333-8333-333333333333';
 response:=public.paperworld_v1_stage_routine_draft(
  '33333333-3333-4333-8333-333333333333',slot-interval '2 minutes');
 IF response IS NOT NULL THEN RAISE EXCEPTION 'wrong slot accepted'; END IF;
END $$;

-- Test both authenticated owners' visibility using real RLS, no public writes.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.paperworld_routines_v1)<>1
  OR (SELECT count(*) FROM public.paperworld_routine_slots_v1)<>1
 THEN RAISE EXCEPTION 'owner 1 RLS mismatch'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.paperworld_routines_v1)<>1
  OR (SELECT count(*) FROM public.paperworld_routine_slots_v1)<>0
 THEN RAISE EXCEPTION 'owner 2 leaked another owner routine'; END IF;
END $$;
RESET ROLE;
SELECT 'Routine Loop PostgreSQL integration passed' AS result;
