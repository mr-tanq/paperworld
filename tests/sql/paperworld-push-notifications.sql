-- Synthetic PostgreSQL test for sql/paperworld_push_notifications_v1.sql.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;CREATE SCHEMA cron;CREATE SCHEMA vault;CREATE SCHEMA net;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE cron.job(jobname text,schedule text,command text);
CREATE FUNCTION cron.schedule(n text,s text,c text) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO cron.job VALUES(n,s,c);SELECT 1::bigint $$;
CREATE FUNCTION cron.unschedule(n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobname=n;SELECT true $$;
CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
INSERT INTO vault.decrypted_secrets VALUES('paperworld_v5_dispatch_trigger',repeat('s',40)),('paperworld_vapid_private_jwk','{"d":"x"}');
CREATE TABLE net.calls(url text);
CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.calls VALUES(url);SELECT 7::bigint $$;
CREATE TABLE public.paperworld_agent_messages(id uuid primary key,thread_id uuid,owner_id uuid,role text,content text,created_at timestamptz default now());
\ir ../../sql/paperworld_push_notifications_v1.sql
\ir ../../sql/paperworld_push_notifications_v1.sql
DO $$ BEGIN ASSERT (SELECT count(*) FROM cron.job WHERE jobname='paperworld-push')=1,'one schedule';
 ASSERT public.paperworld_push_wakeup()->>'state'='idle','nothing to send without devices'; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.paperworld_push_subscriptions_v1(endpoint,p256dh,auth,created_at)
 VALUES ('https://fcm.googleapis.com/fcm/send/a',repeat('B',87),repeat('a',22),now()-interval '1 hour');
DO $$ BEGIN
 BEGIN INSERT INTO public.paperworld_push_subscriptions_v1(owner_id,endpoint,p256dh,auth)
  VALUES ('22222222-2222-4222-8222-222222222222','https://fcm.googleapis.com/x',repeat('B',87),repeat('a',22));
  RAISE EXCEPTION 'wrote for another owner'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM public.paperworld_push_sent_v1; RAISE EXCEPTION 'owner read ledger';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.paperworld_push_subscriptions_v1)=0,'cannot see another owner'; END $$;
RESET ROLE;
INSERT INTO public.paperworld_agent_messages(id,owner_id,role,content) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','agent','@paperworld-matt:v1:{"kind": "notification", "text": "Έτοιμο"}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','agent','@paperworld-matt:v1:{"director":"matt","text":"chat"}');
DO $$ BEGIN
 ASSERT public.paperworld_push_wakeup()->>'waiting'='1','only the notification waits';
 ASSERT (SELECT count(*) FROM net.calls WHERE url like '%/functions/v1/paperworld-push')=1;
 INSERT INTO public.paperworld_push_sent_v1(message_id,owner_id) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
 ASSERT public.paperworld_push_wakeup()->>'state'='idle','sent once, never again';
END $$;
SELECT 'push notifications sql ok';
