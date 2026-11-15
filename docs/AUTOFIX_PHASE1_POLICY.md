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

## Phase 1B: draft-only GitHub publishing adapter (proposal, inactive)

The new `server/autofix-github-draft-publisher.cjs` includes an explicit REST implementation for a future GitHub App publisher. It:
- Refuses ordinary user OAuth tokens; requires a short-lived, trusted GitHub App installation credential for the exact `mr-tanq/concerts` repository.
- Requires an **independently verified sandbox attestation tied to the SHA-256 of the proposed candidate**. Merely displaying passing tests or self-reporting results is insufficient.
- Confirms the base branch SHA, independently fetches source blobs and ensures the regression test is absent; re-runs the deterministic candidate policy before any writes.
- Uses GitHub Git database tree + commit APIs to construct an isolated task-specific commit, creates a new `paperworld/autofix/<taskId>` branch, confirms main has not moved, and opens **only a draft PR**.
- Provides **no methods** to merge, update an existing ref, delete, change settings, dispatch workflows or deploy. Does not bind any HTTP endpoint, token provider or installed GitHub App. Tests use a simulated fetcher, dummy token and fake independent attestation.

**Important security qualification:** GitHub's `contents:write` permission may itself be sufficient to invoke other GitHub endpoints (including merge operations); restrictions in application code are not a substitute for platform-enforced branch protection, a strictly isolated publisher service, repository rulesets, GitHub App installation scope, and an audit trail. Do not assert that possession of the installation token makes merging technically impossible.

Before real activation, independently implement and audit trusted source snapshot, attestation issuer/verifier, zero-network test sandbox, separate per-owner quota, one-time approvals and installation token isolation. Even an approved draft-PR pipeline must not execute model-generated code in the same environment as the GitHub write credential. Branch creation can leave an orphaned branch if a later verification fails; safe cleanup would need a separately reviewed policy.

Current state: Offline-only. No installed GitHub App, live OAuth write permission, model calls, background jobs, publish endpoint, merge or deploy were created.

## Phase 1C: proposed sandbox execution plan (inactive)

Added `server/autofix-sandbox-plan.cjs` which creates a deterministic **plan** for testing prevalidated TicketSwap candidates against a trusted, SHA-256-pinned Node 22 Alpine container image. This is not a runner and has no Docker call; no test of AI-authored code was executed.

Plan constraints:
- Fixed dedicated workspace path bound to a UUID task, a trusted GitHub base SHA and the same candidate SHA-256 digest required by the future publisher.
- Docker options include `--pull=never`, `--network=none`, read-only root filesystem and read-only bind mount, dropped Linux capabilities, `no-new-privileges`, unprivileged UID, resource limits and restricted temporary storage.
- Exactly static `node --check` for each approved source and `node --test` on the new regression test; arrays of process arguments, never shell commands.
- Maximum 15 seconds and 16 KB output **per check** must be independently enforced by the future executor, not merely by the plan.
- The plan explicitly reports `attestation: not_issued` and `approvedForPublish: false` so no model-generated report or mere plan can unlock publishing.

### Activation blockers / required security review

1. **Isolation:** A dedicated trusted sandbox host/service, **not** the Render production application and not a broad shared CI environment with credentials or a Docker socket. Pre-pull and independently approve the exact image digest; configure stronger kernel isolation (seccomp/AppArmor/rootless VM/container, egress firewall) and fully ephemeral execution.
2. **Workspace staging:** Trusted fetch of a pinned clean Git tree; stage only exact candidate content; reject symlinks, absolute paths, hardlinks and non-regular files; mount sanitized worktree without credentials, config secrets or private user files.
3. **Execution:** Enforce process wall-clock timeout and kill the entire container on timeout; strict captured stdout/stderr and output limits; external attestation of the exit codes, actual checks, base SHA, candidate digest and image digest; sign/store proof using a key never accessible to the Worker or sandbox.
4. **Integration testing:** The plan currently does syntax + one regression test; it does **not yet** prove all pre-existing Listening Mirror tests or deployed behavior. Define and run an approved baseline suite (including TicketSwap request and result workflows) before any PR can be described as fully tested.
5. **No publisher credential inside executor:** Separate the write-capable GitHub App publisher from the no-network sandbox with a one-way, signed attestation boundary; verify source freshness before publishing; keep human review for every merge and deployment.
6. **Budget and owner controls:** Trusted quota, direct owner approval, $0 extra AI spend, immutable audit and cancellation controls still required.

Do not deploy, merge for activation, or connect generated tests to production until these items are demonstrated with independent integration tests.

## Phase 1D: bounded Docker execution adapter (proposed; OFF)

`server/autofix-sandbox-runner.cjs` introduces an **actual execution adapter** for an externally isolated Docker host. Unlike Phase 1C's declarative plan, it can invoke a trusted Docker binary when someone explicitly calls `createSandboxRunner(...).run(...)`. **No caller, endpoint, scheduled job, credential, or Docker host is wired into PAPERWORLD.** The code is inert in Render and the browser.

Prerequisites for any execution:
- Explicit trusted `hostReady`, `imageApproved` and `stageWorkspace` providers, plus a dedicated, independently audited Docker host running without user credentials or GitHub publisher credentials. No default adapters are available.
- Trusted staging receipt including pinned base commit, exact candidate digest, no credentials, and no symlinks, followed by local file-byte validation with directory / regular-file / symlink / hardlink checks.
- Container commands are fixed `docker run` with no shell, the Phase 1C network/CPU/memory/user/capability restrictions and a pinned image; each check is followed by mandatory `docker rm -f`, with a failed cleanup preventing success.
- A 15-second wall-clock bound and 16 KB output cap per check. Testing stops after first failure.
- Output is **local observation only** (`checksPassed`), with `attestation: not_issued` and `approvedForPublish: false`. The draft publisher's independent attestation verifier must NOT accept this unsigned result alone.

**Limitations and mandatory review before enabling:**
- Existing project-wide baseline tests, race-free staging, a no-network VM/firewall and isolated Docker daemon, immutable image supply-chain verification, independently signed attestation, kill/cleanup liveness proofs, worktree cleanup, quotas, backend authorization, installed GitHub App and billing enforcement are still missing. Do not execute model-generated code on the production Render host or shared CI runners with secrets.
- Offline CI uses simulated process streams and filesystem; it does **not** invoke a Docker daemon or untrusted generated test code, and does not prove isolation against malicious code. This PR deliberately makes no deployment changes.

## Phase 1E: independent signed test attestation verification (draft only)

Added `server/autofix-attestation-verifier.cjs`: an offline-testable, **public-key-only** Ed25519 verifier for sandbox test attestations. It requires the exact task UUID, repository, base commit SHA, candidate SHA-256, fixed publisher audience, pinned verifier issuer, approved key identity, a short expiry, and explicit isolation claims. It also checks that every modified source file has an attested successful syntax check and the regression test passed with verified cleanup. An atomic, durable one-time nonce registry is required: absence, errors, or repeated consumption deny publishing. A valid signature is necessary but only meaningful if the issuer actually performed independently audited execution.

`server/autofix-github-draft-publisher.cjs` now forwards the precise candidate to its already-injected verifier callback, so a real verifier can bind the check set to the proposed files. This remains **dependency-injected only**: no live verifier instance, public key, issuer, signer private key, nonce registry, service endpoint, or signing capability is installed. The Docker runner still returns `attestation: not_issued`, not a cryptographic proof. The new tests sign invented records using transient fixture keys, verify valid signatures and reject tampering, expiry, replay and missing/mismatched test claims.

Before activation: independently provision and secure an attestation-signing service **outside** both the sandbox and the GitHub publisher; pin and rotate its public verification key with reviewed release; install an atomic persistent nonce claim and audit; demonstrate real isolation and baseline tests on a dedicated sandbox host; and audit full end-to-end authentication / quotas / costs. No Live AI workflow, autonomous writes, background agent, merge, deployment or new permissions are introduced.

## Phase 1F: real pinned GitHub source adapter + infrastructure gap report (draft only)

**Actual infrastructure inspection on 2026-11-15:** The sole Render web service currently known to Paperworld is `paperworld-matt-test-6hmd`, **Free plan**, Node runtime, auto-deploy disabled. This does not establish a separately isolated Docker test host. It is not appropriate to run untrusted model-generated tests on the production Matt server. The `mr-tanq/concerts` repository presently contains both allowlisted TicketSwap browser source files (`js/ticketswap-check.js`, `js/concert-ticketswap.js`), confirmed by independent GitHub read-only access.

**Implemented:**
- `server/autofix-pinned-source.cjs` implements the real fixed GitHub Contents API GET flow behind a trusted owner-linked OAuth broker. It reads `refs/heads/main`, pins its commit SHA, fetches precisely the two allowlisted source files by immutable SHA (not a moving branch), validates exact path, size, base64 encoding, byte length and Git blob SHA-1, and returns the existing Auto Fix coordinator's `readSources` interface. It exposes no write methods, arbitrary URLs or browser endpoint. Any GitHub failure stops processing without revealing tokens or response bodies.
- `server/autofix-readiness.cjs` reports hard blockers from independently supplied trusted backend probes: dedicated host, image, staging, baseline tests, signer, atomic nonce, scoped GitHub App, durable daily quota, zero-overage enforcement and explicit owner approval. It **never activates publishing**, even when probes claim success, and is not exposed via HTTP.
- Offline tests simulate GitHub REST GET responses and readiness gate failures, including wrong owner/repository, integrity mismatch, 401/403 and network errors.

**Still missing before any live Auto Fix:** installation and security review of a real dedicated no-credentials runner, signed issuer, verified trusted nonce store, GitHub App for `mr-tanq/concerts`, full repository test baseline, durable quota and authorization wiring. We have not provisioned any of these, paid for anything, executed model-generated code or enabled autonomous PRs. The current code is not deployed; this is a reviewable draft PR only.
