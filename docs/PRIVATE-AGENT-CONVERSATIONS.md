# PAPERWORLD — Private Agent Conversations (proposed schema)

## Why this is needed
PR #39/#40 provide device-local Matt chat and an in-world conversation UI. This is not cross-device memory and Directors cannot speak. Before adding a real model, store user conversations separately from task or mission records under strict owner-scoped RLS.

## Deliverables
- `supabase/conversation-schema.proposed.sql`: **review-only SQL**, NOT a deployed migration, for threads per agent and human/agent messages.
- `js/agent-conversation-store.js`: transport-agnostic, authenticated REST adapter that can list threads, create a thread and send a **human** message. It cannot create agent replies.
- `tests/agent-conversation-store.test.cjs`: offline tests of privacy and messaging invariants.

## Security boundary
Client uses the user's existing Supabase auth token, never service_role. Owner is supplied by `auth.uid()` inside PostgreSQL, never by the browser. Messages link to threads via a composite FK that includes owner_id. RLS restricts read/insert to the owner, and authenticated clients can insert only `role='human'`; trusted server services must validate identity and thread ownership before creating `role='agent'` replies. Do not expose secret credentials to GitHub Pages.

**Do not deploy this SQL yet.** Review RLS, grants and schema with Supabase advisors, then use a migration workflow and exercise cross-user isolation tests in a safe environment.

## Copilot Pro integration decision
Official GitHub Copilot CLI supports non-interactive execution in GitHub Actions; the Copilot SDK controls a CLI runtime, normally a process on a running server. Our public static GitHub Pages site cannot safely host that process or authenticate arbitrary browser requests to Copilot.

A secure persistent AI gateway requires a suitable runtime, verified billing/credit limits, user-scoped request authorization and a privacy review. Do not route personal chat prompts into public workflow_dispatch inputs, Action logs or a public repository. Never assume Copilot subscription credits are equivalent to an external API budget. No live AI calls or paid services are enabled in this PR.

## Next
1. Review schema and permissions; create a proper migration after approval.
2. Connect existing signed-in conversation UI to private Supabase threads, with explicitly reviewed local transcript migration and deletion controls.
3. Choose and verify a supported server-side Copilot runtime or alternative with known cost before first inference.
4. Add model reply handling and per-agent memory only after an authenticated gateway and explicit budget gate are implemented.
