# Paperworld Workspace V2 — Team · Work · Settings

Screenshots were captured with Playwright (`tests/e2e/workspace.e2e.cjs`).
The real page scripts ran against `tests/e2e/fake-cloud.js`, which is **fake
sample data with no network access**. The same fake data was used for the
before and after captures.

## Audit of the previous interfaces
| Area | Problem |
|---|---|
| Team (`team-panel.js`) | A plain list with Directors/Workers tabs. There was no explanation of who helps with what, no link to projects or work, and no real activity. It opened a second, unrelated floating panel. |
| Work (`cloud-ui.js` drawer) | One long scroll mixing many unrelated things: sign-in, "Λογαριασμός και ρυθμίσεις", project-room tabs, the Human-First hub, mission progress, a Matt card with two GitHub buttons, "Άνοιξε το Messenger του Matt", room counters, "Ανοιχτές εργασίες" with "Άνοιξε project", and manual tasks. There was no clear "what needs me?". |
| Navigation | Several buttons led to the same place: "Talk to Matt", "Μίλα στον Matt", "Άνοιξε το Messenger του Matt" and M. The Town Hall button lived inside the drawer. The drawer and Messenger fought over the same space. |
| Settings | Settings were scattered: account controls in a `<details>`, GitHub connect in two places, Suno connect only inside the Music Studio, memory review behind a drawer button, and maintenance tools mixed in with everyday actions. |
| Visuals | A separate older visual language from Messenger V2: light-on-dark overrides, mixed button styles, and a drawer that covered the village controls. |

## New information architecture
There is one **Workspace** surface with three destinations, reachable from the village controls (♟ · ✓ · ⚙) and from a tab bar inside the Workspace:

- **Ομάδα (Team).** Matt is featured as Chief of Staff, followed by the Directors as character cards. Each card shows:
  - portrait, role and project;
  - what the agent is responsible for;
  - real activity from owner records (or an honest "not available");
  - actions: Συνομιλία, Εργασίες (opens the project) and ⌖ (shows the agent in the village).

  Workers are listed separately and always route through their Director. Each shows its latest real investigation state. Town Hall is offered here as one contextual action.
- **Εργασίες (Work).**
  1. A summary that can be read in three seconds: greeting, one sentence, and three counters that jump to their sections.
  2. **Χρειάζονται εσένα:** the embedded Human-First hub, with every audited approval and confirmation unchanged, plus blocked missions.
  3. **Σε εξέλιξη.**
  4. **Ολοκληρώθηκαν πρόσφατα:** a link appears only when the result is verified.
  5. **Projects:** tiles showing each owner's portrait and open count. Each opens a project view with that project's items and the owner's personal notes.
  6. **Ζήτα κάτι από την ομάδα:** pre-fills Matt's composer. It never sends anything by itself.
- **Ρυθμίσεις (Settings).**
  - Account.
  - Connected services: the single place for GitHub and Suno controls.
  - Memory: "Τι γνωρίζει …" for each agent, plus the review/import desk.
  - Preferences: less motion, and the keyboard shortcuts.
  - **Για προχωρημένους**, collapsed: the classic task desk, Listening Mirror technical review, and maintenance mode.

Workspace ↔ Messenger: choosing an agent closes the Workspace and opens the chat. Closing the chat returns to the exact view and project the user came from. Pressing M or T, or tapping an agent in the village, closes the Workspace.

## Data honesty
- Every count, state and activity line comes from existing owner-scoped records (Supabase RLS): `loadHumanWork()` and `listAutonomousMissions()`, through the existing projections (`PaperworldHumanFirstHub.project`, `PaperworldVillageActivity`).
- If those reads fail, decisions are hidden, counters show "–", and Team says activity is unavailable.
- Missions marked complete without verification are labelled as such and get no link.
- Personal notes are labelled "Δική σου σημείωση", never shown as agent work.
- There are no presence dots, availability claims or simulated activity.
