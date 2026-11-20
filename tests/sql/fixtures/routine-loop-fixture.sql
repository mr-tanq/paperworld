-- Shared synthetic fixture for Routine Loop tests (live schema mirror, 2026-11-19).
-- NEVER run against a real Supabase project. Fixture mirrors the live schema
-- (2026-11-19, read-only inspection) incl. a verbatim paperworld_v5_notify_matt.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.paperworld_agent_threads (
 id uuid NOT NULL, owner_id uuid NOT NULL REFERENCES auth.users(id),
 agent_id text NOT NULL, PRIMARY KEY (id,owner_id));
CREATE TABLE public.paperworld_agent_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL, owner_id uuid NOT NULL,
 role text NOT NULL CHECK (role IN ('human','agent')), content text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (thread_id,owner_id) REFERENCES public.paperworld_agent_threads(id,owner_id));
CREATE TABLE public.paperworld_autonomous_missions_v5 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id),
 thread_id uuid NOT NULL, project_id text NOT NULL
  CHECK (project_id IN ('listening','pokemon','studio','wellbeing')),
 goal text NOT NULL, status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft','planned','queued','running','working','verifying','needs_you',
   'paused_budget','completed','failed','cancelled')),
 policy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(policy)='object'),
 current_step integer DEFAULT 0, ai_calls_used integer DEFAULT 0, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 engine text CHECK (engine IS NULL OR engine IN ('pilot','v1')), spec jsonb, report jsonb,
 UNIQUE (id,owner_id),
 FOREIGN KEY (thread_id,owner_id) REFERENCES public.paperworld_agent_threads(id,owner_id));
CREATE TABLE public.paperworld_autonomous_steps_v5 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mission_id uuid, state text NOT NULL DEFAULT 'ready');
CREATE TABLE public.paperworld_matt_notifications_v5 (
 mission_id uuid NOT NULL REFERENCES public.paperworld_autonomous_missions_v5(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL, kind text NOT NULL, message_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (mission_id,kind),
 CONSTRAINT paperworld_matt_notifications_v5_kind_check
  CHECK (kind IN ('completed','needs_you','stalled')));
CREATE FUNCTION public.paperworld_v5_controller_tick() RETURNS jsonb LANGUAGE sql AS
 $$ SELECT '{"state":"controller_ok"}'::jsonb $$;
CREATE FUNCTION public.paperworld_v5_unified_wakeup() RETURNS jsonb LANGUAGE sql AS
 $$ SELECT '{"state":"no_due_work"}'::jsonb $$;
-- Verbatim live notifier (read-only copy).
CREATE FUNCTION public.paperworld_v5_notify_matt() RETURNS jsonb LANGUAGE plpgsql
 SET search_path TO 'public' AS $function$
declare notice record;declare new_count integer:=0;declare msg text;declare speaker text;declare stored_id uuid;
begin
 if not pg_try_advisory_xact_lock(534128,18) then return jsonb_build_object('state','busy','messages',0); end if;
 for notice in
  select m.id,m.owner_id,m.thread_id,m.project_id,m.goal,m.status,
   case when m.status='completed' then 'completed' when m.status='needs_you' then 'needs_you' else 'stalled' end as kind
  from public.paperworld_autonomous_missions_v5 m
  join public.paperworld_agent_threads t on t.id=m.thread_id and t.owner_id=m.owner_id and t.agent_id='matt'
  where m.engine='v1' and (m.status in ('completed','needs_you') or
    (m.status in ('queued','running','working','verifying') and m.updated_at<now()-interval '2 hours'))
   and not exists (select 1 from public.paperworld_matt_notifications_v5 n where n.mission_id=m.id and n.kind=case
     when m.status='completed' then 'completed' when m.status='needs_you' then 'needs_you' else 'stalled' end)
  order by m.updated_at limit 50
 loop
  speaker:=case notice.project_id when 'pokemon' then 'Ο Joey' when 'listening' then 'Η Luna'
   when 'studio' then 'Ο Crow' when 'wellbeing' then 'Ο Dave' else 'Η ομάδα' end;
  msg:=case notice.kind when 'completed' then speaker||' ολοκλήρωσε την εργασία.'
   when 'needs_you' then speaker||' χρειάζεται τη βοήθειά σου.' else speaker||' δεν έχει νέα.' end;
  stored_id:=md5(notice.id::text||':'||notice.kind)::uuid;
  insert into public.paperworld_matt_notifications_v5(mission_id,owner_id,kind,message_id)
  values(notice.id,notice.owner_id,notice.kind,stored_id) on conflict do nothing;
  if not found then continue; end if;
  insert into public.paperworld_agent_messages(id,thread_id,owner_id,role,content)
  values(stored_id,notice.thread_id,notice.owner_id,'agent','@paperworld-matt:v1:'||jsonb_build_object(
   'director','listening-director','text',msg,'kind','notification')::text) on conflict (id) do nothing;
  if not found then raise exception 'matt_notification_message_conflict'; end if;
  new_count:=new_count+1;
 end loop;
 return jsonb_build_object('state','ok','messages',new_count);
end $function$;
-- Live pre-release tick (verbatim).
CREATE FUNCTION public.paperworld_v5_unified_tick() RETURNS jsonb LANGUAGE plpgsql
 SET search_path TO 'public' AS $function$
declare ctrl jsonb;declare wake jsonb;declare notices jsonb;
begin
 ctrl:=public.paperworld_v5_controller_tick();
 wake:=public.paperworld_v5_unified_wakeup();
 begin notices:=public.paperworld_v5_notify_matt();
 exception when others then notices:='{"state":"error"}'::jsonb; end;
 return jsonb_build_object('controller',ctrl,'dispatch',wake,'notifications',notices);
end $function$;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO public.paperworld_agent_threads(id,owner_id,agent_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','matt'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','matt');
COMMIT;

