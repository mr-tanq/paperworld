# PAPERWORLD Local Matt HTTP Server — status-only, no AI

This PR adds an actual Node HTTP listener, **not a hosted AI service**.

Run manually in a trusted development environment:
```
node server/matt-http-server.cjs
```
It binds to `127.0.0.1:8787` (loopback only) and exposes:
- `GET /health` → status, explicitly `aiEnabled: false`
- `POST /chat/matt` → **503 ai_not_configured** by default
- Other routes → 404; incorrect method → 405.

It accepts an injected gateway *for test purposes only*. Even then, successful AI results are **never returned**: all success statuses are transformed into `503 ai_not_enabled`. This makes it impossible to use this listener as a real Copilot gateway by merely providing environment variables or dependency injections. There is no SDK import, network login, token storage, or GitHub OAuth.

The listener has bounded body size, request timeouts, no general CORS support and no external bind option. This means it is accessible on the **same device only**, not remotely from the user's tablet; it is not suitable as the ultimate remote server.

## Future real server — separate authorization and approval
- Select a secure reachable backend, with explicit price/hosting approval.
- Implement and test linked GitHub OAuth, one-time budget-approved request claims and safe reply persistence.
- Verify real Supabase RLS isolation for distinct accounts.
- Add proper HTTPS, CORS allowlist, origin checks, anti-CSRF, rate limits, security headers, concurrency and replay protections.
- Review SDK API and pin package version.
- Only THEN propose modifying the status-only behavior to allow one approved actual Copilot answer.

## Offline tests
`node --test tests/matt-http-server.test.cjs`

No paid hosting, external AI, network secrets, deployment or Copilot credits are consumed by this PR. GitHub Actions standard runner minutes are separate from Copilot credits.
