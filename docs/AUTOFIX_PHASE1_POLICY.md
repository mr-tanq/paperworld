# PAPERWORLD — Auto Fix, Phase 1 (DRAFT-ONLY safety framework)

Status: **not activated**. The user approved building Phase 1, not merging, deploying, or granting broad autonomous GitHub permissions.

## Exact initial scope
- Repository: `mr-tanq/concerts` **only**
- Source paths: `js/ticketswap-check.js`, `js/concert-ticketswap.js` **only**
- Regression test: **one new** `tests/autofix/ticketswap-<slug>.test.mjs`
- Maximum **3 total files**, **80 added+removed source lines**, **20 KB source / 8 KB test per file**
- At most **2 jobs/day** and **5 AI turns/job** (only after a durable atomic quota counter and trusted billing middleware are wired)
- Additional charged budget must stay **$0**, with an independently verified hard stop
- Never auto-merge or auto-deploy in Phase 1, even if all checks pass

## Execution sequence
1. Authenticate the owner, verify linked GitHub account, an explicitly scoped draft-PR approval, and zero-extra-spend budget.
2. Atomically reserve a daily job slot using a durable trusted quota service.
3. Read immutable repository snapshot from a trusted, owner-scoped reader; pin the base commit SHA and individual file SHAs.
4. AI worker proposes candidate content **as data**. No model tools, arbitrary shell commands, or write access to the model.
5. Deterministic policy verifies exact allowlist, changed-line budget, unchanged static import headers, disallowed new high-risk primitives, and a single NEW regression test.
6. Candidate and untrusted test execute only in a **no-network, no-secrets, unprivileged, bounded, disposable sandbox**. Require syntax checks, the new regression test and existing project tests. Do not trust the model's report of passing tests.
7. A separate trusted publisher verifies fresh branch base, creates a task-specific branch, commits only policy-validated files, and opens a **DRAFT** PR. Writer token cannot merge, modify repo settings, workflows or deploy.
8. Human can inspect the draft PR, actual CI links, independent Director review and code diff. Human approval is required to merge/deploy.

## Separation of duties
- **Matt:** communicates intent and final status; no GitHub write token.
- **Director:** chooses scope, reviews findings; cannot override policy gate.
- **Developer Worker:** proposes text content, cannot run code or commit directly.
- **Policy module:** pure, deterministic deny-by-default validator.
- **Verifier:** isolated trusted executor with real evidence, not a model tool.
- **Publisher:** future narrowly scoped GitHub App installation token, not the existing general OAuth link. No auto-merge or deployment capability.
- **Audit/quota:** durable, owner-scoped, backend-verified; model narrative cannot authorize actions.

## What's implemented in this branch
- `server/autofix-candidate-policy.cjs`: pure patch candidate guard, no I/O.
- `server/autofix-draft-workflow.cjs`: dependency-injected coordinator, **not registered in the HTTP server and never invoked automatically**. No concrete `analyze`, `sandboxVerify`, `quota` or `publisher` services are installed.
- Offline mocked tests for successful draft workflow, unauthorized requests, limits, safe file restrictions, unverified tests, and failures. PR CI has `contents: read` and no model calls.

## Still required before enabling real Auto Fix
- Reviewed GitHub App with **contents: write + pull requests: write** limited to `mr-tanq/concerts`; installation must be separately authorized by the user. Never reuse the transient GitHub OAuth token for write operations.
- Trusted sandbox capable of network isolation, CPU/time limits, read-only dependencies and no credentials. GitHub-hosted runner with network access alone is **not sufficient** for arbitrary model-generated tests.
- Durable atomic daily quota and per-task AI usage enforcement (the model's own reported `turnsUsed` is not an authoritative billing cap).
- Source freshness, draft branch race handling, existing tests, independent Director verification, real CI status checks, signed-in UX and explicit user approval of activation.
- Stage 2 independent protected gates, Stage 3 limited auto-merge and Stage 4 verified rollback/deploy remain separately approved future phases.

**No real GitHub writes, model calls, sandbox executions, auto PR creations, merges or deployments are enabled by this framework.** Passing offline tests proves the guards are exercised against mock data, not that the complete autonomous system is operational.
