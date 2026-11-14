# PAPERWORLD: Matt walk-cycle v3
This change replaces the previous visually flat gait with the approved four-pose sequence from the most recent user-confirmed Matt sprite sheet.

The new 4×4 transparent atlas uses row order: down, right, up, left. In each row the frames alternate contact, passing, opposite contact, passing. Each drawing was extracted from the approved sheet and individually centered above a common feet anchor. Existing draw order, positioning, UI chat and follower trajectory are unchanged. The animation phase advances according to ground distance (14 world px/pose), not wall-clock time; idle keeps the neutral/passing frame.

This asset is a compressed web sprite optimized for the village's small rendered scale. The local screenshots/video must still be reviewed on the user's Android tablet before claiming the motion is visually perfect.

No AI execution, credits, Supabase, OAuth, Director or Worker modifications. Do not merge if offline CI fails.
