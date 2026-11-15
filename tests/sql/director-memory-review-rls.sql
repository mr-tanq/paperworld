-- Synthetic offline PostgreSQL RLS integration, NOT connected to Supabase.
-- Runs in a throwaway GitHub Actions PostgreSQL 17 service.
-- Never reads personal content or production credentials.
\set ON_ERROR_STOP on

-- This isolated fixture mimics Supabase auth.uid() and two distinct identities.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE auth.users(id uuid primary key);
CREATE FUNCTION auth.uid() RETURNS uuid
 LANGUAGE sql STABLE SET search_path=''
 AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
 $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;

INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');

-- The historical table is created using the exact applied schema audit copy.
\i supabase/paperworld_director_memory_v1_APPLIED_AUDIT.sql

INSERT INTO public.paperworld_director_memory
(id,owner_id,project_id,kind,status,title,body,source_type,source_ref,observed_at,version,sensitivity)
VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'studio','project_bible','proposed','Owner A song','A private demo','owner_note','synthetic-A',now(),1,'private'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',
 'workshop','decision','proposed','Owner B app','B private demo','owner_note','synthetic-B',now(),1,'private'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111',
 'studio','decision','proposed','Owner A second','A second demo','owner_note','synthetic-A2',now(),1,'standard');

-- Execute the unchanged proposed migration in the disposable database only.
\i supabase/director_memory_review_v2_REVIEW_ONLY.sql

-- The authenticated actor must not be allowed to edit fields besides status.
DO $$
BEGIN
 IF has_column_privilege('authenticated','public.paperworld_director_memory','title','UPDATE')
 OR has_column_privilege('authenticated','public.paperworld_director_memory','body','UPDATE')
 OR has_column_privilege('authenticated','public.paperworld_director_memory','owner_id','UPDATE')
 OR has_table_privilege('authenticated','public.paperworld_director_memory_review_log','INSERT')
 OR has_table_privilege('authenticated','public.paperworld_director_memory_review_log','UPDATE')
 OR has_table_privilege('anon','public.paperworld_director_memory_review_log','SELECT')
 THEN RAISE EXCEPTION 'review privileges too broad'; END IF;
END;
$$;

-- Both identities share the same postgres role but have distinct auth.uid claims.
-- The role/claim combination mirrors JWT role + sub enforcement in PostgREST;
-- it is NOT a substitute for two real Supabase Auth sessions.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.paperworld_director_memory;
 IF n<>2 THEN RAISE EXCEPTION 'owner A can read % rows (expected 2)',n; END IF;
 SELECT count(*) INTO n FROM public.paperworld_director_memory_review_log;
 IF n<>0 THEN RAISE EXCEPTION 'unexpected reviews before owner action'; END IF;

 -- Must not alter owner B's row (zero affected, no audit).
 UPDATE public.paperworld_director_memory SET status='approved'
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'cross-owner approval succeeded'; END IF;

 UPDATE public.paperworld_director_memory SET status='approved'
 WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND status='proposed';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'owner A approval affected % rows',n; END IF;
 SELECT count(*) INTO n FROM public.paperworld_director_memory_review_log;
 IF n<>1 THEN RAISE EXCEPTION 'expected exactly one owner audit row'; END IF;

 -- Replay cannot approve the already decided row.
 UPDATE public.paperworld_director_memory SET status='rejected'
 WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'replay changed a reviewed memory'; END IF;

 -- Invalid status transition must fail; cannot bypass CHECK/RLS.
 BEGIN
  UPDATE public.paperworld_director_memory SET status='superseded'
  WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  RAISE EXCEPTION 'superseded approval should not succeed';
 EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL;
 END;

 SELECT count(*) INTO n FROM public.paperworld_director_memory_review_log;
 IF n<>1 THEN RAISE EXCEPTION 'replay or invalid update polluted audit'; END IF;
END;
$$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.paperworld_director_memory;
 IF n<>1 THEN RAISE EXCEPTION 'owner B can read % rows (expected 1)',n; END IF;
 SELECT count(*) INTO n FROM public.paperworld_director_memory_review_log;
 IF n<>0 THEN RAISE EXCEPTION 'owner B can read A audit'; END IF;
 UPDATE public.paperworld_director_memory SET status='rejected'
 WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'B changed A entry'; END IF;

 UPDATE public.paperworld_director_memory SET status='rejected'
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND status='proposed';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'owner B rejection did not persist'; END IF;
 SELECT count(*) INTO n FROM public.paperworld_director_memory_review_log;
 IF n<>1 THEN RAISE EXCEPTION 'owner B audit mismatch'; END IF;
END;
$$;
RESET ROLE;

-- Final superuser-only verification that two independent audit events exist.
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.paperworld_director_memory_review_log;
 IF n<>2 THEN RAISE EXCEPTION 'expected two audited decisions, got %',n; END IF;
 SELECT count(*) INTO n FROM public.paperworld_director_memory
 WHERE status='approved';
 IF n<>1 THEN RAISE EXCEPTION 'expected one approved entry'; END IF;
 SELECT count(*) INTO n FROM public.paperworld_director_memory
 WHERE status='rejected';
 IF n<>1 THEN RAISE EXCEPTION 'expected one rejected entry'; END IF;
END;
$$;
SELECT 'PASS: isolated two-identity RLS owner approvals, rejects and audit' AS result;
