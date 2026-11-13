# PAPERWORLD — Functional Project Rooms v1

The village now has real **user-managed task workspaces** in the enlarged preview at `/preview-010/`.

## What is usable

Tap any of the five buildings to open its associated task workspace, or use **Open project dashboard** to open Town Hall. The five rooms correspond to:
- Town Hall (PAPERWORLD and overall decisions)
- Listening Mirror (concert app)
- Pokémon: Echoes (Godot 4 game)
- Wellbeing & Training (exercise, meals and habits)
- The Lost Wanderer (songs and music production)

Each workspace supports:
- Create a task with title and optional notes
- Move between To do, In progress, Done
- Edit a title or notes, or delete with confirmation
- View completion counts and select other workspaces
- Import/export **JSON backups** from the browser
- Optional suggested starter tasks; these are **not created unless clicked**

## Data and safety

All task records are persisted with `localStorage` **only on the current device/browser**. They are not synced across devices and are not read by GitHub or ChatGPT. Clearing browser site data, a private-tab session or changing devices can lose them: export backups. Import merges by task ID and does not silently delete existing tasks. Import rejects malformed or unsupported backup versions; stored corrupted data is not overwritten automatically.

This is a local MVP, not a working autonomous agent system. Tasks are entered and marked complete manually. No AI workers, paid APIs, login, Supabase, remote writes, background tasks or purchases are enabled.

## Android acceptance checklist

1. Open `https://mr-tanq.github.io/paperworld/preview-010/` after an approved merge and successful deployment.
2. Tap the Pokémon Hub, then **+ New task**. Add a title and note.
3. Mark it **In progress** and then **Done**, refresh the page and confirm the task persists.
4. Tap Listening Mirror and verify its task list is separate.
5. Tap **Export backup** to download a JSON file. The exported file should contain all tasks across rooms.
6. Tap **Import backup** and select the JSON; previously present tasks should not be duplicated.
7. Delete a test task and confirm that it does not return after refresh.

## Next meaningful milestone

After mobile acceptance: authenticate to Supabase with strict RLS, migrate tasks to an approved private hosted database with cost controls, add audit/change history, and only then connect agents under a human approval and spending policy. **Do not enable cloud writes, subscriptions or agents without separate explicit permission.**

The original root village remains unchanged.
