# PAPERWORLD — Director Memory System v1

**Updated 2026-11-15: private Supabase storage has been created and 19 initial historical knowledge proposals were inserted under the one verified Paperworld thread owner.** All 19 remain `proposed`, not approved for AI use. This does not install backend routes, run AI, publish private information to GitHub or deploy anything. The versioned adapter correction is in a separate draft PR.

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

The reviewed migration from PR #82 was **not** applied as written because its review RPC was unsafe and its SQL delimiter malformed. The actual safe schema was created in Supabase via migration `director_memory_v1_proposals_private_rls`, mirrored in `supabase/paperworld_director_memory_v1_APPLIED_AUDIT.sql`. It enables owner-scoped RLS, SELECT and proposed-only INSERT. The review RPC was deliberately **omitted**; approvals remain blocked until a separately reviewed protocol is installed. No browser or agent gets `service_role`.

`server/director-memory-policy.cjs` validates and filters entries, and `server/director-memory-store.cjs` defines authenticated Supabase reads/proposals. The optional review operation fails closed until separately implemented trusted **one-time owner confirmation** is injected. Neither module is currently mounted on the Render server, exposed to the UI or integrated with Copilot. This means **persistent private proposal storage now exists**, but live Directors do not yet load approved memory automatically. It is not mounted to the server or model prompts.

## Preparing existing project histories

1. Inspect actual source materials: `PROJECT_NOTES.md`, documented project decisions, GitHub commits/PRs, and owner-provided chat excerpts or private uploads. Never claim to have imported conversations that were not actually inspected.
2. Propose short, source-linked candidate entries per project; label uncertain or conflicting items, do not silently reconcile them.
3. Owner reviews the batch; only explicit approvals become project context. Sensitive notes must be marked private.
4. Keep private history in an owner-scoped database, **not in the public GitHub repository**; do not include the user's personal history, health context or full unreleased lyrics in public fixtures.
5. On each project task, load a bounded and relevant approved memory excerpt, with source pointers, and propose new work-history entries only after verified results. No automatic promotions to approved status.

## Still required before activation

- Private database migration was applied and verified (RLS enabled, anonymous SELECT denied, direct authenticated UPDATE denied, authenticated role with no user JWT sees zero rows). Two-account end-to-end RLS tests and agent-level project isolation tests are still required.
- Backend authenticated API for owner review, project-scoped read, proposals, version conflict handling, pagination and provenance verification.
- Durable atomic one-time owner-approval claims, tamper-resistant actor/project authorization and audit history.
- Opt-in, reviewed ingestion of private historical sources and conflict/supersession semantics.
- Bounded relevance search and prompt-injection safeguards; user-visible inspection / correction / deletion controls subject to privacy.
- Real integration into Matt → Director → Worker with explicit per-task information grants. No new AI charges.
- A separate approval for merge and deployment.

**Privacy note:** even a server-side role label does not substitute for real authorization checks. PostgreSQL RLS currently isolates owners; Director-project scoping is enforced by the backend policy and must be validated at every request. Public repository artifacts contain schema, code and synthetic tests only.

## Initial seed (private database only)

The owner gave permission for importing historical project context. Nineteen **review-needed proposals**, not final verified facts, were written to the owner's private database: 4 town/Matt, 5 Listening Mirror, 5 The Lost Wanderer, 3 Pokémon Echoes and 2 Wellbeing privacy-policy notes. There are **no individual medical records** in this initial seed. Sources are annotated by date and conversation/project-file identifiers; some are summaries rather than exact source excerpts, so the user must verify them before approval. This document does not reproduce those private records. No new secrets or accounts were created.

The database currently cannot promote a proposal to approved. That is intentional: a genuine owner-only review UI, one-time confirmation, audit logging, privacy controls and RLS cross-account tests must precede promotion. The previous REVIEW-only RPC must not be installed.
