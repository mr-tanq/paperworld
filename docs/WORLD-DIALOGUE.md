# PAPERWORLD World Dialogue — visual interaction step

## User-facing behavior
- The Matt conversation is a floating panel within the existing canvas map container, not a separate page.
- Press **M** (or tap **M · Matt**) anywhere to reach Matt. It reuses the authenticated, device-local Matt history and existing safe proposal mechanism.
- Approach a visible placeholder agent on a mapped path, press **T** (or tap **T · Talk**) to open that project's Director profile. Interaction range is limited to 100 artwork pixels.
- Direct actor conversations remain visibly **not connected**. Messaging is disabled instead of fabricating simulated replies.
- Text-field focus blocks the M/T shortcuts, Escape closes the overlay; controls are touch friendly.

## Technical constraints
Only the five existing building approach points become temporary world actor positions. These are simple canvas markers; no new interiors, walking sprites, image assets, autonomous movement or new scene navigation are claimed.

No AI calls, credits, backend schema, GitHub Actions execution, cross-project code change, new secrets, or destructive data edits. Any proposed Matt handoff remains inert as in PR #38/#39.

## Next implementation
Actual proximity-based character selection inside interiors, individual per-agent owner-scoped sessions, safe server-side AI gateway with known credits and explicit approval, and Town Hall collaborative meetings.
