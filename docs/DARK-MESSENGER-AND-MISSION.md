# PAPERWORLD — Working mission handoff and dark in-world Messenger

## Goal
Match the user's most important visual reference in Tristen O'Brien's video: dark, messenger-like in-world conversation with Matt or a nearby Director. Stop presenting multiple stacked beige task/chat blocks as the main conversation.

## The actual interface
- `M` / Matt button opens a centered nearly-black Messenger overlay with dark background veil over the papercraft map.
- `T` / Talk near a mapped Director opens the **same** interface with the agent's name and avatar monogram.
- One scrollable stream of chat bubbles, timestamps when available, fixed composer, Enter-to-send and Shift+Enter for a newline, keyboard Escape or close button.
- Existing Supabase-private user messages are shown for Directors; local Matt history supplies Matt's deterministic responses without duplication of cloud user notes. The interface does not disguise deterministic replies as AI.
- Clicking Chief of Staff in the sidebar opens this same Messenger rather than an alternate beige chat.
- Mobile/tablet overlay fills the available canvas area while leaving the underlying map intact.

## One real job, not fake delegation
When the user asks Matt about TicketSwap/Listening Mirror, his existing honest routing produces a **proposed** Listening Director handoff. The Messenger then offers an action to open the existing Listening Mirror Workshop mission. That opens the existing project mission workflow, including real GitHub run status and reports, rather than creating duplicates or claiming automatic completion.

## Still not present
No autonomous agent activity or real Matt LLM, no automatically changing files, no new Copilot call, no spending, no real agent animation or room interior messaging. Future work will connect the AI runtime and agent work results to this chat after user-approved authentication, hosting and credit policy.

## Review
- Run all offline CI.
- Visual QA in Chrome/Android landscape and portrait: M, T, chat bubbles, keyboard, close, input composer, and Chief sidebar opening the same modal.
- Sign in, send Matt message, verify real private note + local reply, and navigate to the existing Workshop mission.
- Do not merge without user review; no deployment.
