-- DESIGN DRAFT ONLY. NOT APPLIED. Requires separate owner approval,
-- review of existing project schema, local RLS tests and Supabase advisors.
-- Store is intentionally server-only: no anon/authenticated Data API access.
create table if not exists public.paperworld_write_approvals (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null,
 repository text not null check (repository = 'mr-tanq/concerts'),
 plan_digest char(64) not null check (plan_digest ~ '^[a-f0-9]{64}$'),
 secret_hash char(64) not null check (secret_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 check (expires_at > created_at)
);
alter table public.paperworld_write_approvals enable row level security;
revoke all on table public.paperworld_write_approvals from public, anon, authenticated;
grant select, insert, update on table public.paperworld_write_approvals to service_role;
-- No user RLS policy: owner must approve via separately authenticated Render
-- operation, never direct browser PostgREST. Backend mints a random grant, stores
-- only its SHA-256 hash, and returns the one-use handle to the authenticated user.
-- The service-role-backed conditional PATCH binds id, owner_id, job_id,
-- repository, plan_digest, secret_hash, expires_at > current server time and
-- consumed_at IS NULL in the SAME database statement.
-- Still missing before activation: trusted approval issuance endpoint, a
-- persistent exact proposal snapshot + signature, OAuth WRITE permission review,
-- owner confirmation UI, concurrency tests against real isolated PostgreSQL.
