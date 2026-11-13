# Prototype 008 — Real Town Hall PNG integration

The code in this branch is prepared to display the approved 1403×1024 transparent PNG of the Town Hall in place of the older procedural building.

## One required asset upload before merging

The PNG is delivered separately in the conversation as **town-hall.png**. Upload the file to this branch using the GitHub web editor:

1. Open the `prototype-008-townhall-asset` branch in `mr-tanq/paperworld`.
2. Choose **Add file → Upload files**.
3. Upload the PNG into folder `assets/` so its final GitHub path is **`assets/town-hall.png`** (lowercase, exact spelling).
4. Commit to the **prototype-008-townhall-asset** branch, not `main`.
5. Verify that GitHub can display the PNG before merging the PR.

**Do not merge until the PNG is uploaded.** If the file is absent, the app deliberately renders the old procedural Town Hall, to avoid a broken image.

## Design limitations

- The PNG includes the decorated base, foliage and benches; these are part of a single sprite.
- Hit testing remains a simplified screen-space rectangle.
- The character and workshop sprites are unchanged.
- The app remains an offline demo without any AI, API calls, secrets or paid tools.

## Manual acceptance checklist

- The new Town Hall looks like the approved detailed papercraft artwork.
- Its alpha blends correctly into the village without a rectangular background.
- Tap on the building opens Town Hall details.
- Tap an empty tile moves the player without walking through the Town Hall blocked tile.
- Camera pan and zoom still work.
- The Town Hall does not entirely obscure the Workshop or the Chief.
- Rotate the tablet to check placement.
