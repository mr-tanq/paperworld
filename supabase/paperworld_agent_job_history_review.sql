-- REVIEW ONLY: do not apply without separate owner approval.
-- Private-by-owner job history, NOT an authorization or execution ledger.
-- Existing PAPERWORLD tables are unchanged.
begin;
create table if not exists public.paperworld_agent_jobs (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 thread_id uuid not null,
 project text not null check (project in ('Listening Mirror')),
 director_id text not null check (director_id in ('listening-director')),
 worker_id text not null check (worker_id in ('listening-developer')),
 request_summary text not null check (char_length(btrim(request_summary)) between 1 and 1200),
 created_at timestamptz not null default now(),
 unique(id,owner_id),
 foreign key(thread_id,owner_id) references public.paperworld_agent_threads(id,owner_id) on delete cascade
);
create index if not exists paperworld_agent_jobs_owner_recent
 on public.paperworld_agent_jobs(owner_id,created_at desc);
alter table public.paperworld_agent_jobs enable row level security;
revoke all on public.paperworld_agent_jobs from public,anon,authenticated;
grant select,insert on public.paperworld_agent_jobs to authenticated;
create policy "agent_jobs_read_own" on public.paperworld_agent_jobs
 for select to authenticated using ((select auth.uid())=owner_id);
create policy "agent_jobs_insert_own" on public.paperworld_agent_jobs
 for insert to authenticated with check ((select auth.uid())=owner_id);

create table if not exists public.paperworld_agent_job_events (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 state text not null check (state in ('created','routed','scoped','evidence_read',
  'worker_reported','director_reviewed','reported','failed')),
 actor text not null check (actor in ('matt','listening-director','listening-developer')),
 note text not null check (char_length(btrim(note)) between 1 and 500),
 created_at timestamptz not null default now(),
 foreign key(job_id,owner_id) references public.paperworld_agent_jobs(id,owner_id) on delete cascade
);
create index if not exists paperworld_agent_job_events_job_order
 on public.paperworld_agent_job_events(job_id,created_at,id);
alter table public.paperworld_agent_job_events enable row level security;
revoke all on public.paperworld_agent_job_events from public,anon,authenticated;
grant select,insert on public.paperworld_agent_job_events to authenticated;
create policy "agent_job_events_read_own" on public.paperworld_agent_job_events
 for select to authenticated using ((select auth.uid())=owner_id);
create policy "agent_job_events_insert_own" on public.paperworld_agent_job_events
 for insert to authenticated with check ((select auth.uid())=owner_id);
commit;

-- IMPORTANT SECURITY BOUNDARY:
-- An authenticated owner can append statements about their OWN jobs, so these
-- rows are user-controlled history, NOT proof that an AI turn occurred.
-- Never use these rows to authorize external writes, charges, merges or deployments.
-- No grants for UPDATE/DELETE, no service_role token in the browser.
-- Source excerpts, OAuth tokens and full model responses are intentionally NOT stored.
