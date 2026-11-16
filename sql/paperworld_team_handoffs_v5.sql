-- V5 owner-private handoff ledger. Server-only inserts; not an execution queue.
-- This complements rather than rewrites legacy Listening Mirror jobs.
create table if not exists public.paperworld_team_handoffs_v5 (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 thread_id uuid not null,
 request_id uuid not null,
 project text not null check (project in ('listening','pokemon','studio','wellbeing')),
 director_id text not null,
 worker_id text,
 capability text,
 status text not null check(status in ('reported','awaiting_consent')),
 request_summary text not null check(char_length(btrim(request_summary)) between 1 and 1200),
 report_summary text not null default '' check(char_length(report_summary)<=800),
 created_at timestamptz not null default now(),
 unique(owner_id,request_id),
 foreign key (thread_id,owner_id) references public.paperworld_agent_threads(id,owner_id),
 check (
  (project='listening' and director_id='listening-director' and (worker_id is null or worker_id='listening-developer'))
  or (project='pokemon' and director_id='pokemon-director' and (worker_id is null or worker_id='pokemon-developer'))
  or (project='studio' and director_id='studio-director' and worker_id is null)
  or (project='wellbeing' and director_id='wellbeing-director' and worker_id is null)
 ),
 check ((status='reported' and worker_id is null and capability is null)
     or (status='awaiting_consent' and worker_id is not null and capability='source_read'))
);
alter table public.paperworld_team_handoffs_v5 enable row level security;
revoke all on public.paperworld_team_handoffs_v5 from anon, authenticated;
grant select on public.paperworld_team_handoffs_v5 to authenticated;
create policy team_handoffs_owner_read_v5 on public.paperworld_team_handoffs_v5
 for select to authenticated using ((select auth.uid())=owner_id);
-- No client INSERT/UPDATE/DELETE policies: only server service role can record evidence.
create index if not exists paperworld_team_handoffs_v5_owner_time
 on public.paperworld_team_handoffs_v5(owner_id,created_at desc);
