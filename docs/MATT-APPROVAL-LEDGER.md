# Matt AI: one-time, explicit approval ledger — proposal only

## Why
The current gateway (PR #46/#47) accepts an injected `claimApproval` but does not implement one. This proposal supplies the server-side atomic claim, preventing reuse of the same approval on retries or concurrent requests.

## Files
- `supabase/matt-approvals.proposed.sql`: **NOT DEPLOYED**. Server-only private schema and table, revoked from anonymous/authenticated Data API clients, tied to owner + Matt thread.
- `server/matt-approval-claimer.cjs`: safe parameterized UPDATE statement in the trusted server; requires an independently verified `checkBudget` callback first. NEVER pass raw SQL from a browser.
- `tests/matt-approval-claimer.test.cjs`: mocked denial, replay, owner binding and SQL structure checks.

## Unimplemented — mandatory before any AI request
1. The user's real **explicit confirmation** of ONE request and related estimated use, including a separate server-verified approved-state transition. A browser cannot approve itself.
2. GitHub Copilot subscription identity linkage and a checked overage-off billing configuration. This module cannot independently enforce GitHub's credit charges.
3. A trusted private PostgreSQL executor with least-privilege permissions; no DB credentials in browser or GitHub PR.
4. Real PostgreSQL concurrent claim, expiration and two-user isolation tests; mocked tests alone are insufficient.
5. Secure hosting and approved deployment. Existing local server still returns HTTP 503 for every chat call.
6. A reviewed persistence approach for real AI replies with idempotent request IDs.

The claimer returns `{allowed:true,budgetConfigured:true}` only after the injected budget guard passes and an atomic UPDATE returns the exact approval ID. No approval is created or activated by this PR. No credits, AI calls, Supabase migration, hosting or deployment.
