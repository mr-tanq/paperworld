-- Background wakeup for the Copilot Pro worker.
-- Safe to install with no credentials: dispatch_enabled defaults FALSE.
-- No HTTP request is made without explicit enablement and matching Vault secret.
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.paperworld_v5_copilot_edge_wakeup()
returns jsonb language plpgsql security invoker set search_path=public
as $$
declare enabled boolean;
declare allowed text[];
declare pending integer;
declare invocation_secret text;
declare request_id bigint;
begin
 select dispatch_enabled,live_adapters into enabled,allowed
 from public.paperworld_autonomous_controller_v5 where singleton=true;
 if enabled is not true or not 'copilot_agent'=any(coalesce(allowed,'{}'::text[]))
 then return '{"state":"disabled"}'::jsonb; end if;
 select count(*) into pending
 from public.paperworld_autonomous_steps_v5 s
 join public.paperworld_autonomous_missions_v5 m
  on m.id=s.mission_id and m.owner_id=s.owner_id
 where s.state='ready' and s.run_after<=now()
  and s.capability in ('start_agent','await_pr')
  and m.project_id='pokemon' and m.policy->>'executionMode'='copilot_pilot'
  and m.status in ('queued','running');
 if pending=0 then return '{"state":"idle"}'::jsonb; end if;
 if to_regclass('vault.decrypted_secrets') is null
 then return '{"state":"vault_unavailable"}'::jsonb; end if;
 -- Dynamic SQL delays name resolution until Vault is installed.
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
  into invocation_secret using 'paperworld_v5_dispatch_trigger';
 if invocation_secret is null or length(invocation_secret)<32
 then return '{"state":"secret_not_configured"}'::jsonb; end if;
 select net.http_post(
   url:='https://jrevhzvrgenucuozjowm.supabase.co/functions/v1/paperworld-copilot-dispatch',
   headers:=jsonb_build_object('Content-Type','application/json',
    'Authorization','Bearer '||invocation_secret),
   body:='{"source":"supabase-cron","version":"v5"}'::jsonb,
   timeout_milliseconds:=12000) into request_id;
 return jsonb_build_object('state','request_submitted','requestId',request_id);
exception when others then
 -- Logs the failure only in pg_cron/Postgres; no secret is returned.
 return '{"state":"dispatch_failed"}'::jsonb;
end $$;
revoke all on function public.paperworld_v5_copilot_edge_wakeup()
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_copilot_edge_wakeup() to service_role;
-- Dedicated schedule, separate from the existing deterministic SQL supervisor.
-- It stays inert until controller.dispatch_enabled is deliberately enabled.
select cron.schedule(
 'paperworld-v5-copilot-edge',
 '*/5 * * * *',
 'select public.paperworld_v5_copilot_edge_wakeup()'
);
