# Paperworld: Director HQ restoration (November 2026)

## Problem
Pokémon: Echoes director used a 48x66 sprite-cell atlas and Wellbeing used 32x44, both rendered at 60x88 world units. That enlarged the artwork on the tablet and made the last two directors visibly softer than the 64x88 shared atlas for You, Matt and Luna.

## Fix
Both directors now have genuine new 64x88 per-frame artwork sourced from the approved higher-detail illustrations (256x352 each, 4 columns x 4 direction rows), not just an upscaled copy of the old GitHub PNGs. Row order is down/right/up/left. Wellbeing's right-facing frames are mirrored from a source left profile because the generated source didn't include an independent right-facing view.

- `assets/pokemon-director-walk-hq-v2.png`
- `assets/wellbeing-director-walk-hq-v2.png`

Retain on-screen size (60x88), ground anchor, depth layering, existing actor IDs, fallbacks, approved outfits, Matt v3 distance-based stepping, chat and all agent permissions. Old assets are retained for rollback.

## Check on tablet
After Pages deploy, hard refresh. Compare the two directors in the current village against You/Matt/Luna at ordinary zoom and at one level of zoom in. Test standing and moving in each direction if movement is enabled. Automated tests validate file integrity/geometry and renderer mapping, not subjective artistic quality.
