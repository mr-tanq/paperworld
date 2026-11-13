# Environment 010 — Expanded PAPERWORLD review build

This is a **separate preview page** at `/preview-010/`. It does not replace the current production village. The large papercraft environment has no buildings painted onto it; all five main buildings are separate sprites.

## Assets required before merging

Upload these four PNGs from the supplied `PAPERWORLD-Environment-010-assets.zip` into the `assets/` folder of branch `prototype-010-environment-preview`:

- `assets/environment-010.png` — larger empty papercraft world (1671 × 941)
- `assets/pokemon-hub.png`
- `assets/wellbeing-training-center.png`
- `assets/lost-wanderer-studio.png`

Town Hall and Listening Mirror Workshop PNGs **already exist** in `main`. Do not re-upload them.

**Important:** The binary assets are currently supplied separately, not committed by this PR. Upload them **to the preview branch before merging**, and check the **Files changed** tab. Do not merge a missing-image preview.

## What this proves

- Existing Town Hall and Listening Mirror Workshop remain separate, clickable sprites
- Pokémon Hub, Wellbeing Center and Lost Wanderer Studio can be positioned separately
- Proposed road graph supports prototype tap-to-walk
- Camera pan, zoom and fit-to-screen are preserved in this standalone preview
- Future expansion land remains open

## What remains unverified

The image is a visual background, not a true terrain map. The navigation graph contains manually placed candidate waypoints: **it is not a validated walkable/collision mesh**. Building positions and z-order may need adjustment after a tablet screenshot. Several decorative objects in the backdrop are still baked into the picture; they cannot be independently animated until separately authored. The preview is not yet a full replacement of the existing 8×8 village.

## Manual checks after PNGs are uploaded

1. Preview opens with five buildings, no colored rectangle behind any sprite.
2. Each building can be tapped; relevant description appears in sidebar.
3. Zoom, drag-to-pan and fit buttons work on Android tablet.
4. Tapping a paved pathway starts provisional movement.
5. No building blocks an adjacent entrance in the composed scene.
6. Production root `/` continues to show the older functional demo.

All AI agents, project writes, purchases and services remain disabled. No deployment configuration is changed. After an approved merge, GitHub Pages will publish the standalone review page automatically.