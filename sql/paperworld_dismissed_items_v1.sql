-- PAPERWORLD — owner can remove items from their work lists (2026-11-20).
-- Removing hides an item for its owner only; the underlying mission, hand-off
-- or job record is kept (audit trail, budget ledger, Matt history). Owners
-- read/add/undo only their own rows through RLS; nothing else changes.
-- ROLLBACK: drop table public.paperworld_dismissed_items_v1;
begin;
create table if not exists public.paperworld_dismissed_items_v1(
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 item_key text not null check (item_key ~ '^[a-z-]{2,24}:[A-Za-z0-9_.:-]{1,120}$'),
 dismissed_at timestamptz not null default now(),
 primary key (owner_id,item_key));
alter table public.paperworld_dismissed_items_v1 enable row level security;
revoke all on public.paperworld_dismissed_items_v1 from public,anon,authenticated;
grant select,insert,delete on public.paperworld_dismissed_items_v1 to authenticated;
grant all on public.paperworld_dismissed_items_v1 to service_role;
drop policy if exists dismissed_items_owner_select on public.paperworld_dismissed_items_v1;
drop policy if exists dismissed_items_owner_insert on public.paperworld_dismissed_items_v1;
drop policy if exists dismissed_items_owner_delete on public.paperworld_dismissed_items_v1;
create policy dismissed_items_owner_select on public.paperworld_dismissed_items_v1
 for select to authenticated using ((select auth.uid())=owner_id);
create policy dismissed_items_owner_insert on public.paperworld_dismissed_items_v1
 for insert to authenticated with check ((select auth.uid())=owner_id);
create policy dismissed_items_owner_delete on public.paperworld_dismissed_items_v1
 for delete to authenticated using ((select auth.uid())=owner_id);
commit;
