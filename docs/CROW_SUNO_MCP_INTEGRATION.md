# Crow → Suno MCP: verified integration contract (2026-11-16)

## Goal
In PAPERWORLD, the human tells Matt in ordinary language to have Crow make a finished song. Matt routes to **Crow (studio-director)** based on model judgment; Crow prepares a private production brief; the owner explicitly approves a precise generation request; the trusted server submits it to Suno MCP; an actual Suno track reference is returned to the owner and saved in their Suno Library.

## Verified public Suno facts
- Official Suno MCP beta release: 2026-10-28. Docs: https://suno.com/mcp and https://help.suno.com/en/articles/14551361
- Endpoint: `https://api.suno.com/mcp`; OAuth-style Suno sign-in and authorization in a supported MCP client, **no Suno API key**.
- Available on Free and paid Suno plans; creation consumes **existing Suno credits**. Tracks land in Suno Library. Covers, extends, mashups, speech, audio upload and credit inquiries are described. The beta may require early-access enablement.
- The PAPERWORLD web app (GitHub Pages frontend + Render Node backend + Supabase owner identity + Copilot SDK) is **not** itself confirmed to be a supported Suno MCP client; it needs a separately verified MCP client transport and account authorization. An MCP URL is not a drop-in REST song-generation endpoint.

## Current code reality
- `server/matt-live-chat.cjs` uses Copilot in `mode:'empty'` with no tools. Do **not** attach Suno tools to this general-purpose chat session.
- Matt and Director turns use account-level zero-additional-usage controls and owner-initiated confirmations.
- Existing director mapping: `studio-director` = Crow; avoid keyword-specific rules for Matt. Production should use an explicit, schema-checked tool operation only after Crow's AI-generated proposal.
- Private history, health data, and unreleased lyrics must never enter GitHub files or third-party music services without owner selection. Only the actual approved production brief/lyrics are passed to Suno.

## Required stages (fail closed)
1. **Propose only:** Matt routes to Crow. Crow drafts title, original lyrics (if appropriate), style, vocals, generation type, input-audio references and estimated credit cost if the provider supplies it. No external Suno call.
2. **Capability check:** authenticated backend checks whether Suno access is enrolled/connected, scopes and credits via official MCP. No fabricated availability, price or account state. Unsupported beta/transport returns `suno_unavailable`.
3. **Human approval:** owner sees a readable private preview, Suno credit impact or an explicit 'cost unknown' warning, and a one-time **Generate** action. Never silently create song variants. Unknown cost blocks execution until owner acknowledges unknown credit consumption explicitly.
4. **Execute:** only the authenticated server performs the approved, typed request with owner-scoped OAuth; the user's identity and consent must match. Prevent replay (requestId), cap concurrency, constrain song count and response size, redact tokens and private lyrics from logs; do not store Suno tokens in GitHub, browser bundles or public tables.
5. **Verify:** return only actual provider track IDs/URLs and lifecycle states; poll/read status only when API semantics and authorization permit. Persist job ID/status and tracks privately with RLS owner checks. A successfully submitted job is not labelled 'finished song' until actual track availability is confirmed.
6. **Review:** Crow reports available versions to Matt and the owner. Follow-up `extend`, `cover`, or `regenerate` is a **new credit-consuming action**, requiring fresh owner approval.

## Integration boundaries
- UI remains an ordinary Matt Messenger; no development-console jargon in the everyday flow.
- Suno adapter is an isolated *trusted backend* module, not a browser direct fetch. Do not assume an OAuth token from ChatGPT/Claude is accessible in PAPERWORLD; a separate account authorization may be necessary.
- Dedicated permission scope for Crow music generation, no file system, repo writes, deployment, email or unrestricted MCP tools.
- Store approved production details and audit events separately from sensitive Director memories; only approved private project data crosses service boundaries.
- On OAuth loss/Render sleep, explain reconnection; no hidden retries creating duplicate songs.
- No external charge/subscription/API key. The owner's Suno credits **are a spend**, so consent is compulsory.

## Acceptance tests before a live rollout
- Fake MCP server: preview does not call `create`, consent triggers at most one `create`; second same requestId does not create again.
- Cross-owner and unauthenticated requests fail; invalid agent/operation and unauthorized audio IDs fail.
- Declined, expired, already-used and cost-unknown consent cannot execute; no other tools exposed.
- MCP errors/timeouts are accurately represented, tokens and unreleased lyrics absent from logs.
- Track only shown as ready after provider confirms; redirect/link domain validated.
- Existing Matt/Crow chat, routing, private memory and zero-overage tests still pass.
- Only after the owner connects Suno, beta access and transport are verified, and a test mode is explicitly authorized: test **one** generation with owner consent.

## State of this PR
This is an **implementation blueprint and guardrail document**, not a working integration, not a verified Suno account connection, and not an executed Suno generation. Do not merge/deploy or describe it as complete. Implement adapter, UI and offline tests in follow-up commits once MCP transport/oauth semantics and existing agent pathway have been inspected. No credits spent.
