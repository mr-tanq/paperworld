-- PAPERWORLD — Mike, the markets Director (2026-11-26). Read-only watcher.
-- 1) Lets the database accept Mike's chat thread, approved memory and notes.
-- 2) paperworld_mike_holdings_v1: what the owner holds (symbol, pieces, average
--    buy price). PRIVATE: only the owner can see or change their own rows.
-- 3) paperworld_mike_daily_v1: one line a day (value, day change, movers).
--    Only the server writes; the owner reads.
-- 4) Every weekday after the US close the mike-watch Edge Function reads public
--    prices and Mike sends a short update (on Friday also the week).
--    Mike never buys, sells or advises; no AI is used for the numbers.
-- ROLLBACK: select cron.unschedule('paperworld-mike');
--           drop function public.paperworld_mike_wakeup();
--           drop table public.paperworld_mike_daily_v1, public.paperworld_mike_holdings_v1;
begin;
alter table public.paperworld_agent_threads drop constraint if exists paperworld_agent_threads_agent_id_check;
alter table public.paperworld_agent_threads add constraint paperworld_agent_threads_agent_id_check
 check (agent_id = any (array['matt','listening-director','listening-developer','pokemon-director',
  'wellbeing-director','studio-director','shop-director','markets-director']));
alter table public.paperworld_director_memory drop constraint if exists paperworld_director_memory_project_id_check;
alter table public.paperworld_director_memory add constraint paperworld_director_memory_project_id_check
 check (project_id = any (array['town','workshop','pokemon','wellbeing','studio','shop','markets']));
alter table public.paperworld_tasks drop constraint if exists paperworld_tasks_room_check;
alter table public.paperworld_tasks add constraint paperworld_tasks_room_check
 check (room = any (array['town','workshop','pokemon','wellbeing','studio','shop','markets']));

create table if not exists public.paperworld_mike_holdings_v1(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 symbol text not null check (symbol ~ '^[A-Z0-9][A-Z0-9.=^-]{0,19}$'),
 name text not null check (length(name) between 1 and 80),
 quantity numeric not null check (quantity > 0),
 avg_price numeric check (avg_price is null or avg_price > 0),
 currency text not null check (currency in ('EUR','USD','GBP')),
 dividend_date date,
 dividend_per_share numeric check (dividend_per_share is null or dividend_per_share > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,symbol)
);
alter table public.paperworld_mike_holdings_v1 enable row level security;
drop policy if exists paperworld_mike_holdings_owner on public.paperworld_mike_holdings_v1;
create policy paperworld_mike_holdings_owner on public.paperworld_mike_holdings_v1
 for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke all on public.paperworld_mike_holdings_v1 from anon;

create table if not exists public.paperworld_mike_daily_v1(
 owner_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 total_eur numeric not null,
 change_eur numeric not null,
 change_pct numeric not null,
 lines jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 primary key(owner_id,day)
);
alter table public.paperworld_mike_daily_v1 enable row level security;
drop policy if exists paperworld_mike_daily_owner_read on public.paperworld_mike_daily_v1;
create policy paperworld_mike_daily_owner_read on public.paperworld_mike_daily_v1
 for select to authenticated using (owner_id = auth.uid());
revoke insert,update,delete on public.paperworld_mike_daily_v1 from anon,authenticated;

create or replace function public.paperworld_mike_wakeup()
returns jsonb language plpgsql security definer set search_path=public as $$
declare secret text;rid bigint;
begin
 if not exists(select 1 from public.paperworld_mike_holdings_v1) then return '{"state":"no_holdings"}'::jsonb; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
  into secret using 'paperworld_v5_dispatch_trigger';
 if secret is null or length(secret)<32 then return '{"state":"secret_missing"}'::jsonb; end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=60000)'
  into rid using 'https://jrevhzvrgenucuozjowm.supabase.co/functions/v1/mike-watch',
  jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
  '{"source":"cron"}'::jsonb;
 return jsonb_build_object('state','submitted','requestId',rid);
exception when others then
 return '{"state":"wakeup_failed"}'::jsonb;
end $$;
revoke all on function public.paperworld_mike_wakeup() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from cron.job where jobname='paperworld-mike') then perform cron.unschedule('paperworld-mike'); end if;
 -- 22:37 UTC Mon-Fri: after the US close (21:00 UTC in winter, 20:00 in summer).
 perform cron.schedule('paperworld-mike','37 22 * * 1-5','select public.paperworld_mike_wakeup()');
end $$;
commit;
