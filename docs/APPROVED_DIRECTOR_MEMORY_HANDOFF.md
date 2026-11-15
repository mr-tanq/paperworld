# PAPERWORLD — Approved Director Memory in the real AI handoff (draft)

**Scope:** The existing Live PAPERWORLD Supabase stores 74 owner-scoped history rows. Following the user's first individual approval, one Listening Mirror record is `approved`, the other records remain `proposed`. This PR contains **no personal memory data**: only reusable code and synthetic test fixtures.

## Real integration path

On an owner-authenticated, consented, budget-gated delegated Matt request:

1. The existing server verifies the Supabase JWT via `/auth/v1/user` and ownership of the Matt thread.
2. Matt chooses only an allowlisted specialist. **Only `listening-director` has real AI delegation at present**, despite the other Director characters being registered in the village UI.
3. **After routing, before the next Copilot turn**, the trusted server uses `createApprovedDirectorMemory` with the same authenticated owner JWT, fixed `listening-director → workshop` mapping and the existing `paperworld_director_memory` table. Supabase owner RLS remains authoritative. A second independent check rejects mixed-project responses.
4. The server's `projectContext` filters out all `proposed`, `rejected`, and `superseded` entries and formats up to 6,000 characters of approved reference material with source pointers. There is **no promotion or bulk approval**.
5. The specialist Director receives that content explicitly marked *untrusted reference data*, never as system instructions, fresh repository evidence or authorization. The Matt routing turn and the Worker model's source analysis do **not** receive the memory content. It is available in the Listening Mirror Director's own analysis and review prompts only. The Matt final answer receives the Director's report, not the raw memory packet.
6. On a failed identity or storage lookup, execution fails closed **before a further Director/Worker Copilot call**. A previous authorized routing call may already have happened. All existing per-request AI consent, entitlement and $0 overage checks remain unchanged.

The other registered Directors (`studio-director`, `pokemon-director`, `wellbeing-director`) can pass the same reusable owner/project-scoped loader, but **they are not yet enabled in the Matt delegation allowlist**, and this PR does not expand routing or grant tools.

## Security and privacy

- No service-role key or private browser token in a GitHub file or model message.
- No agent-side SQL, project or owner selector, tool permission, editing, deployment, purchase or status-changing operation.
- No private memory copied into public PR tests or GitHub Actions logs.
- A dedicated fixture checks that a permitted, owner-specific `approved` record appears in the Director prompt and unapproved entries do not.
- Read-only repo Worker source excerpts and job event logs do not contain the raw private memory.
- Memory may be stale or contain user-authored instructions. The Director must treat it as untrusted historical evidence, not as privileged commands.
- No inference was executed while developing or testing this PR. The *actual future user-initiated, consented* Copilot delegation will consume its existing allowed turns, with approved memory embedded in the prompt.

**Status: draft PR.** No merge, Render redeploy, new AI activity or extra paid API requests. GitHub Pages alone cannot enable this server-side change: a separately owner-approved deployment of the existing Render backend must be performed/tested later. In the meantime, previously deployed behavior remains unchanged.
