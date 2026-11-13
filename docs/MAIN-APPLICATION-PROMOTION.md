# PAPERWORLD — Main application promotion

The root GitHub Pages entrypoint is now the active full village. This replaces the older offline-only prototype **at the root URL** with the five-building 2.5D diorama and project rooms.

## URLs
- Production candidate after PR merge: https://mr-tanq.github.io/paperworld/
- Previous large-world preview (unchanged): https://mr-tanq.github.io/paperworld/preview-010/
- Former root prototype archive: https://mr-tanq.github.io/paperworld/archive/prototype-002/

## Source of truth going forward
- `index.html`: canonical root entrypoint
- `style.css`: canonical UI styling
- `js/app.js`, `js/navigation.js`, `js/depth.js`: world navigation/rendering
- `js/projects.js`, `js/rooms-ui.js`: browser-only local task board
- `js/cloud.js`, `js/cloud-ui.js`: authenticated private Supabase tasks
- `assets/`: unchanged existing papercraft PNG artwork

The previous `preview-010` directory is retained unchanged as a reference/test baseline, not the future canonical development path. `village.js` at root is retained for compatibility and tests but no longer loaded in the production page. The original root entrypoint and relevant assets are copied to `archive/prototype-002/`.

## Data preservation
Root and preview are on the same origin, so browser localStorage keys and the Supabase session storage remain unchanged. No task migration, deletion, auto-upload, credential reset, or cloud writes occur just by visiting the new main URL. The old preview is still available.

## Safety
Only the Supabase publishable key is present client-side; authorization is enforced with Row Level Security. AI workers, GitHub write automation, expenses and approvals are not enabled.

## Android smoke checklist
1. Visit root URL and verify background and all 5 building PNGs load.
2. Tap Listening Mirror and see existing local task(s) from preview.
3. Open cloud workspace; sign in with the already registered account; verify remote tasks.
4. Confirm old preview link still loads unchanged.
5. Confirm archived prototype exists for reference.
6. Test panning, zoom, walking, building taps and mobile sidebar.

## Remaining Auth setting
The Supabase Auth Site URL and allowed redirect URLs must point to `https://mr-tanq.github.io/paperworld/`, not localhost:3000 or the old preview URL. This configuration is managed in the Supabase dashboard; changing repository code does not automatically update Auth redirects.
