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

## Render Free hosting experiment (14 November 2026)

User approved preparing **Render Free** for a trial, subject to confirmed no-charge setup. Render docs confirm $0/month Free Web Service, 750 shared instance-hours, idle shutdown after 15 minutes, and potential bandwidth/build overage billing **if payment details are on file**. The proposed `render.yaml` uses Free, manual deploy only, no database; an isolated `server/render-matt.cjs` status-only endpoint returns AI OFF. Do not create, merge, or deploy a paid service. GitHub OAuth, ownership, SDK and human approval must be implemented before any live AI request.

## Village-first UI redesign decision — 14 November 2026

Verified the original Tristen O'Brien video description and seven-step chapter plan: the key product is a navigable village with a following Chief of Staff, house-level Directors, specialized workers, a real connector/job, natural chat, and Town Hall. The source's description is available, but original video frames could not be fetched reliably, so *pixel-perfect visual equivalence is not claimed*.

The user explicitly rejected our permanently displayed beige inspector/sidebar, tab-style task selection, prebuilt missions and calibration/dev clutter as the everyday UI.

Approved interaction: village fills the entire viewport, house taps directly open the corresponding in-world agent Messenger, M talks to Matt, T talks to nearby agents, and a small optional work desk contains Cloud login and secondary project data. Task tabs and technical calibration are hidden from the everyday experience, not removed from storage. No fake agent replies or fake worker status. Keep the current papercraft art until separately approved asset changes.

PR `feature/village-first-game-interface` makes these frontend changes only. It does not deploy, auto-merge, spend credits, change Supabase or enable Copilot. Next: validate on Android tablet; implement real user-authorized GitHub OAuth and protected AI endpoint, then real task-to-worker routing.

Additional game-flow improvement: Matt now visually follows the player's walked path (delayed breadcrumb trail); the nearby T action deliberately selects a Director, while M always contacts Matt. No agent actions or model calls are simulated by this movement.

## GitHub OAuth linking for Matt (14 November 2026)

A user-authorized GitHub OAuth App (not stored host credentials) is the selected path to use an existing Copilot subscription. Render server endpoints POST `/auth/github/start`, GET `/auth/github/callback`, POST `/auth/github/status` use authenticated Supabase owner identity and a 10-minute single-use random state. The callback exchanges the code server-side and checks GitHub `/user`. Tokens remain **in memory only**, lost when Render Free sleeps, never sent to GitHub Pages or stored in public tables. The Web client offers Connect GitHub + Check Connection in the optional Work Desk. No AI calls occur: `/chat/matt` remains HTTP 503. GitHub OAuth App creation and Render environment secrets must be performed by the account owner (never paste secrets into chat); merge/deploy require separate explicit approval. After OAuth, pinned SDK, spending controls and a real approval issuance protocol must precede a first model call.
