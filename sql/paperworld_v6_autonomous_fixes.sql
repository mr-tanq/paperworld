-- PAPERWORLD v6 — autonomous fixes (owner decision 2026-11-20).
-- "Tell Matt there is a problem → Luna + Developer find it, fix it, verify it,
--  and Matt says what it was." No per-task approvals.
--
-- 1. controller.auto_merge_verified: the Task Engine dispatcher merges a PR ONLY
--    after the trusted main workflow proved the exact head commit (GitHub sha
--    guard + branch protection still apply). Owner switched it on.
-- 2. Safety limits stay, raised by the owner: 5 Developer sessions/day, 60/month.
-- 3. Matt's completion message explains what was wrong and what changed, and
--    says plainly whether the fix is already live or needs one tap.
-- Re-runnable. Does not touch cron, the unified tick, grants or any other stage.
-- ROLLBACK: update public.paperworld_autonomous_controller_v5
--   set auto_merge_verified=false, sessions_per_day=1, sessions_per_month=10;
begin;

alter table public.paperworld_autonomous_controller_v5
 add column if not exists auto_merge_verified boolean not null default false;
comment on column public.paperworld_autonomous_controller_v5.auto_merge_verified is
 'Owner decision: merge a Developer PR automatically only after the trusted workflow verified its exact head.';

update public.paperworld_autonomous_controller_v5
 set auto_merge_verified=true,sessions_per_day=5,sessions_per_month=60
 where singleton;

create or replace function public.paperworld_v5_notify_matt()
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare notice record;
declare new_count integer:=0;
declare msg text;
declare speaker text;
declare stored_id uuid;
declare rep jsonb;
declare title text;
declare details text;
declare pr_link text;
begin
 -- Dedicated lock prevents independent notifier invocations claiming the same item.
 if not pg_try_advisory_xact_lock(534128,18) then
  return jsonb_build_object('state','busy','messages',0);
 end if;
 for notice in
  select m.id,m.owner_id,m.thread_id,m.project_id,m.goal,m.status,m.spec,
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
  rep:=null;
  if notice.kind='completed' then
   select s.output into rep from public.paperworld_autonomous_steps_v5 s
    where s.mission_id=notice.id and s.capability='report' and s.state='succeeded'
    limit 1;
  end if;
  title:=left(coalesce(nullif(rep->>'title',''),nullif(notice.spec->>'title',''),'την εργασία'),120);
  details:=coalesce(E'\nΤι έφταιγε: '||left(nullif(rep->>'cause',''),280),'')||
   coalesce(E'\nΤι αλλάξαμε: '||left(nullif(rep->>'fix',''),280),'');
  pr_link:=case when rep->>'prUrl' ~ '^https://github\.com/mr-tanq/[A-Za-z0-9._-]+/pull/[0-9]+$'
   then rep->>'prUrl' end;
  msg:=case
   when notice.kind='completed' and rep->>'merged'='true' then
    'Το βρήκαμε και το φτιάξαμε: «'||title||'».'||details||
    E'\nΠέρασαν όλοι οι έλεγχοι και η διόρθωση μπήκε ήδη στην εφαρμογή.'
   when notice.kind='completed' and rep ? 'mergeState' then
    'Η διόρθωση για «'||title||'» είναι έτοιμη και πέρασε όλους τους ελέγχους.'||details||
    case when rep->>'mergeState'='blocked'
     then E'\nΤο GitHub δεν με άφησε να τη βάλω μόνη μου στην εφαρμογή, οπότε θέλει ένα πάτημα από σένα.'
     else E'\nΓια να μπει στην εφαρμογή θέλει ένα πάτημα από σένα.' end||
    coalesce(E'\n'||pr_link,'')
   when notice.kind='completed' then speaker||' ολοκλήρωσε την εργασία που είχαμε αναλάβει. '
     ||'Έχουμε καταγεγραμμένο αποτέλεσμα για να το δεις. '
     ||'Δεν σημαίνει ότι η αλλαγή έχει ήδη δημοσιευτεί.'
   when notice.kind='needs_you' then 'Η ομάδα δεν κατάφερε να ολοκληρώσει μόνη της την εργασία «'
     ||title||'». Δεν άλλαξε τίποτα στην εφαρμογή. Πες μου αν θέλεις να το ξαναδοκιμάσουμε.'
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
     'text',msg,'kind','notification')::text)
  on conflict (id) do nothing;
  if not found then
   raise exception 'matt_notification_message_conflict';
  end if;
  new_count:=new_count+1;
 end loop;
 return jsonb_build_object('state','ok','messages',new_count);
end $function$;

commit;
