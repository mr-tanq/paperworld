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

## Live Matt chat integration proposal — 14 November 2026

A real Copilot SDK endpoint is proposed in `feature/matt-first-real-copilot-chat`: explicit one-turn confirmation, authenticated owner + private thread, per-owner ephemeral GitHub token, runtime quota/model preflight, pinned SDK, model response back to the dark Messenger and no callable worker tools. No hardcoded user-task examples. Build remains on Free Render, but current Render Blueprint must be separately planned/applied after review to install npm dependencies. **Not merged or deployed yet.** Human notes persist in Supabase; Matt's replies and recent conversation context are only in ephemeral browser/Render memory. No claim of AI success before real live test. Before first AI request verify subscription allowance and paid-overage control.

## AI credit pricing correction (14 Nov 2026)
GitHub Copilot individual billing switched June 2026 from premium request multipliers to token-priced GitHub AI Credits. The SDK per-session `sessionLimits.maxAiCredits=1` is a **soft cap**; its first model call can go over that cap. Never assert that a soft cap alone prevents overage. The new real-chat endpoint is BLOCKED by default until the owner has independently set a hard-stop zero-dollar **Additional usage** GitHub budget, verified no extra charges, and authorized turning on the server flag `PAPERWORLD_COPILOT_BUDGET_VERIFIED=yes` in Render. The confirmation is separate from any model call. User must approve merge/deploy and per-message AI credits. The selected model is chosen by available verified token pricing; missing pricing fails closed. No live model request has run so far. The Matts's AI reply memory remains temporary and requires future RLS-safe persistence; OAuth token also expires with Render Free sleep.


## Matt createSession diagnostics after PR #59 (14 November 2026)
Render confirmed two `session_create` failures, even after disabling built-in agents. For the next isolated diagnosis we reduced the SDK session configuration to the minimum required for conversation while retaining per-user `gitHubToken`, `availableTools: []` (SDK's empty mode), deny-all permission callback and pre-tool hook, 1 AI Credit soft cap and static Matt system message. The account's GitHub additional AI usage budget remains $0 with Usage Blocked; no overages are authorized.
A new authenticated `POST /diagnostic/matt-session` endpoint creates and immediately closes one Copilot session for the verified Supabase owner and Matt thread, **without calling send or sendAndWait**. The optional "Έλεγχος Copilot · χωρίς AI μήνυμα" button is shown inside Matt Messenger. Results disclose only allowlisted stage/reason categories, not exception strings or tokens. The diagnostic does not save a chat message or invoke any model; one request ID cannot be reused. The client stays in empty mode and agent tools remain disabled. CI uses injected SDK mocks and must pass before merge and Render deployment. A successful diagnostic only proves session creation, not actual model replies. After a live owner-triggered diagnostic, use Render app logs to determine the next step.

## Live Matt baseline-only session after PR #61 (14 November 2026)
The user-initiated live no-message diagnostic confirmed a **baseline** Copilot session succeeds on Render while the **full** session fails (`session_create:full`). For the first real Matt reply, use exactly the verified baseline createSession config: per-user `gitHubToken`, `availableTools: []` under SDK empty mode, and deny-all `onPermissionRequest`. Remove optional hooks, `systemMessage` and `sessionLimits` from that actual session; only the owner's verified GitHub account-level $0 additional AI Credit hard stop, explicit confirmation per message, request idempotency and Supabase thread ownership guard usage. The SDK soft 1-credit cap is NOT applied in this baseline mode and must not be claimed. Matt's conversational identity and inability to execute tools are explained in the prompt text; this is not a privileged system message. Do not claim a real reply until verified on device. No agent delegation yet.


## First real AI Director — draft, 14 November 2026

The first implemented specialist is **Listening Mirror Director**, operating through GitHub Copilot SDK on the trusted Node backend. The user's original Matt chat stays one normal model call. A **separate opt-in** "Ανάθεση μέσω Matt · έως 3 AI κλήσεις" action in the same dark Messenger performs: Matt natural-language AI routing (allowlisted director ID only) → Listening Mirror Director AI analysis → Matt AI final report. It consumes up to **three included Copilot AI turns** and needs explicit confirmation in the UI; the existing account-level GitHub $0 additional-usage hard stop remains unchanged. When an unrelated request is not routed to the only currently active director, the process stops after the first AI routing call and informs the user. No TicketSwap-specific keyword rules, preset demos or canned specialist reports.

All real Director turns use the **live-proven baseline SDK configuration**, with `mode:empty`, `availableTools:[]`, `onPermissionRequest` always reject, scoped GitHub OAuth user token, private owner+Matt thread verification, one-time request IDs and one active delegation per account. Backend reports are AI outputs, not claims of repository inspection. **Director cannot read or modify `mr-tanq/concerts`, access files/web, send messages, deploy, run code or invoke Workers.** Director report and Matt response are temporarily shown in browser memory, not durably written to Supabase. Render Free server sleeping can interrupt and lose OAuth. This is one-step delegation and advice, not background job automation.

This PR is **draft only**: no production merge, deployment, real credit consumption, file writes to other repos, or billing changes until a separately approved rollout. Future phases: project-scoped authenticated *read-only* GitHub integration, specialist Worker, authorized draft PR edits, persistent job status/trace, resume and durable director memory, other directors (Pokémon, Wellbeing, Lost Wanderer), real progress reporting. Keep approval before any side effect.


## First read-only Listening Mirror Developer Worker — draft PR (14 November 2026)
The user approved implementation of a **real AI Developer Worker** with restricted repository reading, and a fix for literal `\\n` characters in the Messenger. No merge, deployment or live credits are authorized as part of this development approval.

Five role-bound AI turns are proposed behind a **separate opt-in** button: Human → Matt AI route → Listening Mirror Director AI selects one allowed code category → trusted backend performs GET-only reading of exactly three fixed `mr-tanq/concerts` files → Developer Worker AI analyzes source evidence and cites paths/line numbers → Director AI reviews → Matt AI summarizes and asks for approval of any changes. This is **read-only investigation** (not execution); the Worker does not have SDK tools, a shell, arbitrary GitHub queries, repository write access or any permissions to edit/commit/deploy. The original normal one-turn Matt chat and the earlier three-turn Director-only path remain available.

Code fetch uses the GitHub **public Contents API** through fixed-origin `https://api.github.com/repos/mr-tanq/concerts/contents/...`, no OAuth token or secrets and no untrusted URL/path/branch inputs. Group allowlists: ticketing (three TicketSwap files), artwork (three concert image/fallback files), general (README/package/warmup model). Each file <=12 KB, combined <=30 KB. If the repository becomes private, cannot be fetched, or responds with unexpected path/encoding/size, the Worker **fails closed** rather than guessing from invented files. Live public accessibility has not been verified from Render. Evidence is labelled UNTRUSTED and presented to Worker as data, not instructions. The user approves up to five included Copilot turns per request, protected by the existing account-wide additional GitHub AI Credits $0 stop, Supabase ownership check, one active job, request replay protection, and SDK baseline mode with `availableTools: []` and rejected permission requests.

Worker and Director reports are ephemeral in Messenger and not durable in the database. There is no asynchronous background process, no persisted job graph, and no autonomous GitHub file changes. Real code evidence fetch and model handoff remain unverified in production until explicit merge/deploy authorization. All tests are offline mocks.

Messenger displays literal escaped newline sequences as line breaks with textContent, never unsafe HTML. The visual layout remains one dark Messenger, not extra tabs. Next: production review of mock CI, test public GitHub endpoint on Render, obtain separate human approval to merge/deploy, then verify one user-triggered 5-turn request.
