-- Routine Loop V2: integrate with EXISTING V5 five-minute heartbeat.
-- REVIEW ONLY: do not apply before V1 schema, staging auth and owner tests.
-- No cron.schedule, no AI, no effect claims, no execution/queueing.
begin;

-- Keep routine slots progressing instead of setting next_review_at to NULL.
-- A disabled template or a wrong/out-of-window slot never creates a mission.
create or replace function public.paperworld_v1_stage_routine_draft(
 p_routine uuid,p_slot timestamptz)
returns uuid language plpgsql security invoker set search_path=public as $$
declare r public.paperworld_routines_v1%rowtype;
declare existing uuid;
declare new_id uuid:=gen_random_uuid();
declare utc_day integer;
declare utc_hour integer;
declare utc_minute integer;
begin
 if p_routine is null or p_slot is null or p_slot>now()
    or p_slot<=now()-interval '8 days' then return null; end if;
 select * into r from public.paperworld_routines_v1
 where id=p_routine and enabled=true for update;
 if not found or r.max_ai_calls<>0 or r.additional_spend_usd<>0
    or r.next_review_at is distinct from p_slot then return null; end if;
 -- PostgreSQL extract(dow): Sunday=0 ... Saturday=6, same as JS routine policy.
 utc_day:=extract(dow from p_slot at time zone 'UTC')::int;
 utc_hour:=extract(hour from p_slot at time zone 'UTC')::int;
 utc_minute:=extract(minute from p_slot at time zone 'UTC')::int;
 if utc_day<>r.day_of_week or utc_hour<>r.hour_utc
    or utc_minute<>r.minute_utc or
    extract(second from p_slot at time zone 'UTC')<>0 then return null; end if;
 select mission_id into existing from public.paperworld_routine_slots_v1
 where routine_id=r.id and scheduled_at=p_slot;
 if existing is null then
   insert into public.paperworld_autonomous_missions_v5
    (id,owner_id,thread_id,project_id,goal,status,policy)
   values(new_id,r.owner_id,r.thread_id,r.project_id,r.goal,'draft',
    '{"executionMode":"draft_review_only","maxAiCalls":0,
       "additionalSpendUsd":0,"noAutoMerge":true,"noAutoDeploy":true}'::jsonb);
   insert into public.paperworld_routine_slots_v1
    (routine_id,owner_id,scheduled_at,mission_id)
   values(r.id,r.owner_id,p_slot,new_id);
   existing:=new_id;
 end if;
 -- One weekly advancement. Never auto-queue this draft.
 update public.paperworld_routines_v1 set
  next_review_at=p_slot+interval '7 days',updated_at=now()
 where id=r.id;
 return existing;
end $$;
revoke all on function public.paperworld_v1_stage_routine_draft(uuid,timestamptz)
 from public,anon,authenticated;
grant execute on function public.paperworld_v1_stage_routine_draft(uuid,timestamptz)
 to service_role;

-- Called ONLY inside the existing unified tick by the service role.
-- Controller serializes; per-template locks and unique slot PK prevent repeats.
create or replace function public.paperworld_v1_review_due_routines()
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r record;
declare mission uuid;
declare staged integer:=0;
declare skipped integer:=0;
begin
 -- Additional short lock: retry safely at the next existing heartbeat.
 if not pg_try_advisory_xact_lock(534128, 31) then
  return jsonb_build_object('state','busy','staged',0);
 end if;
 for r in
  select id,next_review_at from public.paperworld_routines_v1
  where enabled=true and max_ai_calls=0 and additional_spend_usd=0
    and next_review_at<=now()
    and next_review_at>now()-interval '8 days'
  order by next_review_at,id limit 10
 loop
  mission:=public.paperworld_v1_stage_routine_draft(r.id,r.next_review_at);
  if mission is not null then staged:=staged+1;
  else skipped:=skipped+1;
  end if;
 end loop;
 return jsonb_build_object('state','review_only','staged',staged,
  'skipped',skipped,'aiCalls',0,'externalActions',0);
end $$;
revoke all on function public.paperworld_v1_review_due_routines()
 from public,anon,authenticated;
grant execute on function public.paperworld_v1_review_due_routines()
 to service_role;

-- Extend the already-scheduled unified tick, without creating another schedule.
-- No wakeup is sent for routine drafts: current V5 dispatcher sees ready steps
-- and this routine produces none.
create or replace function public.paperworld_v5_unified_tick()
returns jsonb language plpgsql security invoker set search_path=public as $$
declare ctrl jsonb;declare routine jsonb;declare wake jsonb;declare notices jsonb;
begin
 ctrl:=public.paperworld_v5_controller_tick();
 routine:=public.paperworld_v1_review_due_routines();
 wake:=public.paperworld_v5_unified_wakeup();
 -- Preserve the existing production Matt notification stage. Isolate failures
 -- exactly as the current V5 function does so routine staging cannot suppress it.
 begin
  notices:=public.paperworld_v5_notify_matt();
 exception when others then
  notices:='{"state":"error"}'::jsonb;
 end;
 return jsonb_build_object('controller',ctrl,'routines',routine,
  'dispatch',wake,'notifications',notices);
end $$;
revoke all on function public.paperworld_v5_unified_tick()
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_unified_tick()
 to service_role;
commit;
