# PAPERWORLD — Cloud foundation, staged and disabled

## Current state
The live PAPERWORLD still stores manually created project tasks only in the current browser. No accounts, automatic sync, active agents or cloud writes.

Connected Supabase currently contains projects for other uses. **None is named PAPERWORLD.** Do not deploy this schema to those databases or create a new project without an explicit owner decision and cost confirmation.

## Included in this PR
- `supabase/paperworld_schema_draft.sql` creates `paperworld_tasks`, owner-scoped tasks with strict room/status/title/notes validation.
- RLS policies for authenticated users restrict SELECT, INSERT, UPDATE and DELETE to `owner_id = auth.uid()`.
- Anonymous Data API access is revoked.
- `paperworld_approval_requests` is read-only to authenticated clients with owner-scoped RLS; browser writes deliberately blocked.
- No service keys, payment credentials, GitHub tokens or integrations included.

## Required before activation
1. Confirm that a dedicated Supabase project can be provisioned **without new charges**. Ask the owner to review project price and available free quota; never create a project automatically.
2. Apply this schema **only** to that isolated project after a security review.
3. Configure passwordless user login with appropriate redirect allowlist; do not embed elevated API credentials in a public GitHub Pages page.
4. Implement explicit local backup → cloud import, show a preview/count, and require the owner's confirmation before copying local tasks. Preserve local backups and deduplicate safely by stable IDs.
5. Test RLS under two separate test users: A sees/edits A's rows, B sees/edits B's; anonymous requests see none. Verify attempts to change `owner_id` fail. Test SELECT + UPDATE.
6. After cloud sync succeeds and rollback tested, expose the cloud-enabled UI behind an opt-in feature switch.
7. Only then build a separate server-side policy broker for one-shot AI authorizations, budget limits, audit log, GitHub permissions and kill switch. **An approval row is not permission to perform an action.**

## Safe migration design
Local task IDs are currently generated as arbitrary strings. They must not be inserted directly into UUID primary key columns. The eventual importer should generate server-side UUIDs while recording an explicit `local_id -> cloud_id` mapping, or modify the schema in a reviewed migration to support deterministic mapping. No importer is included in this PR.

## Rollback
Nothing is deployed by this PR, so there is nothing to roll back remotely. Any later deployment requires a separate tested migration/rollback plan and approval.

## Existing project data
Do not modify the `concerts` or other Supabase projects or the `mr-tanq/concerts` repository.
