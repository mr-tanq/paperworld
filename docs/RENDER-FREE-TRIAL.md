# PAPERWORLD — Render Free trial (hosting only, AI OFF)

The owner approved preparing Render Free as the first potential reachable Node runtime for Matt. This PR adds ONLY a public, status-only Node server and an opt-in Render Blueprint.

## Why this is a safe initial deploy
- `render.yaml` explicitly requests `plan: free`, Frankfurt region, `autoDeployTrigger: 'off'`, and no database.
- Render receives only a public GitHub repo and no secrets or credentials.
- `/health` returns an explicit `aiEnabled:false`; `/chat/matt` always returns HTTP 503.
- No OAuth callback, no actual Copilot SDK, no worker tools, no Supabase queries, no third-party packages. `/auth/github/callback` is 404.
- The static PAPERWORLD tablet app remains unchanged and cannot send prompts to this service.
- Node 22 is used for offline tests; inspect the Node version available in the Render service before any SDK integration.
- This service is public and cannot be treated as a secure user API. It is a hosting smoke test ONLY.

## Render Free billing safeguards (verified 14 Nov 2026)
Docs: https://render.com/docs/free and https://render.com/docs/faq
- Free compute = $0/month, 750 shared instance-hours/month, idle shutdown after 15 minutes; cold start may take about one minute.
- Web service free-tier memory is 512 MB.
- Outbound bandwidth and build minutes have separate included limits.
- With a payment method saved, overages can generate charges. **For this experiment do not add a payment method.** Without one, Render suspends free services/pauses builds when included limits are exceeded.
- Do not upgrade from Free, enable paid addons, add a paid database, or turn on auto-deploys.
- Render's terms and free capacity may change; review dashboard pricing before clicking Create.
- No service has actually been provisioned from this PR.

## Manual user action after reviewing and merging this PR
1. Open https://dashboard.render.com/ and sign in.
2. Confirm no payment method is stored for the experimental workspace and the workspace is on a no-charge tier.
3. Choose New > Blueprint and link `mr-tanq/paperworld`; select `render.yaml`. Confirm the proposed service is `paperworld-matt-test`, plan **Free**, no other resources and Auto Deploy **Off**.
4. Review the summary for any nonzero amount before clicking Apply. Do not proceed if it shows charges or asks for a payment card.
5. Open the assigned `https://...onrender.com/health` URL and confirm `aiEnabled:false`. Share **only this public health URL**, never credentials or tokens.
6. The `/chat/matt` endpoint intentionally responds 503. If it does anything else, stop and investigate.

## After hosting check
Implement protected GitHub OAuth start/callback with state + PKCE/CSRF + Supabase owner binding and server-only token storage; verify GitHub Copilot subscription / overage controls and an explicit one-request approval. Then integrate a genuine Copilot SDK response through the secure gateway and private message store, subject to separate consent and smoke tests.

Official SDK OAuth guidance: https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth

No unattended deployment, no merge, no credits, no false claim of real AI at this milestone.
