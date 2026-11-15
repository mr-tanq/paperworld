# Matt Messenger — conversation-first simplification

## Product decision
One Messenger, one natural language chat with Matt. The visible Director/Worker mode switch, project selectors, diagnostics and job-history buttons have been removed from the Messenger itself. The M/T shortcuts, Director private notes, GitHub reconnect and original dark chat remain.

## Internal routing and approval
- Every Matt chat starts with a **per-message 3-AI-turn confirmation** and the existing model-driven semantic Director routing. Automatic Wellbeing remains **prohibited**; no health memory is auto-read.
- The existing first Matt AI routing turn can now return strictly validated JSON `{director, action}`. `action=answer` is ordinary three-turn Matt Q&A. `action=investigate` is a **proposal only**, possible for Listening Mirror or Pokémon, never a permission or side effect. Legacy plain Director outputs still work as `answer`.
- The Director answers through Matt. If the model proposes a relevant read-only Worker, the browser asks **a second explicit confirmation**, clearly disclosing the additional **up to 5 Copilot AI turns**, $0 overage, and exact public/private source scope before calling the existing guarded Worker endpoint. Decline means no Worker. There is no arbitrary user-provided repo or Worker routing.
- Pokémon source `project.godot` is private and its transfer to Copilot is disclosed. Worker backends still independently enforce exact user consent, owner/thread auth, zero-overage budget, fixed source allowlists, no model tools and no GitHub writes. A direct Worker response does not claim code changes.
- Both operations keep separate existing server consents and request IDs. A continuation with a Worker avoids a duplicate human message in the private chat log.

## Known limitations
- This is the **first** conversation-first stage, not persistent autonomous agent state. Currently each new user message is routed independently. Live AI replies in Messenger are ephemeral until separately approved persistence. The model may misclassify work intent; in that case no Worker runs without the user's second confirmation.
- The existing detailed job history remains in the backend, but is no longer an intrusive Messenger control. Wellbeing requires a future explicit dedicated consent flow, rather than an automatic route.
- Draft PR only; no merge or deployment or actual AI calls were made during this change.

## Verification
Offline regression suite checks safe structured model-output validation, worker proposal isolation, Wellbeing exclusion, plain Messenger, client forwarding and independent consent.