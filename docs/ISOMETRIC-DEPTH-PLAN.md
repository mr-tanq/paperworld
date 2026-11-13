# PAPERWORLD: isometric depth and navigation

## Current correction

The preview navigation graph no longer routes through the central cherry-tree planter. The planner validates building footprints and the planter as blocking areas. The existing building sprites are sorted by their ground anchor (`bottom`); the character is rendered before sprites in front of it and after sprites behind it. This is **2.5D painter-ordering**: the character must disappear behind opaque parts of a building, not walk over its roof.

## Why a flat background is insufficient

`assets/environment-010.png` is a single illustration. Trees, fences, lamps, cliff edges, bridges and grass are baked into that image. They cannot automatically occlude the player or supply accurate walkable surfaces. A few manually entered waypoints are a visual prototype, **not proof** of correct routing on every pixel of the paths.

## Next technical pass (before replacing production village)

1. Keep terrain separate from **foreground occluders**: tree canopies and trunks, fences, archways, bridges, railings and elevated elements. For each foreground object, record its image, world position and foot-depth anchor.
2. Author an explicit walkability mask or polygonal navigation mesh aligned with the visible cobblestone, stairs and bridge decks. Mark planters, water, grass plots, cliffs and each building footprint as non-walkable.
3. Use entrance/door interaction nodes for each building, avoiding travel directly to the building center.
4. Render ground first, then sort objects and the character by projected foot Y coordinate; draw foreground masks after actors whenever the actor is behind the object.
5. Test paths around the central planter and behind each building in Android, including zoom, pan, rerouting mid-walk and edge cases.

Do not generate new terrain art or change the existing production village until the user reviews and approves the proposed asset split. No AI services or costs involved.
