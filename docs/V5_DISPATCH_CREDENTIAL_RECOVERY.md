# Paperworld V5 dispatch credential recovery — 17 Nov 2026

## Verified live state
- Supabase project: `jrevhzvrgenucuozjowm`, Edge Function `paperworld-copilot-dispatch`.
- An authenticated Vault-backed `pg_net` POST returned HTTP **200** with `{"state":"disabled","sessionsStarted":0}`.
- Supabase has modern backend keys as `SUPABASE_SECRET_KEYS` (JSON object keyed by name); the Edge runtime uses `default`, with legacy `SUPABASE_SERVICE_ROLE_KEY` fallback.
- `verify_jwt=false` is deliberate: the independently validated bearer trigger is the caller authorization. The new `sb_secret_` backend key is passed via `apikey`, not as a Bearer JWT.
- The live controller was read as `dispatch_enabled=false`, `live_adapters=[]`, `sessions_per_day=1`, `sessions_per_month=10`, `sessions_per_mission=1`, `credit_snapshot=NULL`.
- The older simulation mission was completed with zero provider sessions. This **does not** establish that Copilot assignment is operational.

## Deployment and controls
This PR synchronizes Git-tracked source with the deployed function and adds synthetic credential regression tests. It DOES NOT enable live Copilot, create a paid session, publish a PR from the agent, merge code or change the active Supabase controller.

The shared DB claim `paperworld_v5_claim_copilot_pilot` and adapter remain intentionally limited to Pokémon issue #1. Do not change only the adapter to allow more projects: the queue RPC, claim guard, issue ownership and budget fencing must be updated **atomically** and tested before general rollout.

### Required gate for live mode
1. Independently confirm GitHub token scope, GitHub agent availability and current **used** credit count from provider billing; never infer credits from a default or fabricated snapshot.
2. Run SQL integration tests plus mock dispatch tests and review missed/ambiguous response behavior; uncertain assignments must not be retried.
3. Preserve one external session per effect, provider idempotency and signed/scoped issue ownership.
4. Explicitly approve new sessions and define the per-day/month and dollar/credit ceiling; no increase in included spend without approval.
5. Authorize project-specific targets one by one; no auto-merge/deploy; trusted CI is required to mark a PR independently verified.

## Troubleshooting
If credentials fail, expose only which environment name is absent, never any key, hash, digest or prefix in logs. Check Vault secret name `paperworld_v5_dispatch_trigger` separately from Function secret `PAPERWORLD_DISPATCH_TRIGGER_SECRET`. Never paste either value into issues, chat or repository files.
