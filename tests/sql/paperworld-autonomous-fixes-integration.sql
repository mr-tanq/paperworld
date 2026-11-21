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
 last_error text, policy jsonb DEFAULT '{}', report jsonb);
CREATE TABLE public.paperworld_autonomous_steps_v5 (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid, seq integer, capability text, state text, output jsonb);
CREATE TABLE public.paperworld_matt_notifications_v5 (mission_id uuid, owner_id uuid, kind text,
 message_id uuid UNIQUE, PRIMARY KEY (mission_id,kind));

\ir ../../sql/paperworld_v6_autonomous_fixes.sql
\ir ../../sql/paperworld_v6_autonomous_fixes.sql
\ir ../../sql/paperworld_phase1_plain_failures.sql
\ir ../../sql/paperworld_phase1_plain_failures.sql
CREATE TABLE public.paperworld_director_memory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
 project_id text NOT NULL CHECK (project_id IN ('town','workshop','pokemon','wellbeing','studio')),
 kind text NOT NULL CHECK (kind IN ('project_bible','decision','preference','current_state','work_history')),
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','superseded')),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 140),
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
 source_type text NOT NULL CHECK (source_type IN ('project_file','conversation','owner_note','verified_result')),
 source_ref text NOT NULL CHECK (char_length(btrim(source_ref)) BETWEEN 1 AND 400),
 observed_at timestamptz NOT NULL, sensitivity text NOT NULL DEFAULT 'standard', created_at timestamptz DEFAULT now());
\ir ../../sql/paperworld_phase3_learning_memory.sql
\ir ../../sql/paperworld_phase3_learning_memory.sql
INSERT INTO public.paperworld_autonomous_missions_v5(id,owner_id,thread_id,project_id,goal,status,engine,spec,last_error) VALUES
 ('a0000000-0000-4000-8000-000000000007','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
  'listening','g','needs_you','v1','{"title":"Διόρθωση εύρεσης συναυλιών"}','agent_no_changes');
INSERT INTO public.paperworld_autonomous_steps_v5(mission_id,seq,capability,state,output) VALUES
 ('a0000000-0000-4000-8000-000000000007',3,'await_agent','succeeded','{"prUrl":"https://github.com/mr-tanq/concerts/pull/11"}');

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
 INSERT INTO public.paperworld_autonomous_missions_v5(id,owner_id,thread_id,project_id,goal,status,engine,spec,last_error) VALUES
  ('a0000000-0000-4000-8000-000000000005',o,t,'listening','g','needs_you','v1','{"title":"Με επανάληψη"}','trusted_verification_failed'),
  ('a0000000-0000-4000-8000-000000000006',o,t,'listening','g','queued','v1','{"title":"Με επανάληψη"}',null);
 UPDATE public.paperworld_autonomous_missions_v5 SET last_error='trusted_verification_failed'
  WHERE id='a0000000-0000-4000-8000-000000000004';
 UPDATE public.paperworld_autonomous_missions_v5 SET policy='{"retryOf":"a0000000-0000-4000-8000-000000000005"}'
  WHERE id='a0000000-0000-4000-8000-000000000006';
 INSERT INTO public.paperworld_autonomous_steps_v5(mission_id,seq,capability,state,output) VALUES
  ('a0000000-0000-4000-8000-000000000001',5,'report','succeeded',
   '{"title":"Λείπουν συναυλίες","merged":true,"mergeState":"merged","cause":"Η πηγή άλλαξε μορφή ημερομηνίας.","fix":"Διαβάζουμε και τη νέα μορφή.","prUrl":"https://github.com/mr-tanq/concerts/pull/12"}'),
  ('a0000000-0000-4000-8000-000000000002',5,'report','succeeded',
   '{"title":"Φίλτρο πόλης","merged":false,"mergeState":"blocked","prUrl":"https://github.com/mr-tanq/concerts/pull/13"}'),
  ('a0000000-0000-4000-8000-000000000003',5,'report','succeeded','{"title":"Παλιά εργασία"}');
 r:=public.paperworld_v5_notify_matt();
 ASSERT (r->>'messages')::int=6,'six notifications '||r;
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
DO $$ DECLARE txt text; BEGIN
 SELECT content INTO txt FROM public.paperworld_agent_messages WHERE id=md5('a0000000-0000-4000-8000-000000000007:needs_you')::uuid;
 ASSERT txt LIKE '%δεν χρειάστηκε να αλλάξει τίποτα%' AND txt LIKE '%Τι βρήκε:%' AND txt LIKE '%π.χ. πόλη ή καλλιτέχνη%'
  AND txt LIKE '%https://github.com/mr-tanq/concerts/pull/11%','no-change message: '||txt;
 ASSERT (SELECT count(*) FROM public.paperworld_director_memory)=5,'one lesson per finished task, none while retrying';
 SELECT body INTO txt FROM public.paperworld_director_memory WHERE source_ref='mission:a0000000-0000-4000-8000-000000000001';
 ASSERT txt LIKE '%Τι έφταιγε: Η πηγή άλλαξε μορφή ημερομηνίας.%' AND txt LIKE '%μπήκε στην εφαρμογή%','lesson: '||txt;
 ASSERT (SELECT project_id||kind||status||source_type FROM public.paperworld_director_memory
  WHERE source_ref='mission:a0000000-0000-4000-8000-000000000001')='workshopwork_historyapprovedverified_result';
 ASSERT NOT EXISTS(SELECT 1 FROM public.paperworld_director_memory WHERE source_ref='mission:a0000000-0000-4000-8000-000000000005'),'no lesson while a retry runs';
 SELECT body INTO txt FROM public.paperworld_director_memory WHERE source_ref='mission:a0000000-0000-4000-8000-000000000004';
 ASSERT txt LIKE '%Δεν ολοκληρώθηκε: η διόρθωση δεν πέρασε τα tests%','failure lesson: '||txt;
 SELECT content INTO txt FROM public.paperworld_agent_messages WHERE id=md5('a0000000-0000-4000-8000-000000000005:needs_you')::uuid;
 ASSERT txt LIKE '%δεν τα κατάφερε: η διόρθωση δεν πέρασε τα tests%' AND txt LIKE '%το ξαναπιάνει μόνος του%','retry message: '||txt;
END $$;
\ir ../../sql/paperworld_phase2_daily_summary.sql
\ir ../../sql/paperworld_phase2_daily_summary.sql
DO $$ DECLARE txt text; n int; BEGIN
 UPDATE public.paperworld_autonomous_missions_v5 SET report='{"merged":true,"title":"Λείπουν συναυλίες"}'
  WHERE id='a0000000-0000-4000-8000-000000000001';
 UPDATE public.paperworld_autonomous_missions_v5 SET updated_at='2030-01-15 07:30Z';
 ASSERT public.paperworld_v1_daily_summary('2030-01-15 06:30Z')=0,'nothing before 09:00 Amsterdam';
 n:=public.paperworld_v1_daily_summary('2030-01-15 08:30Z');
 ASSERT n=1,'one summary for the owner: '||n;
 ASSERT public.paperworld_v1_daily_summary('2030-01-15 10:30Z')=0,'once per local day';
 ASSERT public.paperworld_v1_daily_summary('2030-01-16 17:30Z')=0,'never an evening good-morning';
 SELECT content INTO txt FROM public.paperworld_agent_messages
  WHERE id=md5('11111111-1111-4111-8111-111111111111:daily:2030-01-15')::uuid;
 ASSERT txt LIKE '%"director": "matt"%' OR txt LIKE '%"director":"matt"%','from Matt: '||txt;
 ASSERT txt LIKE '%Ολοκληρώθηκαν 3 (1 μπήκαν ήδη στην εφαρμογή)%' AND txt LIKE '%«Λείπουν συναυλίες»%'
  AND txt LIKE '%Σε εξέλιξη: 1%' AND txt LIKE '%Χρειάζονται εσένα: 2%','summary: '||txt;
END $$;
SELECT 'Autonomous fixes integration passed' AS result;
ROLLBACK;
