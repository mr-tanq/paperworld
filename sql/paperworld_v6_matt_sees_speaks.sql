-- Matt Sees & Speaks: one owner-scoped read model and exactly-once conversation events.
-- Additive. No new model calls, GitHub actions or payment permissions.
create table if not exists public.paperworld_matt_notifications_v5 (
 mission_id uuid not null references public.paperworld_autonomous_missions_v5(id) on delete cascade,
 owner_id uuid not null,
 kind text not null check (kind in ('completed','needs_you','stalled')),
 message_id uuid not null unique,
 created_at timestamptz not null default now(),
 primary key (mission_id,kind)
);
alter table public.paperworld_matt_notifications_v5 enable row level security;
revoke all on public.paperworld_matt_notifications_v5 from public,anon,authenticated;
grant select,insert on public.paperworld_matt_notifications_v5 to service_role;

create or replace function public.paperworld_v5_team_snapshot(p_owner uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
with directors(project_id,person) as (
 values ('listening','Luna'),('pokemon','Joey'),
        ('studio','Crow'),('wellbeing','Dave')
), per_director as (
 select d.project_id,d.person,
 (select count(*) from public.paperworld_autonomous_missions_v5 m
  where m.owner_id=p_owner and m.project_id=d.project_id
  and m.status in ('queued','running','working','verifying')) as active_count,
 (select count(*) from public.paperworld_autonomous_missions_v5 m
  where m.owner_id=p_owner and m.project_id=d.project_id
  and m.status in ('needs_you','paused_budget')) as attention_count,
 (select coalesce(jsonb_agg(jsonb_build_object(
    'id',z.id,'goal',case when d.project_id='wellbeing' then null else z.goal end,
    'status',z.status,'updatedAt',z.updated_at,
    'result',case when d.project_id='wellbeing' then null
       when z.status='completed' then jsonb_build_object(
        'prepared',z.report is not null,'verified',z.report is not null)
       else null end) order by z.updated_at desc),'[]'::jsonb)
  from (select m.id,m.goal,m.status,m.report,m.updated_at
   from public.paperworld_autonomous_missions_v5 m
   where m.owner_id=p_owner and m.project_id=d.project_id
    and m.status in ('queued','running','working','verifying',
                     'completed','needs_you','paused_budget')
   order by m.updated_at desc limit 3) z
 ) as recent_jobs
 from directors d
)
select jsonb_build_object('directors',coalesce(
 (select jsonb_agg(jsonb_build_object('projectId',project_id,'name',person,
 'active',active_count,'attention',attention_count,'recent',recent_jobs)
 order by project_id) from per_director),'[]'::jsonb),
 'asOf',now())
where p_owner is not null
$$;
revoke all on function public.paperworld_v5_team_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.paperworld_v5_team_snapshot(uuid) to service_role;

create or replace function public.paperworld_v5_notify_matt()
returns jsonb language plpgsql security invoker set search_path=public as $$
declare notice record;
declare new_count integer:=0;
declare msg text;
declare speaker text;
declare stored_id uuid;
begin
 -- Dedicated lock prevents independent notifier invocations claiming the same item.
 if not pg_try_advisory_xact_lock(534128,18) then
  return jsonb_build_object('state','busy','messages',0);
 end if;
 for notice in
  select m.id,m.owner_id,m.thread_id,m.project_id,m.goal,m.status,
   case when m.status='completed' then 'completed'
        when m.status='needs_you' then 'needs_you'
        else 'stalled' end as kind
  from public.paperworld_autonomous_missions_v5 m
  join public.paperworld_agent_threads t
   on t.id=m.thread_id and t.owner_id=m.owner_id and t.agent_id='matt'
  where m.engine='v1' and
   (m.status in ('completed','needs_you') or
    (m.status in ('queued','running','working','verifying')
      and m.updated_at<now()-interval '2 hours'))
   and not exists (
    select 1 from public.paperworld_matt_notifications_v5 n
    where n.mission_id=m.id and n.kind=case
     when m.status='completed' then 'completed'
     when m.status='needs_you' then 'needs_you' else 'stalled' end)
  order by m.updated_at
  limit 50
 loop
  speaker:=case notice.project_id when 'pokemon' then 'Ο Joey'
   when 'listening' then 'Η Luna'
   when 'studio' then 'Ο Crow' when 'wellbeing' then 'Ο Dave'
   else 'Η ομάδα' end;
  msg:=case notice.kind
   when 'completed' then speaker||' ολοκλήρωσε την εργασία που είχαμε αναλάβει. '
     ||'Έχουμε καταγεγραμμένο αποτέλεσμα για να το δεις. '
     ||'Δεν σημαίνει ότι η αλλαγή έχει ήδη δημοσιευτεί.'
   when 'needs_you' then speaker||' χρειάζεται τη βοήθειά σου για να συνεχίσει. '
     ||'Η εργασία δεν ολοκληρώθηκε ακόμη.'
   else speaker||' δεν έχει δώσει νέα ενημέρωση εδώ και δύο ώρες. '
     ||'Δεν θα υποθέσω ότι ολοκληρώθηκε. Θα το ελέγξουμε.'
   end;
  -- Deterministic message ID protects against duplicate messages on retries.
  stored_id:=md5(notice.id::text||':'||notice.kind)::uuid;
  insert into public.paperworld_matt_notifications_v5
    (mission_id,owner_id,kind,message_id)
  values(notice.id,notice.owner_id,notice.kind,stored_id)
  on conflict do nothing;
  if not found then continue; end if;
  insert into public.paperworld_agent_messages(id,thread_id,owner_id,role,content)
  values(stored_id,notice.thread_id,notice.owner_id,'agent',
    '@paperworld-matt:v1:'||jsonb_build_object(
     'director',case notice.project_id
       when 'pokemon' then 'pokemon-director'
       when 'studio' then 'studio-director'
       else 'listening-director' end,
     'text',msg)::text)
  on conflict (id) do nothing;
  if not found then
   raise exception 'matt_notification_message_conflict';
  end if;
  new_count:=new_count+1;
 end loop;
 return jsonb_build_object('state','ok','messages',new_count);
end $$;
revoke all on function public.paperworld_v5_notify_matt() from public,anon,authenticated;
grant execute on function public.paperworld_v5_notify_matt() to service_role;

-- One existing cron heartbeat. A notification failure never prevents dispatch.
create or replace function public.paperworld_v5_unified_tick()
returns jsonb language plpgsql security invoker set search_path=public as $$
declare ctrl jsonb;declare wake jsonb;declare notices jsonb;
begin
 ctrl:=public.paperworld_v5_controller_tick();
 wake:=public.paperworld_v5_unified_wakeup();
 begin
  notices:=public.paperworld_v5_notify_matt();
 exception when others then
  notices:='{"state":"error"}'::jsonb;
 end;
 return jsonb_build_object('controller',ctrl,'dispatch',wake,'notifications',notices);
end $$;
revoke all on function public.paperworld_v5_unified_tick() from public,anon,authenticated;
grant execute on function public.paperworld_v5_unified_tick() to service_role;
