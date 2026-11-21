-- PAPERWORLD — Director initiatives, phase B: ideas answered with Yes/No (2026-11-21).
-- Daily (10:23 Amsterdam) the database wakes the Render server with a
-- single-use token; Luna, Joey and Crow each store ONE idea here and Matt tells
-- the owner. Nothing starts until the owner answers "Ναι" in the app.
-- ROLLBACK: select cron.unschedule('paperworld-proposals');
--   drop function public.paperworld_proposals_wakeup(), public.paperworld_decide_proposal(uuid,boolean);
--   drop table public.paperworld_proposals_v1, public.paperworld_initiative_runs_v1;
begin;
create table if not exists public.paperworld_proposals_v1(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 director_id text not null check (director_id in ('listening-director','pokemon-director','studio-director','wellbeing-director')),
 title text not null check (length(btrim(title)) between 1 and 80),
 why text not null check (length(btrim(why)) between 1 and 200),
 task text not null check (length(btrim(task)) between 1 and 400),
 week text not null check (week ~ '^\d{4}-\d{2}-\d{2}$'),
 status text not null default 'proposed' check (status in ('proposed','accepted','declined')),
 created_at timestamptz not null default now(),
 decided_at timestamptz);
create index if not exists paperworld_proposals_owner on public.paperworld_proposals_v1(owner_id,status);
alter table public.paperworld_proposals_v1 enable row level security;
revoke all on public.paperworld_proposals_v1 from public,anon,authenticated;
grant select on public.paperworld_proposals_v1 to authenticated;
grant all on public.paperworld_proposals_v1 to service_role;
drop policy if exists proposals_owner_select on public.paperworld_proposals_v1;
create policy proposals_owner_select on public.paperworld_proposals_v1
 for select to authenticated using ((select auth.uid())=owner_id);

-- The owner answers once: Ναι or Όχι. Returns what the app needs to hand the
-- idea to the Director (only for the owner's own, still-open proposal).
create or replace function public.paperworld_decide_proposal(p_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.paperworld_proposals_v1%rowtype;
begin
 update public.paperworld_proposals_v1 set status=case when p_accept then 'accepted' else 'declined' end,decided_at=now()
 where id=p_id and owner_id=auth.uid() and status='proposed' returning * into r;
 if not found then return '{"state":"not_open"}'::jsonb; end if;
 return jsonb_build_object('state',r.status,'id',r.id,'directorId',r.director_id,'title',r.title,'task',r.task);
end $$;
revoke all on function public.paperworld_decide_proposal(uuid,boolean) from public,anon;
grant execute on function public.paperworld_decide_proposal(uuid,boolean) to authenticated;

create table if not exists public.paperworld_initiative_runs_v1(
 token uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 used_at timestamptz);
alter table public.paperworld_initiative_runs_v1 enable row level security;
revoke all on public.paperworld_initiative_runs_v1 from public,anon,authenticated;
grant all on public.paperworld_initiative_runs_v1 to service_role;

create or replace function public.paperworld_proposals_wakeup()
returns jsonb language plpgsql security definer set search_path=public as $$
declare t uuid;rid bigint;
begin
 if exists(select 1 from public.paperworld_autonomous_controller_v5 where singleton and initiatives_paused)
 then return '{"state":"paused"}'::jsonb; end if;
 insert into public.paperworld_initiative_runs_v1 default values returning token into t;
 delete from public.paperworld_initiative_runs_v1 where created_at<now()-interval '30 days';
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=60000)'
 into rid using 'https://paperworld-matt-test-6hmd.onrender.com/initiative/propose',
  '{"Content-Type":"application/json"}'::jsonb,jsonb_build_object('token',t);
 return jsonb_build_object('state','submitted','requestId',rid);
exception when others then
 return '{"state":"wakeup_failed"}'::jsonb;
end $$;
revoke all on function public.paperworld_proposals_wakeup() from public,anon,authenticated;
grant execute on function public.paperworld_proposals_wakeup() to service_role;
do $$
begin
 if exists(select 1 from cron.job where jobname='paperworld-proposals')
 then perform cron.unschedule('paperworld-proposals'); end if;
 perform cron.schedule('paperworld-proposals','23 8 * * *','select public.paperworld_proposals_wakeup()');
end $$;
commit;
