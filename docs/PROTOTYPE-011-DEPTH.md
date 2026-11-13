# PAPERWORLD Prototype 011 — First isometric depth pass

This is an incremental **preview-only** implementation of 2.5D painter-order rendering. It leaves the old production village at the repository root unchanged.

## Rendering

1. Draw the approved 1671×941 papercraft environment PNG as ground.
2. Sort each existing building's transparent PNG by its **ground anchor** (`bottom`, not its roof top).
3. Sort the real moving character by its **foot Y** coordinate.
4. Include a foreground canopy layer for the central cherry tree with depth = 505. Its hand-traced polygon clips the same pixels from the background PNG and redraws only those pixels when the character is behind the tree.

This is a first incremental foreground occlusion proof. Because most vegetation and fences are baked into the background, it is **not yet a complete layered map**.

## Tablet visual verification

Use the **Depth test** button at the top of the map (new in this PR). It cycles:

- **Off:** no temporary test actor.
- **Behind the Studio:** a purple test actor at (835,705), drawn behind the Studio transparent PNG (ground depth 801).
- **Behind the plaza tree:** a purple test actor at (831,434), drawn behind the traced cherry-tree crown layer (ground depth 505).

The test actor is **visual only**. It is not a genuine walkable destination and does not edit or bypass pathfinding. The normal player remains on the mapped walkway, and building selection/door-marker calibration is unchanged.

## Limitations and next step

The cherry-tree mask is an approximate polygon, so it may overpaint a few pixels around leaves. For professional-quality layering we should extract independent transparent foreground sprites for all tree crowns, lamp posts, fences, bridge railings and arches, retaining their exact source-image positions. Foreground cutouts should not reproduce stray ground or path pixels. Then maintain an authored collision/navigation layer with door approach nodes.

This PR does **not** add paid APIs, AI agents, remote tasks, database connections, automatic expenses, new generated assets or production-site replacement. Review on Android before merging.
