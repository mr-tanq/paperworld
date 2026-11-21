-- PAPERWORLD — Crow's Suno link survives deploys (2026-11-21).
-- One sealed (AES-256-GCM, encrypted by the server before storage) Suno link
-- per owner. Service role only: no browser, owner or anon access.
-- ROLLBACK: drop table public.paperworld_suno_links_v1;
begin;
create table if not exists public.paperworld_suno_links_v1(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 sealed text not null check (sealed ~ '^v1\.[A-Za-z0-9_-]+$' and length(sealed) between 43 and 24000),
 updated_at timestamptz not null default now());
alter table public.paperworld_suno_links_v1 enable row level security;
revoke all on public.paperworld_suno_links_v1 from public,anon,authenticated;
grant all on public.paperworld_suno_links_v1 to service_role;
commit;
-- 2026-11-21 fix: PostgreSQL regex bounds stop at 255, so the first version's
-- check rejected every row. Replace it on tables created from that version.
alter table public.paperworld_suno_links_v1 drop constraint if exists paperworld_suno_links_v1_sealed_check;
alter table public.paperworld_suno_links_v1 add constraint paperworld_suno_links_v1_sealed_check
 check (sealed ~ '^v1\.[A-Za-z0-9_-]+$' and length(sealed) between 43 and 24000);
