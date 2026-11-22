-- PAPERWORLD Phase 3 — Directors learn from every finished task.
-- Supersedes the notifier in paperworld_phase1_plain_failures.sql (same text,
-- plus one lesson per finished mission in paperworld_director_memory:
-- kind work_history, source verified_result, standard sensitivity, approved,
-- once per mission; never for Wellbeing; isolated from the message path).
-- The owner sees and removes lessons in Memory like any other note.
-- Also calls Matt's morning summary (paperworld_phase2_daily_summary.sql) in its
-- own exception block. Re-runnable; no cron, tick, grant or budget changes.
begin;
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
declare why text;
declare memory_project text;
declare lesson text;
begin
 -- Dedicated lock prevents independent notifier invocations claiming the same item.
 if not pg_try_advisory_xact_lock(534128,18) then
  return jsonb_build_object('state','busy','messages',0);
 end if;
 for notice in
  select m.id,m.owner_id,m.thread_id,m.project_id,m.goal,m.status,m.spec,m.last_error,
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
  if rep is null and notice.kind='needs_you' then
   select jsonb_build_object('prUrl',s.output->>'prUrl') into rep from public.paperworld_autonomous_steps_v5 s
    where s.mission_id=notice.id and s.capability='await_agent' limit 1;
  end if;
  pr_link:=case when rep->>'prUrl' ~ '^https://github\.com/mr-tanq/[A-Za-z0-9._-]+/pull/[0-9]+$'
   then rep->>'prUrl' end;
  -- Plain words for the engine's stop reasons (never shows raw codes).
  why:=case coalesce(notice.last_error,'')
   when 'trusted_verification_failed' then 'η διόρθωση δεν πέρασε τα tests, οπότε δεν τη βάλαμε.'
   when 'trusted_verification_timed_out' then 'ο έλεγχος με τα tests δεν τελείωσε μέσα σε δύο ώρες.'
   when 'copilot_pr_missing' then 'ο Developer δεν παρέδωσε διόρθωση μέσα σε μισή ώρα.'
   when 'copilot_deadline_exceeded' then 'ο Developer δεν τελείωσε μέσα σε τρεις ώρες.'
   when 'ambiguous_copilot_pr' then 'βρέθηκαν δύο διαφορετικές διορθώσεις και δεν ήταν σίγουρο ποια ισχύει.'
   when 'pr_head_changed_before_verify' then 'η διόρθωση άλλαξε πριν τον έλεγχο, οπότε για ασφάλεια σταματήσαμε.'
   when 'pr_head_moved_after_verify' then 'η διόρθωση άλλαξε μετά τον έλεγχο, οπότε για ασφάλεια δεν τη βάλαμε.'
   when 'pr_head_moved_after_verification' then 'η διόρθωση άλλαξε μετά τον έλεγχο, οπότε για ασφάλεια δεν τη βάλαμε.'
   when 'trusted_verification_missing' then 'δεν βρέθηκε επιβεβαιωμένος έλεγχος, οπότε δεν τη βάλαμε.'
   when 'agent_no_changes' then 'ο Developer το έλεγξε και δεν χρειάστηκε να αλλάξει τίποτα.'
   when 'agent_too_many_files' then 'η αλλαγή άγγιζε περισσότερα αρχεία από όσα επιτρέπονται, οπότε δεν τη βάλαμε.'
   when 'agent_files_out_of_scope' then 'η αλλαγή άγγιζε αρχεία έξω από τα επιτρεπόμενα, οπότε για ασφάλεια δεν τη βάλαμε.'
   else 'κάτι δεν πήγε όπως έπρεπε στη διαδικασία.' end;
  msg:=case
   when notice.kind='completed' and rep->>'merged'='true' then
    'Το βρήκαμε και το φτιάξαμε: «'||title||'».'||details||
    E'\nΠέρασαν όλοι οι έλεγχοι και η διόρθωση μπήκε ήδη στην εφαρμογή.'
   -- 2026-11-22: main moved on meanwhile; the engine already redoes it once.
   when notice.kind='completed' and rep->>'retryQueued'='true' then
    'Η διόρθωση για «'||title||'» πέρασε όλους τους ελέγχους, αλλά στο μεταξύ άλλαξε ο κώδικας και δεν ταίριαζε πια. '
     ||'Ο Developer την ξαναφτιάχνει μόνος του πάνω στην τρέχουσα έκδοση. Δεν χρειάζεται να κάνεις τίποτα· θα σου πω το αποτέλεσμα.'
   when notice.kind='completed' and rep ? 'mergeState' then
    'Η διόρθωση για «'||title||'» είναι έτοιμη και πέρασε όλους τους ελέγχους.'||details||
    case when rep->>'mergeState'='blocked'
     then E'\nΤο GitHub δεν με άφησε να τη βάλω μόνος μου στην εφαρμογή, οπότε θέλει ένα πάτημα από σένα.'
     else E'\nΓια να μπει στην εφαρμογή θέλει ένα πάτημα από σένα.' end||
    coalesce(E'\n'||pr_link,'')
   when notice.kind='completed' then speaker||' ολοκλήρωσε την εργασία που είχαμε αναλάβει. '
     ||'Έχουμε καταγεγραμμένο αποτέλεσμα για να το δεις. '
     ||'Δεν σημαίνει ότι η αλλαγή έχει ήδη δημοσιευτεί.'
   when notice.kind='needs_you' and exists(select 1 from public.paperworld_autonomous_missions_v5 r
     where r.policy->>'retryOf'=notice.id::text and r.owner_id=notice.owner_id) then
    'Η πρώτη προσπάθεια για «'||title||'» δεν τα κατάφερε: '||why
     ||' Ο Developer το ξαναπιάνει μόνος του, με όσα έμαθε. Δεν χρειάζεται να κάνεις τίποτα· θα σου πω το αποτέλεσμα.'
   when notice.kind='needs_you' and notice.last_error='agent_no_changes' then
    -- 2026-11-21: a check that changed nothing is a finished check, not a request.
    'Για «'||title||'»: '||why||coalesce(' Τι βρήκε: '||pr_link,'')
     ||case when notice.project_id='listening'
       then ' Αν κάτι δεν δουλεύει, πες μου ένα παράδειγμα (π.χ. πόλη ή καλλιτέχνη) και το ξαναψάχνουμε.'
       else ' Αν κάτι δεν δουλεύει, πες μου ένα συγκεκριμένο παράδειγμα και το ξαναψάχνουμε.' end
   when notice.kind='needs_you' then 'Η ομάδα σταμάτησε την εργασία «'||title||'»: '||why
     ||' Δεν άλλαξε τίποτα στην εφαρμογή. Πες μου αν θέλεις να το ξαναδοκιμάσουμε.'
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
  -- Phase 3: the Director keeps a lesson from every finished task (verified
  -- results only; the owner can see and remove it in Memory). Isolated so a
  -- memory problem never blocks Matt's message. Never for Wellbeing.
  if notice.project_id in ('listening','pokemon','studio') and
     (notice.kind='completed' or (notice.kind='needs_you' and not exists(
      select 1 from public.paperworld_autonomous_missions_v5 r
      where r.policy->>'retryOf'=notice.id::text and r.owner_id=notice.owner_id))) then
   begin
    memory_project:=case notice.project_id when 'listening' then 'workshop' else notice.project_id end;
    lesson:=case
     when notice.kind='completed' then
      'Εργασία: «'||title||'».'||coalesce(details,'')||
      case when rep->>'merged'='true' then E'\nΑποτέλεσμα: πέρασε τα tests και μπήκε στην εφαρμογή.'
       when rep ? 'mergeState' then E'\nΑποτέλεσμα: πέρασε τα tests· περίμενε ένα πάτημα για να μπει.'
       else E'\nΑποτέλεσμα: ολοκληρώθηκε.' end||coalesce(E'\nΑλλαγή: '||pr_link,'')
     else 'Εργασία: «'||title||'». Δεν ολοκληρώθηκε: '||why||
      E'\nΤην επόμενη φορά: ξεκίνα από αυτό το σημείο.' end;
    insert into public.paperworld_director_memory
     (owner_id,project_id,kind,status,title,body,source_type,source_ref,observed_at,sensitivity)
    select notice.owner_id,memory_project,'work_history','approved',
     left('Μάθημα: '||title,140),left(lesson,4000),'verified_result','mission:'||notice.id::text,now(),'standard'
    where not exists(select 1 from public.paperworld_director_memory d
     where d.owner_id=notice.owner_id and d.source_ref='mission:'||notice.id::text);
   exception when others then null;
   end;
  end if;
  new_count:=new_count+1;
 end loop;
 -- Phase 2: Matt's morning summary (no-op before 09:00 local or if already sent).
 begin perform public.paperworld_v1_daily_summary();
 exception when others then null; end;
 return jsonb_build_object('state','ok','messages',new_count);
end $function$;

commit;
