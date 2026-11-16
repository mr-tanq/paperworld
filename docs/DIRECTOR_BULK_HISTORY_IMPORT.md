# Director History Bulk Import — human-reviewed suggestions

## Goal
The owner wants Luna, Joey, Crow and Dave to build rich project memories from many actual ChatGPT conversations without manually selecting and importing each chat separately.

## Implementation
- Local-only deterministic suggestions scan each conversation's title and a limited sample of **user** text. Never send the archive to a classifier API, model, GitHub Action or telemetry.
- Suggested Director assignments use high-confidence project phrases. Missing or mixed-project evidence remains unassigned, especially when wellbeing/health content competes with creative studio material.
- All selections start **unchecked**. The owner may individually choose conversations and change each Director. A voluntary "select clear suggestions" control applies only to the currently visible page.
- Show historical title, message count, suggested Director, reason and local user-text preview before any upload.
- Max 15 conversations and 30 history chunks per confirmed batch. If any selected conversation exceeds the batch limit, abort the batch rather than silently omit sections; the original single-conversation import remains available.
- The confirmation previews the exact conversation title, target Director and part count. Only after approval does the existing owner-authenticated Supabase adapter upload bounded `status=proposed`, `sensitivity=private` source-linked excerpts.
- The owner JWT and Supabase RLS remain the only client write authority; only the existing explicit owner review flow can later activate these memories.
- Duplicate checks now look for a source reference across **all** the owner's Director projects. If already assigned to a different project, fail rather than silently duplicate private material in a second Director.

## Privacy / correctness boundaries
- All data stays in the user's browser until the user confirms. No automatic transfer, no new AI calls, no additional model credits or background jobs.
- Keyword suggestions are fallible and do not prove a conversation is exclusively about the suggested project. Mixed-topic chats must be manually reviewed; the owner can choose to skip them.
- No source-code repositories are modified by agents, and no new private data is committed to this public repo.
- Historical assistant outputs remain unverified data, not instructions or present-day work status.
- Existing imported-memory prompt bound (6,000 characters), 400 approved-record search cap and 100-record owner-review screen limit remain. These require separate archive/index design for comprehensive long-history use.
- Source-ref duplicate check prevents sequential duplicate imports, but is not an atomic uniqueness constraint under concurrent tabs. Future schema changes may add unique(owner_id, source_ref) with a migration review.
- Actual source archive files are **not** available to this GitHub PR and have not been imported automatically.

## Release checklist
1. Node test suite and two-identity RLS tests green.
2. Manually inspect classifier precision on sanitized mixed-project exports; verify accents and safe abstention.
3. Verify browser import selection stays unchecked by default and no requests occur before confirmation.
4. Confirm erroneous cross-project reimport is blocked, cancellation writes nothing and partial writes report honestly.
5. Review PR and deployment authorization separately.
