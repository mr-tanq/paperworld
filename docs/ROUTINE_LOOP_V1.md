# Paperworld Intelligence & Autonomy — Routine Loop V1

## Scope / decisions
First increment of weekly routines using the **existing** V5 autonomous missions, not a competing job engine or a second recurring cron.

- A routine has an owner, existing Matt thread, project, goal, and explicit UTC weekday/hour/minute.
- Pure deterministic scheduler computes a stable weekly `routineId:scheduledAt` slot. Changing the description or restarting the server cannot produce a new slot identity for the same routine/week.
- Additive **review-only** migration defines owner-scoped routine templates and unique routine slots, referencing the existing V5 missions and existing Supabase owner-thread FK.
- A service-only SQL staging function can create a `draft` mission *once* per slot, without queued steps, external effects, API requests, AI calls, auto merge or deployment. A second call returns the same mission ID.
- Budget is rigidly `0` AI calls and `0` additional spend in this first version. Even if somebody enables a routine in the table, it is not executed: there is no cron hook, background timer or live dispatch integration.
- RLS allows a signed-in owner to **read their own** templates and slots; not to write or arm schedules from the browser. A later owner-authenticated API must separately validate thread ownership and explicit intent before writing.
- No private context, sensitive text, access tokens or user logs in public fixtures.

## Activation milestones (not implemented here)
1. Review SQL migration and production RLS; confirm no duplicate triggers or extra cron job.
2. Create trusted owner-only schedule create/edit/pause endpoints, with explicit confirmation, accurate local-time display and timezone/DST rules. UTC is deliberately explicit in V1.
3. Inside existing 5-minute V5 controller heartbeat, detect due routines and atomically stage a **draft** via the SQL function. Establish a DB-validated due slot and no catch-up beyond one week; do not create a second cron.
4. Send a natural Matt inbox item for a due draft. Never present a draft as an executed result.
5. Only after budget/effect evidence and stop rules are proven, offer opt-in execution for a strictly scoped task category, with bounded retries, no duplicate chargeable agent sessions, and owner pause/cancel.

## Important limits
This PR **does not** implement a running periodic automation or deliver notifications. The SQL is review-only, not applied. The JavaScript helper is not wired to production, and the project is unchanged until review/merge/deploy. No Suno modifications, spending or paid model calls.

Run `node --test tests/routine-loop-policy.test.cjs` and full CI. Check owner isolation against a separate user before installing SQL.
