-- PROPOSAL ONLY: DO NOT APPLY TO LIVE SUPABASE WITHOUT REVIEW.
-- Server-controlled, atomic, single-use Matt AI authorization ledger.
-- Requires trusted server direct PostgreSQL connection. NOT a Data API endpoint.
begin;
create schema if not exists paperworld_private;
revoke all on schema paperworld_private from public, anon, authenticated;
create table if not exists paperworld_private.matt_ai_approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  request_id uuid not null unique,
  agent_id text not null default 'matt' check (agent_id = 'matt'),
  state text not null default 'pending' check (state in ('pending','approved','claimed','cancelled','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  foreign key (thread_id,owner_id)
    references public.paperworld_agent_threads(id,owner_id) on delete cascade,
  check (expires_at <= created_at + interval '15 minutes'),
  check ((state = 'claimed') = (claimed_at is not null))
);
create index if not exists matt_ai_approvals_pending_owner
  on paperworld_private.matt_ai_approvals(owner_id,state,expires_at);
revoke all on paperworld_private.matt_ai_approvals from public, anon, authenticated;
alter table paperworld_private.matt_ai_approvals enable row level security;

-- Atomic claim MUST be executed through a trusted server-only DB connection
-- in ONE statement with parameters, after independently verifying JWT owner,
-- requested thread, explicit approval, and account-level Copilot budget.
-- $1 approval UUID, $2 request UUID, $3 thread UUID, $4 owner UUID.
-- UPDATE paperworld_private.matt_ai_approvals
--    SET state='claimed', claimed_at=now()
--  WHERE id=$1::uuid AND request_id=$2::uuid AND thread_id=$3::uuid
--    AND owner_id=$4::uuid AND agent_id='matt'
--    AND state='approved' AND expires_at > now()
-- RETURNING id;
--
-- Important: writing state='approved' requires an authenticated, explicit
-- human approval flow implemented in a SEPARATE trusted server component.
-- Never let the browser or anonymous clients mutate this table.
commit;
