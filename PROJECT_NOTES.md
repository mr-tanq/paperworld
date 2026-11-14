# PAPERWORLD — PROJECT NOTES (living source of truth)

## Locked product vision — 14 November 2026

The user is Chief Human Officer. The Chief of Staff is currently named **Matt** (rename later).

**One chain for every request, with no hardcoded topic-specific routing:**

Human → Matt (actual AI conversation) → appropriate Director → specialized Worker → tested output/report → Director → Matt → Human.

Example requests are only examples; **TicketSwap must not be a built-in demo, preset mission or routing keyword**. A user can instead raise any issue in Listening Mirror, plan a new song for The Lost Wanderer, or request Pokémon Echoes work. Matt understands the intent dynamically, consults project instructions and selects the correct specialists. Workers know their assigned project and have bounded, specific capabilities.

## Visual and interaction decisions

- Papercraft, daylight village; the user moves to Matt or a Director.
- Press M to talk to Matt, T when near another agent. Dark, high-quality Messenger-style chat overlay.
- Single private conversation, not separate scripted demonstrations or stacked beige forms.
- Human can track delegation states and outcomes in-world. Visual agent movement must reflect **real** workflow events, never decorative fake completion.
- Matt is primary contact; user need not separately explain the request to each Worker.
- The system can complete approved safe work asynchronously, but any coding writes are PR drafts only, with human approval before merge/deploy. Credits and paid services require explicit advance approval.

## November 2026 reset

- The old TicketSwap-specific workflow/controller and fixed dialogue are removed from the new branch.
- The old TicketSwap project missions and demo cloud task have been deleted from the PAPERWORLD Supabase tables only. Listening Mirror's own repository is untouched.
- No fabricated Matt/Director replies: until a REAL approved AI gateway exists, the dark Messenger can only retain genuine user messages.
- Existing GitHub Copilot Pro does NOT automatically authenticate an unattended web app. Do not use a server's GitHub login as identity, commit tokens, or claim AI is connected.
- The existing server adapter, private approvals, identity guards and owner-only message storage are available as groundwork; host/OAuth/budget verification and end-to-end worker execution are still missing.
- Supabase Edge Function `worker-bridge` was previously deployed for legacy worker flow; deleting repository source does not automatically disable that deployed function. Must audit and retire with a separately approved change before any live AI activation.

## Build order

1. Remove all preconfigured TicketSwap routing/UI and deactivate orphaned workflow entry points; offline tests.
2. Establish one **real AI conversation** with Matt through user-linked GitHub Copilot OAuth, a secure accessible backend and verified cost/credit limits.
3. Persist agent answers and generic task/hand-off records with statuses; route freely among existing Directors/Workers based on genuine model decisions, with server validation of agent capabilities.
4. Connect one real worker from prompt through approved execution to a verified result and Matt's response. Reuse GitHub via draft PRs, but no unattended changes.
5. Add job-state-based agents' movement, Town Hall meetings and richer interiors.

## Existing user rules

No paid API or surprise credits; review/estimate and explicit yes before credits. No autonomous merge, deployment or edits to `mr-tanq/concerts`; workers can propose fixes for review. Before file mutations or running on the user's devices, explain scope and receive permission. Maintain this notes file with decisions. Show completed work and accurate CI status.
