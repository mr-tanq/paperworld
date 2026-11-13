-- Applied to dedicated PAPERWORLD project jrevhzvrgenucuozjowm.
-- Tightened grants on 2026-11-13 because Supabase default table grants
-- left approval-request writes open even after granting SELECT.
begin;
revoke all privileges on table public.paperworld_approval_requests from public, anon, authenticated;
grant select on table public.paperworld_approval_requests to authenticated;
revoke all privileges on table public.paperworld_tasks from public, anon, authenticated;
grant select,insert,update,delete on table public.paperworld_tasks to authenticated;
alter table public.paperworld_tasks add column if not exists local_task_id text;
create unique index if not exists paperworld_tasks_owner_local_id_unique
 on public.paperworld_tasks(owner_id,local_task_id) where local_task_id is not null;
commit;
