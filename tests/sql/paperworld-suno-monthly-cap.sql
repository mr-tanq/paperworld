-- Synthetic PostgreSQL test for sql/paperworld_phase4_suno_monthly_cap.sql.
-- NEVER run against a real Supabase project. No Suno call is involved.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
\ir ../../sql/paperworld_suno_durable_claim_v1.sql
\ir ../../sql/paperworld_phase4_suno_monthly_cap.sql
\ir ../../sql/paperworld_phase4_suno_monthly_cap.sql
DO $$
DECLARE o uuid:='11111111-1111-4111-8111-111111111111'; other uuid:='22222222-2222-4222-8222-222222222222';
 t uuid:='33333333-3333-4333-8333-333333333333'; d text:=repeat('a',64); k uuid; i int; first uuid;
BEGIN
 FOR i IN 1..50 LOOP
  k:=gen_random_uuid(); IF i=1 THEN first:=k; END IF;
  ASSERT public.paperworld_suno_claim_create(o,t,k,d),'claim '||i;
 END LOOP;
 ASSERT (public.paperworld_suno_month_usage(o)->>'used')::int=50,'usage 50';
 -- A repeat of an existing request is still "already submitted", never a new spend.
 ASSERT public.paperworld_suno_claim_create(o,t,first,d)=false,'duplicate stays false at the cap';
 BEGIN
  PERFORM public.paperworld_suno_claim_create(o,t,gen_random_uuid(),d);
  RAISE EXCEPTION 'cap not enforced';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'suno_monthly_limit_reached' THEN RAISE; END IF;
 END;
 ASSERT (SELECT count(*) FROM public.paperworld_suno_create_claims WHERE owner_id=o)=50,'51st never stored';
 -- Another owner has their own allowance.
 ASSERT public.paperworld_suno_claim_create(other,t,gen_random_uuid(),d),'other owner unaffected';
 -- Last month's songs do not count this month.
 UPDATE public.paperworld_suno_create_claims SET claimed_at=now()-interval '40 days' WHERE owner_id=o;
 ASSERT public.paperworld_suno_claim_create(o,t,gen_random_uuid(),d),'new month resets the allowance';
 ASSERT has_function_privilege('authenticated','public.paperworld_suno_month_usage(uuid)','execute')=false,'service only';
END $$;
SELECT 'Suno monthly cap passed' AS result;
