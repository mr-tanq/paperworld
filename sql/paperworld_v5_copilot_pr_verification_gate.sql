-- A discovered Copilot PR is NOT a verified mission.
-- Record its real URL and block for independent Godot verification.
create or replace function public.paperworld_v5_record_unverified_copilot_pr(
 p_step uuid,p_worker uuid,p_pr_url text,p_pr_number integer)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare s public.paperworld_autonomous_steps_v5%rowtype;
declare m public.paperworld_autonomous_missions_v5%rowtype;
begin
 if p_step is null or p_worker is null or
  p_pr_number is null or p_pr_number<1 or
  p_pr_url is distinct from
   ('https://github.com/mr-tanq/pokemon-echoes/pull/'||p_pr_number::text)
 then return false; end if;
 select * into s from public.paperworld_autonomous_steps_v5
 where id=p_step and capability='await_pr'
  and state in ('leased','running') and lease_owner=p_worker
  and lease_expires_at>now() for update;
 if not found then return false; end if;
 select * into m from public.paperworld_autonomous_missions_v5
 where id=s.mission_id and owner_id=s.owner_id for update;
 if not found or m.status not in ('queued','running') or
  m.project_id<>'pokemon' or m.policy->>'executionMode'<>'copilot_pilot'
 then return false; end if;
 update public.paperworld_autonomous_steps_v5 set state='succeeded',
  lease_owner=null,lease_expires_at=null,finished_at=now(),
  output=jsonb_build_object('prUrl',p_pr_url,'prNumber',p_pr_number,
   'verification','not_independently_verified')
 where id=p_step;
 update public.paperworld_autonomous_missions_v5 set
  status='needs_you',
  last_error='independent_godot_verification_required',
  updated_at=now(),current_step=s.seq where id=s.mission_id;
 insert into public.paperworld_autonomous_events_v5
 (mission_id,owner_id,step_id,event_type,payload)
 values(s.mission_id,s.owner_id,s.id,'copilot_pr_found_unverified',
  jsonb_build_object('prUrl',p_pr_url,'prNumber',p_pr_number,
   'requiresIndependentVerification',true));
 return true;
end $$;
revoke all on function public.paperworld_v5_record_unverified_copilot_pr(uuid,uuid,text,integer)
 from public,anon,authenticated;
grant execute on function public.paperworld_v5_record_unverified_copilot_pr(uuid,uuid,text,integer)
 to service_role;
