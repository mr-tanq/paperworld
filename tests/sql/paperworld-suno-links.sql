-- Synthetic PostgreSQL test for sql/paperworld_suno_links_v1.sql: real sealed values are accepted.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111');
\ir ../../sql/paperworld_suno_links_v1.sql
\ir ../../sql/paperworld_suno_links_v1.sql
INSERT INTO public.paperworld_suno_links_v1(owner_id,sealed) VALUES ('11111111-1111-4111-8111-111111111111','v1.'||repeat('Ab_-',600));
DO $$ BEGIN
 BEGIN INSERT INTO public.paperworld_suno_links_v1(owner_id,sealed) VALUES ('11111111-1111-4111-8111-111111111111','plain');
  RAISE EXCEPTION 'unsealed accepted'; EXCEPTION WHEN check_violation OR unique_violation THEN NULL; END;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM 1 FROM public.paperworld_suno_links_v1; RAISE EXCEPTION 'browser read links';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT 'suno links sql ok';
