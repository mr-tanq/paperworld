-- Synthetic PostgreSQL test for sql/paperworld_v6_autonomous_fixes.sql.
-- NEVER run against a real Supabase project. Fixture mirrors the live columns.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE public.paperworld_autonomous_controller_v5 (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton=true),
 sessions_per_day integer NOT NULL DEFAULT 1, sessions_per_month integer NOT NULL DEFAULT 10,
 sessions_per_mission integer NOT NULL DEFAULT 1, credit_stop_at integer NOT NULL DEFAULT 1050,
 credit_snapshot integer,
 CONSTRAINT pw_v5_budget_limits CHECK (sessions_per_day BETWEEN 0 AND 10 AND
  sessions_per_month BETWEEN 0 AND 100 AND sessions_per_mission BETWEEN 0 AND 3));
INSERT INTO public.paperworld_autonomous_controller_v5 DEFAULT VALUES;
CREATE TABLE public.paperworld_agent_threads (id uuid, owner_id uuid, agent_id text, PRIMARY KEY (id,owner_id));
CREATE TABLE public.paperworld_agent_messages (id uuid PRIMARY KEY, thread_id uuid, owner_id uuid,
 role text, content text);
CREATE TABLE public.paperworld_autonomous_missions_v5 (id uuid PRIMARY KEY, owner_id uuid, thread_id uuid,
 project_id text, goal text, status text, engine text, spec jsonb, updated_at timestamptz DEFAULT now(),
 last_error text);
CREATE TABLE public.paperworld_autonomous_steps_v5 (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid, seq integer, capability text, state text, output jsonb);
CREATE TABLE public.paperworld_matt_notifications_v5 (mission_id uuid, owner_id uuid, kind text,
 message_id uuid UNIQUE, PRIMARY KEY (mission_id,kind));

\ir ../../sql/paperworld_v6_autonomous_fixes.sql
\ir ../../sql/paperworld_v6_autonomous_fixes.sql
\ir ../../sql/paperworld_phase1_plain_failures.sql
\ir ../../sql/paperworld_phase1_plain_failures.sql

DO $$
DECLARE o uuid:='11111111-1111-4111-8111-111111111111'; t uuid:='22222222-2222-4222-8222-222222222222';
 c record; r jsonb; txt text;
BEGIN
 SELECT * INTO c FROM public.paperworld_autonomous_controller_v5;
 ASSERT c.auto_merge_verified AND c.sessions_per_day=5 AND c.sessions_per_month=60,'owner limits and auto-merge applied';
 INSERT INTO public.paperworld_agent_threads VALUES (t,o,'matt');
 INSERT INTO public.paperworld_autonomous_missions_v5 VALUES
  ('a0000000-0000-4000-8000-000000000001',o,t,'listening','g','completed','v1','{"title":"Λείπουν συναυλίες"}'),
  ('a0000000-0000-4000-8000-000000000002',o,t,'listening','g','completed','v1','{"title":"Φίλτρο πόλης"}'),
  ('a0000000-0000-4000-8000-000000000003',o,t,'listening','g','completed','v1','{"title":"Παλιά εργασία"}'),
  ('a0000000-0000-4000-8000-000000000004',o,t,'listening','g','needs_you','v1','{"title":"Αποτυχία"}');
 UPDATE public.paperworld_autonomous_missions_v5 SET last_error='trusted_verification_failed'
  WHERE id='a0000000-0000-4000-8000-000000000004';
 INSERT INTO public.paperworld_autonomous_steps_v5(mission_id,seq,capability,state,output) VALUES
  ('a0000000-0000-4000-8000-000000000001',5,'report','succeeded',
   '{"title":"Λείπουν συναυλίες","merged":true,"mergeState":"merged","cause":"Η πηγή άλλαξε μορφή ημερομηνίας.","fix":"Διαβάζουμε και τη νέα μορφή.","prUrl":"https://github.com/mr-tanq/concerts/pull/12"}'),
  ('a0000000-0000-4000-8000-000000000002',5,'report','succeeded',
   '{"title":"Φίλτρο πόλης","merged":false,"mergeState":"blocked","prUrl":"https://github.com/mr-tanq/concerts/pull/13"}'),
  ('a0000000-0000-4000-8000-000000000003',5,'report','succeeded','{"title":"Παλιά εργασία"}');
 r:=public.paperworld_v5_notify_matt();
 ASSERT (r->>'messages')::int=4,'four notifications '||r;
 ASSERT (public.paperworld_v5_notify_matt()->>'messages')::int=0,'never notified twice';
 SELECT content INTO txt FROM public.paperworld_agent_messages WHERE id=md5('a0000000-0000-4000-8000-000000000001:completed')::uuid;
 ASSERT txt LIKE '%Το βρήκαμε και το φτιάξαμε: «Λείπουν συναυλίες»%' AND txt LIKE '%Τι έφταιγε: Η πηγή άλλαξε μορφή ημερομηνίας.%'
  AND txt LIKE '%Τι αλλάξαμε: Διαβάζουμε και τη νέα μορφή.%' AND txt LIKE '%μπήκε ήδη στην εφαρμογή%','merged story: '||txt;
 SELECT content INTO txt FROM public.paperworld_agent_messages WHERE id=md5('a0000000-0000-4000-8000-000000000002:completed')::uuid;
 ASSERT txt LIKE '%είναι έτοιμη και πέρασε όλους τους ελέγχους%' AND txt LIKE '%ένα πάτημα από σένα%'
  AND txt LIKE '%https://github.com/mr-tanq/concerts/pull/13%' AND txt NOT LIKE '%μπήκε ήδη%','blocked: '||txt;
 SELECT content INTO txt FROM public.paperworld_agent_messages WHERE id=md5('a0000000-0000-4000-8000-000000000003:completed')::uuid;
 ASSERT txt LIKE '%Δεν σημαίνει ότι η αλλαγή έχει ήδη δημοσιευτεί%','legacy wording kept for old missions';
 SELECT content INTO txt FROM public.paperworld_agent_messages WHERE id=md5('a0000000-0000-4000-8000-000000000004:needs_you')::uuid;
 ASSERT txt LIKE '%«Αποτυχία»%' AND txt LIKE '%δεν πέρασε τα tests%' AND txt LIKE '%Δεν άλλαξε τίποτα στην εφαρμογή%'
  AND txt NOT LIKE '%trusted_verification%','needs_you explains in plain words: '||txt;
 BEGIN
  UPDATE public.paperworld_autonomous_controller_v5 SET sessions_per_day=50;
  RAISE EXCEPTION 'limit not enforced';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT 'Autonomous fixes integration passed' AS result;
ROLLBACK;
