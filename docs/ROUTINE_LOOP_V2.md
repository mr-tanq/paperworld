# Routine Loop V2 — Existing Heartbeat Integration (REVIEW ONLY)

This is an additive SQL **proposal**, not an activated automation.

## Relationship to V1 and V5
- Requires the V1 routine schema and the existing V5 autonomous missions, steps, controller and **unified** heartbeat functions to have been installed and reviewed first.
- Replaces the V1 staging RPC with a stricter UTC slot check and advances `next_review_at` by exactly seven days only after the draft is recorded.
- Extends `paperworld_v5_unified_tick` to check up to ten due routines on each existing five-minute heartbeat. It does **not** create an additional pg_cron job.
- The old dispatcher receives no executable new steps: created missions remain in `draft`, with zero AI calls and zero additional spend. No automatic PR, commit, merge, deployment or user notification.

## Safety properties and unimplemented work
- Service-role-only entry points; owner-scoped routine/mission/slot relations reuse V1/V5 compound foreign keys.
- A unique `(routine_id,scheduled_at)` slot and per-template transaction lock prevent repeat staging; requests with wrong UTC weekday/hour/minute and out-of-window slots fail closed.
- Maximum ten routines per tick. A routine older than eight days is not backfilled automatically and needs explicit owner review to correct `next_review_at`.
- **Still missing:** authenticated owner-only create/edit/pause endpoint; owner timezone and daylight-saving support; production migration verification; natural-language Matt inbox review; opt-in execution and budget evidence.
- There is no automatic retry of a chargeable external effect, and no secondary cron job.

## Rollout order
1. Review existing V1 and this V2 SQL as migrations, with isolated PostgreSQL tests for the unique-slot table, RLS and service-role-only RPCs.
2. Build and verify an authenticated owner edit/pause API and explicit review controls before allowing any routine to be enabled.
3. Check current live cron identity, pg_cron grants, and function definitions in the targeted Supabase project. Only then consider applying migrations in a separately approved production change.
4. Test one synthetic zero-spend due slot, repeat the heartbeat, and verify one **draft** in the existing V5 missions table with no ready steps, no GitHub activity and no new paid calls.
5. Add Matt's clear, nontechnical review of due drafts. Independent owner approval remains required before an actual Worker task.

No Suno modifications.
