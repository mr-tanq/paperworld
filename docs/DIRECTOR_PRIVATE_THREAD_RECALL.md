# Director Private Thread Recall — v1

## Purpose
The owner wants each of the four Directors to remember earlier conversations without repeatedly re-explaining their project.

## Implemented in this draft
- The direct Director Copilot chat reads the last 40 already-stored messages in **the same owner-authenticated Supabase thread**.
- Server reauthenticates owner identity and exact Director/thread ownership before reading. The database's existing owner RLS is authoritative.
- Reader uses only the end user's own JWT and the public Supabase key. No service-role key, alternate account, cross-project selector, new endpoint or write.
- At most 6,000 characters of historical chat are included and explicitly labeled lower-trust reference material.
- User's latest question and same-project approved memory are supplied separately.
- Reject malformed/mixed-thread responses rather than sending uncertain private data to a model.
- The older in-process 6-message cache has been removed to avoid misleading ephemeral chat memory.

## Important limitations
- This restores only existing messages in the authenticated Paperworld conversation table, **not** the user's full ChatGPT chat archives.
- The existing direct Director endpoint still returns `persisted:false`: its AI replies are not durably saved by this feature. Until separately implemented, a past reply may be absent after restart even if a user message exists.
- The history selection currently reads recent messages rather than semantic full-archive search. Memory remains an approved-only 6k-character excerpt.
- Live model calls remain consented per turn; any sensitive Wellbeing content transmitted to Copilot still requires review of personal-data handling.
- No migration, secrets, real credentials, model calls, expenses, merge, deployment or new tools. The remaining steps are secure reply persistence, private historical ChatGPT import, source-linked full-text/semantic indexing, durable summaries and privacy controls.

## End-to-end checklist before deploy
1. Run node test suite and inspect GitHub Actions.
2. Verify user RLS isolation and exact agent/thread ownership using two real authenticated users in an appropriate test environment.
3. Check historical messages include the expected fields and do not exceed bounded limits.
4. Test Director reply consistency in browser with the real account after an approved deployment.
