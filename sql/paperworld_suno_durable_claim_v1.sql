-- Paperworld Phase 1: durable, fail-closed Suno request claim.
-- REVIEW ONLY until deployed and tested; never use browser privileges.
create table if not exists public.paperworld_suno_create_claims (
 owner_id uuid not null,
 idempotency_key uuid not null,
 crow_thread_id uuid not null,
 brief_sha256 text not null check (brief_sha256 ~ '^[0-9a-f]{64}$'),
 state text not null default 'submission_unknown'
   check (state in ('submission_unknown')),
 claimed_at timestamptz not null default now(),
 primary key (owner_id,idempotency_key)
);
alter table public.paperworld_suno_create_claims enable row level security;
revoke all on public.paperworld_suno_create_claims from public, anon, authenticated;
grant select,insert on public.paperworld_suno_create_claims to service_role;

-- Invoker-only, service-role-only RPC. A conflicting key is never released:
-- even a timeout/crash before provider reply must block repeats.
create or replace function public.paperworld_suno_claim_create(
 p_owner uuid, p_thread uuid, p_key uuid, p_digest text)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare inserted_count bigint;
begin
 if p_owner is null or p_thread is null or p_key is null
    or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
  raise exception 'invalid_suno_claim';
 end if;
 insert into public.paperworld_suno_create_claims
  (owner_id,crow_thread_id,idempotency_key,brief_sha256)
 values (p_owner,p_thread,p_key,p_digest)
 on conflict (owner_id,idempotency_key) do nothing;
 get diagnostics inserted_count = row_count;
 return inserted_count = 1;
end;
$$;
revoke all on function public.paperworld_suno_claim_create(uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.paperworld_suno_claim_create(uuid,uuid,uuid,text)
 to service_role;
