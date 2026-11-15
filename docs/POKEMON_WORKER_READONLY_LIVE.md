# First real Pokémon Echoes Worker investigation — explicit, read-only

## Scope
Adds a separate **human-selected** Matt → Pokémon Echoes Director → Pokémon Developer Worker → Director → Matt analysis path in Paperworld. It can read only the current private repository `mr-tanq/pokemon-echoes` file `project.godot` on `main`, via authenticated GET to GitHub. No source code writes, branches, draft PRs, sandbox runs or tests in the game repository.

The human must enter Worker mode, select **Pokémon Echoes**, then approve a dedicated prompt. The consent explicitly states the private Godot configuration will be shared with GitHub Copilot for this one answer, at most **five allowed Copilot turns** and existing $0 overage budget guard. The previously active Listening Mirror Worker remains on its separate endpoint.

## Chain and evidence
1. Server authenticates current Supabase owner JWT and ownership of the Matt thread, verifies configured GitHub $0 overage guard and linked GitHub token, and consumes the request ID to prevent duplicate attempts.
2. Server validates a proposal-only Pokémon Worker handoff policy; project is **fixed and owner-selected** rather than switched by model text. It retrieves **approved** owner/project-scoped Pokémon memory for Director turns only.
3. Matt scopes the task (turn 1), Pokémon Director frames source limits (turn 2), and a fixed-path GET loads `project.godot` using the linked GitHub OAuth token. No user-provided branch, file path or repo URL is accepted.
4. Pokémon Developer Worker analyzes the read-only source excerpt and cites `L#` and the source file SHA (turn 3), Director checks against independent excerpt and approved memory (turn 4), Matt summarizes verified findings and next human-approved step (turn 5). All AI sessions are tool-free and permissions rejected.
5. Response identifies `pokemon-director`, `pokemon-developer`, source repo/ref/path/SHA and **`persisted:false`**. The Pokémon flow does **not** use the Listening Mirror-specific job-history tables, and cannot claim progress from them. The Messenger does not poll/show fabricated Pokémon job stages.

## Known limitations
- This first source window covers **Godot project configuration only**; the worker cannot confirm current Alder Town scenes, NPC logic, battles, sprite sheets or other files. Those require a separately approved extension to the allowlisted reader.
- The existing GitHub OAuth connection must actually permit read access to the private Pokémon repository. If it does not, the request fails closed. No extra repository rights are automatically requested.
- This is code prepared in a **draft PR**, not a deployed real AI invocation. Offline tests use synthetic identities, model replies and mocked GitHub source. A real live workflow must be separately authorized and verified after merge and Render deployment.
- No background tasks, GitHub write permissions, billable subscriptions, multi-project access or sensitive Wellbeing exposure. Prompt content is untrusted historical/source reference data and never executable instructions.

## Future work
Separately approve broader read-only game file evidence, private project source scanning with strict bounds, owner-scoped durable Pokémon job events, then isolated code-change proposal and **draft PR only** after individual permissions and tests. Merges and deployments remain separate human decisions.