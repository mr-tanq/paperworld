# Listening Mirror Workshop: conversational entry point

The user opens the Listening Mirror Workshop and describes a problem in everyday Greek or English. This phase provides a **conversation-shaped interface with transparent deterministic intent routing**, not a general-purpose LLM chatbot.

For a TicketSwap request, the UI identifies the existing non-cancelled TicketSwap mission, prioritizes the review-ready mission and offers to jump directly to its controls. It does not generate duplicate missions. Any AI run still requires the existing separate explicit GitHub Copilot credit approval.

For other requests, the UI says that a general AI worker is not yet available; the user may explicitly confirm saving their message as a private Listening Mirror task. It does not fabricate execution or silently modify repositories.

This is an incremental step toward a true autonomous Workshop Developer. Missing components remain: authenticated general-purpose intent planning, permission-scoped orchestration for arbitrary tickets, autonomous test/repair cycles, human-approved deployment policies, per-project scoped credentials, durable conversation history and reliable feedback on actual success.

Cloud data and existing tasks remain unchanged by installation. The backend Worker Bridge from PR #32 is already deployed and untouched here.
