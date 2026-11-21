-- PAPERWORLD — Director initiatives, phase A (2026-11-21).
-- Once a day the paperworld-watch Edge Function lets Luna and Joey look at
-- their repo's scheduled/push workflows; a failing one becomes a normal Task
-- Engine mission (same caps, trusted tests, auto-merge rule). Limits live in
-- the function: 1 per Director per day, 2 in total, never the same workflow
-- twice in 7 days. initiatives_paused=true stops everything at once.
-- ROLLBACK: select cron.unschedule('paperworld-watch');
--           drop function public.paperworld_watch_wakeup();
--           alter table public.paperworld_autonomous_controller_v5 drop column initiatives_paused;
begin;
alter table public.paperworld_autonomous_controller_v5
 add column if not exists initiatives_paused boolean not null default false;
create or replace function public.paperworld_watch_wakeup()
returns jsonb language plpgsql security definer set search_path=public as $$
declare secret text;rid bigint;
begin
 if exists(select 1 from public.paperworld_autonomous_controller_v5 where singleton and initiatives_paused)
 then return '{"state":"paused"}'::jsonb; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
 into secret using 'paperworld_v5_dispatch_trigger';
 if secret is null or length(secret)<32 then return '{"state":"secret_missing"}'::jsonb; end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=12000)'
 into rid using 'https://jrevhzvrgenucuozjowm.supabase.co/functions/v1/paperworld-watch',
  jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
  '{"source":"cron"}'::jsonb;
 return jsonb_build_object('state','submitted','requestId',rid);
exception when others then
 return '{"state":"wakeup_failed"}'::jsonb;
end $$;
revoke all on function public.paperworld_watch_wakeup() from public,anon,authenticated;
grant execute on function public.paperworld_watch_wakeup() to service_role;
do $$
begin
 if exists(select 1 from cron.job where jobname='paperworld-watch')
 then perform cron.unschedule('paperworld-watch'); end if;
 -- 06:47 UTC = 07:47/08:47 Amsterdam: before the morning summary window.
 perform cron.schedule('paperworld-watch','47 6 * * *','select public.paperworld_watch_wakeup()');
end $$;
commit;
