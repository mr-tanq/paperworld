# Paperworld — Release readiness v1 (2026-11-19)

This report is based on evidence from four sources:
- the `main` branch at `75bb06b`;
- open and recently merged pull requests;
- **read-only** inspection of the live Supabase project (catalog, cron, aggregates only; no data changes);
- tests that were actually executed (Node and a local PostgreSQL 16).

Nothing was deployed, merged or applied to production.

## 1. Audit — what is real today

| Area | Status | Evidence |
|---|---|---|
| Village, Messenger V2, Workspace V2, responsive framing | **Live** on GitHub Pages | PRs #241, #244, #245, #248 merged; e2e screenshots |
| Owner auth + RLS | **Live and enforced** | RLS is on for all 22 public tables. Tables without policies are service-only (deny by default). |
| Director memory (approved, owner-scoped) | **Live** | `paperworld_director_memory` RLS (3 policies); owner review transition policy; review log |
| Matt → Director delegation | **Live** | `server/matt-delegation.cjs`, durable replies, job history |
| V5 Task Engine heartbeat | **Live and healthy** | One cron, `paperworld-v5-safe-controller` (`*/5`), calls `paperworld_v5_unified_tick()`. 781 ticks; last tick a few minutes before inspection; `last_error` null; 0 failed runs in 24h; 0 stalled missions. |
| Copilot Worker execution | **Has run for real** | Effects ledger: 2 `start_agent` sessions, 1 `create_issue`, 1 `dispatch_verify`, 1 dry run, all `done`; no `uncertain` effects. Only 1 of the 2 `start_agent` effects carries a confirmed URL. |
| Budget guard | **Partially effective** | Caps of 1 session/day, 10/month and 1/mission are enforced by the controller. `credit_snapshot` has never been recorded, so `credit_stop_at` (1050) cannot trigger. `allow_unmetered_copilot=true`. |
| Matt notifications | **Live** | `paperworld_v5_notify_matt()` inside the unified tick (completed / needs_you / stalled) |
| Routine Loop | **Not in production** | No routine tables or functions exist live. The UI and API existed, but every call would fail. |
| Shared knowledge for Workers (PR #236) | Draft, not merged | Integrated in this PR |
| PostgreSQL routine tests (PR #247) | Draft, failing | Root cause: `DO $ … END $;` (needs `$$`). Fixed and integrated in this PR. |

### Gaps found in the unmerged Routine Loop (now fixed in this PR)
1. **Wrong time zone.** Times were stored and parsed as UTC, and the user had to type "UTC". "Monday 09:00" would have run at 10:00 or 11:00 in Amsterdam, depending on the season.
2. **DST drift.** The next slot was always `+7 days` (7×24 h), so a routine would drift by an hour at every daylight-saving change.
3. **No error isolation.** The new routine stage in the unified tick was *not* inside its own exception block. Any routine error would have aborted the whole tick: the controller, dispatch and Matt notifications.
4. **Stuck routines.** A routine whose slot was more than 8 days old was never selected *and* never advanced.
5. **No edit.** There was no way to change the time or goal without deleting the routine.
6. **No notification.** Routine drafts would never notify Matt, because notifications only cover engine `v1` missions.
7. **PR #247's SQL test** failed with a syntax error, and it covered none of the above.

## 2. What this PR delivers

### Routine Loop release
- **`sql/paperworld_routine_loop_release_v1.sql`** is one consolidated migration, applied by the owner, that **supersedes** the never-applied V1/V2 drafts (removed).
  - Routines store a **local** weekday and time plus a time zone (default `Europe/Amsterdam`). PostgreSQL computes the slots, so DST is correct.
  - A database trigger owns `next_review_at`: enabling or editing recomputes it, and pausing clears it.
  - Exactly once per slot, via the primary key, a row lock, an advisory lock and `skip locked`.
  - Drafts are review-only, with zero AI calls and zero spend. There are no runnable steps and no new cron.
  - An idempotent Matt message: "Η Luna: ήρθε η ώρα για την εβδομαδιαία εργασία «…». Την ετοίμασα για να τη δεις — δεν ξεκινά τίποτα χωρίς εσένα." The notification `kind` check is extended by exactly one value, `routine_due`.
  - Missed or invalid slots fast-forward instead of getting stuck.
  - The live tick is reproduced **verbatim**, plus an isolated routine stage, and its grants are untouched. Rollback SQL is included.
- **Owner API** (`server/routine-owner-api.cjs`): preview, create (disabled), list, enable, pause and a **new update** action. Every write needs explicit confirmation and is filtered by owner, thread and zero budget. `next_review_at` always comes from the database.
- **Matt (Messenger):**
  - Natural phrases work: "Κάθε Δευτέρα στις 09:00 έλεγχε το Listening Mirror", "στις 8 μ.μ.", and "UTC" if you say it.
  - The preview card shows the first local date.
  - The list card offers **Αλλαγή** (edit), **Παύση** and **Ενεργοποίηση**.
  - Wording is plain Greek, 24-hour time.

### Intelligence: shared approved knowledge for Workers (from PR #236)
- Listening and Pokémon Workers receive **approved, non-private** notes for their own project. This requires a server-created per-task grant (owner, project, request).
- It adds no extra AI turn, and private notes are excluded by the existing policy.

### Operational reliability
- **`POST /health/system`**: an owner-only, read-only health report with no AI calls and no external services. It covers:
  - heartbeat freshness and errors;
  - dispatch caps and credit-snapshot presence;
  - the owner's *own* stalled missions and uncertain effects;
  - which migrations are installed;
  - configuration presence.

  It returns no secrets and no global counts.
- **Settings → Για προχωρημένους → Κατάσταση συστήματος** shows the report in plain Greek.

## 3. Verification

| Check | Result |
|---|---|
| `npm test` (after `npm install --omit=dev` as in CI) | **792 / 792 pass** |
| Routine release SQL on real **PostgreSQL 16** (CI uses 17) | **10 scenarios pass:** privileges, RLS for two owners, zero-budget constraint, DST both directions plus gap, DB-owned scheduling, exactly-once staging and notification, missed and invalid slot repair, stage-failure isolation (controller, dispatch and notifications survive), pause and edit, no cron objects |
| Test sensitivity | Removing the isolation block makes the SQL test **fail**, as intended |
| Migration idempotency | Re-applying it raises no errors |
| JS vs PostgreSQL slot rule | **0 mismatches in 954 cases** (2026–2027, DST gaps and repeated hours). A 151-case PostgreSQL-generated golden fixture is in the test suite. |
| HTTP routes | `/health/system` and `/routines/update` tested over a real HTTP listener: POST only, origin bound, CORS scoped |
| Browser e2e (Playwright, fake data) | Natural routine request → preview → save → enable → list → edit → health panel; 0 page errors (`tests/e2e/routine.e2e.cjs`) |

## 4. Release status

**Completed and tested (in this PR, not deployed):** everything in §2.

**Needs owner action to go live, in this order:**
1. **Review and apply** `sql/paperworld_routine_loop_release_v1.sql` in Supabase. It's one transaction and re-runnable, with rollback included. It replaces the live `paperworld_v5_unified_tick()` with an identical body plus the isolated routine stage.
2. **Merge this PR.** GitHub Pages then serves the new UI. Until step 3, routine actions fail closed with a polite message; nothing else changes.
3. **Deploy Render manually** (`autoDeployTrigger: off`). This activates `/routines/update`, `/health/system`, local-time routines and shared Worker knowledge.
4. Open **Settings → Για προχωρημένους → Κατάσταση συστήματος** and confirm that the heartbeat is "κανονικά" and routines show as installed.
5. Optional: create one routine ("Κάθε … στις …"), enable it, and check the Matt message at the next slot.

**Remaining risks and decisions for the owner:**
- **Credit stop is inert.** `credit_snapshot` has never been recorded, so `credit_stop_at` cannot stop anything. Today the session caps (1/day, 10/month) are the effective budget guard. Recording a credits snapshot (or setting `allow_unmetered_copilot=false`) is an owner decision that needs your Copilot billing information.
- **Unconfirmed Copilot session.** One historic `start_agent` effect has no confirmed URL. It's not uncertain, but it isn't evidenced either.
- **Routine execution is review-only by design.** A routine prepares a draft for your review. Letting a due routine automatically queue paid Copilot work would need its own explicit per-routine budget and consent design. It isn't included, by intent.
- **Old open PRs.** #212 (Crow Aftermath; superseded by #241's reference dossier), #145, #130, #110 and #83 (old drafts), and #242 (obsolete routine implementation) can be closed. Closing them is left to the owner.
