# Routine Loop V4 — Matt human-first Messenger integration

## Delivered as code (not deployed)
- Adds a small, deterministic Greek/English weekly-intent recognizer on existing Matt chat messages. Only explicit recurring intent with one registered project, one weekday, HH:mm and **UTC** proceeds to the schedule preview. Ordinary requests continue to the unchanged Matt flow.
- When recognition is incomplete or lacks UTC, the Messenger explains what to specify; the request is **not** sent to Copilot and no schedule is written.
- Calls existing authenticated `/routines/preview` first; displays project, weekly UTC slot, next occurrence converted for display to Europe/Amsterdam, and an explicit caution that a fixed UTC weekly schedule is **not** a fixed Dutch local hour across DST.
- Two distinct owner actions: **Save disabled draft** (`/routines/create`), then optional **Enable draft-only review schedule** (`/routines/enable`). Server verifies user JWT, Matt thread and zero-spend policy on every call. No one-click auto-activation.
- “Δείξε μου τις ρουτίνες” / “Σταμάτα τα προγράμματα μου” opens a small list of owned routines, with manual pause buttons for active items. The user explicitly clicks the named routine; no guessing which to disable.
- The API responses are checked on the client; errors never imply successful save/activation/pause.
- Adds a small responsive inline card within the existing Messenger. No technical task selector, new database, model parser, notification mechanism, AI inference, scheduling engine, or new cron.

## Current release blockers
**Do not claim routines work in production yet.** A read-only live Supabase check on November 19 found no `paperworld_routines_v1`, `paperworld_routine_slots_v1`, stage RPC or review-due function. V1/V2 SQL were merged as files but not applied. V4 will preview correctly once Render deploys, but create/list/pause will fail closed until separate schema deployment.

## Next release
1. Verify SQL V1/V2 in isolated DB, owner/thread RLS, schedule slot uniqueness and no chargeable effect replay.
2. Apply reviewed SQL only with explicit owner approval, after confirming the live V5 unified tick exists (do not replace any other active cron blindly).
3. Deploy the Render + GitHub Pages changes, test manual preview/create/enable/pause in one owner account, then cross-owner denial.
4. Add `Europe/Amsterdam` DST-correct, local-time schedule policy before removing the explicit UTC requirement.
5. Present due drafts as simple pending decisions through Matt's existing inbox and require separate approval for any actual worker action.

No Suno changes, no paid model call or credits.
