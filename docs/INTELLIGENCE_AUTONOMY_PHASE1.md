# Paperworld Intelligence & Autonomy — Phase 1 safety contract

Status: **partial implementation**, not a completed autonomous release.
This is the shared plan for improving the existing V5 engine, never a parallel engine.

## Verified inventory (19 Nov 2026)

- The existing task dispatcher uses `paperworld_autonomous_effects_v5` and DB-backed effect reservation and reconciliation for Copilot sessions.
- Crow's `server/suno-oauth-client.cjs` currently records `audio-create` keys in a **process-local** `submittedKeys` Map. It blocks repeat keys in the same process only; a restart or second Render instance can lose that protection.
- Crow's `server/suno-audio-create.cjs` sends one `audio-create` call with `idempotency_key`, does **not** retry, and reports acknowledged submissions as `submitted_unverified` (not generated songs).
- Matt's read-only team snapshot reports statuses and presence of reports, *not* proof of applied code or produced audio. This PR updates status wording to avoid false completion claims.

## Next production change: durable Suno charge-attempt ledger

1. Design a **separate owner-scoped Suno request ledger**, not a reuse of the Copilot mission/effect lease. Enforce a unique `(owner_id,idempotency_key)` constraint in Postgres, request hash binding, timestamps and a bounded state machine: `reserved`, `submission_unknown`, `provider_acknowledged`, `confirmed`, `rejected_before_send`.
2. On the trusted backend, verify owner, Crow thread, request brief and connected OAuth session **before** DB reservation. Use an atomic single-use claim *before* any external provider call. If DB is unavailable, fail closed without calling Suno.
3. Never assume a timeout, 5xx, transport reset or process restart means the request did not spend credits. Keep the key locked until trustworthy provider reconciliation; do not automatically call `audio-create` again. Do not present provider acknowledgement as music completion.
4. Do not store lyrics, access tokens, provider-private responses or raw auth headers in the ledger. For conflict checks use a server-computed canonical brief digest; ensure per-owner access only, trusted-role writes, bounded retention, no cross-owner reading.
5. Establish a verified Suno read-only lookup/reconciliation capability *before* automatic status transitions; absent that capability, report `unknown / needs owner review`. No fabricated provider results.
6. Add concurrency, restart, duplicate key/different brief, database-down, upstream timeout, owner isolation and uncertain-response tests. Confirm exactly zero provider calls in all preflight-denied cases. No live credit-spending tests without an explicit user-initiated action.

## Matt completion proof contract

- **Draft/analysis**: artifact or report available for review; no external action asserted.
- **Submitted**: request acknowledged; no generation or code application asserted.
- **Verified**: trustworthy evidence exists for the exact intended external effect and immutable relevant revision.
- **Completed**: only after the exact effect has been verified and the user-facing report accurately reflects the evidence. Generic AI text, an issue status, or green unrelated tests are insufficient.
- Failure to load evidence must downgrade wording to *not verified*, never silently promote status.
- Keep the Messenger human-first: technical IDs, ledger tables and PR details remain in the engineering audit, not in Matt's normal chat.

## Order of delivery

1. **This PR**: remove misleading status-only completion wording and add regression tests.
2. Database migration and service-role atomic Suno claim, with RLS/owner checks and tests.
3. Wire claim into `createSong` and test uncertain outcomes and restarts without spending credits.
4. Unify evidence-based Matt reports across Director outcomes and actual worker effects.
5. Only after Phase 1 is demonstrated, proceed to learning loop, shared knowledge, routines and model routing with budgets.

No changes to live credentials, subscription plans, paid actions, deployment or automatic merge are authorized by this document.
