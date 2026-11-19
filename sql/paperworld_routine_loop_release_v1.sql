-- PAPERWORLD ROUTINE LOOP — RELEASE MIGRATION v1 (owner-applied, REVIEW FIRST)
-- Supersedes the never-applied paperworld_routine_loop_v1/v2_REVIEW_ONLY drafts.
--
-- What this adds
--  * Durable, owner-scoped weekly routines in LOCAL time with an IANA time
--    zone (default Europe/Amsterdam). PostgreSQL's time-zone rules handle
--    daylight saving: "Monday 09:00" stays 09:00 in Amsterdam all year.
--  * Exactly one draft mission per routine per due slot (PK + row lock +
--    advisory lock), staged ONLY by the existing V5 five-minute heartbeat.
--  * A friendly Matt notification for each staged review (idempotent).
--  * Missed/invalid slots fast-forward instead of getting stuck.
--
-- What this deliberately does NOT do
--  * No new cron job (the existing paperworld-v5-safe-controller is reused).
--  * No AI calls, no queueing, no runnable steps, no spend: routines create
--    "draft_review_only" missions with maxAiCalls=0 and additionalSpendUsd=0.
--  * The live unified tick keeps its controller, dispatch and Matt
--    notification stages exactly; the routine stage is isolated so a failure
--    can never suppress them.
--
-- Rollback: see the end of this file (commented, owner-run only).
begin;

-- ---------------------------------------------------------------- schedule
create table if not exists public.paperworld_routines_v1 (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 thread_id uuid not null,
 project_id text not null check (project_id in ('listening','pokemon','studio','wellbeing')),
 goal text not null check (char_length(btrim(goal)) between 1 and 1200),
 enabled boolean not null default false,
 day_of_week integer not null check (day_of_week between 0 and 6),   -- 0=Sunday (JS/PG dow)
 local_hour integer not null check (local_hour between 0 and 23),
 local_minute integer not null check (local_minute between 0 and 59),
 timezone text not null default 'Europe/Amsterdam'
  check (timezone in ('Europe/Amsterdam','UTC')),
 max_ai_calls integer not null default 0 check (max_ai_calls=0),
 additional_spend_usd numeric(12,2) not null default 0 check (additional_spend_usd=0),
 next_review_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (thread_id,owner_id) references public.paperworld_agent_threads(id,owner_id),
 unique (id,owner_id)
);
create table if not exists public.paperworld_routine_slots_v1 (
 routine_id uuid not null,
 owner_id uuid not null,
 scheduled_at timestamptz not null,
 mission_id uuid not null unique,
 created_at timestamptz not null default now(),
 primary key (routine_id,scheduled_at),
 foreign key (routine_id,owner_id) references public.paperworld_routines_v1(id,owner_id)
  on delete cascade,
 foreign key (mission_id,owner_id) references public.paperworld_autonomous_missions_v5(id,owner_id)
  on delete cascade
);
create index if not exists paperworld_routines_due_v1
 on public.paperworld_routines_v1(next_review_at) where enabled;
alter table public.paperworld_routines_v1 enable row level security;
alter table public.paperworld_routine_slots_v1 enable row level security;
revoke all on public.paperworld_routines_v1,public.paperworld_routine_slots_v1
 from public,anon,authenticated;
grant select on public.paperworld_routines_v1,public.paperworld_routine_slots_v1 to authenticated;
drop policy if exists paperworld_routines_owner_read_v1 on public.paperworld_routines_v1;
create policy paperworld_routines_owner_read_v1 on public.paperworld_routines_v1
 for select to authenticated using ((select auth.uid())=owner_id);
drop policy if exists paperworld_routine_slots_owner_read_v1 on public.paperworld_routine_slots_v1;
create policy paperworld_routine_slots_owner_read_v1 on public.paperworld_routine_slots_v1
 for select to authenticated using ((select auth.uid())=owner_id);
-- Writes are service-role only, through the authenticated owner API.

-- First local occurrence of (weekday, hh:mm) in tz strictly AFTER p_after.
-- Local times that do not exist (spring-forward gap) resolve forward, as
-- PostgreSQL does; repeated local times (autumn) resolve deterministically.
create or replace function public.paperworld_routine_slot_after(
 p_day integer,p_hour integer,p_minute integer,p_tz text,p_after timestamptz)
returns timestamptz language plpgsql stable set search_path=public as $$
declare local_now timestamp;
declare base date;
declare candidate timestamptz;
begin
 if p_day not between 0 and 6 or p_hour not between 0 and 23 or
    p_minute not between 0 and 59 or p_after is null then return null; end if;
 local_now:=p_after at time zone p_tz;
 base:=local_now::date+((p_day-extract(dow from local_now)::int+7)%7);
 for i in 0..2 loop
  candidate:=((base+i*7)+make_time(p_hour,p_minute,0)) at time zone p_tz;
  if candidate>p_after then return candidate; end if;
 end loop;
 return null;
end $$;
revoke all on function public.paperworld_routine_slot_after(integer,integer,integer,text,timestamptz)
 from public,anon;
grant execute on function public.paperworld_routine_slot_after(integer,integer,integer,text,timestamptz)
 to authenticated,service_role;

-- The database owns next_review_at: enabling or changing the schedule
-- recomputes it; pausing clears it. Staging advances it itself.
create or replace function public.paperworld_routines_schedule_v1()
returns trigger language plpgsql set search_path=public as $$
begin
 new.updated_at:=now();
 if not new.enabled then
  new.next_review_at:=null;
 elsif tg_op='INSERT' or not old.enabled or
   new.day_of_week<>old.day_of_week or new.local_hour<>old.local_hour or
   new.local_minute<>old.local_minute or new.timezone<>old.timezone then
  new.next_review_at:=public.paperworld_routine_slot_after(
   new.day_of_week,new.local_hour,new.local_minute,new.timezone,now());
 end if;
 return new;
end $$;
drop trigger if exists paperworld_routines_schedule_v1 on public.paperworld_routines_v1;
create trigger paperworld_routines_schedule_v1 before insert or update
 on public.paperworld_routines_v1 for each row execute function public.paperworld_routines_schedule_v1();

-- ----------------------------------------------------------- notifications
-- Allow one additional, routine-specific notification kind (same table, same
-- idempotent pattern as the live paperworld_v5_notify_matt).
alter table public.paperworld_matt_notifications_v5
 drop constraint if exists paperworld_matt_notifications_v5_kind_check;
alter table public.paperworld_matt_notifications_v5
 add constraint paperworld_matt_notifications_v5_kind_check
 check (kind in ('completed','needs_you','stalled','routine_due'));

-- ------------------------------------------------------------------ staging
-- Stage exactly one draft (review-only) mission for one due slot.
create or replace function public.paperworld_v1_stage_routine_draft(
 p_routine uuid,p_slot timestamptz)
returns uuid language plpgsql security invoker set search_path=public as $$
declare r public.paperworld_routines_v1%rowtype;
declare existing uuid;
declare new_id uuid:=gen_random_uuid();
declare speaker text;
declare stored uuid;
begin
 if p_routine is null or p_slot is null or p_slot>now() or
    p_slot<=now()-interval '8 days' then return null; end if;
 select * into r from public.paperworld_routines_v1
 where id=p_routine and enabled=true for update;
 if not found or r.max_ai_calls<>0 or r.additional_spend_usd<>0 or
    r.next_review_at is distinct from p_slot then return null; end if;
 -- The slot must be a genuine local occurrence of the schedule.
 if public.paperworld_routine_slot_after(r.day_of_week,r.local_hour,r.local_minute,
     r.timezone,p_slot-interval '1 second') is distinct from p_slot then return null; end if;
 select mission_id into existing from public.paperworld_routine_slots_v1
 where routine_id=r.id and scheduled_at=p_slot;
 if existing is null then
  insert into public.paperworld_autonomous_missions_v5
   (id,owner_id,thread_id,project_id,goal,status,policy)
  values(new_id,r.owner_id,r.thread_id,r.project_id,r.goal,'draft',
   jsonb_build_object('executionMode','draft_review_only','maxAiCalls',0,
    'additionalSpendUsd',0,'noAutoMerge',true,'noAutoDeploy',true,
    'source','routine','routineId',r.id,'scheduledAt',p_slot));
  insert into public.paperworld_routine_slots_v1(routine_id,owner_id,scheduled_at,mission_id)
  values(r.id,r.owner_id,p_slot,new_id);
  existing:=new_id;
  -- Friendly, idempotent message in the owner's Matt thread.
  if exists(select 1 from public.paperworld_agent_threads t
            where t.id=r.thread_id and t.owner_id=r.owner_id and t.agent_id='matt') then
   speaker:=case r.project_id when 'pokemon' then 'Ο Joey' when 'listening' then 'Η Luna'
    when 'studio' then 'Ο Crow' else 'Ο Dave' end;
   stored:=md5(new_id::text||':routine_due')::uuid;
   insert into public.paperworld_matt_notifications_v5(mission_id,owner_id,kind,message_id)
   values(new_id,r.owner_id,'routine_due',stored) on conflict do nothing;
   if found then
    insert into public.paperworld_agent_messages(id,thread_id,owner_id,role,content)
    values(stored,r.thread_id,r.owner_id,'agent','@paperworld-matt:v1:'||jsonb_build_object(
     'director',case r.project_id when 'pokemon' then 'pokemon-director'
      when 'studio' then 'studio-director' when 'wellbeing' then 'wellbeing-director'
      else 'listening-director' end,
     'text',speaker||': ήρθε η ώρα για την εβδομαδιαία εργασία «'||left(r.goal,140)||
      '». Την ετοίμασα για να τη δεις — δεν ξεκινά τίποτα χωρίς εσένα.',
     'kind','notification')::text)
    on conflict (id) do nothing;
   end if;
  end if;
 end if;
 -- Advance to the next LOCAL occurrence (DST-correct, never "+7 days").
 update public.paperworld_routines_v1 set next_review_at=
  public.paperworld_routine_slot_after(r.day_of_week,r.local_hour,r.local_minute,r.timezone,p_slot)
 where id=r.id;
 return existing;
end $$;
revoke all on function public.paperworld_v1_stage_routine_draft(uuid,timestamptz)
 from public,anon,authenticated;
grant execute on function public.paperworld_v1_stage_routine_draft(uuid,timestamptz) to service_role;

-- Called only from the existing unified tick. Bounded and lock-protected.
create or replace function public.paperworld_v1_review_due_routines()
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r record;
declare mission uuid;
declare staged integer:=0;
declare repaired integer:=0;
begin
 if not pg_try_advisory_xact_lock(534128,31) then
  return jsonb_build_object('state','busy','staged',0);
 end if;
 for r in
  select id,next_review_at,day_of_week,local_hour,local_minute,timezone
  from public.paperworld_routines_v1
  where enabled and max_ai_calls=0 and additional_spend_usd=0 and next_review_at<=now()
  order by next_review_at,id limit 25
  for update skip locked
 loop
  mission:=null;
  if r.next_review_at>now()-interval '8 days' then
   mission:=public.paperworld_v1_stage_routine_draft(r.id,r.next_review_at);
  end if;
  if mission is not null then staged:=staged+1;
  else
   -- Missed for over a week, or not a valid slot: never stage old work,
   -- simply move on to the next future occurrence.
   update public.paperworld_routines_v1 set next_review_at=
    public.paperworld_routine_slot_after(r.day_of_week,r.local_hour,r.local_minute,r.timezone,now())
   where id=r.id and enabled;
   repaired:=repaired+1;
  end if;
 end loop;
 return jsonb_build_object('state','review_only','staged',staged,'repaired',repaired,
  'aiCalls',0,'externalActions',0);
end $$;
revoke all on function public.paperworld_v1_review_due_routines() from public,anon,authenticated;
grant execute on function public.paperworld_v1_review_due_routines() to service_role;

-- ------------------------------------------------- extend the EXISTING tick
-- Identical to the live function (controller → dispatch → Matt notifications)
-- plus an isolated routine stage. CREATE OR REPLACE keeps the existing owner,
-- grants and the single cron job (paperworld-v5-safe-controller).
create or replace function public.paperworld_v5_unified_tick()
returns jsonb language plpgsql set search_path to 'public' as $$
declare ctrl jsonb;declare wake jsonb;declare notices jsonb;declare routines jsonb;
begin
 ctrl:=public.paperworld_v5_controller_tick();
 begin
  routines:=public.paperworld_v1_review_due_routines();
 exception when others then
  routines:='{"state":"error"}'::jsonb;
 end;
 wake:=public.paperworld_v5_unified_wakeup();
 begin
  notices:=public.paperworld_v5_notify_matt();
 exception when others then
  notices:='{"state":"error"}'::jsonb;
 end;
 return jsonb_build_object('controller',ctrl,'routines',routines,
  'dispatch',wake,'notifications',notices);
end $$;
commit;

-- ROLLBACK (owner-run, only if needed). Restores the pre-release tick exactly:
-- begin;
-- create or replace function public.paperworld_v5_unified_tick()
-- returns jsonb language plpgsql set search_path to 'public' as $$
-- declare ctrl jsonb;declare wake jsonb;declare notices jsonb;
-- begin
--  ctrl:=public.paperworld_v5_controller_tick();
--  wake:=public.paperworld_v5_unified_wakeup();
--  begin notices:=public.paperworld_v5_notify_matt();
--  exception when others then notices:='{"state":"error"}'::jsonb; end;
--  return jsonb_build_object('controller',ctrl,'dispatch',wake,'notifications',notices);
-- end $$;
-- update public.paperworld_routines_v1 set enabled=false;
-- commit;
