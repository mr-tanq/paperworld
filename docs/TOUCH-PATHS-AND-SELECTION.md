# Preview 010 — Touch navigation / selection improvements

## User-observed issues

On Android, taps on visibly paved ground were often rejected as “not a verified walkway,” and several provisional graph segments crossed grass or water. Selected building indicators were broad ellipses drawn across their surroundings. The rectangular sprite hit test also captured transparent pixels.

## Changes

- Re-trace a network of **22 nodes / 22 road segments** along visibly paved routes in `assets/environment-010.png` (compared with the older 14-node sparse network).
- Snap touch destinations to the nearest point **on a road segment**, not just to a node. A tap can be approximately 190 artwork pixels from the road and the character will still head to the closest point **on** the road; it will not walk across the intervening grass.
- Use Dijkstra routing with virtual start/end positions along road segments, so rerouting mid-walk doesn't cut diagonally through grass.
- Retain collision validation of every segment against building footprints and the plaza planter.
- Check building hit areas against a lightweight downscaled **alpha mask**; taps on transparent corners can reach the terrain.
- Replace the giant selection ellipse with a compact entrance marker and show a small snapped destination marker.

## What remains provisional

The environment remains one illustration, not an editable true walkability mask. Some hand-traced road centerlines may need refinement based on screenshots. On higher terraces and around bridges, the player must not be allowed to leave the traced road network. Correct occlusion behind environment trees/fences requires separately layered art. This is **not** a pixel-perfect navmesh or complete 2.5D scene.

## Tablet checks after user-approved merge

1. Tap visibly paved road near each building, including between hand-traced waypoints.
2. Tap grass and water close to paths: avatar should snap **to the nearest pavement**, never step directly onto the tapped patch.
3. Tap a building: only a small marker by the entrance, not a broad oval.
4. Drag the camera and zoom; touch snapping should still map correctly.
5. Try a second destination while avatar is walking; no direct shortcuts through grass.
6. Review any off-pavement segment and identify its location for further tracing.

All AI, purchases, external writes and backend connections remain disabled. The production root page stays unchanged.
