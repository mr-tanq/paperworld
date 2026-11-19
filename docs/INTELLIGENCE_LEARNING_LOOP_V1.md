# Paperworld Intelligence & Autonomy — Learning Loop V1

## Goal
Matt and the registered Directors should improve from real owner corrections without silently training themselves on inaccurate or unapproved model output. Reuse the **existing** private, owner-scoped Director Memory, its statuses, project boundaries and approval workflow; never create a second memory database.

## What this first PR actually delivers
- Pure server-side helper `ownerCorrectionProposal` converting an explicitly confirmed correction into a standard existing `proposed` Director-memory entry.
- Source reference derived from trusted thread and message IDs; project always derived from the registered Director, never free-text labels.
- Private-by-default sensitivity, no tool rights, and no auto-approval.
- Offline regression tests for scope, lifecycle, misuse and invalid inputs.

This helper is **not connected to live chat**, does not save proposals, and does not use a model. `ownerConfirmed` is a caller contract, **not proof of owner identity**: a later authenticated server integration must verify real owner/session, ownership of conversation, and original human message before invoking it.

## Next connection to the real Messenger
1. Use existing verified owner identity and trusted message storage; only collect corrections to a previous answer when the owner intentionally confirms the correction. Do **not** infer permanent preferences from every chat message.
2. Associate the correction with the *specific* Director response, source message and project. Route through the existing private `director-memory-store` proposal path with server-established owner ID. Do not put sensitive text in GitHub.
3. Present a short human-first review to the owner (e.g., “Να θυμάται αυτό η Luna;”) using the existing reviewed approval UI. No automatic approval, no blanket grant of tools or credits.
4. On owner approval, use the existing verified approved-only memory context for that Director. The chief of staff only receives non-private, scope-limited snippets after an authenticated handoff.
5. Support explicit correction/rejection/supersession with audit and regression tests. Do not overwrite old decisions silently, and do not propagate private Wellbeing notes across projects.
6. Verify owner/cross-owner access, multiple simultaneous corrections and replay/duplicate protection before deployment.

## Separate roadmap after Learning Loop
- Share bounded, approved, non-private project context with the Copilot Worker under a verified task grant.
- Implement budgeted routine jobs via the existing V5 task engine and immutable evidence, not a second scheduler.
- Add weekly health checks, Android notifications and cost-aware model routing with explicit ceilings.

**No Suno code is changed or discussed as part of this workstream.**
