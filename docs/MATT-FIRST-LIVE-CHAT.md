# PAPERWORLD — First real Matt conversation (proposed, not deployed)

## Human goal
Open PAPERWORLD on Android tablet, tap M, type an arbitrary request (not a scripted TicketSwap example) and read a real Copilot reply inside the existing dark Messenger.

## Data flow
Browser PAPERWORLD Cloud authenticated Supabase user -> private Matt thread (existing RLS) -> explicit one-turn Copilot consent in Messenger -> HTTPS Render POST /chat/matt with a unique request UUID -> server rechecks Supabase JWT and Matt thread ownership -> server looks up **that user's** OAuth-linked GitHub token (never sent to browser) -> uses pinned @github/copilot-sdk 1.0.33 in an isolated client with useLoggedInUser:false -> reads available models and GitHub Copilot account quota -> selects at most 1.0 premium-request multiplier and refuses calls without confirmed quota buffer (zero multiplier preferred) -> one fresh Copilot session with ALL TOOLS denied -> returns real model reply to Messenger.

- Browser persists user message to their private Supabase thread; AI replies are **temporarily visible in the open Messenger only** and the server retains a bounded short conversation during its uptime. Permanent AI-response storage is not yet implemented, so reloading the page loses replies. Do not imply otherwise.
- Render Free restarts wipe in-memory OAuth token and chat context, requiring re-authorization. This prevents a promise that a previously linked account stays linked forever.
- The SDK might not fit the 512 MB Free service or require a runtime CLI binary; this has NOT been live-tested. If it fails, expose an honest error rather than simulate a reply.
- Any quota/model lookup ambiguity fails closed; the implementation will NOT silently try an unspecified paid model.
- We still need to confirm that GitHub's paid overages are disabled in the owner's GitHub Copilot billing settings. Quota is a preventive check, not a payment guarantee.

## Scope
- Changes in this PR: the server endpoint, OAuth token retrieval by owner, SDK dependency and Render build command, browser API, one explicit consent step per sent message, live model replies, short conversational context and offline security tests.
- No tools / shell / filesystem writes / connector actions / autonomous delegation. The assistant may *propose* Director assignments but cannot claim an assignment executed.
- No new service or GitHub Copilot usage from CI. No previous messages have been sent to models from this PR.

## Release checklist: NOT AUTOMATIC
1. Offline CI green, code review, test on Android portrait and landscape.
2. Independently verify Copilot Pro allowance and **disable paid overages** on GitHub. No paid model or unbounded usage.
3. Explicit human approval to merge the PR and to apply Render Blueprint changes. The current Render service's build command is the old echo command; changing render.yaml in GitHub by itself does **not** install the SDK because autoSync is off. After merge, plan/apply Render Blueprint, review Free plan, then manual deploy.
4. Verify /health, /chat/matt denial without auth, check /auth/github/status. Re-link GitHub if the Free server restarted.
5. Approve ONE explicit Copilot turn inside the app and verify a genuine answer plus model usage; inspect Render logs without logging content or credentials.
6. Then persist assistant replies securely and add real Director/Worker delegation with separate action approvals.

Official references:
https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate
https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing
https://www.npmjs.com/package/@github/copilot-sdk
