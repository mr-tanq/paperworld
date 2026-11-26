-- PAPERWORLD — James's daily research journal (2026-11-26).
-- One note a day: niche, product, channel, why, the public evidence he used and
-- a confidence 1-5. Strong notes (4-5) or Mondays become proposals the owner
-- answers with Ναι/Όχι. Only the server writes; the owner can read.
-- ROLLBACK: drop table public.paperworld_shop_research_v1;
begin;
create table if not exists public.paperworld_shop_research_v1(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 note jsonb not null,
 confidence integer not null check (confidence between 1 and 5),
 created_at timestamptz not null default now(),
 unique(owner_id,day)
);
alter table public.paperworld_shop_research_v1 enable row level security;
drop policy if exists paperworld_shop_research_owner_read on public.paperworld_shop_research_v1;
create policy paperworld_shop_research_owner_read on public.paperworld_shop_research_v1
 for select to authenticated using (owner_id = auth.uid());
revoke insert,update,delete on public.paperworld_shop_research_v1 from anon,authenticated;
commit;
