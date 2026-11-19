# Paperworld Messenger v2 + Director memory retrieval

Screenshots in this folder were captured with Playwright against the static
site. They use an **in-page stub with fake sample data**: no network, no
Supabase, no AI or Suno calls.
`after-phone-keyboard-safe` simulates a 480px visual viewport, as it is when
the on-screen keyboard is open.

## 1. Audit (what was actually wrong)

### Director memory
| Finding | Evidence | Effect |
|---|---|---|
| Approved memory **does** reach Directors | `formatDirectorMemory` is in both the direct-chat and Matt-delegation prompts | Not the root cause |
| The Smoky Dreams request went **Matt → Crow**, and that path loaded memory **without the user's query** | `matt-delegation.cjs`: `approvedMemory.load({token,ownerId,actor:route})` | Ranking fell back to "newest first". Relevant notes would be the first dropped once memory exceeds the 6000-char budget |
| Approved knowledge about Smoky Dreams is only "kept from the rejected Album V" | Read-only count: 1 approved Crow note mentions it; a richer note is still **proposed** (unapproved) | Crow's "I only know the title" was *honest*; the approval boundary held |
| Crow's guide told it to ask clarifying questions about any "unfamiliar … track" | `crow-songwriting-guide.cjs` | A questionnaire instead of a proposal for the owner's **own** catalogue |
| No typo tolerance | "smokey" ≠ "smoky" in `rankMemories` | Relevant notes ranked lower |
| Proposed memories were invisible from the chat | Only a maintenance batch-approval button existed | The owner could not see what Crow knew or approve the missing note |

### Messenger UX
- Three stacked, `!important`-heavy `.world-dialogue` rule layers in `style.css`, plus dead mode-picker and project-target rules.
- The Music Studio (form, voices, MCP diagnostics, connection checks) was crammed into the composer, with a 270px inner scroller on phones.
- On phones the chat was a narrow 310px / 72vw strip.
- A GitHub chip appeared stuck on "Έλεγχος…" in Crow's header: a CSS rule overrode `[hidden]`.
- AI replies showed raw `**markdown**`.
- Failures surfaced as technical error strings, with no retry.

## 2. Decisions

- **Retrieval stays deterministic and free.** It uses no paid vector database or embeddings. `server/crow-reference-dossier.cjs` resolves references to the owner's own catalogue (songs, albums, eras; typo-tolerant). It combines the curated bible with **approved** memory text only, and emits KNOWN / NEIGHBOURING CONTEXT (labelled as inference) / UNKNOWN, plus a response contract: propose first, name at most one gap, never invent lyrics or audio.
- **One component system, per-agent accent.** Every agent uses the same header, timeline, composer and sheets; `data-agent` only changes `--pw-accent`.
- **Conversation first.** Secondary actions live in an overflow menu, and contextual actions appear next to the content they relate to:
  - "Open in Music Studio" on a Crow song card,
  - "Να το θυμάται;" under the owner's latest message,
  - retry on a failure.
- **Workspaces, not forms.**
  - The Music Studio opens beside the chat on screens ≥ 900px wide, and as a full-screen sheet with a back button on phones.
  - "Τι γνωρίζει ο …" shows approved and proposed notes separately, with one-row approval behind a confirmation.
- **Safety unchanged.** Suno creation still requires explicit confirmation, a verified voice (or an explicitly chosen Random voice), a one-shot idempotency key, and honest "not yet verified" outcomes. Memory approval goes through the existing audited RLS transition.

## 3. Design system (`messenger.css`)

| | |
|---|---|
| Space | 4 · 8 · 12 · 16 · 20 · 24 · 32 |
| Radius | 10 controls · 12 cards · 18 bubbles · 22 panel |
| Type | 12 meta · 13.5 UI · 15 body (16 on phones, no iOS zoom) · 17 titles · line-height 1.55 |
| Surfaces | `#101216` → s1 → s2 → s3 → s4, borders `rgba(255,255,255,.07/.12)` |
| Accents | Matt amber · Crow lilac · Luna moon-blue · Joey coral · Dave sage |
| Buttons | primary (accent), secondary (s3), ghost, chip, accent chip |
| Motion | 120/180ms, `cubic-bezier(.2,.8,.2,1)`; disabled under `prefers-reduced-motion` |
| Layout | ≥900 docked (+ studio column) · 761–899 docked + sheets · ≤760 full height sized by `visualViewport`; collapses to a bottom sheet while Matt walks |
