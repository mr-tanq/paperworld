# PAPERWORLD — Agent collaboration foundation (Phase 1)

## Aim
Rebuild the interaction model from **human Director → Matt (Chief of Staff) → project Directors → specialized Workers**, rather than adding TicketSwap-specific buttons. Keep the papercraft village as the navigation surface and preserve all current Supabase mission/task data.

## What this PR actually adds
- A small shared, browser-and-Node compatible agent registry in `js/agents.js`.
- Explicit routing boundaries, with Matt delegating to project Directors and Directors delegating to their own Workers.
- A validated, structured, **proposed-only** handoff containing project, operation, request, context, and required approval.
- Offline tests for authorized paths, rejected cross-project/deep shortcuts, unsupported operations, and zero-execution semantics.

## What it does NOT add
- **No live conversational AI, memory, model provider, background scheduler, worker execution or credits**. This is infrastructure for future features, not a claim that agents can now talk or work independently.
- No UI wiring, file writes to other repositories, publishing, GitHub Actions dispatch, Supabase migration or deployment.
- Nothing changes in the existing Chief task-review interface, TicketSwap missions or village artwork.

## Next increments (separate review and permission)
1. Add a **real conversation session** for Matt (thread history, project context, grounded replies) with owner-scoped persistence. Choose the model/provider and per-run budget explicitly before activation.
2. Turn Matt-approved handoffs into visible cards/messages delivered to the correct Director, with state transitions and a clear difference between **proposed**, **approved**, **running**, **failed** and **completed**. No simulated activity.
3. Connect one Listening Mirror Developer Worker to an isolated, logged review-only executor, then expand to other workshops.
4. Add world interactions (approach agent, talk, summon, Town Hall meeting) using the same unified message system instead of project-specific panels.

## Safety invariant
A proposed handoff is inert data. Permission to prepare a handoff **never** implies permission to run an AI model, consume credits, edit files, merge or deploy. Each future execution requires explicit user authorization and server-enforced budget controls. Do not rely on browser code for enforcement.

Run the tests locally with `node --test tests/agents.test.cjs`.
