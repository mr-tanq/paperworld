-- PAPERWORLD — James's shop, production line (2026-11-25).
-- 1) paperworld_shop_products_v1: one row per product James makes after the
--    owner's weekly "Ναι" (spec → rendered file → listed in the storefront →
--    live once Stripe is connected). Only the server writes; the owner reads.
-- 2) Storage bucket "shop-files" (PRIVATE): the sold files. Never public;
--    buyers only get short-lived signed links after a confirmed payment.
-- 3) Every 15 minutes the shop-studio Edge Function moves products along,
--    only while there is something to do. initiatives_paused stops it.
-- ROLLBACK: select cron.unschedule('paperworld-shop-studio');
--           drop function public.paperworld_shop_studio_wakeup();
--           drop table public.paperworld_shop_products_v1;
begin;
create table if not exists public.paperworld_shop_products_v1(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 proposal_id uuid unique references public.paperworld_proposals_v1(id) on delete set null,
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
 spec jsonb not null,
 status text not null default 'spec' check (status in ('spec','listing','listed','live','failed')),
 file_key text check (file_key is null or file_key ~ '^[a-z0-9][a-z0-9-]{2,59}\.pdf$'),
 pr_number integer,
 payment_link text check (payment_link is null or payment_link ~ '^https://buy\.stripe\.com/[A-Za-z0-9_]+$'),
 last_error text check (last_error is null or last_error ~ '^[a-z0-9_]{1,60}$'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.paperworld_shop_products_v1 enable row level security;
drop policy if exists paperworld_shop_products_owner_read on public.paperworld_shop_products_v1;
create policy paperworld_shop_products_owner_read on public.paperworld_shop_products_v1
 for select to authenticated using (owner_id = auth.uid());
revoke insert,update,delete on public.paperworld_shop_products_v1 from anon,authenticated;
insert into storage.buckets(id,name,public) values('shop-files','shop-files',false)
 on conflict (id) do update set public=false;
create or replace function public.paperworld_shop_studio_wakeup()
returns jsonb language plpgsql security definer set search_path=public as $$
declare secret text;rid bigint;
begin
 if exists(select 1 from public.paperworld_autonomous_controller_v5 where singleton and initiatives_paused)
 then return '{"state":"paused"}'::jsonb; end if;
 if not exists(select 1 from public.paperworld_shop_products_v1 where status in ('spec','listing'))
 then return '{"state":"idle"}'::jsonb; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
 into secret using 'paperworld_v5_dispatch_trigger';
 if secret is null or length(secret)<32 then return '{"state":"secret_missing"}'::jsonb; end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=30000)'
 into rid using 'https://jrevhzvrgenucuozjowm.supabase.co/functions/v1/shop-studio',
  jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
  '{"source":"cron"}'::jsonb;
 return jsonb_build_object('state','submitted','requestId',rid);
exception when others then
 return '{"state":"wakeup_failed"}'::jsonb;
end $$;
revoke all on function public.paperworld_shop_studio_wakeup() from public,anon,authenticated;
grant execute on function public.paperworld_shop_studio_wakeup() to service_role;
do $$
begin
 if exists(select 1 from cron.job where jobname='paperworld-shop-studio')
 then perform cron.unschedule('paperworld-shop-studio'); end if;
 perform cron.schedule('paperworld-shop-studio','*/15 * * * *','select public.paperworld_shop_studio_wakeup()');
end $$;
commit;
