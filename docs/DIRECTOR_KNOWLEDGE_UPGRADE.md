# Director Knowledge Upgrade — relevance-first, private-history architecture

## Product intent (15 Nov 2026)
The owner wants Luna, Joey, Crow, and Dave to know their own projects in comparable depth to a long-running ChatGPT conversation: decisions, reversals, preferences, prior work, source-linked chats, drafts, and ongoing context. Owner explicitly permits including private medical history for Dave and unreleased lyrics for Crow **inside authenticated project-private memory**; that is not permission to publish that content.

## Implemented here
- Existing approved-memory policy now prioritizes relevant records for the current user question instead of blindly inserting the oldest records.
- A single oversized record no longer prevents smaller relevant records from fitting within the existing bounded context.
- Trusted server paths pass the user's current Director question to the sorter; project isolation, approved-only filtering, privacy rules, 6,000-character trusted-context cap and per-turn AI consent stay intact.
- No new credentials, external data access, AI turns, role or scope grants; no database or browser migrations.

## Target architecture (not implemented in this PR)
1. **Private Project Bible** for each Director: independently curated evergreen project specification, established preferences, known rejected choices, and operating boundaries.
2. **Source-linked conversation ingestion** from exports or explicitly accessible prior conversations, with source references and date ranges; preserve contradictory decisions rather than pretending one is current.
3. **Rich private archive**, including the actual text of unreleased lyrics where obtained, and private health context for Wellbeing. Keep raw source bodies and protected fields in private owner-isolated storage; never place them in GitHub commits, public fixtures, logs or front-end bundles.
4. **Hybrid retrieval**: structured fields + full-text search, recency, verified state and semantic matching within a single Director project. Return bounded passages with provenance instead of raw unlimited conversation dumps.
5. **Durable per-project conversation history** and continuity across sessions/devices. Current short in-process history is not a durable memory system.
6. **Provenance and freshness**: distinguish user statement, assistant suggestion, confirmed decision, screenshot, project file and verified runtime evidence. Invalidate stale current-state entries after new repo changes.
7. **Automatic candidate capture** from future owner conversations only after a reviewable privacy and ingestion policy is implemented. Owner's request removes repetitive line-by-line manual approval for ordinary within-project notes, but must not bypass verified owner authentication, scope isolation, confidentiality, or existing privileged-action approval gates.
8. **Correction and deletion**: owner-facing review, source attribution, export, project-specific retention rules, supersession and delete controls; protect Wellbeing from automatic delegation and cross-project leaks.

## Ingestion manifest
- Luna/workshop: concert recommendation rules, festivals/re-entry decisions, sources, ticket features, setlist reliability, supported countries, current Listening Mirror and Friends repos and PR history.
- Joey/pokemon: Godot 4, overworld sprites, map and battle/dialogue prototypes, artistic constraints and gameplay design decisions.
- Crow/studio: all artistic eras of The Lost Wanderer; approved song identity, vocal and arrangement preferences; per-track rejection and revision notes; private unreleased lyric bodies only if actually available.
- Dave/wellbeing: owner-supplied habit and exercise goals and consented personal history; distinguish health reports from clinical diagnosis; keep entirely private to the Wellbeing project.

## Boundaries
This PR does not import unseen past chats, create or approve memory rows, enable automatic model access to health data, expand GitHub or Supabase access, deploy, merge, trigger models, or spend credits. A later separately reviewed private data-import flow is required, and the owner can revoke its access. Never claim that a Director has full ChatGPT historical memory until end-to-end retrieval of real sources has been verified.
