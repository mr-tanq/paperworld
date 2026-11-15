# High-detail trio v2: final human likeness

This revision keeps the shared four-direction walk atlas, but replaces the first 16 frames with the **user-approved standalone Chief Human Officer sheet**.

- Real hair details: short clipped sides, long tied-back hair on top, clearly visible **white front streak**.
- White shirt with black Sigil of Lucifer, black denim jeans and striped trainers.
- The Matt and Luna frames are unchanged from the first high-detail atlas.
- Atlas source is 256×1056 with 64×88 cell geometry and 12 total rows, stored as transparent optimized PNG. Render stays 60×88 world units (size A).
- Source-to-game row map remains down, left, right, up; the player's approved source rows were rearranged to match.
- The 14-pixel distance based gait, idle state, painter's depth sorting, NPC positions and AI actions are unchanged.
- The old `characters-hq-v1.png` remains in git as a rollback asset. This PR only changes the art asset, visual source path and corresponding regression test.
