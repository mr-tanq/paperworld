-- Synthetic PostgreSQL integration test for the Routine Loop release migration.
-- NEVER run against a real Supabase project.
\set ON_ERROR_STOP on
\ir fixtures/routine-loop-fixture.sql
\ir ../../sql/paperworld_routine_loop_release_v1.sql

-- 1. Privileges, RLS and zero-budget constraints.
DO $$
BEGIN
 IF has_table_privilege('authenticated','public.paperworld_routines_v1','INSERT')
  OR has_table_privilege('authenticated','public.paperworld_routines_v1','UPDATE')
  OR has_table_privilege('authenticated','public.paperworld_routine_slots_v1','INSERT')
  OR has_function_privilege('authenticated','public.paperworld_v1_stage_routine_draft(uuid,timestamptz)','EXECUTE')
  OR has_function_privilege('anon','public.paperworld_v1_review_due_routines()','EXECUTE')
 THEN RAISE EXCEPTION 'unauthorized routine write permission'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.paperworld_routines_v1'::regclass)
 THEN RAISE EXCEPTION 'routine RLS absent'; END IF;
 BEGIN
  INSERT INTO public.paperworld_routines_v1(owner_id,thread_id,project_id,goal,day_of_week,local_hour,local_minute,max_ai_calls)
  VALUES('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','listening','x',1,9,0,1);
  RAISE EXCEPTION 'paid routine accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 2. DST: "Monday 09:00 Europe/Amsterdam" stays 09:00 local across both transitions.
DO $$
DECLARE a timestamptz; b timestamptz; c timestamptz; d timestamptz; g timestamptz;
BEGIN
 a:=paperworld_routine_slot_after(1,9,0,'Europe/Amsterdam','2026-10-19 00:00Z');
 b:=paperworld_routine_slot_after(1,9,0,'Europe/Amsterdam',a);
 IF a<>'2026-10-19 07:00Z' OR b<>'2026-10-26 08:00Z' THEN RAISE EXCEPTION 'autumn DST wrong: % %',a,b; END IF;
 c:=paperworld_routine_slot_after(1,9,0,'Europe/Amsterdam','2027-03-22 00:00Z');
 d:=paperworld_routine_slot_after(1,9,0,'Europe/Amsterdam',c);
 IF c<>'2027-03-22 08:00Z' OR d<>'2027-03-29 07:00Z' THEN RAISE EXCEPTION 'spring DST wrong: % %',c,d; END IF;
 -- Non-existent local time (02:30 on 2027-03-28) resolves on that day, deterministically.
 g:=paperworld_routine_slot_after(0,2,30,'Europe/Amsterdam','2027-03-27 12:00Z');
 IF (g AT TIME ZONE 'Europe/Amsterdam')::date<>'2027-03-28' THEN RAISE EXCEPTION 'gap slot moved day: %',g; END IF;
 IF paperworld_routine_slot_after(1,9,0,'UTC','2026-10-19 09:00Z')<>'2026-10-26 09:00Z'
 THEN RAISE EXCEPTION 'strictly-after rule broken'; END IF;
END $$;

-- 3. Enabling computes next_review_at in the database; pausing clears it.
INSERT INTO public.paperworld_routines_v1(id,owner_id,thread_id,project_id,goal,enabled,day_of_week,local_hour,local_minute)
VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','listening','Έλεγξε τις συναυλίες',false,1,9,0),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','pokemon','Owner two private schedule',true,2,11,30);
DO $$
BEGIN
 IF (SELECT next_review_at FROM paperworld_routines_v1 WHERE id='33333333-3333-4333-8333-333333333333') IS NOT NULL
 THEN RAISE EXCEPTION 'disabled routine has a next slot'; END IF;
 IF (SELECT next_review_at FROM paperworld_routines_v1 WHERE id='44444444-4444-4444-8444-444444444444')<=now()
 THEN RAISE EXCEPTION 'enabled routine slot not in the future'; END IF;
END $$;

-- 4. Disabled routines never stage; live notifications keep working.
INSERT INTO public.paperworld_autonomous_missions_v5(id,owner_id,thread_id,project_id,goal,status,engine)
VALUES('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','pokemon','Existing V5 work','completed','v1');
DO $$
DECLARE r jsonb;
BEGIN
 r:=paperworld_v5_unified_tick();
 IF r->'routines'->>'staged'<>'0' OR r->'controller'->>'state'<>'controller_ok'
  OR r->'dispatch'->>'state'<>'no_due_work' OR r->'notifications'->>'messages'<>'1'
 THEN RAISE EXCEPTION 'tick lost an existing stage: %',r; END IF;
END $$;

-- 5. A due local slot stages exactly one draft + one notification, then advances.
DO $$
DECLARE slot timestamptz:=date_trunc('minute',now())-interval '5 minutes';
DECLARE loc timestamp:=slot AT TIME ZONE 'Europe/Amsterdam';
BEGIN
 UPDATE paperworld_routines_v1 SET enabled=true,day_of_week=extract(dow FROM loc)::int,
  local_hour=extract(hour FROM loc)::int,local_minute=extract(minute FROM loc)::int
 WHERE id='33333333-3333-4333-8333-333333333333';
 -- Same schedule, so the trigger keeps this explicitly due slot.
 UPDATE paperworld_routines_v1 SET next_review_at=slot WHERE id='33333333-3333-4333-8333-333333333333';
END $$;
DO $$
DECLARE first jsonb; second jsonb; old_slot timestamptz; nxt timestamptz;
BEGIN
 SELECT next_review_at INTO old_slot FROM paperworld_routines_v1 WHERE id='33333333-3333-4333-8333-333333333333';
 first:=paperworld_v5_unified_tick(); second:=paperworld_v5_unified_tick();
 IF first->'routines'->>'staged'<>'1' OR second->'routines'->>'staged'<>'0'
 THEN RAISE EXCEPTION 'not exactly once: % / %',first,second; END IF;
 IF (SELECT count(*) FROM paperworld_routine_slots_v1)<>1
  OR (SELECT count(*) FROM paperworld_autonomous_missions_v5 WHERE status='draft')<>1
  OR (SELECT count(*) FROM paperworld_autonomous_steps_v5)<>0
 THEN RAISE EXCEPTION 'duplicate or runnable routine work'; END IF;
 IF (SELECT (policy->>'maxAiCalls')::int+(policy->>'additionalSpendUsd')::numeric
     FROM paperworld_autonomous_missions_v5 WHERE status='draft')<>0
 THEN RAISE EXCEPTION 'routine draft can spend'; END IF;
 IF (SELECT count(*) FROM paperworld_matt_notifications_v5 WHERE kind='routine_due')<>1
  OR (SELECT count(*) FROM paperworld_agent_messages WHERE content LIKE '%εβδομαδιαία εργασία%'
      AND thread_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1
 THEN RAISE EXCEPTION 'routine notification missing or duplicated'; END IF;
 SELECT next_review_at INTO nxt FROM paperworld_routines_v1 WHERE id='33333333-3333-4333-8333-333333333333';
 IF nxt<>paperworld_routine_slot_after(
   extract(dow FROM old_slot AT TIME ZONE 'Europe/Amsterdam')::int,
   extract(hour FROM old_slot AT TIME ZONE 'Europe/Amsterdam')::int,
   extract(minute FROM old_slot AT TIME ZONE 'Europe/Amsterdam')::int,'Europe/Amsterdam',old_slot)
  OR nxt<=now() THEN RAISE EXCEPTION 'next local slot wrong: %',nxt; END IF;
 IF paperworld_v1_stage_routine_draft('33333333-3333-4333-8333-333333333333',old_slot) IS NOT NULL
 THEN RAISE EXCEPTION 'old slot staged twice'; END IF;
END $$;

-- 6. Missed for over a week, or an invalid slot: fast-forward, never stage old work.
DO $$
DECLARE r jsonb; missions_before bigint;
BEGIN
 SELECT count(*) INTO missions_before FROM paperworld_autonomous_missions_v5;
 ALTER TABLE paperworld_routines_v1 DISABLE TRIGGER paperworld_routines_schedule_v1;
 UPDATE paperworld_routines_v1 SET next_review_at=now()-interval '15 days'
  WHERE id='33333333-3333-4333-8333-333333333333';
 UPDATE paperworld_routines_v1 SET next_review_at=now()-interval '3 minutes 7 seconds'
  WHERE id='44444444-4444-4444-8444-444444444444';
 ALTER TABLE paperworld_routines_v1 ENABLE TRIGGER paperworld_routines_schedule_v1;
 r:=paperworld_v5_unified_tick();
 IF r->'routines'->>'staged'<>'0' OR r->'routines'->>'repaired'<>'2'
  OR (SELECT count(*) FROM paperworld_autonomous_missions_v5)<>missions_before
  OR EXISTS(SELECT 1 FROM paperworld_routines_v1 WHERE enabled AND next_review_at<=now())
 THEN RAISE EXCEPTION 'stuck or stale routine not repaired: %',r; END IF;
END $$;

-- 7. Owner isolation through real RLS.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM paperworld_routines_v1)<>1 OR (SELECT count(*) FROM paperworld_routine_slots_v1)<>1
 THEN RAISE EXCEPTION 'owner 1 RLS mismatch'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM paperworld_routines_v1)<>1 OR (SELECT count(*) FROM paperworld_routine_slots_v1)<>0
 THEN RAISE EXCEPTION 'owner 2 sees another owner'; END IF; END $$;
RESET ROLE;

-- 8. A failing routine stage never suppresses controller, dispatch or notifications.
BEGIN;
CREATE OR REPLACE FUNCTION public.paperworld_v1_review_due_routines() RETURNS jsonb LANGUAGE plpgsql AS
 $$ BEGIN RAISE EXCEPTION 'synthetic routine failure'; END $$;
INSERT INTO public.paperworld_autonomous_missions_v5(owner_id,thread_id,project_id,goal,status,engine)
VALUES('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','studio','Needs owner','needs_you','v1');
DO $$
DECLARE r jsonb;
BEGIN
 r:=paperworld_v5_unified_tick();
 IF r->'routines'->>'state'<>'error' OR r->'controller'->>'state'<>'controller_ok'
  OR r->'dispatch'->>'state'<>'no_due_work' OR r->'notifications'->>'messages'<>'1'
 THEN RAISE EXCEPTION 'routine failure leaked into the tick: %',r; END IF;
END $$;
ROLLBACK;

-- 9. Pausing clears the slot; editing the time recomputes it.
UPDATE paperworld_routines_v1 SET enabled=false WHERE id='33333333-3333-4333-8333-333333333333';
DO $$ BEGIN
 IF (SELECT next_review_at FROM paperworld_routines_v1 WHERE id='33333333-3333-4333-8333-333333333333') IS NOT NULL
 THEN RAISE EXCEPTION 'paused routine kept a slot'; END IF; END $$;
UPDATE paperworld_routines_v1 SET local_hour=7 WHERE id='44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
 IF (SELECT extract(hour FROM next_review_at AT TIME ZONE 'Europe/Amsterdam') FROM paperworld_routines_v1
     WHERE id='44444444-4444-4444-8444-444444444444')<>7
 THEN RAISE EXCEPTION 'edited time not applied'; END IF; END $$;

-- 10. Exactly one cron-facing entry point; the migration created no schedule.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='cron') THEN RAISE EXCEPTION 'unexpected cron schema'; END IF;
END $$;
SELECT 'Routine Loop release integration passed' AS result;
