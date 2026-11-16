# One-confirmation Director memory import — release checklist

## User-facing flow
Matt's Messenger displays **Έλεγχος μνήμης Directors** only to a signed-in Paperworld owner. When clicked, it reads the owner's existing Supabase memory records, shows the names and titles of the pending 2026-11-16 import grouped by Luna, Joey, Crow and Dave, and asks for **one explicit confirmation**. Cancel makes no changes. This is deliberately not part of AI conversation or autonomous delegation.

The batch requires fresh Supabase Auth verification. Immediately before commit, the browser rereads every project's owner-scoped selection and refuses a changed set. The reviewed RPC (once explicitly installed by the owner) checks the complete exact UUID set, valid owner, status, source and project and updates all entries in a single database transaction. Existing triggers should stamp the reviewer event and write the row-level audit log.

## Boundaries
- Only `source_ref = chat-summary:2026-11-16`, `source_type = conversation` and currently `status = proposed` are eligible (20 rows initially). Legacy unrelated proposals remain proposed. Previously rejected entries remain rejected.
- The SQL migration is **review-only** and is not executed by this PR. Neither the public repository nor the PR contains any medical facts, music lyrics or private conversation contents.
- Successful CI cannot verify actual production RLS or trigger behavior. Check policies and perform owner-vs-outsider integration tests before executing the migration.
- Do not allow the server AI, Matt, Workers, prompts or tools to invoke the batch RPC. Only the owner's deliberate button may do so. There is no new model call or credit use.
- Results can include private health data (Dave) and creative directions (Crow). The preview should only be displayed while owner authenticated.
- This does **not** import complete ChatGPT conversations or recover unreleased lyrics. It activates the staged summaries if and only if the owner separately confirms them.

## Release plan
1. Inspect security and CI checks for this PR.
2. Obtain explicit schema-application approval; create the reviewed RPC and verify post-deployment security.
3. Deploy the client only after explicit deployment approval.
4. Sign in, open Matt, inspect the exact title list, and deliberately approve once if it matches the intended memories.
5. Verify counts, auditing and isolation in private Supabase, with a harmless synthetic unauthorized test.
