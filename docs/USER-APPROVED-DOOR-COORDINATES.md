# PAPERWORLD — tablet-calibrated doorway coordinates

The user exported the following marker positions directly from the Android tablet for the 1671×941 world. These positions are now the source-code defaults for the five visual **door diamonds**.

| Building | Approved door marker | Existing navigable approach |
|---|---|---|
| Town Hall | (355, 547) | (535, 520) |
| Listening Mirror Workshop | (1153, 358) | (1125, 515) |
| Pokémon Hub | (343, 561) | (385, 665) |
| Wellbeing & Training Center | (1330, 574) | (1240, 690) |
| The Lost Wanderer Studio | (872, 679) | (835, 854) |

**The visible marker and walking approach are deliberately separate coordinates.** Existing road segments and approach nodes have not changed.

## Important calibration caveat

The exported Town Hall marker at (355,547) is substantially to the left of the Town Hall sprite anchor (535,476). This may be intentional or may reflect a misplaced tap; retain the user's exported coordinate verbatim rather than silently substituting a guess. Verify on the tablet before considering the positions final.

## Browser override behavior

The existing marker calibration tool stores per-building positions in `localStorage`. Those values override source defaults in that same browser. Other visitors get the exported positions after merge. Selecting **Reset** in the editor restores the newly updated source-code default. The existing export function remains unchanged and is local-only.

This PR only updates default selection marker positions, documentation, and tests; it does not modify movement, terrain art, building sprites, any external service or backend.
