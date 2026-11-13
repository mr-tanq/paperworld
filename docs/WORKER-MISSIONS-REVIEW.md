# PAPERWORLD — Human-reviewed Worker Missions

This delivers a persistent **mission planning and human review** layer, not an executing AI system.

## Verified live database
A new `public.paperworld_missions` table was created in dedicated PAPERWORLD Supabase project `jrevhzvrgenucuozjowm`. Owner-scoped RLS is active; `anon` cannot read or create mission drafts. The `authenticated` browser role can manage only its own missions. Statuses are `draft`, `ready_for_review`, and `cancelled`.

**Ready for review is NOT approval to run code, deploy, or spend.** The table has no runner, token, external service or privileged action broker. No agent consumes these records.

## UI
In the Chief of Staff desk, the human can click **Prepare worker mission** for a PAPERWORLD or Listening Mirror task. This saves a structured planning brief to Supabase, explicitly naming the repository and limiting activity to analysis. Under **Worker mission drafts**, the user may read/copy the brief, mark it ready for their review or cancel it. None of these actions starts a worker or touches GitHub.

## First grounded mission: TicketSwap
For TicketSwap-related Listening Mirror tasks, the handoff references these confirmed real code paths in `mr-tanq/concerts`:
- `js/concert-ticketswap.js`
- `js/ticketswap-check.js`
- `scripts/lib/ticketswap-matching.mjs`
- `scripts/lib/ticketswap-going.mjs`
- `scripts/test-ticketswap.mjs`

The scope is to reproduce the reported failing check, distinguish matching/no tickets/network errors, and propose regression tests and a fix. No claim is made that the root cause has been found.

## Future work (requires distinct approval)
1. Build an isolated trusted worker broker / queue using short-lived limited GitHub credentials, fixed repository allowlist, immutable action fingerprints, and audit logs.
2. Add a one-time human approval for each exact operation, independent of the browser-editable mission status.
3. Implement a permissioned AI agent sandbox with no paid APIs unless explicitly approved; record costs and include a kill switch.
4. Run test-only analysis first. Publish a draft PR only with explicit human approval.
5. Validate account-scoped policy with two different authenticated identities, not merely by reading RLS definitions.

## Constraints
No GitHub repository besides `mr-tanq/paperworld` has been written by this feature. Existing cloud tasks and localStorage are preserved.
