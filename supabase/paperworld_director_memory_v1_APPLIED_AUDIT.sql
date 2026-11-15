-- Applied to PAPERWORLD Supabase project jrevhzvrgenucuozjowm on 2026-11-15.
-- AUDIT COPY ONLY. Migration name: director_memory_v1_proposals_private_rls
-- Do not reapply blindly. Live database schema was verified independently.
-- The previous REVIEW-only draft was NOT applied: its review RPC was unsafe
-- and contained a malformed delimiter. Review remains intentionally disabled.
begin;
create table public.paperworld_director_memory (
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
create index paperworld_director_memory_project_lookup
 on public.paperworld_director_memory(owner_id,project_id,status,observed_at desc);
alter table public.paperworld_director_memory enable row level security;
revoke all on public.paperworld_director_memory from public,anon,authenticated;
grant select,insert on public.paperworld_director_memory to authenticated;
create policy director_memory_select_owner on public.paperworld_director_memory
 for select to authenticated using ((select auth.uid())=owner_id);
create policy director_memory_insert_proposed_owner on public.paperworld_director_memory
 for insert to authenticated
 with check ((select auth.uid())=owner_id and status='proposed');
commit;
-- Intentionally NO review RPC, no UPDATE/DELETE grants and no model access.
-- Historical proposals are seeded separately in the PRIVATE database; the
-- associated personal data is never included in this public audit copy.
