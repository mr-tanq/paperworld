# PAPERWORLD — Village Human First V4

## Purpose

PAPERWORLD is not an admin panel pasted on a beautiful village. It is a human-friendly **team of AI collaborators**, where the owner gives Matt a goal in ordinary language, Matt asks the appropriate Director, authorized Workers examine the right project, and the owner is presented with a comprehensible next decision. The code, credentials, PRs and logs are infrastructure, not the owner's daily job.

This implementation is an integrated product slice based on the current deployed Paperworld implementation and the **seven steps of Tristen O'Brien's "Claude Built a Working AI AGENT Village. (Steal My Prompts)"** (October 25, 2026). The source describes a game world, chief of staff, directors each with a folder and notes, specialized workers, movement, real connector-powered jobs, walk-up conversations, Town Hall meetings, and the owner approving hires/messages/spending. It does **not** imply that every feature in the video can be reproduced for free with our available providers, nor that the video proves secret-sharing safety, persistence or zero incremental usage.

### Product north star

**One sentence from owner → verified team's progress → one clear decision → proven outcome.**

No one should have to know "public_repo", "SHA", "diff", "Draft PR", "Supabase service role", "worker proposal" or "route" to tell Matt their problem or understand its status.

### What is now actually supported

1. **One Messenger**: Matt's existing real Copilot delegation and Director handoffs remain exactly as implemented. A compact, authenticated **solution approval card** appears inside Matt's chat only when the server has returned a *valid, persisted, pending* owner proposal. Do not redirect the owner away to the Work Desk when the Developer returns a preview. Long AI reports open in an optional disclosure rather than swallowing the phone screen.
2. **One task and decision view**: read-only projection of owner-authenticated Supabase job history, actual persisted Listening Mirror review proposals, and separately stored manual cloud tasks. These three data types are visibly distinct. No narrative event alone authorizes a write or proves model execution. The same exact job ID collapses under its persisted proposal, avoiding duplicate "investigation" and "approval" cards.
3. **One informed preparation approval**: the only enabled primary action for a valid persisted pending proposal tells the owner that it will create a reviewable change *without applying it*. Clicking shows a specific human confirmation before calling the pre-existing owner-checked `publishListeningProposal(jobId,digest)` endpoint. The server retains exactly the same thread/owner check, immutable proposal digest, GitHub OAuth write scope and single-use approval. A second action permanently rejects the saved proposal, and is accurately labeled **Απόρριψη λύσης** instead of "Not now".
4. **Honest statuses**: a recorded `reported` history event is called "analysis finished, no ready solution" unless a real proposal exists. A stored `draft_created` proposal is "prepared, not applied". A manual `done` task is described as **user-marked**, not automatically completed by agents. Incomplete or unverified proposal objects never produce approval actions.
5. **Readable Work Desk**: the solution/task timeline is first; manual task CRUD, GitHub connection/review internals and account settings are optional disclosures. Workshop is no longer the only place for an approval.
6. **Town Hall**: the original mapped movement and gathering animation is preserved, but the meeting panel now pulls actual owner job and solution state into an agenda; its attendee buttons open already-existing direct Director chats. A separate **explicitly owner-consented live discussion** can request at most three independent Copilot answers from Luna, Joey and Crow, using the already deployed single-director server endpoint (which checks owner, zero-overage and disables tools). The shared agenda and short previous replies are disclosed to these three project Directors only. Dave/Wellbeing is **never included** in this cross-project feature. Closing the meeting stops further AI turns between any requests; an already-started server request can finish.
7. **Team directory**: instead of dead "planned" Workers, clicking an existing Worker opens the responsible Director, never pretends to open a Worker AI thread. Visual agent movement and greetings remain honest visual-only behavior.
8. **No surprise technical terms**: live statuses, collapsed source, human-language activity labels, larger mobile hit targets, visible focus states and responsively limited side panels. Important confirmation messages explicitly state which actions do **not** happen automatically.
9. **Keyboard and touch**: previous keyboard shortcuts M/T/escape remain. New controls have text labels, real buttons, minimum 44-pixel touch targets, focus-visible styles, no hover-only disclosure and safe truncation of long untrusted text.
10. **No new backend credentials**: no secret changes, new paid API, cron jobs, role grants, deployment, schema migration, model tool permissions, arbitrary network requests or autonomous writers were added in this integrated PR.

### Journey A: Listening Mirror wrong-year poster

- Owner opens Matt and says "Στο Listening Mirror οι αφίσες φεστιβάλ είναι από λάθος χρονιά. Φτιάξ' το."
- Existing owner-consented model routing and any separately consented Worker read are carried out. No source data is read without the authorized server path.
- Verified saved solution from `paperworld_worker_proposals` appears in **Matt's Messenger** and **Οι εργασίες μου**, with the same exact one-use approval digest.
- Owner sees the proposed fix in Greek, which part of the app it impacts, and the explicit note that approval prepares a change only.
- Owner may authorize or reject; server rechecks user identity, job digest and precise repository scope.
- If approved and the server creates a Draft PR, the status becomes **Προετοιμάστηκε · δεν εφαρμόστηκε**. The user can review the resulting GitHub PR. This PR does not silently merge it, does not run actual code tests, and does not deploy it.
- If the storage adapter is missing or the Worker emitted analysis only, the Human First UI displays investigation history instead of pretending there is a ready fix.

### Journey B: Town Hall

- Owner chooses Town Hall in the existing village. The director gathering animation plays if available; no AI call is triggered by that animation.
- Town Hall shows owner-scoped known pending jobs/proposals with explicit evidence disclaimers.
- Owner can speak privately with any Director by opening its existing Messenger.
- To request real AI conversation, owner enters a concrete agenda and confirms a disclosure describing **three Copilot calls and cross-project sharing among Luna/Joey/Crow**. No wellbeing memory is included.
- Luna, Joey and Crow answer sequentially in the single meeting panel, with each earlier answer excerpt shown only to the next participants. Replies do not perform tasks, create issues, write files, send external emails, or publish.
- No additional model request is triggered by the status refresh, walking sprites or opening the panel. Aborting the meeting stops later calls. User can copy its visible transcript manually.

### Explicitly NOT complete

- Autonomous, unprompted work while the owner is away.
- Persistent transcript for Town Hall (the in-panel discussion is ephemeral; the owner may copy it).
- A single owner approval that authorizes both research and deployment across all projects: each distinct cost/privacy/write scope remains explicit.
- Specialized software-writing capability for Pokémon or the music studio, or independent Workers operating with tools and private code outside the existing backend allowlists.
- Cross-project wellbeing memory at Town Hall.
- A proven end-to-end **applied and tested** fix for an existing Listener Mirror issue. A Draft PR is a prepared change, not deployment.
- Global multi-project activity history; only Listening Mirror Worker history has the existing durable job event store. Manual tasks are independent and only their explicitly shown state is trusted.
- Automated monitoring, notifications while offline or paid provider usage.

### Mapping to the video (source concepts, not claim of identical implementation)

| Video step | Paperworld V4 |
| --- | --- |
| 1: Build Your World | Existing papercraft village and project rooms retained |
| 2: Move In With Your Chief of Staff | Existing Matt follow, chat and verified routing retained |
| 3: Bring In Your Directors | Existing direct Copilot Director chat + approved project memory + safer team directory |
| 4: Make Them Move | Existing mapped walk and ambient social behavior retained |
| 5: Give Them Real Jobs | Verified Listening Mirror Worker workflow + owner job activity + actual saved proposal + guarded Draft PR |
| 6: Talk to Everyone | Existing direct Director chats + owner-consented Town Hall 3-speaker discussion |
| 7: Stay in Charge | Review card, exact server approval, no automatic merge/deploy/purchase, cost gates |

### Release acceptance checklist

- All offline Node tests pass; no silent change to old routes or permission modes.
- A real pending proposal yields **exactly one owner decision** even when the same job exists in the history table.
- Every invalid or foreign proposal is ignored instead of enabling a write.
- Existing server methods for publish/reject are untouched.
- A GitHub draft status is **never** relabeled "applied".
- Matt Messenger remains reachable with `M`, nearby Director `T`, and the village remains a usable world rather than a full-screen form.
- Opening Town Hall or Work Desk sends **zero** Copilot model requests.
- The only Town Hall AI workflow requires specific one-time human confirmation, uses exactly three individual Director calls at most, discloses cross-project sharing, excludes sensitive wellbeing and continues to deny model tools.
- UI remains functional when source status APIs are unavailable; error is visible and no stale data is presented as fresh completion.
- Mobile-width viewport has readable decision text and buttons without horizontal overflow.
- The change is delivered as a **Draft PR** until a separate owner approval for merge and deployment. Existing unrelated PRs are not modified.

### Technical boundaries and follow-up verification

This PR is intentionally built around the *already existing* owner-verified server API surfaces:
`/history/matt/jobs`, `/listening/proposals/list`, `/listening/proposals/publish`, `/listening/proposals/reject`, `/chat/director`.
It adds UI projections, an optional in-Messenger decision surface, one combined read-only task hub, a Town Hall briefing and a client-orchestrated, approved meeting.
The known dedicated-sandbox Auto Fix coordinator in the server remains **unmounted and inactive**; its operational readiness must not be inferred from new UI affordances. The user's currently saved festival proposal and any Draft PR retain their original repository and one-use approval rules.

No external action is authorized solely because a new label is shorter or more friendly. The back-end boundary must remain observable, testable and unchanged.

### Sources

- Tristen O'Brien, "Claude Built a Working AI AGENT Village. (Steal My Prompts)", published October 25, 2026: https://www.youtube.com/watch?v=-mb6buCbv8E (video description and seven-step chapter breakdown).
- Tristen O'Brien public personal-account discussion of chief-of-staff, director hierarchy and Town Hall, October 2026: https://www.businessinsider.com/dad-built-150-personal-ai-agents-to-run-his-life-2026-10
- Current Paperworld `PROJECT_NOTES.md`, existing source and offline integration tests.
