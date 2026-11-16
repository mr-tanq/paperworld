# Paperworld V5 — Autonomous Team Foundation (first reviewable slice)

## Product contract

Owner speaks naturally to Matt. Matt chooses a project Director; the Director scopes a capability for a specialized Worker; the owner sees one clear request for the exact permission needed; the backend executes only after checking identity, consent, project scope and a one-use grant; a verified result returns through Director and Matt. The village remains the interface, not a developer dashboard.

## Implemented in this PR

- `server/team-orchestrator-v5.cjs`: a pure, shared registry for Listening Mirror, Pokémon Echoes, The Lost Wanderer and Wellbeing, with canonical Director/Worker IDs and allowed capability sets.
- Explicit state progression: queued → assigned → awaiting_consent → ready → running → review → completed; failed and cancelled cannot silently restart.
- Revision-based optimistic concurrency: old approvals and stale resume attempts are rejected.
- Approval metadata ties a specific job, revision and capability to one owner-confirmed grant ID. This is **not** a real authority token; the trusted server must independently verify ownership, expiry and single-use consumption before granting any tool.
- Results may only be marked reviewable when verified, and completion requires Matt's report stage. An AI assertion alone cannot mark external work completed.
- Resume policy stays **manual** unless a trusted server independently validates a previously granted approval.
- Offline tests cover cross-project authority, owner consent, stale revision, lifecycle, cancellation and no network/AI execution.

## Not yet implemented, do not claim otherwise

- No wiring into the existing Matt/Director/Crow/Pokémon UI or Render endpoints.
- No actual autonomous jobs, scheduler, durable queue, database migrations or background processing.
- No credentials, model calls, paid services, repository edits or delegated permissions.
- No changes to the existing Listening Mirror live Worker; its established owner authentication, proposal and RLS rules remain authoritative.
- No ability to generate or publish a song in Suno.
- Wellbeing's proposed analysis-only Worker is a **policy placeholder**, not an active agent; sensitive memory remains isolated and cannot be disclosed to cross-project meetings.
- The existing `paperworld_agent_jobs` schema and `agent-job-memory.cjs` remain Listening Mirror-specific. Generalize them only with reviewed DB migration, owner RLS checks and production rollback before enabling new project jobs.

## Integration sequence / acceptance criteria

1. Decide exact one-use consent server format and expiry (not based on client JS object), and implement owner-thread-scoped persistence with RLS. Existing proposals and chats stay intact.
2. Bridge Matt's validated AI intent to `validateAssignment` and record one real persisted handoff. Do not let an AI select arbitrary repository URLs or tool permissions.
3. Implement a server-owned durable queue, lease and idempotent resume. No automatic work without specific prior authorization; failure and cancellation must release the lease safely.
4. Adapt one approved Worker connector at a time: source-read Listening Mirror, then read-only Pokémon. Studio creative briefs and health analysis remain tool-free until specific privacy/cost reviews.
5. Return evidence-backed progress and a human-readable next decision in Matt Messenger, distinguishing draft/proposed from applied/tested.
6. Run offline unit+integration tests, isolated Supabase RLS tests and controlled live read-only verification. Merge and deployment require separate owner approval.

## Safety boundary

Client-side selections, AI narratives, visual agent movement and history event labels are never a source of authority. No Worker executes a write, sends email, spends credits, grants access, merges or deploys solely because Matt delegated it. User consent must describe the exact side effect, scope, and cost, and server validation occurs again immediately before execution.
