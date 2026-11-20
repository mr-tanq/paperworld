-- Synthetic PostgreSQL test for sql/paperworld_dismissed_items_v1.sql (RLS between owners).
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
\ir ../../sql/paperworld_dismissed_items_v1.sql
\ir ../../sql/paperworld_dismissed_items_v1.sql
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.paperworld_dismissed_items_v1(item_key) VALUES ('mission:0806232f-a6f4-4038-a4b3-b2e273b4e4bb'),('handoff:abc');
DO $$ BEGIN
 BEGIN INSERT INTO public.paperworld_dismissed_items_v1(owner_id,item_key) VALUES ('22222222-2222-4222-8222-222222222222','job:x');
  RAISE EXCEPTION 'wrote for another owner'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.paperworld_dismissed_items_v1(item_key) VALUES ('bad key with spaces');
  RAISE EXCEPTION 'bad key accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.paperworld_dismissed_items_v1)=0,'cannot see another owner';
 DELETE FROM public.paperworld_dismissed_items_v1; -- affects nothing of owner one
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.paperworld_dismissed_items_v1)=2,'own rows intact';
 DELETE FROM public.paperworld_dismissed_items_v1 WHERE item_key='handoff:abc';
 ASSERT (SELECT count(*) FROM public.paperworld_dismissed_items_v1)=1,'undo works';
END $$;
RESET ROLE;
SELECT 'Dismissed items RLS passed' AS result;
