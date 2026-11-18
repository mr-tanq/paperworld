-- One five-minute scheduled controller; routes either pilot or v1.
-- Additive, fail-closed: the controller.engine defaults to 'pilot'.
CREATE OR REPLACE FUNCTION public.paperworld_v5_claim_copilot_pilot(p_worker uuid, p_seconds integer DEFAULT 600)
 RETURNS TABLE(step_id uuid, mission_id uuid, owner_id uuid, issue_number integer, effect_key text, capability text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare config public.paperworld_autonomous_controller_v5%rowtype;
begin
 if p_worker is null or p_seconds not between 60 and 900 then return; end if;
 select * into config from public.paperworld_autonomous_controller_v5
 where singleton=true;
 if not found or config.engine<>'pilot' or config.dispatch_enabled is not true
 or not 'copilot_agent'=any(config.live_adapters) then return; end if;
 select st.* into s from public.paperworld_autonomous_steps_v5 st
 join public.paperworld_autonomous_missions_v5 mi on
  mi.id=st.mission_id and mi.owner_id=st.owner_id
 where st.state='ready' and st.capability in ('start_agent','await_pr')
  and st.attempts<st.max_attempts and st.run_after<=now()
  and st.input->>'repository'='mr-tanq/pokemon-echoes'
  and st.input->>'issueNumber'='1'
  and mi.project_id='pokemon'
  and mi.status in ('queued','running')
  and mi.policy->>'executionMode'='copilot_pilot'
  and not exists(select 1 from public.paperworld_autonomous_effects_v5 e
   where e.step_id=st.id)
 order by st.created_at
 for update of st skip locked limit 1;
 if not found then return; end if;
 update public.paperworld_autonomous_steps_v5 set
 state='leased',lease_owner=p_worker,
 lease_expires_at=now()+make_interval(secs=>p_seconds),
 attempts=attempts+1,started_at=now() where id=s.id;
 update public.paperworld_autonomous_missions_v5 set
 status='running',updated_at=now() where id=s.mission_id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(s.mission_id,s.owner_id,s.id,'copilot_step_claimed',
  '{"session_limit":1,"repository":"mr-tanq/pokemon-echoes"}'::jsonb);
 return query select s.id,s.mission_id,s.owner_id,
  (s.input->>'issueNumber')::integer,s.input->>'effectKey',s.capability;
end $function$
;

create or replace function public.paperworld_v5_unified_wakeup()
returns jsonb language plpgsql security invoker set search_path=public as $$
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
end $$;
revoke all on function public.paperworld_v5_unified_wakeup() from public,anon,authenticated;
grant execute on function public.paperworld_v5_unified_wakeup() to service_role;

create or replace function public.paperworld_v5_unified_tick()
returns jsonb language plpgsql security invoker set search_path=public as $$
declare ctrl jsonb;declare wake jsonb;
begin
 ctrl:=public.paperworld_v5_controller_tick();
 wake:=public.paperworld_v5_unified_wakeup();
 return jsonb_build_object('controller',ctrl,'dispatch',wake);
end $$;
revoke all on function public.paperworld_v5_unified_tick() from public,anon,authenticated;
grant execute on function public.paperworld_v5_unified_tick() to service_role;

-- Switch schedules atomically; no second heartbeat survives.
do $$
begin
 if exists(select 1 from cron.job where jobname='paperworld-v5-copilot-edge')
 then perform cron.unschedule('paperworld-v5-copilot-edge'); end if;
 if exists(select 1 from cron.job where jobname='paperworld-v5-safe-controller')
 then perform cron.unschedule('paperworld-v5-safe-controller'); end if;
 perform cron.schedule('paperworld-v5-safe-controller','*/5 * * * *',
 'select public.paperworld_v5_unified_tick()');
end $$;
