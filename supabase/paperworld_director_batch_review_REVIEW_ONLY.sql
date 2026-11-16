-- REVIEW ONLY — NOT APPLIED. Deploy only after a separately approved schema review.
-- Owner-initiated, all-or-nothing approval for the 2026-11-16 private summary import.
-- Does not grant an agent, Worker, or public client permission to approve.
begin;
create or replace function public.paperworld_approve_imported_director_memories(
 p_ids uuid[]
) returns integer language plpgsql security definer set search_path=''
as $function$
declare
 v_owner uuid;
 v_count integer;
 v_updated integer;
begin
 v_owner := (select auth.uid());
 if v_owner is null or p_ids is null or
    coalesce(array_length(p_ids,1),0) < 1 or
    array_length(p_ids,1) > 40 then
  raise exception 'owner_batch_invalid' using errcode='42501';
 end if;
 if array_position(p_ids,null) is not null or
    (select count(distinct id) from unnest(p_ids) as selected(id)) <>
    array_length(p_ids,1) then
  raise exception 'owner_batch_duplicate_or_null' using errcode='42501';
 end if;
 -- Do not activate ANY pre-existing older proposals, unverified uploads,
 -- rejected/superseded entries, or rows belonging to another owner.
 select count(*) into v_count
 from public.paperworld_director_memory m
 where m.id=any(p_ids) and m.owner_id=v_owner
  and m.project_id in ('workshop','pokemon','studio','wellbeing')
  and m.status='proposed'
  and m.source_type='conversation'
  and m.source_ref='chat-summary:2026-11-16';
 if v_count <> array_length(p_ids,1) then
  raise exception 'owner_batch_selection_changed' using errcode='42501';
 end if;
 update public.paperworld_director_memory m
 set status='approved'
 where m.id=any(p_ids) and m.owner_id=v_owner
  and m.project_id in ('workshop','pokemon','studio','wellbeing')
  and m.status='proposed' and m.source_type='conversation'
  and m.source_ref='chat-summary:2026-11-16';
 get diagnostics v_updated = row_count;
 if v_updated <> v_count then
  raise exception 'owner_batch_not_atomic' using errcode='40001';
 end if;
 -- Existing review triggers stamp reviewed_at and append audit log once per row.
 return v_updated;
end;
$function$;
revoke all on function public.paperworld_approve_imported_director_memories(uuid[])
 from public,anon,authenticated;
grant execute on function public.paperworld_approve_imported_director_memories(uuid[])
 to authenticated;
commit;

-- SECURITY REVIEW BEFORE DEPLOYMENT:
-- Confirm both existing row-level trigger functions reject any mismatched auth.uid,
-- proposed-only transition, modified project/owner/id, and missing append-only audit.
-- PostgREST owner JWT (not service role) must be used for invocation.
-- No automatic model call or tool may invoke this function.
