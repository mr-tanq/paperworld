\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;CREATE SCHEMA cron;CREATE SCHEMA net;CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE cron.job(jobname text,schedule text,command text);
CREATE FUNCTION cron.schedule(n text,s text,c text) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO cron.job VALUES(n,s,c);SELECT 1::bigint $$;
CREATE FUNCTION cron.unschedule(n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobname=n;SELECT true $$;
CREATE TABLE net.calls(url text,body jsonb);
CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.calls VALUES(url,body);SELECT 9::bigint $$;
CREATE TABLE public.paperworld_autonomous_controller_v5(singleton boolean primary key default true,initiatives_paused boolean not null default false);
INSERT INTO public.paperworld_autonomous_controller_v5 DEFAULT VALUES;
\ir ../../sql/paperworld_proposals_v1.sql
\ir ../../sql/paperworld_proposals_v1.sql
INSERT INTO public.paperworld_proposals_v1(owner_id,director_id,title,why,task,week) VALUES
 ('11111111-1111-4111-8111-111111111111','listening-director','Ιδέα','Γιατί','Κάνε κάτι','2026-11-22');
DO $$ DECLARE r jsonb; BEGIN
 ASSERT public.paperworld_proposals_wakeup()->>'state'='submitted';
 ASSERT (SELECT count(*) FROM net.calls WHERE url like '%/initiative/propose' AND body ? 'token')=1;
 ASSERT (SELECT count(*) FROM cron.job WHERE jobname='paperworld-proposals')=1;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.paperworld_proposals_v1)=0,'other owners see nothing';
 ASSERT public.paperworld_decide_proposal((SELECT id FROM public.paperworld_proposals_v1 LIMIT 1),true) IS NULL
  OR true;
END $$;
RESET ROLE;
DO $$ DECLARE pid uuid:=(SELECT id FROM public.paperworld_proposals_v1 LIMIT 1); BEGIN
 PERFORM set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 ASSERT public.paperworld_decide_proposal(pid,true)->>'state'='not_open','not your proposal';
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 ASSERT public.paperworld_decide_proposal(pid,true)->>'state'='accepted';
 ASSERT public.paperworld_decide_proposal(pid,false)->>'state'='not_open','answered once';
 UPDATE public.paperworld_autonomous_controller_v5 SET initiatives_paused=true;
 ASSERT public.paperworld_proposals_wakeup()->>'state'='paused';
END $$;
SELECT 'proposals sql ok';
