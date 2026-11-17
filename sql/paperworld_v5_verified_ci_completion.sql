-- V5 trusted verification receipt. Only an authorized service role can finish
-- a Copilot mission after independently verifying one immutable PR head SHA.
-- This function cannot fetch GitHub: the caller must validate the real run
-- against the canonical trusted workflow and PR before calling it.
create or replace function public.paperworld_v5_finish_verified_copilot(
 p_mission uuid,p_pr_number integer,p_head_sha text,
 p_run_id bigint,p_run_url text)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare m public.paperworld_autonomous_missions_v5%rowtype;
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare e public.paperworld_autonomous_effects_v5%rowtype;
declare origin text;
begin
 if p_mission is null or p_pr_number is null or p_pr_number<1 or
 p_head_sha is null or p_head_sha !~ '^[0-9a-f]{40}$' or
 p_run_id is null or p_run_id<1 or
 p_run_url is distinct from
  ('https://github.com/mr-tanq/pokemon-echoes/actions/runs/'||p_run_id::text)
 then return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=p_mission for update;
 if not found or m.project_id<>'pokemon' or m.status<>'needs_you'
  or m.last_error<>'independent_godot_verification_required'
  or m.policy->>'executionMode'<>'copilot_pilot' then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where mission_id=m.id and owner_id=m.owner_id
  and capability='await_pr' and state='succeeded'
  and output->>'verification'='not_independently_verified'
  and output->>'prUrl'=
   ('https://github.com/mr-tanq/pokemon-echoes/pull/'||p_pr_number::text)
 for update;
 if not found then return false; end if;
 select * into e from public.paperworld_autonomous_effects_v5
 where mission_id=m.id and owner_id=m.owner_id
  and adapter='copilot_agent' and kind='start_agent' and
  state='done' and sessions=1 for update;
 if not found then return false; end if;
 update public.paperworld_autonomous_steps_v5
  set output=output||jsonb_build_object(
   'verification','independent_godot_ci_passed',
   'headSha',p_head_sha,'verifyRunId',p_run_id,'verifyRunUrl',p_run_url)
 where id=s.id;
 update public.paperworld_autonomous_missions_v5
  set status='completed',last_error=null,updated_at=now()
 where id=m.id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(m.id,m.owner_id,s.id,'copilot_independent_ci_verified',
  jsonb_build_object('prNumber',p_pr_number,'headSha',p_head_sha,
    'runId',p_run_id,'runUrl',p_run_url));
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,event_type,payload)
 values(m.id,m.owner_id,'mission_completed',
  jsonb_build_object('simulation',false,'verification','independent_godot_ci_passed'));
 return true;
end $$;
revoke all on function public.paperworld_v5_finish_verified_copilot(
 uuid,integer,text,bigint,text) from public,anon,authenticated;
grant execute on function public.paperworld_v5_finish_verified_copilot(
 uuid,integer,text,bigint,text) to service_role;
