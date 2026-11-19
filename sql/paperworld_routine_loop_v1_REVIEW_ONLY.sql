-- PAPERWORLD ROUTINE LOOP V1 — REVIEW ONLY; DO NOT EXECUTE AUTOMATICALLY.
-- Adds durable owner-scoped weekly templates and one unique draft per UTC slot.
-- No new cron, no jobs, no paid AI, no queueing or auto-execution.
begin;
create table if not exists public.paperworld_routines_v1 (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 thread_id uuid not null,
 project_id text not null check (project_id in ('listening','pokemon','studio','wellbeing')),
 goal text not null check (char_length(btrim(goal)) between 1 and 1200),
 enabled boolean not null default false,
 day_of_week integer not null check(day_of_week between 0 and 6),
 hour_utc integer not null check(hour_utc between 0 and 23),
 minute_utc integer not null check(minute_utc between 0 and 59),
 max_ai_calls integer not null default 0 check(max_ai_calls=0),
 additional_spend_usd numeric(12,2) not null default 0 check(additional_spend_usd=0),
 next_review_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(thread_id,owner_id)
  references public.paperworld_agent_threads(id,owner_id),
 unique(id,owner_id)
);
create table if not exists public.paperworld_routine_slots_v1 (
 routine_id uuid not null,
 owner_id uuid not null,
 scheduled_at timestamptz not null,
 mission_id uuid not null unique,
 created_at timestamptz not null default now(),
 primary key(routine_id,scheduled_at),
 foreign key(routine_id,owner_id) references public.paperworld_routines_v1(id,owner_id)
  on delete cascade,
 foreign key(mission_id,owner_id) references public.paperworld_autonomous_missions_v5(id,owner_id)
  on delete cascade
);
create index if not exists paperworld_routines_owner_next_v1
 on public.paperworld_routines_v1(owner_id,next_review_at) where enabled;
alter table public.paperworld_routines_v1 enable row level security;
alter table public.paperworld_routine_slots_v1 enable row level security;
revoke all on public.paperworld_routines_v1,public.paperworld_routine_slots_v1
 from public,anon,authenticated;
grant select on public.paperworld_routines_v1,public.paperworld_routine_slots_v1
 to authenticated;
create policy paperworld_routines_owner_read_v1 on public.paperworld_routines_v1
 for select to authenticated using ((select auth.uid())=owner_id);
create policy paperworld_routine_slots_owner_read_v1 on public.paperworld_routine_slots_v1
 for select to authenticated using ((select auth.uid())=owner_id);
-- Writes remain service-role only, through separately reviewed authenticated backend.
-- This function creates ONLY a draft mission, not runnable steps or a queue entry.
create or replace function public.paperworld_v1_stage_routine_draft(
 p_routine uuid,p_slot timestamptz)
returns uuid language plpgsql security invoker set search_path=public as $$
declare r public.paperworld_routines_v1%rowtype;
declare existing uuid;
declare new_id uuid:=gen_random_uuid();
begin
 if p_routine is null or p_slot is null or p_slot>now() or
    p_slot<now()-interval '8 days' then return null; end if;
 select * into r from public.paperworld_routines_v1
 where id=p_routine and enabled=true for update;
 if not found or r.max_ai_calls<>0 or r.additional_spend_usd<>0 or
    r.next_review_at is distinct from p_slot then return null; end if;
 -- DB enforces same owner/thread by existing compound foreign keys.
 select mission_id into existing from public.paperworld_routine_slots_v1
 where routine_id=r.id and scheduled_at=p_slot;
 if existing is not null then return existing; end if;
 -- Back-end scheduler must first validate this is the actual UTC weekly slot.
 insert into public.paperworld_autonomous_missions_v5
 (id,owner_id,thread_id,project_id,goal,status,policy)
 values(new_id,r.owner_id,r.thread_id,r.project_id,r.goal,'draft',
  '{"executionMode":"draft_review_only","maxAiCalls":0,
    "additionalSpendUsd":0,"noAutoMerge":true,"noAutoDeploy":true}'::jsonb);
 insert into public.paperworld_routine_slots_v1
 (routine_id,owner_id,scheduled_at,mission_id)
 values(r.id,r.owner_id,p_slot,new_id);
 update public.paperworld_routines_v1 set next_review_at=null,updated_at=now()
 where id=r.id;
 return new_id;
end $$;
revoke all on function public.paperworld_v1_stage_routine_draft(uuid,timestamptz)
 from public,anon,authenticated;
grant execute on function public.paperworld_v1_stage_routine_draft(uuid,timestamptz)
 to service_role;
commit;
