# Responsive village & UX polish

Screenshots were captured with Playwright (`tests/e2e/responsive.e2e.cjs`). The real page scripts ran against `tests/e2e/fake-cloud.js`, which is fake data with no network access.

## Camera audit (before)
- `resize()` called `resetCamera()` on **every** resize. As a result:
  - rotating the tablet threw away the user's zoom and pan;
  - so did the address bar collapsing or the keyboard opening.
- The fit was always "contain" for the 1671×941 world. In portrait, the village was a thin strip, and about 65% of the screen was empty on an 800×1280 tablet.
- On a portrait tablet (800px wide) the docked Workspace and Messenger covered most of that strip.

## Framing rules (now)
Implemented in `js/camera-framing.js`: pure math, unit-tested. World coordinates, paths, collision and depth are untouched.

| Viewport | Default framing |
|---|---|
| Landscape / desktop | Unchanged: the whole image, centred (same formula as before) |
| Portrait | The buildings' content box fills the width: all five houses fully visible and larger (tablet ≈ +13%, phones ≈ +12–15%); only decorative margin is cropped |
| Portrait tablet + panel | Workspace and Messenger become bottom sheets; the village is framed in the space above them |
| Docked panel (landscape) | As in #245: zoom kept, the village is only panned beside the panel |

| Event | Behaviour |
|---|---|
| Rotation after pan/zoom | Zoom kept relative to the new fit, same centre point; rotating back restores it exactly |
| Rotation, untouched | Re-framed for the new orientation |
| Keyboard / browser chrome (height-only) | Camera does not move |
| ⌂ Home | Re-frames for the current orientation (and any open panel) |
