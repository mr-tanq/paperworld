-- Real PostgreSQL 17 disposable integration: zero network/AI, synthetic IDs.
\set ON_ERROR_STOP on
begin;
create schema if not exists auth;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
create table public.paperworld_agent_threads (
 id uuid primary key,owner_id uuid not null references auth.users(id),
 agent_id text not null,unique(id,owner_id));
insert into public.paperworld_agent_threads values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','matt');
\i sql/paperworld_autonomous_core_v5.sql
-- The actual production controller table is already installed by its
-- preceding migration. In isolated CI, reproduce its exact pre-dispatch DDL.
create table public.paperworld_autonomous_controller_v5 (
 singleton boolean primary key default true check(singleton=true),
 last_tick_at timestamptz,tick_count bigint not null default 0,
 recovered_steps bigint not null default 0,ready_steps integer not null default 0,
 waiting_missions integer not null default 0,last_error text
);
alter table public.paperworld_autonomous_controller_v5 enable row level security;
revoke all on public.paperworld_autonomous_controller_v5 from anon,authenticated;
insert into public.paperworld_autonomous_controller_v5(singleton) values(true);
\i sql/paperworld_v5_dispatch_v1.sql
\i sql/paperworld_v5_dispatch_v1_simulation.sql

do $$
declare
 a uuid:='11111111-1111-4111-8111-111111111111';
 thread uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 m uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 s1 uuid; s2 uuid;
 worker uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 thief uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 packet record;
 n integer;
begin
 if has_function_privilege('authenticated','public.paperworld_v5_begin_effect(uuid,uuid,text,text,text)','execute')
  or has_table_privilege('authenticated','public.paperworld_autonomous_effects_v5','insert')
  or has_table_privilege('anon','public.paperworld_autonomous_effects_v5','select')
 then raise exception 'public can start external effect'; end if;
 insert into public.paperworld_autonomous_missions_v5
 (id,owner_id,thread_id,project_id,goal,status,policy)
 values(m,a,thread,'pokemon','Synthetic offline test','draft',
  '{"maxAiCalls":0,"additionalSpendUsd":0}'::jsonb);
 if not public.paperworld_v5_queue_mission(m,'simulation')
  then raise exception 'queue failed'; end if;
 if public.paperworld_v5_queue_mission(m,'simulation')
  then raise exception 'duplicate queue allowed'; end if;
 select id into s1 from public.paperworld_autonomous_steps_v5 where mission_id=m and seq=1;
 insert into public.paperworld_autonomous_steps_v5
 (mission_id,owner_id,seq,role_id,capability,state,idempotency_key,input)
 values(m,a,2,'pokemon-director','dry_run','pending',
  'sim:'||m::text||':2','{"simulation":true}'::jsonb)
 returning id into s2;
 select * into packet from public.paperworld_v5_claim_step(worker,600);
 if packet.step_id<>s1 then raise exception 'wrong first step'; end if;
 if exists(select 1 from public.paperworld_v5_claim_step(thief,600))
 then raise exception 'concurrent or out of order step claimed'; end if;
 if public.paperworld_v5_complete_step(s1,thief,'{}'::jsonb)
 then raise exception 'stale worker completion accepted'; end if;
 if not public.paperworld_v5_heartbeat(s1,worker,600)
 then raise exception 'heartbeat rejected'; end if;
 if public.paperworld_v5_begin_effect(s1,worker,'sim-key-test-0001',
  'dry_run','dry_run')<>'reserved'
 then raise exception 'simulation effect failed'; end if;
 if public.paperworld_v5_begin_effect(s1,worker,'sim-key-test-0001',
  'dry_run','dry_run')<>'uncertain'
 then raise exception 'duplicate effect did not fail closed'; end if;
 if public.paperworld_v5_complete_step(s1,worker,'{}'::jsonb)
 then raise exception 'unconfirmed external effect allowed completion'; end if;
 if not public.paperworld_v5_confirm_effect('sim-key-test-0001',worker,
  '{"simulation":true}'::jsonb)
 then raise exception 'effect confirmation failed'; end if;
 if not public.paperworld_v5_complete_step(s1,worker,
  '{"simulation":true,"noRealWork":true}'::jsonb)
 then raise exception 'step completion failed'; end if;
 if (select state from public.paperworld_autonomous_steps_v5 where id=s2)<>'ready'
 then raise exception 'second step not promoted'; end if;
 select * into packet from public.paperworld_v5_claim_step(worker,600);
 if packet.step_id<>s2 then raise exception 'ordered step 2 not claimed'; end if;
 if not public.paperworld_v5_complete_step(s2,worker,'{"simulation":true}'::jsonb)
 then raise exception 'second completion failed'; end if;
 if (select status from public.paperworld_autonomous_missions_v5 where id=m)<>'completed'
 then raise exception 'mission never reaches completed'; end if;
 if (select count(*) from public.paperworld_autonomous_events_v5
   where mission_id=m and event_type='mission_completed')<>1
 then raise exception 'mission completion not audited exactly once'; end if;
 if exists(select 1 from public.paperworld_v5_claim_step(thief,600))
 then raise exception 'terminal mission replay'; end if;
end $$;

-- Second synthetic mission: crash AFTER an effect intent. It may not retry.
do $$
declare
 a uuid:='11111111-1111-4111-8111-111111111111';
 m uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 worker uuid:='ffffffff-ffff-4fff-8fff-ffffffffffff';
 r record;
begin
 insert into public.paperworld_autonomous_missions_v5
 (id,owner_id,thread_id,project_id,goal,status,policy)
 values(m,a,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','pokemon',
  'Synthetic crash simulation','draft',
  '{"maxAiCalls":0,"additionalSpendUsd":0}'::jsonb);
 if not public.paperworld_v5_queue_mission(m,'simulation')
 then raise exception 'second queue failed'; end if;
 select * into r from public.paperworld_v5_claim_step(worker,600);
 if public.paperworld_v5_begin_effect(r.step_id,worker,'crash-intent-001',
  'dry_run','dry_run')<>'reserved' then raise exception 'cannot reserve intent'; end if;
 update public.paperworld_autonomous_steps_v5
 set lease_expires_at=now()-interval '1 minute' where id=r.step_id;
 if public.paperworld_v5_reclaim_expired()<>1
 then raise exception 'expired lease not reclaimed'; end if;
 if (select state from public.paperworld_autonomous_effects_v5
   where effect_key='crash-intent-001')<>'uncertain'
 then raise exception 'effect not marked uncertain'; end if;
 if (select status from public.paperworld_autonomous_missions_v5
   where id=m)<>'needs_you'
 then raise exception 'uncertain mission not blocked'; end if;
 if exists(select 1 from public.paperworld_v5_claim_step(worker,600))
 then raise exception 'uncertain external task restarted'; end if;
end $$;

-- Budget denial is checked transactionally before effect insertion.
do $$
declare
 a uuid:='11111111-1111-4111-8111-111111111111';
 m uuid:='99999999-9999-4999-8999-999999999999';
 worker uuid:='88888888-8888-4888-8888-888888888888';
 r record;
begin
 insert into public.paperworld_autonomous_missions_v5
 (id,owner_id,thread_id,project_id,goal,status,policy)
 values(m,a,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','pokemon',
  'Synthetic billing gate','queued',
  '{"maxAiCalls":1,"additionalSpendUsd":0}'::jsonb);
 insert into public.paperworld_autonomous_steps_v5
 (mission_id,owner_id,seq,role_id,capability,state,idempotency_key)
 values(m,a,1,'pokemon-director','start_agent','ready','synthetic-agent-01');
 select * into r from public.paperworld_v5_claim_step(worker,600);
 if r.step_id is null then raise exception 'paid step not claimed'; end if;
 if public.paperworld_v5_begin_effect(r.step_id,worker,'paid-effect-0001',
  'copilot_agent','start_agent')<>'denied'
 then raise exception 'kill switch failed'; end if;
 update public.paperworld_autonomous_controller_v5 set
  dispatch_enabled=true,live_adapters=array['copilot_agent'],
  credit_snapshot=1499,credit_snapshot_at=now();
 if public.paperworld_v5_begin_effect(r.step_id,worker,'paid-effect-0001',
  'copilot_agent','start_agent')<>'budget_denied'
 then raise exception 'credit threshold was bypassed'; end if;
 if (select count(*) from public.paperworld_autonomous_effects_v5
   where mission_id=m)<>0
 then raise exception 'budget denied after external intent'; end if;
end $$;

-- Simulated offline scheduler dispatch goes to completion without a model.
do $
declare
 a uuid:='11111111-1111-4111-8111-111111111111';
 m uuid:='77777777-7777-4777-8777-777777777777';
 result jsonb;
begin
 insert into public.paperworld_autonomous_missions_v5
 (id,owner_id,thread_id,project_id,goal,status,policy)
 values(m,a,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','studio',
  'Synthetic scheduled work','draft',
  '{"maxAiCalls":0,"additionalSpendUsd":0}'::jsonb);
 if not public.paperworld_v5_queue_mission(m,'simulation')
 then raise exception 'simulation queue refused'; end if;
 result:=public.paperworld_v5_controller_tick();
 if result->'simulation'->>'status'<>'simulation_completed'
 then raise exception 'cron did not execute simulation: %',result; end if;
 if (select status from public.paperworld_autonomous_missions_v5
    where id=m)<>'completed'
 then raise exception 'scheduled simulation never completed'; end if;
 if (select policy->>'executionMode' from public.paperworld_autonomous_missions_v5
    where id=m)<>'simulation'
 then raise exception 'simulated outcome not labeled'; end if;
 if (select count(*) from public.paperworld_autonomous_effects_v5
    where mission_id=m and sessions=1)<>0
 then raise exception 'simulation spent a session'; end if;
 if public.paperworld_v5_controller_tick()->'simulation'->>'status'<>'idle'
 then raise exception 'simulation reran terminal mission'; end if;
end $;
rollback;
select 'PASS: real PostgreSQL 17 lifecycle, uncertain effects, offline simulation, budget and RLS' as result;
