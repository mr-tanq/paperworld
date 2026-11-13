# PAPERWORLD — mission-linked Worker runs and results

## What changes
The Chief of Staff no longer reports an unrelated, latest repository-wide GitHub run as if it were the selected mission.

The `PAPERWORLD Worker — review-only sandbox` GitHub Actions workflow now accepts an optional `mission_id` input and places that UUID in the GitHub run display title. The private Supabase Worker Bridge checks that the requested mission belongs to the authenticated user, is a supported TicketSwap mission, and finds the matching GitHub run by its explicit ID.

After a run completes, the user can choose **View worker result** from the mission card. The server reads the bounded GitHub Actions artifact (currently `paperworld-worker-scope`, later `paperworld-worker-review`) and returns allowed files for read-only display: `scope.json`, `prompt.txt`, `analysis.md`, `audit.json`, `tests.log`, `worker.patch`.

The user sees **only** output associated with that mission ID. Before requesting a report, the user must be signed into PAPERWORLD. Data from an unrelated manual run or another mission will not be shown. An existing untagged historical run will correctly appear as **No tagged run yet**, even if it completed successfully.

## Limits and safety
- Still **prepare-only** from the PAPERWORLD browser. No AI inference, Copilot credits, push, merge or deployment is triggered by this workflow bridge.
- The GitHub token remains in the Supabase Edge Function secrets, not in the public browser.
- Dispatch checks the exact mission ID/status/owner and refuses repeated dispatch within ten minutes.
- GitHub Actions results may take a few seconds to appear. Use **Check this mission** and later **View worker result**.
- GitHub's 204 response confirms dispatch acceptance, **not** job success.
- Artifact reading is size-limited and scoped to an allowlist, with a link to the official GitHub run.
- The run display title provides **tracking**, not a cryptographic execution receipt. A stronger future broker should record dispatch receipt/run IDs in a privileged audited table.
- A run marked `completed / success` still means only that the selected workflow succeeded. If its `worker` job was skipped under `prepare-only`, no AI performed any analysis.
- The backend in this PR is not yet deployed to the production Supabase function. It must be deployed from the committed file **after merge**, alongside the updated GitHub workflow. This avoids incompatible partial rollouts.
- The Copilot Free plan has limited included AI Credits; future actual AI execution needs explicit separate approval and should respect the account's disabled additional AI usage and $0 overage budget.

## Test plan
1. Merge the PR; deploy updated `supabase/functions/worker-bridge/index.ts` to the existing `worker-bridge` function.
2. In PAPERWORLD open **Chief of Staff** → the single `ready for review` TicketSwap mission.
3. Click **Prepare-only in GitHub** once and confirm. It should accept the request.
4. Use **Check this mission**, then **View worker result** once completed.
5. Verify that `scope.json` and `prompt.txt` appear and show only allowed operations. `analysis.md` should not exist in a prepare-only run.
6. Verify unrelated old manual runs are not shown as successes for this mission.

No secrets should be pasted into GitHub issues, PR descriptions or ChatGPT.
