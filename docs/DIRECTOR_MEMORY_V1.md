# PAPERWORLD — Director Memory System v1

**Status: draft, inactive.** This change does not apply the SQL migration, install backend routes, import personal history, make AI calls, merge, deploy or modify any other project. It is the shared foundation for all registered Directors.

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

The proposed migration `supabase/paperworld_director_memory_v1_REVIEW.sql` defines a private owner-scoped table with RLS and owner-scoped SELECT / proposed-only INSERT, plus an owner-restricted review RPC for approving or rejecting proposals. It has **not** been run. No browser or agent gets `service_role`.

`server/director-memory-policy.cjs` validates and filters entries, and `server/director-memory-store.cjs` defines authenticated Supabase reads/proposals. The optional review operation fails closed until separately implemented trusted **one-time owner confirmation** is injected. Neither module is currently mounted on the Render server, exposed to the UI or integrated with Copilot. This means there is **not yet persistent live Director memory**, only reviewed storage design and tested adapters.

## Preparing existing project histories

1. Inspect actual source materials: `PROJECT_NOTES.md`, documented project decisions, GitHub commits/PRs, and owner-provided chat excerpts or private uploads. Never claim to have imported conversations that were not actually inspected.
2. Propose short, source-linked candidate entries per project; label uncertain or conflicting items, do not silently reconcile them.
3. Owner reviews the batch; only explicit approvals become project context. Sensitive notes must be marked private.
4. Keep private history in an owner-scoped database, **not in the public GitHub repository**; do not include the user's personal history, health context or full unreleased lyrics in public fixtures.
5. On each project task, load a bounded and relevant approved memory excerpt, with source pointers, and propose new work-history entries only after verified results. No automatic promotions to approved status.

## Still required before activation

- Review/apply private database migration with owner consent; test RLS with two distinct accounts and intentional cross-project access attempts.
- Backend authenticated API for owner review, project-scoped read, proposals, version conflict handling, pagination and provenance verification.
- Durable atomic one-time owner-approval claims, tamper-resistant actor/project authorization and audit history.
- Opt-in, reviewed ingestion of private historical sources and conflict/supersession semantics.
- Bounded relevance search and prompt-injection safeguards; user-visible inspection / correction / deletion controls subject to privacy.
- Real integration into Matt → Director → Worker with explicit per-task information grants. No new AI charges.
- A separate approval for merge and deployment.

**Privacy note:** even a server-side role label does not substitute for real authorization checks. PostgreSQL RLS currently isolates owners; Director-project scoping is enforced by the backend policy and must be validated at every request. Public repository artifacts contain schema, code and synthetic tests only.
