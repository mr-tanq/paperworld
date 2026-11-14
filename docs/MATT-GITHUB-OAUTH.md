# PAPERWORLD: real GitHub OAuth for the Matt server

This PR establishes **real GitHub account linking**, using GitHub's authorization-code OAuth flow and existing PAPERWORLD Supabase user identity. It does **not** enable an AI conversation or spend Copilot credits.

## Render endpoints
- POST `/auth/github/start` — a PAPERWORLD user with a valid Supabase JWT and correct GitHub Pages origin gets a GitHub authorization URL. The server stores a random, one-time 10-minute state bound to their Supabase owner ID.
- GET `/auth/github/callback?code=...&state=...` — the **server** exchanges the GitHub code using an OAuth App client secret from Render's private environment, checks the GitHub user, and stores the access token **in memory only**, never in a browser response or redirect URL. Replays, expired state and bad codes fail.
- POST `/auth/github/status` — the authenticated owner gets only `{connected,login,ephemeral}`. No token or GitHub identity is returned to other owners.
- GET `/health` — public availability check; `aiEnabled:false`.
- POST `/chat/matt` — still HTTP 503; **Copilot remains OFF**.

Security: exact GitHub Pages origin CORS, short-lived random state, server-side GitHub client secret, Supabase account binding and token non-disclosure. No GitHub token ever goes to GitHub Pages or Supabase public tables. Server secrets are never added to GitHub.

**Limitation of free tier:** the server's in-memory OAuth state and tokens vanish whenever Render idles/restarts. This is intentionally a low-cost proof of account linking; the user may need to re-authorize. We will implement encrypted server-side persistent storage only after a separate security review. If the service restarts during OAuth, the authorization fails closed.

## Required manual GitHub setup (after PR review; user controls GitHub account)

Create an OAuth App at https://github.com/settings/developers → OAuth Apps → New OAuth App.

- Application name: `PAPERWORLD Matt`
- Homepage URL: `https://mr-tanq.github.io/paperworld/`
- Authorization callback URL: `https://paperworld-matt-test-6hmd.onrender.com/auth/github/callback`

Then copy the **Client ID** and **Client Secret** directly into Render → `paperworld-matt-test-6hmd` → Environment as:
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

**Never paste the secret or access tokens into this chat, GitHub issues, a PR, screenshots, or a browser application.** The GitHub OAuth App is user-owned and authorized by the user. The backend will report `oauth_not_configured` until both values exist.

After a separate user-reviewed merge and explicitly approved **manual** Render deploy, sign into PAPERWORLD Cloud, open Work Desk → Matt → **Σύνδεσε το GitHub**. Authorize the GitHub app, return to PAPERWORLD, then click **Έλεγχος σύνδεσης GitHub**.

## Before ANY real AI usage

1. Confirm the owner-linked GitHub account has an active Copilot subscription and verify included premium requests / overage disablement on GitHub. A subscription is not a blanket unlimited credit authorization.
2. Verify a pinned Copilot SDK dependency and an actual server runtime compatible with Render's Node version and memory limits.
3. Implement a secure, one-time, server-verifiable AI approval flow. The existing private ledger is not automatically an issuance mechanism.
4. Wire the secure gateway to per-user tokens and private thread ownership with no host-account fallback; add live isolated tests and idempotent persistence.
5. Ask for explicit approval of the first real AI request separately. No worker tools or automatic file edits initially.

Official references:
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate
