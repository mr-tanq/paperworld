-- PAPERWORLD Phase 2 — Matt's short morning summary.
-- Once per owner per local day (Europe/Amsterdam, 09:00-11:59), and only when
-- the team did something in the last 24 hours: finished / live / running /
-- needs you, with up to three finished titles. Deterministic message id, a
-- ledger row per owner-day, no AI call, no cron (called by the existing
-- notifier inside its own exception block). Re-runnable.
-- ROLLBACK: drop function public.paperworld_v1_daily_summary(timestamptz); (the notifier ignores its absence)
begin;

create table if not exists public.paperworld_daily_summaries_v1(
 owner_id uuid not null,
 local_day date not null,
 message_id uuid not null unique,
 created_at timestamptz not null default now(),
 primary key (owner_id,local_day));
alter table public.paperworld_daily_summaries_v1 enable row level security;
revoke all on public.paperworld_daily_summaries_v1 from public,anon,authenticated;

create or replace function public.paperworld_v1_daily_summary(p_now timestamptz default now())
 returns integer language plpgsql set search_path to 'public' as $function$
declare o record;
declare local_now timestamp:=p_now at time zone 'Europe/Amsterdam';
declare today date:=(p_now at time zone 'Europe/Amsterdam')::date;
declare msg text;declare stored uuid;declare titles text;declare sent integer:=0;
begin
 -- Morning only: a missed morning is skipped, never sent as a late "Καλημέρα".
 if extract(hour from local_now)<9 or extract(hour from local_now)>=12 then return 0; end if;
 for o in
  select m.owner_id,
   (array_agg(m.thread_id order by m.updated_at desc))[1] thread_id,
   count(*) filter (where m.status='completed' and m.updated_at>p_now-interval '24 hours') finished,
   count(*) filter (where m.status='completed' and m.updated_at>p_now-interval '24 hours'
     and m.report->>'merged'='true') live,
   count(*) filter (where m.status in ('queued','running','working','verifying')) running,
   count(*) filter (where m.status='needs_you' and m.updated_at>p_now-interval '3 days'
     and not exists(select 1 from public.paperworld_autonomous_missions_v5 r
      where r.policy->>'retryOf'=m.id::text)) needs_you
  from public.paperworld_autonomous_missions_v5 m
  join public.paperworld_agent_threads t on t.id=m.thread_id and t.owner_id=m.owner_id and t.agent_id='matt'
  where m.engine='v1' and m.project_id<>'wellbeing' and m.updated_at>p_now-interval '24 hours'
  group by m.owner_id
 loop
  if o.finished+o.running+o.needs_you=0 then continue; end if;
  if exists(select 1 from public.paperworld_daily_summaries_v1 d
   where d.owner_id=o.owner_id and d.local_day=today) then continue; end if;
  select string_agg('«'||left(coalesce(m.report->>'title',m.goal),80)||'»',', ' order by m.updated_at desc)
   into titles from (select * from public.paperworld_autonomous_missions_v5 m2
    where m2.owner_id=o.owner_id and m2.engine='v1' and m2.project_id<>'wellbeing'
     and m2.status='completed' and m2.updated_at>p_now-interval '24 hours'
    order by m2.updated_at desc limit 3) m;
  msg:='Καλημέρα! Τι έκανε η ομάδα το τελευταίο 24ωρο:'||
   case when o.finished>0 then E'\n✓ Ολοκληρώθηκαν '||o.finished||
     case when o.live>0 then ' ('||o.live||' μπήκαν ήδη στην εφαρμογή)' else '' end||
     coalesce(': '||titles,'')||'.' else '' end||
   case when o.running>0 then E'\n• Σε εξέλιξη: '||o.running||'.' else '' end||
   case when o.needs_you>0 then E'\n! Χρειάζονται εσένα: '||o.needs_you||'.' else E'\nΔεν χρειάζεται να κάνεις τίποτα.' end;
  stored:=md5(o.owner_id::text||':daily:'||today::text)::uuid;
  insert into public.paperworld_daily_summaries_v1(owner_id,local_day,message_id)
  values(o.owner_id,today,stored) on conflict do nothing;
  if not found then continue; end if;
  insert into public.paperworld_agent_messages(id,thread_id,owner_id,role,content)
  values(stored,o.thread_id,o.owner_id,'agent','@paperworld-matt:v1:'||jsonb_build_object(
   'director','matt','text',msg,'kind','notification')::text)
  on conflict (id) do nothing;
  sent:=sent+1;
 end loop;
 return sent;
end $function$;
revoke all on function public.paperworld_v1_daily_summary(timestamptz) from public,anon,authenticated;
grant execute on function public.paperworld_v1_daily_summary(timestamptz) to service_role;

commit;
