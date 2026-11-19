# Learning Loop V2 — authenticated owner-message bridge

This slice connects the previously merged pure Learning Loop helper to the existing PAPERWORLD Render server and owner-scoped Director Memory store.

## New endpoint
`POST /director/memory/propose-correction`, browser origin restricted to PAPERWORLD.

Payload includes only the registered Director ID, existing owner-owned thread UUID, saved human message UUID, owner-selected short title, kind (preference/decision) and sensitivity (private/standard). No arbitrary body text or project ID is accepted.

The server verifies:
1. Supabase user JWT and existing ownership of the **specific Director thread**.
2. The selected message exists in that thread, with role **human**, via an RLS-protected bearer-token lookup.
3. Its stored text and timestamp become the exact proposal body/provenance.
4. The registered Director project is derived from the server roster.
5. Existing owner-token-backed Director Memory `propose()` writes the entry in `proposed` state only.

The message UUID is reused as proposed memory UUID to avoid duplicate proposals for the same selected human message. Existing memory RLS blocks cross-owner access. Failing either read or write returns a failure, never a success claim.

## Boundaries
- **Not a UI release**: no Messenger correction button is wired in this PR. This is an authenticated API route for a future explicit user action.
- No autonomous detection or AI inference, no auto-approval, no change to the existing approval/rejection flow, no new AI calls, no credits.
- Private by default. Human message content is not committed to the public repository.
- The caller's deliberate POST is not by itself sufficient: trusted JWT, real owner-owned Director thread, and exact stored human message are separately verified.
- Messages are not automatically interpreted as true or globally relevant; the user must intentionally select the correct past message.
- A second request for the same message fails rather than overwriting an existing decision.
- The next slice should add a subtle `Να το θυμάται;` UI action to existing chat messages, with a preview before submission and an explicit, separately reviewed approval of the resulting proposed entry. Recheck the owner session and production RLS before enabling.

## Verification still required
Run `node --test tests/director-learning-proposal-api.test.cjs tests/director-learning-loop.test.cjs tests/director-memory-policy.test.cjs` plus full CI; validate with one authenticated owner and a distinct user in a controlled staging environment. Do not assume GitHub tests prove live RLS behaviour. No SQL, deployment, merge, or user data changes occur as part of the PR.
