-- V5 Pokémon owner-scoped exact code proposal + one-use private Draft PR approval.
-- Models and browsers cannot write; only trusted backend using owner OAuth may.
create table public.paperworld_pokemon_proposals_v5 (
 job_id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 thread_id uuid not null,
 project text not null default 'pokemon' check(project='pokemon'),
 status text not null default 'pending_review'
  check(status in ('pending_review','rejected','draft_created','needs_reverification')),
 digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 plan jsonb not null check(jsonb_typeof(plan)='object'),
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 draft_pr_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(thread_id,owner_id) references public.paperworld_agent_threads(id,owner_id),
 constraint pokemon_draft_url_v5 check(
  (status='draft_created' and
   draft_pr_url ~ '^https://github[.]com/mr-tanq/pokemon-echoes/pull/[1-9][0-9]*$')
  or (status<>'draft_created' and draft_pr_url is null))
);
create table public.paperworld_pokemon_approvals_v5 (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null,
 digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 secret_hash text not null check(secret_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(job_id) references public.paperworld_pokemon_proposals_v5(job_id),
 check(expires_at>created_at)
);
alter table public.paperworld_pokemon_proposals_v5 enable row level security;
alter table public.paperworld_pokemon_approvals_v5 enable row level security;
revoke all on public.paperworld_pokemon_proposals_v5 from anon,authenticated;
revoke all on public.paperworld_pokemon_approvals_v5 from anon,authenticated;
grant select on public.paperworld_pokemon_proposals_v5 to authenticated;
create policy pokemon_owner_proposal_read_v5 on public.paperworld_pokemon_proposals_v5
 for select to authenticated using ((select auth.uid())=owner_id);
-- Owner cannot see or create server-side approval secrets.
create index pokemon_proposal_owner_created_v5
 on public.paperworld_pokemon_proposals_v5(owner_id,created_at desc);
create index pokemon_approval_pending_v5
 on public.paperworld_pokemon_approvals_v5(owner_id,job_id,expires_at)
 where consumed_at is null;
