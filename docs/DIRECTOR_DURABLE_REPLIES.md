# Director Memory v3 — Durable private AI replies (review branch)

## Goal
All four Directors should be able to continue a conversation across a server restart, not simply display a transient model response. This change builds directly on the read-only private transcript recall PR #126.

## Implementation
- Server persists an actual successful one-turn Copilot reply to the **existing** protected Supabase `paperworld_agent_messages` table.
- Every save reauthenticates the owner and exact Director/thread ownership, then inserts `role=agent` using the server-held Supabase secret (never browser or agent prompt).
- `id=requestId` is a unique primary key: duplicate attempts fail rather than creating duplicate reply records.
- Calls do not persist fabricated text, cost extra model turns, grant file access, or alter the model's permitted tools.
- The response returns truthful `persisted` and `persistedExcerpt` flags.
- The UI reconciles persisted replies by exact ID while retaining an unsaved reply in the local view.

## Limitations and privacy
- The existing deployed schema only permits 2,000 characters per message. A longer response is still shown in full initially, but **only the first 2,000 characters are durable**; the API exposes `persistedExcerpt:true` rather than implying full long-term recall. A later reviewed schema update can safely support long texts.
- No new Supabase schema, external conversation import, historical ChatGPT browsing, secrets in public files, autonomous approval, new model calls, or deployment.
- This PR is stacked on the read-only recall branch from PR #126. Do not merge into main before its prerequisite is merged and security tests are reviewed.
- Prior replies made before this change are not retroactively saved if they do not already exist in Supabase.
- The protected health history and unreleased lyrics belong only in privately stored, project-isolated records, never this public GitHub documentation.
- Real integration requires independently verifying correct service credentials, auth policy and cross-user isolation; offline mocks are not proof of production security.

## Checklist
1. CI and security tests green.
2. Confirm PR #126 merged first.
3. Check Render secret availability without printing or logging credentials.
4. After explicit deployment approval, verify one Director reply survives refresh/restart and other Directors cannot read the thread.
5. Add full-response persistence and private source history ingestion in later reviewed PRs.
