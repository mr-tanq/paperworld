# PAPERWORLD — mission-linked Worker runs and results

## What changes
The Chief of Staff no longer reports an unrelated, latest repository-wide GitHub run as if it were the selected mission.

The `PAPERWORLD Worker — review-only sandbox` GitHub Actions workflow now accepts an optional `mission_id` input and places that UUID in the GitHub run display title. The private Supabase Worker Bridge checks that the requested mission belongs to the authenticated user, is a supported TicketSwap mission, and finds the matching GitHub run by its explicit ID.

After a run completes, the user can choose **View worker result** from the mission card. The server reads the bounded GitHub Actions artifact (currently `paperworld-worker-scope`, later `paperworld-worker-review`) and returns allowed files for read-only display: `scope.json`, `prompt.txt`, `analysis.md`, `audit.json`, `tests.log`, `worker.patch`.

The user sees **only** output associated with that mission ID. Before requesting a report, the user must be signed into PAPERWORLD. Data from an unrelated manual run or another mission will not be shown. An existing untagged historical run will correctly appear as **No tagged run yet**, even if it completed successfully.

## Limits and safety
- **Prepare-only** remains the no-AI default. A separate **Run AI investigation** button is available only on an owner-scoped, review-ready TicketSwap mission and requires the user to type `I_APPROVE_INCLUDED_AI_CREDITS` for that single job. It can consume included Copilot Free AI credits. It cannot push, merge, deploy, call paid APIs directly or write to the user's computer.
- The GitHub token remains in the Supabase Edge Function secrets, not in the public browser.
- Dispatch checks the exact mission ID/status/owner and refuses repeated dispatch within ten minutes.
- GitHub Actions results may take a few seconds to appear. Use **Check this mission** and later **View worker result**.
- GitHub's 204 response confirms dispatch acceptance, **not** job success.
- Artifact reading is size-limited and scoped to an allowlist, with a link to the official GitHub run.
- The run display title provides **tracking**, not a cryptographic execution receipt. A stronger future broker should record dispatch receipt/run IDs in a privileged audited table.
- A run marked `completed / success` still means only that the selected workflow succeeded. If its `worker` job was skipped under `prepare-only`, no AI performed any analysis. In `run-ai` mode the Copilot worker analyzes only the temporary checkout and returns artifacts for human review. Its own access to shell/URL tools and GitHub write permission are disabled.
- The backend in this PR is not yet deployed to the production Supabase function. It must be deployed from the committed file **after merge**, alongside the updated GitHub workflow. This avoids incompatible partial rollouts.
- The Copilot Free plan has limited included AI Credits. The workflow selects `claude-haiku-4.5` and `--max-ai-credits=0.50` (a **soft per-response limit, not a hard overall budget**), as well as an 8-minute run timeout. The account screenshots show additional AI usage disabled and an overage budget of $0, but PAPERWORLD **cannot inspect or enforce billing settings** and makes no absolute promise of $0 costs if the account changes. Review GitHub Billing before clicking. AI runs are limited to one per mission per 24 hours. The GitHub Actions environment may itself consume included or billable Actions resources depending on plan and budgets.

## Test plan
1. Merge the PR; deploy updated `supabase/functions/worker-bridge/index.ts` to the existing `worker-bridge` function.
2. In PAPERWORLD open **Chief of Staff** → the single `ready for review` TicketSwap mission.
3. Click **Prepare-only in GitHub** once and confirm. It should accept the request.
4. Use **Check this mission**, then **View worker result** once completed.
5. Verify that `scope.json` and `prompt.txt` appear and show only allowed operations. `analysis.md` should not exist in a prepare-only run.
6. After **separate explicit user approval of AI-credit consumption**, click `Run AI investigation`, type the requested acknowledgement, and inspect the subsequent tagged `run-ai` report. If free credits are unavailable, the run should stop with a GitHub error rather than requesting paid overage.
7. Verify unrelated old manual runs are not shown as successes for this mission.

No secrets should be pasted into GitHub issues, PR descriptions or ChatGPT.
