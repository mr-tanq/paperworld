-- PAPERWORLD Director Memory v1 — REVIEW ONLY, NOT APPLIED.
-- Private owner-scoped persistent knowledge across registered projects.
-- DO NOT insert user history or sensitive content into a public GitHub repo.
-- Entries are narrative data, never authority to execute tools or spend.
begin;
create table if not exists public.paperworld_director_memory (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 project_id text not null check (project_id in ('town','workshop','pokemon','wellbeing','studio')),
 kind text not null check (kind in ('project_bible','decision','preference','current_state','work_history')),
 status text not null default 'proposed' check (status in ('proposed','approved','rejected','superseded')),
 title text not null check (char_length(btrim(title)) between 1 and 140),
 body text not null check (char_length(btrim(body)) between 1 and 4000),
 source_type text not null check (source_type in ('project_file','conversation','owner_note','verified_result')),
 source_ref text not null check (char_length(btrim(source_ref)) between 1 and 400),
 observed_at timestamptz not null,
 version integer not null default 1 check (version between 1 and 999999),
 sensitivity text not null default 'standard' check (sensitivity in ('standard','private')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(owner_id,project_id,id)
);
create index if not exists paperworld_director_memory_project_lookup
 on public.paperworld_director_memory(owner_id,project_id,status,observed_at desc);
alter table public.paperworld_director_memory enable row level security;
revoke all on public.paperworld_director_memory from public,anon,authenticated;
grant select,insert on public.paperworld_director_memory to authenticated;
-- No client-side UPDATE or DELETE grants: a separate, reviewed owner-only
-- approval path is needed before a proposal can become approved.
create policy "director_memory_select_owner" on public.paperworld_director_memory
 for select to authenticated using ((select auth.uid())=owner_id);
create policy "director_memory_insert_proposed_owner" on public.paperworld_director_memory
 for insert to authenticated
 with check ((select auth.uid())=owner_id and status='proposed');
commit;

-- SECURITY: all rows are readable only by their owner via RLS. Agent identities
-- are not database user accounts; trusted backend must independently validate
-- director-to-project mapping before sharing any snippets with an AI.
-- Approval requires separate owner-authorized server mutation and audit policy.
-- NEVER grant the model, worker, or browser a service_role credential.
-- No historical owner facts are seeded by this migration.
