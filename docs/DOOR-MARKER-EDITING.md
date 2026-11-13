# PAPERWORLD — Door marker calibration

The five existing paper-building sprites have visually estimated doorway coordinates rather than a marker at the sprite baseline.

## Revised first-pass door coordinates (1671×941 scene pixels)

| Building | Door marker | Safe walkable approach |
|---|---|---|
| Town Hall | 542, 425 | 535, 520 |
| Listening Mirror Workshop | 1175, 419 | 1125, 515 |
| Pokémon Hub | 343, 561 | 385, 665 |
| Wellbeing & Training Center | 1330, 574 | 1240, 690 |
| The Lost Wanderer Studio | 855, 733 | 835, 854 |

## Accurate placement on the Android tablet

1. Tap the building to select it.
2. Press **Place marker on door** in the right panel.
3. Tap the exact visible doorway location **once**. This moves the diamond to that pixel. While the placement mode is active, the tap cannot trigger walking or select another building.
4. The change is saved **locally in that browser** with localStorage. Tap **Reset** to restore the default for the selected building.

This editor only changes the **visual selection marker**; the distinct safe walkable approach node stays on the existing navigation graph. Marker calibration does not affect the building hit mask, movement or pathfinding. The calibration is not automatically written to GitHub or shared between devices. A later code PR can bake in the corrected positions from a user screenshot or shared coordinates.

No credentials, paid APIs, cloud services or project agents. This affects the review preview only, not the original village.
