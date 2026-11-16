# Director Memory — one-confirmation owner batch review

## Goal
The owner explicitly requested detailed memory for all four Directors, including private wellbeing and unreleased creative notes, without repeating per-record approvals.

## Implemented in this PR
- Work Desk Director Memory panel adds one batch approval control for the **currently selected project only**.
- The signed-in owner sees every selected title, provenance and sensitivity flag, then confirms once.
- Every record remains owner-authenticated using the existing `reviewDirectorMemory` client; the database's status-only RLS policy and per-record append-only audit triggers remain authoritative.
- Each item is re-read and matched to its frozen confirmed snapshot (identity, status, project, title, body, source, observed date, version, sensitivity) before attempting approval.
- Stop immediately on changed content, unauthorized response, or failed write. Display the actual applied count and refresh persisted state.
- No server credential added to browser, no agent/model access to owner tokens or approval endpoints, no auto-approval triggered by AI.
- Existing individual approve/reject is retained for corrections.

## Known limitations
- This is a **one-confirmation user action**, not unattended agent authority. It reduces approval friction while retaining deliberate activation of private information. Does not grant future continuous ingestion permission.
- Existing 100-row project view cap still applies to the batch; no background all-project approval.
- Concurrent edits between re-read and PATCH remain possible. Current status/version/source are verified just before the write, but the existing PATCH guards only entry ID, project and status; a later reviewed RPC with atomic fingerprint compare would eliminate this race.
- One row can commit before a later failure; partial batches are not atomic. All applied decisions remain visible and individually audit logged.
- These are existing proposals and summaries, not a complete export of historical chats. Never claim access to unretrieved full lyrics or every older ChatGPT conversation.
- Private wellbeing/creative material may be sent in a user-consented GitHub Copilot turn after activation; owner should review provider data handling before doing so.

## Release checklist
- Automated tests including fail-closed and RLS simulation.
- Confirm production DB status-only RLS and two real-user identity isolation before deployment.
- Confirm actual authenticated batch review in browser with synthetic, non-sensitive rows first.
- User approval remains required for merge/deploy. No code writes to Listening Mirror or Pokémon repos are allowed by this feature.
