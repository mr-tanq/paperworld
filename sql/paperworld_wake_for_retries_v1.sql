-- PAPERWORLD 2026-11-24: wake the Task Engine also when a recently stopped
-- coding task can be redone automatically (one retry, see AUTO_RETRY in
-- supabase/functions/paperworld-task-dispatch/index.mjs). Before, the engine
-- only woke while some task was already running, so those retries waited.
-- Same function as before; only the "pending" check gained one condition.
create or replace function public.paperworld_v5_unified_wakeup()
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare mode text;declare enabled boolean;declare allowed text[];
declare pending integer;declare secret text;declare endpoint text;declare rid bigint;
begin
 select engine,dispatch_enabled,live_adapters into mode,enabled,allowed
 from public.paperworld_autonomous_controller_v5 where singleton=true;
 if enabled is not true or mode not in ('pilot','v1') or
  not 'copilot_agent'=any(allowed) then
  return '{"state":"disabled"}'::jsonb;
 end if;
 if mode='pilot' then
  select count(*) into pending
  from public.paperworld_autonomous_steps_v5 s
  join public.paperworld_autonomous_missions_v5 m on m.id=s.mission_id
  where m.policy->>'executionMode'='copilot_pilot'
   and m.status in ('queued','running')
   and s.state='ready' and s.run_after<=now()
   and s.capability in ('start_agent','await_pr');
  endpoint:='paperworld-copilot-dispatch';
 else
  select count(*) into pending from public.paperworld_autonomous_missions_v5 m
  where m.engine='v1' and (
   exists(select 1 from public.paperworld_autonomous_steps_v5 s
    where s.mission_id=m.id and s.state='ready' and s.run_after<=now()
     and m.status in ('queued','running','working','verifying','paused_budget'))
   or exists(select 1 from public.paperworld_autonomous_effects_v5 e
    where e.mission_id=m.id and e.state='uncertain'
     and e.reconcile_attempts<6 and m.status not in ('completed','cancelled'))
   -- NEW: a recent retryable stop that has no automatic retry yet.
   or (m.status in ('needs_you','failed') and m.updated_at>now()-interval '48 hours'
    and m.project_id in ('listening','pokemon') and m.policy->>'retryOf' is null
    and m.last_error in ('trusted_verification_failed','copilot_pr_missing','merge_conflict',
     'agent_files_out_of_scope','agent_too_many_files','copilot_deadline_exceeded',
     'pr_head_changed_before_verify','pr_head_moved_after_verify',
     'pr_head_moved_after_verification','trusted_verification_timed_out',
     'effect_requires_reconciliation')
    and not exists(select 1 from public.paperworld_autonomous_missions_v5 r
     where r.policy->>'retryOf'=m.id::text))
  );
  endpoint:='paperworld-task-dispatch';
 end if;
 if pending=0 then return '{"state":"idle"}'::jsonb; end if;
 if to_regclass('vault.decrypted_secrets') is null
 then return '{"state":"vault_missing"}'::jsonb; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
 into secret using 'paperworld_v5_dispatch_trigger';
 if secret is null or length(secret)<32 then
  return '{"state":"secret_missing"}'::jsonb;
 end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=12000)'
 into rid using
  'https://jrevhzvrgenucuozjowm.supabase.co/functions/v1/'||endpoint,
  jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
  jsonb_build_object('source','cron','engine',mode);
 return jsonb_build_object('state','submitted','mode',mode,'requestId',rid);
exception when others then
 return '{"state":"wakeup_failed"}'::jsonb;
end $function$;
