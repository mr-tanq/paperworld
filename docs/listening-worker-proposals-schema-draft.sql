-- PAPERWORLD PR #117: REVIEW DRAFT ONLY — DO NOT APPLY YET.
-- No changes to the live Supabase database are part of this PR.
-- Server-only storage; zero direct anon/authenticated read or write.
-- Review grants / RLS and apply only with separate owner authorization.
create table if not exists public.paperworld_worker_proposals (
 job_id uuid primary key references public.paperworld_agent_jobs(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 thread_id uuid not null references public.paperworld_agent_threads(id) on delete cascade,
 project text not null default 'Listening Mirror'
  check (project = 'Listening Mirror'),
 status text not null default 'pending_review'
  check (status in ('pending_review','rejected','needs_reverification')),
 digest text not null check (digest ~ '^[a-f0-9]{64}$'),
 plan jsonb not null,
 evidence jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.paperworld_worker_proposals enable row level security;
revoke all on public.paperworld_worker_proposals from public, anon, authenticated;
grant select, insert, update on public.paperworld_worker_proposals to service_role;

-- Prevent identity, source evidence, SHA/digest, or proposed content from
-- changing after insertion, INCLUDING through privileged PostgREST callers.
create or replace function public.paperworld_proposal_immutable_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op='INSERT' then
  if not exists (
   select 1 from public.paperworld_agent_jobs j
   where j.id=new.job_id and j.owner_id=new.owner_id
    and j.thread_id=new.thread_id
    and j.project='Listening Mirror' and j.worker_id='listening-developer'
  ) then raise exception 'proposal_job_owner_mismatch'; end if;
  if new.status<>'pending_review' then
   raise exception 'proposal_must_begin_pending'; end if;
 else
  if new.job_id is distinct from old.job_id
    or new.owner_id is distinct from old.owner_id
    or new.thread_id is distinct from old.thread_id
    or new.project is distinct from old.project
    or new.digest is distinct from old.digest
    or new.plan is distinct from old.plan
    or new.evidence is distinct from old.evidence
    or new.created_at is distinct from old.created_at then
   raise exception 'immutable_proposal'; end if;
  if old.status <> 'pending_review' or
   new.status not in ('rejected','needs_reverification') then
   raise exception 'invalid_review_transition'; end if;
  new.updated_at = now();
 end if;
 return new;
end;
$$;
revoke all on function public.paperworld_proposal_immutable_guard() from public;
create trigger paperworld_proposal_immutable
before insert or update on public.paperworld_worker_proposals
for each row execute function public.paperworld_proposal_immutable_guard();

-- No browser RLS policy is created.
-- Must be verified against real isolated PostgreSQL, not deployed from PR.
-- Need an owner-authenticated, thread-verified Render API to call the store.
-- Never infer ownerId from browser body or treat persisted data as consent.
-- Do NOT treat proposal status as proof of source freshness or approval.
