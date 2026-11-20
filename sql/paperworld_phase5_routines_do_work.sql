-- PAPERWORLD Phase 5 — weekly routines start real work (owner decision 2026-11-20).
-- For Listening Mirror and Pokémon Echoes, a due routine now becomes a normal
-- Task Engine mission (Developer → trusted tests → verified merge → Matt report)
-- instead of a draft for review. The task brief is built deterministically from
-- the routine goal (no AI call at schedule time). Every existing guard applies:
-- plan_task validation, the shared 5/day–60/month session cap, per-mission
-- limits, the one automatic follow-up, verification and the sha-guarded merge.
-- Studio and Wellbeing routines keep the review-only draft.
-- Switch: controller.routines_start_work (owner turned it on). Re-runnable.
-- ROLLBACK: update public.paperworld_autonomous_controller_v5 set routines_start_work=false;
begin;

alter table public.paperworld_autonomous_controller_v5
 add column if not exists routines_start_work boolean not null default false;
comment on column public.paperworld_autonomous_controller_v5.routines_start_work is
 'Owner decision: due weekly routines for coding projects start a Developer mission within the shared caps.';
update public.paperworld_autonomous_controller_v5 set routines_start_work=true where singleton;

-- Fixed, validated brief for a routine run. Paths and tests mirror the trusted
-- project registry; plan_task re-validates everything.
create or replace function public.paperworld_v1_routine_task_spec(p_project text,p_goal text)
 returns jsonb language sql immutable set search_path to 'public' as $$
 select case p_project
  when 'listening' then jsonb_build_object(
   'projectId','listening','directorId','listening-director','repository','mr-tanq/concerts',
   'requiredTests',jsonb_build_array('festival_revisit','festival_discovery','identity_profile','setlist_resolver'),
   'allowedPaths',jsonb_build_array('js/','css/','scripts/','tests/','workers/','server/'))
  when 'pokemon' then jsonb_build_object(
   'projectId','pokemon','directorId','pokemon-director','repository','mr-tanq/pokemon-echoes',
   'requiredTests',jsonb_build_array('godot_smoke','battle_damage'),
   'allowedPaths',jsonb_build_array('scripts/','scenes/','tests/'))
  end || jsonb_build_object(
   'title',left('Εβδομαδιαίος έλεγχος: '||btrim(p_goal),120),
   'summary',left('Weekly routine set by the owner: '||btrim(p_goal),560)||
    E'\n\nCheck that this works today. If you find a problem, find its root cause and fix it '||
    'with the smallest safe change. If everything works, add or improve one small automated '||
    'test that covers this check, so the run is still verified.',
   'acceptance',jsonb_build_array('The weekly check described in the summary was done',
    'Any problem found is fixed, and the check is covered by an automated test'),
   'maxFiles',6,'noAutoMerge',true,'noAutoDeploy',true)
 where p_project in ('listening','pokemon') and length(btrim(coalesce(p_goal,'')))>0
$$;
revoke all on function public.paperworld_v1_routine_task_spec(text,text) from public,anon,authenticated;
grant execute on function public.paperworld_v1_routine_task_spec(text,text) to service_role;

create or replace function public.paperworld_v1_stage_routine_draft(p_routine uuid, p_slot timestamp with time zone)
 returns uuid
 language plpgsql
 set search_path to 'public'
as $function$
declare r public.paperworld_routines_v1%rowtype;
declare existing uuid;
declare new_id uuid:=gen_random_uuid();
declare speaker text;
declare stored uuid;
declare started boolean:=false;
declare spec jsonb;
begin
 if p_routine is null or p_slot is null or p_slot>now() or
    p_slot<=now()-interval '8 days' then return null; end if;
 select * into r from public.paperworld_routines_v1
 where id=p_routine and enabled=true for update;
 if not found or r.max_ai_calls<>0 or r.additional_spend_usd<>0 or
    r.next_review_at is distinct from p_slot then return null; end if;
 -- The slot must be a genuine local occurrence of the schedule.
 if public.paperworld_routine_slot_after(r.day_of_week,r.local_hour,r.local_minute,
     r.timezone,p_slot-interval '1 second') is distinct from p_slot then return null; end if;
 select mission_id into existing from public.paperworld_routine_slots_v1
 where routine_id=r.id and scheduled_at=p_slot;
 if existing is null then
  insert into public.paperworld_autonomous_missions_v5
   (id,owner_id,thread_id,project_id,goal,status,policy)
  values(new_id,r.owner_id,r.thread_id,r.project_id,r.goal,'draft',
   jsonb_build_object('executionMode','draft_review_only','maxAiCalls',0,
    'additionalSpendUsd',0,'noAutoMerge',true,'noAutoDeploy',true,
    'source','routine','routineId',r.id,'scheduledAt',p_slot));
  insert into public.paperworld_routine_slots_v1(routine_id,owner_id,scheduled_at,mission_id)
  values(r.id,r.owner_id,p_slot,new_id);
  existing:=new_id;
  -- Phase 5: coding projects start real work when the owner switched it on.
  spec:=public.paperworld_v1_routine_task_spec(r.project_id,r.goal);
  if spec is not null and exists(select 1 from public.paperworld_autonomous_controller_v5
     where singleton and routines_start_work and engine='v1' and dispatch_enabled) then
   begin
    started:=public.paperworld_v5_plan_task(new_id,spec) and public.paperworld_v5_queue_task(new_id);
    if not started then raise exception 'routine_task_not_queued'; end if;
   exception when others then
    -- Never lose the slot: fall back to the review-only draft.
    started:=false;
   end;
  end if;
  -- Friendly, idempotent message in the owner's Matt thread.
  if exists(select 1 from public.paperworld_agent_threads t
            where t.id=r.thread_id and t.owner_id=r.owner_id and t.agent_id='matt') then
   speaker:=case r.project_id when 'pokemon' then 'Ο Joey' when 'listening' then 'Η Luna'
    when 'studio' then 'Ο Crow' else 'Ο Dave' end;
   stored:=md5(new_id::text||':routine_due')::uuid;
   insert into public.paperworld_matt_notifications_v5(mission_id,owner_id,kind,message_id)
   values(new_id,r.owner_id,'routine_due',stored) on conflict do nothing;
   if found then
    insert into public.paperworld_agent_messages(id,thread_id,owner_id,role,content)
    values(stored,r.thread_id,r.owner_id,'agent','@paperworld-matt:v1:'||jsonb_build_object(
     'director',case r.project_id when 'pokemon' then 'pokemon-director'
      when 'studio' then 'studio-director' when 'wellbeing' then 'wellbeing-director'
      else 'listening-director' end,
     'text',case when started then
       speaker||': ξεκίνησα την εβδομαδιαία εργασία «'||left(r.goal,140)||
       '». Θα την ελέγξω με τον Developer, θα διορθώσουμε ό,τι βρούμε και θα σου πω τι έγινε.'
      else speaker||': ήρθε η ώρα για την εβδομαδιαία εργασία «'||left(r.goal,140)||
       '». Την ετοίμασα για να τη δεις — δεν ξεκινά τίποτα χωρίς εσένα.' end,
     'kind','notification')::text)
    on conflict (id) do nothing;
   end if;
  end if;
 end if;
 -- Advance to the next LOCAL occurrence (DST-correct, never "+7 days").
 update public.paperworld_routines_v1 set next_review_at=
  public.paperworld_routine_slot_after(r.day_of_week,r.local_hour,r.local_minute,r.timezone,p_slot)
 where id=r.id;
 return existing;
end $function$;

commit;
