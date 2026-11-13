# Preview 010 — Doorway-marker calibration (PR review)

The large selection ellipse was previously replaced with a small circle, but the small circle still used `{x: building.center, y: building.bottom + 5}`. The visible building artwork includes landscaping and steps; those are not equivalent to the door coordinates.

This change defines **two separate points for each building**, in the 1671×941 environment coordinate system:

| Building | Visual door marker | Walkable approach node |
|---|---|---|
| Town Hall | (535, 460) | (535, 520) |
| Listening Mirror Workshop | (1125, 448) | (1125, 515) |
| Pokémon Hub | (330, 632) | (385, 665) |
| Wellbeing & Training Center | (1325, 633) | (1240, 690) |
| The Lost Wanderer Studio | (835, 789) | (835, 854) |

**Visual door marker:** a small cream diamond fixed beside the front steps. **Walkable approach:** a separate point on the existing validated path network. The two must not be confused; door artwork is allowed to extend beyond the collision graph. For this pass, building taps only inspect; they do not automatically route to the door.

Touch-to-walk destination is represented by a **small cross** at the actual snapped route location, not another building circle. Touch snapping still tolerates imprecision but is capped at 115 art pixels, avoiding large jumps to distant unrelated paths. Inspecting a building cancels previous pending walk commands.

These positions were manually checked against the existing composited PNG art and navigation nodes. The door coordinates are **first-pass visual calibration**, not yet verified on Android; the appearance must be tested in the live preview after an approved merge. No new assets, services, credentials or payments.

Suggested Android checks: select each of the five buildings, check marker placement at front steps, then tap an adjacent paved road and verify the cross appears on the road. Test after zoom/pan as the marker should move with the world rather than float on screen.
