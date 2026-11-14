# PAPERWORLD Matt Conversation — local-first, honest first increment

## What users can do now
- Open the Chief of Staff and talk in a conversation panel, not a list-only dashboard.
- Read a per-account conversation transcript retained **in the same browser on the same device**, across refreshes.
- Ask for the current cloud-task count, using the loaded task list.
- Mention a known project to receive an **inert, visible proposed handoff** to the relevant Director.
- Clear this device's Matt transcript.

## What cannot happen yet
This is **not live LLM chat** and does not constitute autonomous understanding, ongoing background activity, or genuine multi-agent delegation. Every response must say what is real and what is proposed. There is NO AI provider call, credits, new Supabase table, agent execution, GitHub write beyond this review PR, worker dispatch, or cross-device chat sync.

## Next phase — requires separate review
1. Owner-authenticated Supabase conversation storage with row-level security, bounded retention and per-thread access control (local browser history alone is not private cloud memory).
2. Server-side model gateway with explicit consent and a hard spending boundary. Inspect billing controls before first use; do not put tokens in the browser.
3. Ground Matt in owned project data and conversation history, allow only structured, validated handoff proposals. Server must authorize dispatch; browser validation alone is insufficient.
4. Connect one real Director and one review-only Worker, exposing actual running/failure/completed events.
5. Tie village avatars and Town Hall to the same session system.

## Validation
Run `node --test tests/matt-conversation.test.cjs` and the existing regression suite. Existing Supabase Worker Bridge and TicketSwap workflows are unchanged.
