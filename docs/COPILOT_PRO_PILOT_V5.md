# Paperworld V5 — first Copilot Pro unattended pilot

**Status: installed but DISABLED by default.** This guide contains no credentials.

## Verified background components

- The shared Dispatch v1 database and five-minute supervisor are live.
- A second gated five-minute cron job, `paperworld-v5-copilot-edge`, wakes the Copilot dispatcher **only if** `dispatch_enabled=true`, the Copilot adapter is on the allowlist, eligible work exists, and a trigger credential is present in Supabase Vault.
- The `paperworld-copilot-dispatch` Edge Function is deployed. With missing configuration it rejects every request and does not call GitHub.
- Only `mr-tanq/pokemon-echoes` issue **#1** can be queued by `paperworld_v5_queue_copilot_pilot`. A future Luna worker will require a separately reviewed live policy.
- The paid GitHub assignment comes **after** `paperworld_v5_begin_effect` atomically reserves an included-credit session. The issue is pre-marked with an effect key, avoiding a second issue.
- If an assignment response is missing or uncertain, the mission stops as `needs_you` and the effect stays uncertain; it is **never retried blindly**.
- PR discovery is real GitHub polling, but finding a PR is not a verification. The PR and its link are saved as **unverified**, with the mission at `needs_you` until independent Godot tests and review.

## Preparations completed in Pokémon Echoes

Private repository `mr-tanq/pokemon-echoes` has already merged a pinned Godot 4.7.2 setup and a trusted headless smoke/verification workflow. The first one-session agent brief is prepared in issue #1 and is intentionally not assigned.

## Owner-only connection steps — do not share secrets in chat

1. Confirm at GitHub Billing that extra usage is $0, check included AI credits used, and cloud agent is enabled. **Account AI credits can still be depleted even with $0 extra charges.**
2. Create a **fine-grained user PAT** (30 days) limited to only `mr-tanq/pokemon-echoes`: Metadata read; Actions, Contents, Issues, Pull requests read/write. Use a user token (not a GitHub App installation token).
3. Save the PAT as `GITHUB_COPILOT_USER_TOKEN` in Supabase **Edge Function secrets**. Never commit or send it in a chat.
4. Create an unrelated random trigger secret of at least 32 characters. Save it as `PAPERWORLD_DISPATCH_TRIGGER_SECRET` in Supabase Edge Function secrets and store the exact same value in **Supabase Vault** under `paperworld_v5_dispatch_trigger`. Never print it in logs or SQL results.
5. Verify that the backend can authenticate to GitHub and that the correct bot is assignable **before** turning on dispatch.
6. Only then record the *credits USED* (not remaining), UTC time of that observation, and enable the one-project adapter on the controller row. Keep daily sessions=1, monthly sessions<=10, mission sessions=1 and `credit_stop_at=1050`.
7. In Paperworld's Work Hub, create a Pokémon mission, review its pilot consent and start the single approved Issue #1 task. Then close the browser. Copilot works in GitHub's environment.
8. When a real Draft PR appears, run `paperworld-verify.yml` against its immutable head SHA. **No automatic merge or deploy.** Only a separate green verification may justify marking the overall mission completed.

Current SQL defaults deliberately remain:
```text
dispatch_enabled = false
live_adapters = []
credit_snapshot = NULL
sessions_per_day = 1
sessions_per_mission = 1
```

Never set them to live without checking actual private billing and credentials. An unclear provider response is a blocking state requiring investigation, not permission to retry.

## Still not implemented

- An automatic no-secrets independent verification + completion handshake for Copilot PRs (the manual trusted workflow exists).
- Durable refresh-token authentication beyond a 30-day pilot PAT.
- Real Luna/Crow creative or coding sessions and a privacy-isolated Dave Worker.
- Budget-aware AI planning for autonomous multi-step goals.

Do not present an installed timer, enabled Edge Function, or dry run as a fully autonomous tested AI village.
