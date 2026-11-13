# Prototype 009 — Listening Mirror Workshop

The approved Listening Mirror Workshop artwork has been prepared as a transparent PNG, cropped to **1274×1010 pixels**.

## Required before merging

The PNG must be added to this branch as:

`assets/listening-mirror-workshop.png`

**Upload to the branch `prototype-009-listening-mirror-asset` before merging**, not to `main`.

The file is supplied in the ChatGPT conversation as a download. From GitHub open:

`https://github.com/mr-tanq/paperworld/upload/prototype-009-listening-mirror-asset/assets`

Select the PNG and commit directly to the branch. Confirm the file is visible at `assets/listening-mirror-workshop.png` in the PR's **Files changed** list before merging.

If the PNG is missing, the old Canvas-rendered Workshop will remain visible. The code is explicitly designed to fail safely.

## Visual acceptance checks

- Both detailed buildings display without black or rectangular backgrounds.
- Workshop remains clickable, and shows Listening Mirror information.
- Town Hall stays functional and visible.
- Character walking, zoom and drag-to-pan remain functional.
- Workshop and Town Hall don't overlap unnaturally at the usual tablet zoom.
- This is a single image for the building, decoration, landscaping and light. Separate layered sprites come later.

No paid services, remote AI agents or new backend connections are involved.
