-- PAPERWORLD Phase 4 — Crow may create up to 50 songs per month (owner decision 2026-11-20).
-- The cap lives in the same atomic claim that already guards every
-- credit-spending Suno call, so nothing can bypass it: the 51st claim in a
-- calendar month (Europe/Amsterdam) raises 'suno_monthly_limit_reached'
-- BEFORE any request reaches Suno. Claims are never released (a timeout still
-- counts), and nothing is ever retried automatically. Re-runnable.
-- ROLLBACK: re-apply sql/paperworld_suno_durable_claim_v1.sql (removes the cap).
begin;

alter table public.paperworld_suno_create_claims
 add column if not exists claimed_at timestamptz not null default now();
create index if not exists paperworld_suno_create_claims_owner_month
 on public.paperworld_suno_create_claims(owner_id,claimed_at);

create or replace function public.paperworld_suno_claim_create(
 p_owner uuid, p_thread uuid, p_key uuid, p_digest text)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare inserted_count bigint;
declare used integer;
declare month_start timestamptz:=date_trunc('month',now() at time zone 'Europe/Amsterdam')
  at time zone 'Europe/Amsterdam';
begin
 if p_owner is null or p_thread is null or p_key is null
    or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
  raise exception 'invalid_suno_claim';
 end if;
 -- Serialise this owner's claims so two parallel requests cannot both take the 50th slot.
 perform pg_advisory_xact_lock(534128,hashtext(p_owner::text));
 if exists(select 1 from public.paperworld_suno_create_claims
   where owner_id=p_owner and idempotency_key=p_key) then
  return false;
 end if;
 select count(*) into used from public.paperworld_suno_create_claims
  where owner_id=p_owner and claimed_at>=month_start;
 if used>=50 then
  raise exception 'suno_monthly_limit_reached';
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

-- Read-only usage for the owner's own Crow card (service role only).
create or replace function public.paperworld_suno_month_usage(p_owner uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$
 select jsonb_build_object('used',count(*),'limit',50)
 from public.paperworld_suno_create_claims
 where owner_id=p_owner and claimed_at>=date_trunc('month',now() at time zone 'Europe/Amsterdam')
  at time zone 'Europe/Amsterdam'
$$;
revoke all on function public.paperworld_suno_month_usage(uuid) from public,anon,authenticated;
grant execute on function public.paperworld_suno_month_usage(uuid) to service_role;

commit;
