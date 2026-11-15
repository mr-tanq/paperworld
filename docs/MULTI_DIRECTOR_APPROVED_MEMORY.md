# Multi-project Director Q&A — draft, opt-in and memory-safe

## Scope
Extend the existing owner-authenticated, consented, no-tools Matt → Director → Matt Q&A route (up to three allowed Copilot calls per turn) to Lost Wanderer, Pokémon Echoes, and Wellbeing. Do not change the existing Listening Mirror Worker investigation route.

Server actor ↔ fixed memory project: listening-director ↔ workshop; studio-director ↔ studio; pokemon-director ↔ pokemon; wellbeing-director ↔ wellbeing.

Owner chooses a named Director in the Messenger. A named selection skips the model router and uses up to two existing AI turns. Automatic routing can choose only Listening Mirror, Lost Wanderer or Pokémon. Wellbeing is never auto-selected.

For sensitive Wellbeing material, the browser asks a second, dedicated per-turn confirmation that approved health history may be sent to GitHub Copilot. The server requires both the exact Wellbeing director target and an explicit consent marker before any model call or memory access. The caller's validated Supabase JWT and owner RLS still isolate projects.

The existing approved-only loader filters out all unapproved/rejected/superseded memory. No personally identifying history is included in the PR or tests. Currently the 27 Lost Wanderer, 9 Pokémon and 9 Wellbeing proposals are not yet approved. A model must not invent historical decisions, claim access to files, or confuse general advice with retrieved personal history.

No tools, Worker code privileges, new inference or spending APIs, automatic background jobs, SQL migrations, or change of database approval status. Existing Listening Mirror Worker flow remains Listening Mirror only. This is source code in a draft PR, not a deployed or tested live Copilot integration.

Separate explicit approval is required for merge and deployment. Browser and server updates require release verification; GitHub Pages availability must be checked independently.