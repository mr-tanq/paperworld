# Matt semantic Director routing — conservative fix (draft)

## Problem observed in live PAPERWORLD
The human described a dismissed festival that later added MONO, without naming Listening Mirror. The 3-turn auto route returned no Director and the generic error misleadingly mentioned Wellbeing. Render app logs did not disclose the raw routing output, so the precise model response is unknown.

## Correction
The first model turn remains Matt's semantic classifier, with a strengthened description of Director responsibilities and illustrative natural language. No fixed classifier of project keywords is installed. The user need not mention app names. Listening to music and attending festivals are distinct from writing music albums. This follows the project's locked natural-language routing principle.

Only three non-sensitive Directors may be auto-selected: listening-director, studio-director and pokemon-director. The Wellbeing Director is never chosen automatically, regardless of model output; it requires the existing explicit user target and sensitive-data consent. The server uses an allowlist and treats memory as scoped to the selected actor.

`server/matt-semantic-router.cjs` accepts only exact allowlisted identifiers, narrowly wrapped identifiers or one-key JSON (`director` or `directorId`). It rejects contradictory, verbose, injected, unsupported, Worker and Wellbeing values. A refusal or invalid response does not invoke another model turn, expose private facts or inspect a repository. It returns a neutral unresolved status and asks the user to select the project explicitly.

The response includes `directorName`, `routeMethod` and `routeStatus`. The Messenger displays the actual selected Director beside Matt's answer; for unresolved routing it displays helpful guidance instead of the misleading Wellbeing sentence. It never exposes the raw model response, user tokens or other project memory.

## Tests and limits
All new tests are offline mock Copilot responses. They verify safe result parsing, relevant semantic prompt context, authoritatively selected actor, no extra routing turns, and refusal of unsafe choices. These tests cannot guarantee that a live model will always classify every real user prompt correctly. After owner-authorized merge and separate deployment, confirm the real returned Director for a natural-language festival question; then verify the scoped approved memory.

No additional AI calls or credit use during development; no changes to production SQL, approved memory, Worker route, permissions or deployment. PR stays draft until separately reviewed and merged.