# PAPERWORLD: Matt Copilot SDK adapter — **inert** prototype

## Goal
The user wants real conversation with Matt from the PAPERWORLD village, not more deterministic keyword panels. This PR lays down **server-only code** that can call GitHub Copilot SDK later; it does NOT wire the tablet or create a hosted AI service. No credits are consumed.

## Scope
- `server/matt-copilot-adapter.cjs`: dependency-injected Copilot SDK request adapter with mandatory **server-side authorization and budget checks before client creation**.
- `tests/matt-copilot-adapter.test.cjs`: mock-only tests for denial, tool isolation, successful response and cleanup. No Copilot package is downloaded or invoked.
- The adapter is never imported by public `index.html` or browser `js/` files. No GitHub API tokens are committed.

## Future gateway prerequisites — **not implemented**
1. Secure hosting choice and explicit spend approval, or a private trusted local machine with accessible connectivity from tablet.
2. Validate Supabase user JWT using Supabase Auth; bind user to their own conversation thread.
3. Securely link GitHub OAuth identity to that verified user, hold OAuth tokens only server-side and prevent replay / cross-user access.
4. Enforce actual per-request approval, request IDs, rate limits and budget. **The injected authorization callback is just an interface; its caller must implement and enforce the checks.** A `budgetConfigured` boolean is not a true monetary cap. Confirm GitHub billing overage restrictions separately.
5. Confirm selected model, entitlement, SDK version and runtime security under official documentation, then perform an **explicitly user-approved** one-question AI trial.
6. Persist actual assistant responses via the trusted server; treat failures as failures. Do not create agent messages from the public browser.
7. Decide retention and delete controls; add audit logging without storing secrets/prompts in publicly readable Actions logs.

## SDK strategy
The Copilot SDK supports `new CopilotClient({ mode: "empty" })` and a session with explicit `availableTools`. This adapter requests `availableTools: []`, so Matt cannot use shell, filesystem, GitHub tools or Workers. No agent autonomy at this stage. Before deployment, verify empty-tool support against the exact pinned SDK release.

Official documentation:
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/backend-services
- https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/multi-tenancy

## Run tests (offline)
`node --test tests/matt-copilot-adapter.test.cjs`

## Next review
Only after these tests and server security design are reviewed should a separate PR propose a real hosting/OAuth gateway. There must be no automatic launch, credits, merge, deployment or new subscriptions without explicit approval.
