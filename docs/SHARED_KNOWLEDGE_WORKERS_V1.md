# Paperworld Intelligence — Shared Knowledge for Copilot Workers (V1)

## Existing foundation
The registered Directors already load owner-approved project memory from the private Supabase Director Memory store. Until this change, the Listening Mirror and Pokémon Copilot Developer Workers received code evidence and the current request, but not the approved standard project context.

## What this PR changes
- Reuses the existing authenticated, owner-RLS-backed Director Memory store and the existing project-scoping policy. **No new table or independent memory**.
- A trusted backend constructs a per-request task grant for the registered `listening-developer` or `pokemon-developer` after existing owner, thread, consent and budget checks. The browser or AI never chooses a memory project.
- The worker loader independently verifies owner JWT, task actor/project and request identifier; it selects **approved standard-sensitivity** records only, excluding all `private`, `proposed`, `rejected` and `superseded` notes.
- Bounded project notes are inserted as lower-trust **historical reference data** into the existing Worker inference prompt, with source labels. They are not current GitHub code evidence, an instruction source, permission to write, or proof of completed execution.
- Uses the already authorized Worker turn; **no extra AI turn or pay-per-use action**. Sensitive memory text is not included in job logs or user-facing result metadata. Existing read-only repository evidence and source SHA checks remain authoritative.
- Adds offline tests for owner isolation, wrong project/actor, private filtering and both Workers receiving the bounded context without extra turns.

## Limitations and release checks
This PR adds the read path only. It does not activate previously proposed memories, silently approve corrections, grant additional GitHub tools, or enable scheduled jobs. If private Supabase memory cannot be verified, the Worker analysis fails closed rather than inventing a memory summary.

Before merge/deployment: pass all offline and RLS tests, verify the exact diff and do a controlled owner-authenticated end-to-end review. A green CI alone does not prove production RLS behavior.

No Suno changes.
