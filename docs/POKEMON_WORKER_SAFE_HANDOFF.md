# Pokémon Echoes Developer Worker — guarded handoff foundation

## Confirmed current codebase
Pokémon Echoes has a separate **private** GitHub repository, `mr-tanq/pokemon-echoes`, with `project.godot` (Godot config version 5, 320×288 viewport). Do **not** mistake Paperworld's `pokemon` workshop or existing historical memory for proof of the private game's current source state. No complete code audit was performed. Historical approved memory may inform scope but must never be treated as a confirmed repository diff.

## This PR implements
- An explicit registered `pokemon-developer` worker belonging only to `pokemon-director`. Matt can assign the Director a question; only that Director is permitted to propose a handoff to the registered worker.
- A pure `preparePokemonWorkerHandoff` policy: authenticated-looking UUIDs validated for a future trusted adapter; bounded request; purpose `investigate`, `summarize`, `plan`, `review`; returns **proposed** state only with `execution=none`, no model calls, no write/grant and mandatory human approval.
- A fixed-path `createPokemonRepoReader` for a *future* user-authorized GitHub OAuth read of private `project.godot` from pinned repository and ref `main`. It enforces GET only, fixed host and file, 8 KB size bound, checked metadata and SHA; credentials never become model content or output. No browser hooks or live server routes call this reader.
- Offline tests using **synthetic** identity and GitHub responses. No real developer AI or code generation is run.

## What is deliberately NOT implemented
- No live Matt → Pokémon Worker model call, HTTP handler, job history mutation, GitHub API write, branch creation, sandbox code execution, tests against the game repo, or automatic draft PR creation.
- Existing Listening Mirror Worker endpoint remains limited to `mr-tanq/concerts` and does not gain any Pokémon access.
- Existing dormant TicketSwap autofix publisher cannot be repurposed directly: it is bound to its existing source allowlist and requires separate verified privileges, sandbox and explicit approval.
- No unreviewed Pokémon source code, secrets or private user data are committed to the public Paperworld repo.

## Next independently approved stage
After review and merge of this foundation, identify a concrete, modest game task, then implement a separately authorized, read-only Pokémon investigation endpoint with owner-scoped persistent job state and **real** project file verification. Only after that would we design safe patch generation, isolated tests and a **draft** GitHub PR using a minimal-scoped credential, preserving separate human approvals for code writes, merges, deployments and any Copilot credit use. A successful Paperworld workflow must always distinguish a historical decision from a current source inspection and completed action.