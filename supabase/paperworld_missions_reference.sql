-- PAPERWORLD mission drafts — applied to the dedicated project on 2026-11-13.
-- Historical/schema reference only. Do not automatically rerun this script.
-- No worker execution, third-party API authorization or spending is granted.
create table public.paperworld_missions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 source_task_id uuid references public.paperworld_tasks(id) on delete set null,
 project_room text not null check (project_room in ('town','workshop')),
 repository text not null check (repository in ('mr-tanq/paperworld','mr-tanq/concerts')),
 title text not null check (char_length(btrim(title)) between 1 and 160),
 brief text not null check (char_length(btrim(brief)) between 1 and 6000),
 mode text not null default 'analysis_only' check (mode='analysis_only'),
 status text not null default 'draft' check (status in ('draft','ready_for_review','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint paperworld_missions_repository_room_check check (
  (project_room='town' and repository='mr-tanq/paperworld') or
  (project_room='workshop' and repository='mr-tanq/concerts')
 )
);
create index paperworld_missions_owner_created_idx on public.paperworld_missions(owner_id,created_at desc);
alter table public.paperworld_missions enable row level security;
revoke all privileges on table public.paperworld_missions from public, anon, authenticated;
grant select,insert,update,delete on table public.paperworld_missions to authenticated;
create policy "missions_select_own" on public.paperworld_missions
 for select to authenticated using ((select auth.uid())=owner_id);
create policy "missions_insert_own" on public.paperworld_missions
 for insert to authenticated with check ((select auth.uid())=owner_id and
 (source_task_id is null or exists (select 1 from public.paperworld_tasks t
 where t.id=source_task_id and t.owner_id=(select auth.uid()))));
create policy "missions_update_own" on public.paperworld_missions
 for update to authenticated using ((select auth.uid())=owner_id)
 with check ((select auth.uid())=owner_id and
 (source_task_id is null or exists (select 1 from public.paperworld_tasks t
 where t.id=source_task_id and t.owner_id=(select auth.uid()))));
create policy "missions_delete_own" on public.paperworld_missions
 for delete to authenticated using ((select auth.uid())=owner_id);
