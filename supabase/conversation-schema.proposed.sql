-- PAPERWORLD proposed owner-scoped agent conversation storage.
-- REVIEW ONLY: not applied to Supabase by this PR.
-- Roles: clients can insert human messages only. AI replies require trusted server privileges.
begin;

create table if not exists public.paperworld_agent_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_id text not null check (agent_id in (
    'matt','listening-director','listening-developer',
    'pokemon-director','wellbeing-director','studio-director')),
  created_at timestamptz not null default now(),
  unique (id,owner_id),
  unique (owner_id,agent_id)
);

create table if not exists public.paperworld_agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  owner_id uuid not null default auth.uid(),
  role text not null check (role in ('human','agent')),
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint agent_messages_owned_thread foreign key(thread_id,owner_id)
    references public.paperworld_agent_threads(id,owner_id) on delete cascade
);

create index if not exists agent_messages_thread_recent
  on public.paperworld_agent_messages(thread_id,created_at desc,id desc);

alter table public.paperworld_agent_threads enable row level security;
alter table public.paperworld_agent_messages enable row level security;

revoke all on public.paperworld_agent_threads from public,anon,authenticated;
revoke all on public.paperworld_agent_messages from public,anon,authenticated;
grant select,insert,delete on public.paperworld_agent_threads to authenticated;
grant select,insert on public.paperworld_agent_messages to authenticated;

create policy "threads_owned_read" on public.paperworld_agent_threads
  for select to authenticated using ((select auth.uid())=owner_id);
create policy "threads_owned_create" on public.paperworld_agent_threads
  for insert to authenticated with check ((select auth.uid())=owner_id);
create policy "threads_owned_delete" on public.paperworld_agent_threads
  for delete to authenticated using ((select auth.uid())=owner_id);

create policy "messages_owned_read" on public.paperworld_agent_messages
  for select to authenticated using ((select auth.uid())=owner_id);
create policy "messages_human_create" on public.paperworld_agent_messages
  for insert to authenticated with check (
    (select auth.uid())=owner_id and role='human'
  );

commit;
