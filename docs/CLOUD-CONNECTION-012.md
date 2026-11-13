# PAPERWORLD — Private cloud workspace (Prototype 012)

The dedicated PAPERWORLD Supabase project was created as a separate free project in `eu-west-1` (Ireland). **Project ID:** `jrevhzvrgenucuozjowm`. This is completely separate from Listening Mirror and Pally Ombouwen.

## Database: installed and checked

- `paperworld_tasks`: private per-user rooms, titles, notes and status, with authenticated-only RLS.
- `paperworld_approval_requests`: owner-specific, **read-only** to ordinary signed-in browsers. Approvals never trigger any action.
- `local_task_id`: optional original browser task identifier, unique per owner for safe re-import.
- Supabase default grants needed explicit correction after the first migration: both tables had inherited privileges. These were revoked. A fresh `has_table_privilege` SQL check verified:
  - **anon:** no SELECT/INSERT/UPDATE/DELETE/TRUNCATE rights on either table.
  - **authenticated:** task SELECT/INSERT/UPDATE/DELETE, **not TRUNCATE**; approvals SELECT **only**.
- RLS is enabled on both tables, and owner-scoped policies were verified. A two-user end-to-end RLS test with real accounts remains outstanding.

## Connecting the browser

Once PR is merged, open `https://mr-tanq.github.io/paperworld/preview-010/` and any building. The existing **local workspace** remains intact. Press **Open cloud workspace** to see the *separate* PAPERWORLD Cloud workspace.

The UI offers account creation and sign-in with email/password. New Supabase projects usually require email verification. **Supabase login accounts are separate from the Supabase management dashboard account.** Signup creates a PAPERWORLD Auth user, not a GitHub or Supabase management login.

### Required Auth setting BEFORE registering

In the dedicated project Dashboard go to **Authentication → URL Configuration**:
- Set Site URL to `https://mr-tanq.github.io/paperworld/preview-010/`
- Add this exact URL to **Redirect URLs** as well
- Leave email confirmation enabled; do NOT disable it to simplify testing
- Confirm the email provider/template and throttling limitations in Auth settings

Do not use localhost redirect defaults for production signup emails. No OAuth provider, third-party client key or service-role key is included. No runtime dependency or external CDN required.

## Using cloud tasks

After login: switch room tabs, create/edit tasks, change progress, delete, refresh. All queries use your authenticated user token; Postgres RLS enforces ownership.

The optional **Preview and copy** flow first loads current cloud tasks, checks for previously imported IDs, shows the number to copy and asks for a confirmation. On approval, it copies from local to cloud. **Local tasks are never removed.** Reimporting is deduplicated by the original task ID. Partial imports can be safely retried, although task status of a partially imported item may need manual correction.

The cloud task panel and old local panel intentionally stay separate for now, to avoid accidental conflict or overwriting. Do not mistake local tasks for cloud tasks before importing.

## Security and limitations

- The `sb_publishable_` frontend key is public by design; security depends on RLS. **Never add a secret or service_role key to GitHub Pages.**
- The browser stores the user session in site localStorage. Use a trusted, non-shared browser/device. Sign out when finished.
- No AI workers, no autonomous actions, no GitHub writes, no paid APIs, no cost authorization.
- This PR is **not deployed until approved merge**. No existing Supabase data was migrated automatically.
- Verify email signup and redirects, real authenticated CRUD from Android, cross-device reload and RLS under two separate users before describing synchronization as fully accepted.

## Acceptance test

1. Set Auth redirect URLs in Supabase Dashboard, verify signup email, and sign in.
2. Select **Listening Mirror** cloud room, add `TicketSwap fix`, refresh and check persistence.
3. Sign in on another device with the same email and check the task.
4. Click **Back to local**, inspect existing local tasks. Copy only after reviewing the number.
5. Return to cloud and verify imported tasks and de-duplication.
6. Use a distinct test account and verify no access to the first account's tasks.

Project URL: `https://supabase.com/dashboard/project/jrevhzvrgenucuozjowm`
