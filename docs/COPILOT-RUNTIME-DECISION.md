# PAPERWORLD — Decision: Copilot Pro conversational runtime

Status: **proposed architecture, NO activation, NO credit use**. This document accompanies PR #41 and does not deploy anything.

## Desired experience
The tablet or PC displays the papercraft village. The user taps **M** for Matt or approaches an agent and taps **T**. Each character gets its own private thread, skills and project scope. Matt can propose handoffs to Directors and Directors to Workers. Proposed work is always distinguished from approved/running/completed work. No claimed actions unless verified by authoritative events.

## Selected AI integration
Use the official GitHub Copilot SDK, authenticated **on behalf of the user's Copilot account** via GitHub OAuth, over a trusted server. Official SDK documentation confirms that user-scoped OAuth sessions can consume the user's Copilot subscription allowance. BYOK is **not** part of this plan. Keep the user's GitHub token off GitHub Pages and out of database messages, browser storage, logs and Actions inputs.

References:
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/backend-services
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/multi-tenancy

## Hosting decision: not settled
The existing static GitHub Pages application cannot run a server-side SDK/CLI. Supabase Edge Functions are used for authorization and database access, **not assumed to support a persistent Copilot CLI process**. We should not assert the SDK runs there without a documented and tested compatible runtime.

For the first private proof of concept, prefer a temporary trusted Node host using the official bundled Copilot SDK; local access from the tablet requires a secure network path and a computer available while chatting. If no suitable existing computer is available, investigate a temporary hosted runtime with explicit monthly price, idle policies and network/privacy restrictions, and get user approval before activation. Do **not** select a pay-per-use host automatically.

## Security architecture
Tablet (GitHub Pages) → existing Supabase authentication → authenticated AI gateway → Copilot SDK session with user-scoped OAuth → validated AI reply → owner-scoped Supabase thread.

The gateway must:
1. Verify the Supabase session/owner for every request, bind the thread to the owner and validate the agent ID.
2. Complete GitHub OAuth without exposing credentials to the browser or any other user. OAuth GitHub identity and Supabase identity must be explicitly and securely linked.
3. Use `mode: "empty"` / explicit tool allowlists. The conversational Matt prototype has **no file/network/tools**, and cannot dispatch Workers. This prevents an innocent chat response from silently acquiring code write rights.
4. Enforce rate limits, bounded input/history and a server-side per-user request budget. External Copilot billing settings (overage disabled) must be verified separately. An app-side request count is **not** a guaranteed credit cap.
5. Keep private prompts and responses out of public repository content, workflow_dispatch inputs, GitHub Actions logs and PR artifacts.
6. Persist only verified replies to private conversations. Record failed/cancelled requests as such, rather than inventing success.
7. Keep all proposed handoffs as inert review objects until explicit per-action approval, with a server authorization check before any job or write.
8. Provide clear account disconnect and conversation deletion/retention controls.

## Work stages
- PR #41: schema + safe client transport **design only**, not deployed.
- Next reviewed change: owner-scoped schema migration, RLS security tests and an authenticated UI backed by actual private threads (no model).
- Runtime prototype: Copilot SDK on a temporary trusted Node process with a test-only endpoint, no tools and one user. Verify subscription identity and real credit usage before allowing any model prompt.
- After cost and security review: integrate gateway into in-world M/T chat, one agent at a time. Then plan delegation/event logging.

## Acceptance checks before first AI call
- Subscription and charge/overage configuration confirmed in GitHub billing UI.
- No unapproved recurring infrastructure charge.
- Server token isolation and Supabase-to-GitHub identity link verified.
- User approves this specific model test and its maximum allowed usage. No automatic retries.
- Privacy review of prompts/logs; request, thread and error IDs remain private.
