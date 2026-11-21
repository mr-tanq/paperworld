-- PAPERWORLD — phone notifications for Matt's updates (2026-11-21).
-- 1) paperworld_push_subscriptions_v1: the owner's own devices (RLS: own rows).
-- 2) paperworld_push_sent_v1: at-most-once ledger (service role only).
-- 3) paperworld_push_wakeup(): every minute, wakes the paperworld-push Edge
--    Function ONLY when a new notification is waiting for a subscribed owner.
-- The VAPID private key is stored separately in Vault as 'paperworld_vapid_private_jwk'.
-- Nothing here starts work, calls AI or changes missions.
-- ROLLBACK: select cron.unschedule('paperworld-push');
--           drop function public.paperworld_push_wakeup();
--           drop table public.paperworld_push_sent_v1, public.paperworld_push_subscriptions_v1;
begin;
create table if not exists public.paperworld_push_subscriptions_v1(
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 endpoint text primary key check (endpoint ~ '^https://[A-Za-z0-9.-]+/' and length(endpoint)<=1000),
 p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
 auth text not null check (auth ~ '^[A-Za-z0-9_-]{16,30}$'),
 created_at timestamptz not null default now());
create index if not exists paperworld_push_subscriptions_owner on public.paperworld_push_subscriptions_v1(owner_id);
alter table public.paperworld_push_subscriptions_v1 enable row level security;
revoke all on public.paperworld_push_subscriptions_v1 from public,anon,authenticated;
grant select,insert,delete on public.paperworld_push_subscriptions_v1 to authenticated;
grant all on public.paperworld_push_subscriptions_v1 to service_role;
drop policy if exists push_owner_select on public.paperworld_push_subscriptions_v1;
drop policy if exists push_owner_insert on public.paperworld_push_subscriptions_v1;
drop policy if exists push_owner_delete on public.paperworld_push_subscriptions_v1;
create policy push_owner_select on public.paperworld_push_subscriptions_v1
 for select to authenticated using ((select auth.uid())=owner_id);
create policy push_owner_insert on public.paperworld_push_subscriptions_v1
 for insert to authenticated with check ((select auth.uid())=owner_id);
create policy push_owner_delete on public.paperworld_push_subscriptions_v1
 for delete to authenticated using ((select auth.uid())=owner_id);

create table if not exists public.paperworld_push_sent_v1(
 message_id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 sent_at timestamptz not null default now());
alter table public.paperworld_push_sent_v1 enable row level security;
revoke all on public.paperworld_push_sent_v1 from public,anon,authenticated;
grant all on public.paperworld_push_sent_v1 to service_role;

create or replace function public.paperworld_push_wakeup()
returns jsonb language plpgsql security definer set search_path=public as $$
declare waiting int;secret text;vapid text;rid bigint;
begin
 select count(*) into waiting
 from public.paperworld_agent_messages m
 where m.role='agent' and m.created_at>now()-interval '6 hours'
  and m.content like '@paperworld-matt:v1:%' and m.content like '%"notification"%'
  and exists(select 1 from public.paperworld_push_subscriptions_v1 s
   where s.owner_id=m.owner_id and s.created_at<=m.created_at)
  and not exists(select 1 from public.paperworld_push_sent_v1 p where p.message_id=m.id);
 if waiting=0 then return '{"state":"idle"}'::jsonb; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
 into secret using 'paperworld_v5_dispatch_trigger';
 if secret is null or length(secret)<32 then return '{"state":"secret_missing"}'::jsonb; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
 into vapid using 'paperworld_vapid_private_jwk';
 if vapid is null then return '{"state":"vapid_missing"}'::jsonb; end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=12000)'
 into rid using 'https://jrevhzvrgenucuozjowm.supabase.co/functions/v1/paperworld-push',
  jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
  jsonb_build_object('source','cron','vapid',vapid);
 return jsonb_build_object('state','submitted','waiting',waiting);
exception when others then
 return '{"state":"wakeup_failed"}'::jsonb;
end $$;
revoke all on function public.paperworld_push_wakeup() from public,anon,authenticated;
grant execute on function public.paperworld_push_wakeup() to service_role;

do $$
begin
 if exists(select 1 from cron.job where jobname='paperworld-push')
 then perform cron.unschedule('paperworld-push'); end if;
 perform cron.schedule('paperworld-push','* * * * *','select public.paperworld_push_wakeup()');
end $$;
commit;
