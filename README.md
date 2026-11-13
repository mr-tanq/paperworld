# PAPERWORLD — Prototype 002

An isolated, dependency-free isometric village prototype for tablet and mobile. This is **not yet an AI agent platform**.

## Run locally
Open `index.html` in a modern browser or serve the folder with `python3 -m http.server 8000`.

## Features
- Responsive Canvas 2D isometric 8×8 village
- Paper-inspired buildings, trees and placeholder characters
- Tap-to-move with tile-based breadth-first pathfinding around blocked tiles
- Drag-to-pan, zoom buttons and reset camera
- Depth sorting, touch-friendly controls, simulated dialogue
- Clear inactive-system notices

## Security and scope
- No AI calls, paid services, GitHub API writes, Supabase or secrets
- No deployment and no changes to other repositories
- This is a visual and interaction prototype, **not** final original papercraft art or Phaser implementation

## Known limitations
- Browser and Android device tests have not been performed
- Touch hit testing uses approximate ground coordinates; building/character interaction requires validation
- Basic tile collision only; moving characters are not dynamic obstacles
- No CI checks yet, no automated performance measurements

## Next steps
1. Review this PR and manually test on an Android device.
2. Fix observed hit-testing, touch and accessibility issues.
3. Add automated browser smoke tests before further expansion.
4. Create original art assets and evaluate Phaser migration.
5. Separately approve any future hosting or backend integration.
