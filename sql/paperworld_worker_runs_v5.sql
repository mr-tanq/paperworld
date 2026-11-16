-- Durable V5 worker-run receipts. Not an autonomous scheduler or authority grant.
-- Existing read-only workers already require explicit owner consent and zero-overage budget checks.
create table public.paperworld_worker_runs_v5 (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 thread_id uuid not null,
 request_id uuid not null,
 project text not null check (project in ('listening','pokemon')),
 director_id text not null,
 worker_id text not null,
 status text not null default 'running' check(status in ('running','reported','failed')),
 execution text not null default 'read_only_analysis' check(execution='read_only_analysis'),
 summary text not null check(char_length(btrim(summary)) between 1 and 1200),
 result_summary text not null default '' check(char_length(result_summary)<=800),
 started_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,request_id),
 foreign key(thread_id,owner_id) references public.paperworld_agent_threads(id,owner_id),
 check ((project='listening' and director_id='listening-director' and worker_id='listening-developer')
 or (project='pokemon' and director_id='pokemon-director' and worker_id='pokemon-developer'))
);
alter table public.paperworld_worker_runs_v5 enable row level security;
revoke all on public.paperworld_worker_runs_v5 from anon,authenticated;
grant select on public.paperworld_worker_runs_v5 to authenticated;
create policy worker_runs_v5_owner_read on public.paperworld_worker_runs_v5
 for select to authenticated using ((select auth.uid())=owner_id);
create index paperworld_worker_runs_v5_owner_time
 on public.paperworld_worker_runs_v5(owner_id,started_at desc);
-- No browser writes. Server's existing private key can only be used after
-- authenticated owner/thread/consent validation in the trusted endpoint.
