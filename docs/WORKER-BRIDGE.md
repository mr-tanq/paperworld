# PAPERWORLD authenticated worker bridge — prepare-only

## Deployment
Supabase Edge Function `worker-bridge` has been deployed to the dedicated PAPERWORLD Supabase project `jrevhzvrgenucuozjowm`. The repository copy is `supabase/functions/worker-bridge/index.ts`.

### What is operational now
1. Signed-in PAPERWORLD users can request status of the latest GitHub Actions Worker workflow from within the Chief of Staff mission list. This is a repository-level run status, **not** a per-mission execution audit.
2. The server verifies session credentials against Supabase Auth and checks ownership and fields of the selected mission using row-level-security-aware PostgREST.
3. The **only permitted dispatch** is `workflow_dispatch` on the PAPERWORLD `main` branch, selecting `prepare-only` with the AI-credit acknowledgement blank.
4. An eligible mission must be owned by the requester, marked `ready_for_review`, in `mr-tanq/concerts`, from Listening Mirror, and TicketSwap-related. The server ignores any client-provided GitHub ref, prompt, repository or execution mode.
5. No AI inference, repository write, code push, or paid API call is possible through this bridge.

### Required external configuration — NOT DONE
The backend requires the secret environment variable `PAPERWORLD_GITHUB_ACTIONS_TOKEN`, which has **not** been installed. Therefore a prepare-only request currently fails safely with HTTP 503 and does not start a workflow.

To connect it after explicit authorization:
- Use GitHub to create a **fine-grained personal access token** restricted to **only** the `mr-tanq/paperworld` repository and **Actions: Read and write**. Prefer an expiration date and revoke when unused. Do not give the token to the website or paste it into chat.
- Add it as a **secret** in Supabase project PAPERWORLD, Edge Functions → Secrets, named `PAPERWORLD_GITHUB_ACTIONS_TOKEN`. It is then available only server-side to deployed Edge Functions.
- In the PAPERWORLD Chief of Staff, choose the existing TicketSwap mission, then `Check worker run` to check status. After the bridge reports connected, use `Prepare-only in GitHub` and confirm explicitly.

A GitHub App with dedicated installation credentials, scoped to Actions dispatch, is preferable long-term. No direct GitHub connector credential is available to the deployed Edge Function automatically.

### Security and limits
- The Edge Function uses `verify_jwt=false` at the gateway **because it performs online Supabase Auth `/auth/v1/user` verification itself on every request** and verifies mission ownership via RLS. The function rejects requests without the required origin and bearer token; it never relies on client user IDs alone.
- If the token is absent, dispatch is rejected. The token is never returned to the browser.
- No `run-ai` mode is exposed. Do not modify this guard without an entirely separate approval and cost review.
- The GitHub workflow's own `prepare-only` operation prepares the mission pack but does not invoke Copilot.
- The latest-run status is *not* reliably bound to the selected mission. A future version should record a dispatch ID and correlate runs/artifacts server-side, add idempotency, audit logs and explicit consent records.
- A dedicated short-lived GitHub App token and a full two-user RLS regression test remain future hardening work.
- Supabase Edge Functions may use plan-included or billable platform resources depending on the user's usage; no claim of an unlimited free service is made.

## Status
Backend deployed with safe credential-missing fallback. Client UI is in a PR until merged. **No workflow has been dispatched by the Edge Function yet**.
