# Private ChatGPT History Import — source-led Director memory

## User goal
Luna (Listening Mirror), Joey (Pokémon: Echoes), Crow (The Lost Wanderer), and Dave (Wellbeing) should recall older conversations. The owner specifically permits sensitive health summaries and unreleased creative notes **in private project-scoped memory**. This does not imply publication to GitHub, access to other agents, automatic approval or additional AI calls.

## Implemented in this draft
- The Work Desk Director Memory view offers a browser-only `conversations.json` file picker, title selector, explicit Director selector, preview and per-batch confirmation.
- The raw ChatGPT export is parsed **locally in the browser**. The application does not upload the whole archive or write it into localStorage, repository files, logs or model prompts.
- Only the **user-selected conversation**, only text-based user/assistant messages on its current message branch, is segmented into bounded entries. System/tool messages, alternate regenerated paths, images, audio and attachments are intentionally omitted.
- All resulting entries use `status=proposed`, `sensitivity=private`, `source_type=conversation`, `kind=work_history` and stable `chatgpt-export:<conversation UUID>:<part>` references.
- Before any transfer, show which Director and how many segments are selected. The owner explicitly confirms the transfer for each batch. An authenticated Supabase client re-verifies the user's identity and checks existing source references to avoid routine duplicate imports.
- Existing database RLS is the final owner boundary. Only explicit owner review can change proposals to approved. AI tools, Workers, the public GitHub repo and other Directors receive no new permission.
- Up to 30 segments are shown per batch (max 40 supported by the adapter); the user can proceed through subsequent pages. Input file limit: 25 MB to reduce browser memory issues.

## Important limitations
- This does **not** fetch old ChatGPT conversations from OpenAI automatically and does not import any file until the owner explicitly chooses one in their own browser.
- The supplied `conversations.json` must have the standard mapping/current_node structure. Unsupported exports, missing bodies, photos and audio are skipped. Large exports must be split into smaller files. This version is intentionally conservative on mobile.
- Owner selects project manually because keyword-based automatic routing could leak private health or lyric material to the wrong Director.
- ChatGPT assistant responses are historic unverified discussion, **not** established project facts. The current memory bridge treats all memory as lower-trust reference data.
- The current memory database has 4,000-character body limits and retrieves a bounded number of approved entries. Very large archives ultimately need a separately designed private full-text/source archive and index rather than unbounded rows.
- Duplicate checks are best effort with current RLS queries, not a database unique constraint; simultaneous imports from multiple tabs can race.
- No new migrations, service-role keys in the browser, paid model calls, code execution privileges, merge or deployment.

## Manual acceptance
1. Sign into Paperworld Cloud and open Director Memory in the Work Desk.
2. Select a local ChatGPT `conversations.json` smaller than 25 MB.
3. Select exactly one conversation and the correct Director; inspect preview and privacy warning.
4. Confirm import. Verify imported entries appear as `proposed` only and reimport skips known source references.
5. Approve only selected entries through the existing owner-confirmed review controls, then check they appear to the correct Director on a user-consented AI turn.
6. Test other users cannot read those memories; test another Director cannot see them; test cancellation leaves no database writes.

## Validation
Added synthetic tests for active-branch parsing, multiline sanitization, pagination, invalid scopes, auth-only upload and duplicate detection. Automated CI remains a prerequisite before merge.
