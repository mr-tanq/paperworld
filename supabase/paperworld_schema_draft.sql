-- PAPERWORLD / Draft migration. DO NOT APPLY to any existing Supabase project.
-- 2026-11-13: dedicated PAPERWORLD project and explicit authorization required.
-- Creates private per-user tasks; no agents or autonomous execution.
begin;

create table if not exists public.paperworld_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room text not null check (room in ('town','workshop','pokemon','wellbeing','studio')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  notes text not null default '' check (char_length(notes) <= 1500),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paperworld_tasks_owner_room_idx
 on public.paperworld_tasks(owner_id,room,created_at desc);

alter table public.paperworld_tasks enable row level security;

-- Database API access is authenticated and scoped by row ownership.
revoke all on table public.paperworld_tasks from anon;
grant select,insert,update,delete on table public.paperworld_tasks to authenticated;

create policy "paperworld_tasks_read_own"
 on public.paperworld_tasks for select to authenticated
 using ((select auth.uid()) = owner_id);
create policy "paperworld_tasks_insert_own"
 on public.paperworld_tasks for insert to authenticated
 with check ((select auth.uid()) = owner_id);
create policy "paperworld_tasks_update_own"
 on public.paperworld_tasks for update to authenticated
 using ((select auth.uid()) = owner_id)
 with check ((select auth.uid()) = owner_id);
create policy "paperworld_tasks_delete_own"
 on public.paperworld_tasks for delete to authenticated
 using ((select auth.uid()) = owner_id);

-- User-owned proposal/approval records: never grant permission to AI workers
-- based only on table contents. A separate broker must verify the human
-- session and enforce one-shot scope before any external side effects.
create table if not exists public.paperworld_approval_requests (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 action_type text not null check (action_type in ('github_pr','github_merge','deployment','external_write','spend')),
 project_room text not null check (project_room in ('town','workshop','pokemon','wellbeing','studio')),
 summary text not null check (char_length(btrim(summary)) between 1 and 500),
 details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
 status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
 created_at timestamptz not null default now()
);

create index if not exists paperworld_approval_requests_owner_idx
 on public.paperworld_approval_requests(owner_id,created_at desc);
alter table public.paperworld_approval_requests enable row level security;
revoke all on table public.paperworld_approval_requests from anon;
grant select on table public.paperworld_approval_requests to authenticated;
create policy "paperworld_approval_read_own"
 on public.paperworld_approval_requests for select to authenticated
 using ((select auth.uid()) = owner_id);

-- Fail closed: approval records are read-only through browser Data API.
-- A future broker must create/decide records with explicit server-side
-- authorization, immutable action fingerprint and audited decision path.
-- No insert/update/delete grants to authenticated for approval_requests.

commit;
