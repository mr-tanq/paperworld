# Routine Loop V3 — authenticated owner controls (API foundation)

## What is built
The existing Render Matt server now exposes a narrowly scoped Routine API:
`POST /routines/preview`, `/routines/create`, `/routines/list`, `/routines/enable`, and `/routines/pause`.

- Supabase authenticated owner JWT and **owned Matt thread** must be verified before any storage operation.
- Project, goal, weekday and time are validated on the server. V3 uses **UTC only**; do not quietly present this as a fixed Amsterdam local time through daylight saving.
- Preview validates a plan with zero DB writes. Creation needs explicit `confirmed:true`, stores a **disabled** template and zero AI calls / zero additional spend. Activation requires a second explicit `confirmed:true`; pausing explicitly disables it.
- Service-role PostgREST writes are owner/thread scoped. Neither a browser-supplied owner ID nor budget override is accepted.
- The API never creates executable tasks, queues a mission, calls Copilot, adds cron schedules, or spends credits.
- The V1/V2 SQL schema is a required dependency. The live Supabase instance was checked read-only on Nov 19 and does **not yet contain** the routine tables or staging RPCs. Until separately installed and verified, write/list operations fail closed.

## What is *not* built
- There is **no Matt natural-language parser or Messenger UI** for these routes in this PR. Those need a clear user confirmation preview, timezone picker, and end-to-end auth/RLS tests.
- No production schema change, deployment or routine activation has been performed.
- No automatic execution or billing grants, and no notification delivery.

## Deployment gates
1. Review SQL V1/V2, PostgreSQL RLS, existing pg_cron identity and staging semantics; install only with explicit release approval.
2. Verify owner/cross-owner read/write separation in staging and regression tests, including missing schema, duplicate updates and concurrent activation.
3. Wire a human-first Matt UI, displaying UTC accurately and requiring direct owner confirmation before create and enable.
4. Enable one synthetic zero-cost template and verify that V5 produces only an owner-reviewed draft mission, not a paid task.
5. Only then consider future routines with carefully scoped cost limits and external actions.

No Suno changes.
