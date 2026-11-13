# PAPERWORLD — first executable AI Developer Worker (sandbox mode)

**Status:** runner implemented on a branch; **not enabled or run**. GitHub Actions is a potential execution environment. An AI-provider cost check and explicit consent are required **before running inference**.

## What runs
The manual workflow `.github/workflows/worker-review.yml` has two modes:

- `prepare-only`: builds a task prompt and allowlist, then produces a short downloadable artifact. It makes **no AI inference requests** and performs no writes to other repositories.
- `run-ai`: **only after a separate explicit credit acknowledgement**. Uses GitHub Copilot CLI with the ephemeral GitHub Actions `GITHUB_TOKEN` to work inside a disposable checkout of the public repository `mr-tanq/concerts`.

The first mission is **TicketSwap diagnostics**. The worker can read the target repo and edit *only a temporary copy* of listed files. Its available CLI tools are limited to local file viewing/searching/editing (`view`, `grep`, `glob`, `edit`, `create`, `apply_patch`). The approval patterns `read` and `write` govern permissions; shell, URL and memory access are denied. The workflow token is **contents:read** plus `copilot-requests:write`. No git push, issue creation, PR, merge, deployment or publish step exists. After inference, a controller validates the modified file paths and produces `worker.patch`, `analysis.md`, `audit.json` and offline test output in a seven-day GitHub Actions artifact for human review.

The controller refuses unexpected modified files. This is an additional policy guard, not proof that third-party model output is always safe. Existing code and repository content are untrusted input to the AI. Keep output under human review.

## Cost warning — important
GitHub's current docs say Copilot CLI uses **GitHub AI credits** and, for a workflow in a personally owned GitHub repo authenticated using `GITHUB_TOKEN`, credits are billed against the repository owner's Copilot seat. Charges may occur if included allowance is exceeded and overage is permitted. **A job timeout is not a monetary budget.** Neither this code nor PAPERWORLD can currently read or enforce your account's GitHub billing limit. Check your actual Copilot access, included credits and GitHub Billing > Budgets and alerts; disable paid overage or set a hard-stop budget where supported.

Do **not** select `run-ai` until usage, availability, and possible spending are reviewed and the user explicitly authorizes a test. Creating or merging this PR does **not** start the worker. The workflow has no automatic triggers or cron schedule.

Sources:
- https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/copilot-cli-in-github-actions
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference
- https://docs.github.com/en/billing/how-tos/set-up-budgets

## Future PAPERWORLD integration
This workflow proves out a bounded AI engine. At present it is **NOT** triggered by a PAPERWORLD cloud mission and cannot write an analysis report to Supabase. The next work is an authenticated, server-side, owner-verified broker that accepts only an exact pending mission, verifies an explicit one-shot credit approval, dispatches the GitHub workflow, and records workflow status and artifact links. Do not put GitHub tokens or service-role keys in the public web app.

The TicketSwap task in Supabase remains a **review-only planning record**. The worker is not executing it merely because its status is `ready_for_review`. Current PAPERWORLD agent autonomy is therefore **not complete**.

## Offline acceptance
- `node --test scripts/worker/worker.test.mjs` — tests scope preparation, patch capture and forbidden-path rejection without network or AI credits.
- Review the GitHub Actions workflow manually.
- If costs are explicitly approved, use GitHub Actions > PAPERWORLD Worker — review-only sandbox > Run workflow with mode `run-ai` and type the required acknowledgement.
- Inspect the report and diff artifact **before** allowing any remote repository changes in a separate, future approval workflow.
