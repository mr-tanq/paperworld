# Chief Human Officer — final approved size A sprite (2026-11-15)

The 16-frame sprite is extracted from the latest user-approved 4×4 walking illustration, at the approved **size A** display setting. The visual design is a white T-shirt, black jeans, dark three-stripe trainers, short tied-back dark hair with a light streak and short beard. The user stands apart from the dressed-up AI residents.

## Technical integration
- New transparent indexed PNG, `assets/player-walk-v2.png`, 160 × 224 (40 × 56 pixels per cell), row order down / right / up / left, four poses per direction.
- The source was segmented to remove image artifacts and each pose aligned to a shared feet baseline and torso center.
- The existing Canvas render size remains **60 × 88 world units**, preserving the selected balanced village scale, depth order and ground anchor.
- Uses Matt v3's proven distance-based gait: one pose per 14 world units and neutral second frame while idle.
- Retains existing fallback, navigation, Director workflows, AI runtime, chats and all related permissions unchanged.

The previous v1 asset remains in place for rollback. Visual animation still needs a real tablet smoke test after publication.
