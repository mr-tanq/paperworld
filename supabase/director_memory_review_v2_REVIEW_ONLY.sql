-- REVIEW-ONLY migration. DO NOT RUN before separate owner approval.
-- Extends the APPLIED private owner-RLS table. Human review is individual,
-- not bulk. This does not grant model tools / Director write permissions.
begin;
create table public.paperworld_director_memory_review_log (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid not null,
 project_id text not null,
 previous_status text not null check (previous_status='proposed'),
 decision text not null check (decision in ('approved','rejected')),
 reviewed_at timestamptz not null default now(),
 foreign key(owner_id,project_id,entry_id)
   references public.paperworld_director_memory(owner_id,project_id,id)
   on delete cascade
);
-- The referenced triplet has unique(owner_id,project_id,id) in the base table.
create index paperworld_director_memory_review_log_owner
 on public.paperworld_director_memory_review_log(owner_id,reviewed_at desc);
alter table public.paperworld_director_memory_review_log enable row level security;
revoke all on public.paperworld_director_memory_review_log from public,anon,authenticated;
grant select on public.paperworld_director_memory_review_log to authenticated;
create policy director_memory_review_log_owner_select
 on public.paperworld_director_memory_review_log for select to authenticated
 using ((select auth.uid())=owner_id);

-- Only status may be updated by the owner's authenticated token. The browser
-- cannot edit provenance, content, ownership, project or review timestamp.
grant update(status) on public.paperworld_director_memory to authenticated;
create policy director_memory_owner_review_transition
 on public.paperworld_director_memory for update to authenticated
 using ((select auth.uid())=owner_id and status='proposed')
 with check ((select auth.uid())=owner_id and status in ('approved','rejected'));

-- Non-API schema: trigger functions NEVER callable by browser or model.
create schema if not exists paperworld_memory_private;
revoke all on schema paperworld_memory_private from public,anon,authenticated;
create function paperworld_memory_private.stamp_memory_owner_decision()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
begin
 if old.status <> 'proposed'
   or new.status not in ('approved','rejected')
   or new.id is distinct from old.id
   or new.owner_id is distinct from old.owner_id
   or new.project_id is distinct from old.project_id
   or (select auth.uid()) is distinct from old.owner_id
 then
  raise exception 'memory_review_denied' using errcode='42501';
 end if;
 new.reviewed_at := now();
 return new;
end;
$fn$;
revoke all on function paperworld_memory_private.stamp_memory_owner_decision()
 from public,anon,authenticated;
create trigger director_memory_stamp_review
 before update of status on public.paperworld_director_memory
 for each row execute function paperworld_memory_private.stamp_memory_owner_decision();

create function paperworld_memory_private.log_memory_owner_decision()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is distinct from new.owner_id
   or old.status <> 'proposed'
   or new.status not in ('approved','rejected')
 then
  raise exception 'memory_review_denied' using errcode='42501';
 end if;
 insert into public.paperworld_director_memory_review_log
  (owner_id,entry_id,project_id,previous_status,decision,reviewed_at)
 values (new.owner_id,new.id,new.project_id,old.status,new.status,new.reviewed_at);
 return null;
end;
$fn$;
revoke all on function paperworld_memory_private.log_memory_owner_decision()
 from public,anon,authenticated;
create trigger director_memory_log_review
 after update of status on public.paperworld_director_memory
 for each row execute function paperworld_memory_private.log_memory_owner_decision();
commit;

-- No UPDATE on title, body, project, source, owner, reviewed_at.
-- No owner access to INSERT/UPDATE/DELETE audit log. No public execute RPC.
-- This SQL is not yet applied. Verify with two distinct JWT owners, including
-- cross-owner and repeated approvals, before exposing any user review buttons.
