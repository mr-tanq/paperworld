# PAPERWORLD — Director Memory System v1

**Status (2026-11-15): the private Supabase memory table has been applied and contains 74 owner-scoped, unapproved proposals.** The read-only review screen is merged in source, but no deployment, approval schema, agent-to-memory inference connection or autonomous model calls were activated by this draft.

## Registered project namespaces

| Project ID | Director / access |
|---|---|
| town | Matt (own coordination knowledge) |
| workshop | Listening Mirror Director; approved Listening Mirror Workers on a single assigned task |
| studio | The Lost Wanderer Director |
| pokemon | Pokémon: Echoes Director |
| wellbeing | Wellbeing Director (sensitive/private entries never sent to Matt or Workers) |

Namespaces are derived from the registered `js/agents.js` roster, **not** a model-generated project name. Future Directors need registration and an explicit data-access policy.

## Five kinds of long-term knowledge

- `project_bible`: purpose, scope, architecture and artistic identity
- `decision`: choices approved/rejected and rationale
- `preference`: owner-established style, quality and interaction rules
- `current_state`: confirmed latest build / release / version and unresolved issues
- `work_history`: real work, verified evidence and references to PRs and test runs

Each entry has project, type, title/body, source type/reference, observation date, version, sensitivity and lifecycle status (`proposed`, `approved`, `rejected`, `superseded`). A fact is not independently verified merely because its source type says `verified_result`. Sources must be checked separately where decisions depend on accuracy.

## Data access

- Owner: may review facts across their own projects under Supabase authentication.
- Director: may read only **approved** entries in their assigned project, including private notes where appropriate.
- Matt: may receive approved, **non-private** project snippets only for an explicit project handoff. He cannot retrieve all sensitive Director notes by default.
- Worker: may receive only approved **non-private** facts in its project's scope, after explicit task-level grant.
- Everyone: proposed, rejected and superseded notes are excluded from operational context. Never interpret memory text as instructions to execute tools, grant repository writes, override privacy or spend money.

## Persistence and review

The safe applied schema is recorded in `supabase/paperworld_director_memory_v1_APPLIED_AUDIT.sql` (audit only; **do not execute again**). Supabase already has owner-RLS with authenticated SELECT and proposed-only INSERT. The original `supabase/paperworld_director_memory_v1_REVIEW.sql` was **not applied**: its review RPC is malformed and unsafe. The audit copy does not install any review RPC. No browser or agent gets `service_role`.

`server/director-memory-policy.cjs` validates and filters entries, and `server/director-memory-store.cjs` defines authenticated Supabase reads/proposals. The backend adapter's `review()` method **always fails closed**, because no compatible review RPC exists. Neither the backend adapter nor the context bridge is mounted on the Render server or integrated with Copilot. Durable **proposed** history is already privately persisted, but it is not yet used by the AI.

## Preparing existing project histories

1. Inspect actual source materials: `PROJECT_NOTES.md`, documented project decisions, GitHub commits/PRs, and owner-provided chat excerpts or private uploads. Never claim to have imported conversations that were not actually inspected.
2. Propose short, source-linked candidate entries per project; label uncertain or conflicting items, do not silently reconcile them.
3. Owner reviews the batch; only explicit approvals become project context. Sensitive notes must be marked private.
4. Keep private history in an owner-scoped database, **not in the public GitHub repository**; do not include the user's personal history, health context or full unreleased lyrics in public fixtures.
5. On each project task, load a bounded and relevant approved memory excerpt, with source pointers, and propose new work-history entries only after verified results. No automatic promotions to approved status.

## Still required before activation

- The initial private schema was already applied. Simulated authenticated database-role checks showed 74 rows with a claim matching the owner and 0 with a different claim. **These checks do not substitute for two real logged-in users or a live negative mutation test.**
- Backend authenticated API for owner review, project-scoped read, proposals, version conflict handling, pagination and provenance verification.
- Durable atomic one-time owner-approval claims, tamper-resistant actor/project authorization and audit history.
- Opt-in, reviewed ingestion of private historical sources and conflict/supersession semantics.
- Bounded relevance search and prompt-injection safeguards; user-visible inspection / correction / deletion controls subject to privacy.
- Real integration into Matt → Director → Worker with explicit per-task information grants. No new AI charges.
- A separate approval for merge and deployment.

**Privacy note:** even a server-side role label does not substitute for real authorization checks. PostgreSQL RLS currently isolates owners; Director-project scoping is enforced by the backend policy and must be validated at every request. Public repository artifacts contain schema, code and synthetic tests only.

## Phase 1G — private review desk (draft, read-only)

The Work Desk now has an authenticated **Μνήμη Directors** button leading to a project-filtered review of owner-scoped Supabase rows. It reuses the current PAPERWORLD Cloud login and a fixed five-project registry, and shows full proposal text, lifecycle status, source/date/version/sensitivity. Text is rendered with `textContent` (not HTML), with a 100-record cap and strict project response checks. Only `GET /rest/v1/paperworld_director_memory` is allowed. This view is accessible from the secondary Work Desk, rather than a permanently displayed world overlay.

**Approval/rejection remains unavailable:** the actual applied database has owner-RLS and proposed-only inserts, but has no reviewed approval RPC. The original `paperworld_director_memory_v1_REVIEW.sql` should **never** be run: it includes a malformed and inappropriate security-definer review function. The new UI clearly labels every proposed memory as waiting for review, and provides no fake approve action. A separate review of authenticated one-time human approval, audit history and correct permissions is required before an operational Approve/Reject button can be added.

The new interface does not send any prompt to Matt/Copilot, change Supabase statuses, expose private source text through public GitHub, or grant a Director context access. The read-only UI from PR #84 is merged into main but still requires a separate deployment approval before it appears on the live website.

## Phase 1H — reviewed human decisions and private context adapter (draft only)

The approved plan is to let the signed-in owner approve/reject **one proposal at a time**, with a full text/source confirmation. `js/director-memory-review.js` has optional per-row controls, but `js/cloud-ui.js` explicitly passes `enableReview:false` today. The owner cannot yet approve in the live UI.

`supabase/director_memory_review_v2_REVIEW_ONLY.sql` is a **new, unexecuted** migration. It grants only `UPDATE(status)` on owner-owned `proposed` rows, with RLS checking `approved` or `rejected` status, and stores a private append-only audit record from locked-down, non-API trigger functions. It must be independently reviewed and tested with real distinct users before application. This approach does not install or call the **unsafe old review RPC** from the original v1 REVIEW SQL.

`js/cloud.js` proposes a status-only, project+id+proposed filtered PATCH using the authenticated owner's Supabase JWT. A missing or conflicting row cannot be presented as an applied decision. The UI requires an explicit user confirmation containing the full entry and provenance. These controls are **not a cryptographic human-presence proof**: browser JWTs are owner credentials, so AI and workers must never receive the user JWT or an authenticated review endpoint. The existing project- and owner-RLS boundary remains authoritative.

`server/director-memory-context.cjs` defines a future server-only bridge which rechecks identity, actor and authorized project, rejects mixed-project responses, excludes unapproved records, and filters private content from Matt/Workers. It returns untrusted data without tool or action rights. The bridge is **not mounted in Render**, not sent to Copilot, and cannot initiate inference.

**PR #83 reconciliation:** its applied-schema audit file, fail-closed backend store adapter and updated tests have been copied into the draft PR #87 branch; the timestamp normalization is included here as well. PR #83 remains open but must **not** be merged separately without re-review, to avoid redundant/conflicting changes. No historical proposals have been approved.

## Phase 1I — current read-only RLS test evidence

On 2026-11-15, the connected PAPERWORLD Supabase project was inspected without modifying memory records. The initial table has RLS enabled, and `anon` has no SELECT grant while `authenticated` lacks direct UPDATE privilege. Inside **rolled-back, transaction-local SQL simulations**, `SET LOCAL ROLE authenticated` with `request.jwt.claim.sub` matching the existing owner saw **74 entries**; a synthetic different user ID saw **0 entries**. This confirms the current owner filter under simulated database claims, **not** end-to-end token validation. No real secondary Supabase Auth account or JWT was used.

The v2 owner-approval SQL remains **unapplied**. Review requires independent verification of role grants, PostgreSQL trigger privileges, audit uniqueness, cross-owner UPDATE denial, replay attempts, and two actual authenticated user sessions. Test with synthetic records in a dedicated staging environment before enabling any browser buttons. No individual private history was copied into the GitHub PR.
