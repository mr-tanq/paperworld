# Lost Wanderer Studio Director — true 4-direction art v2

Replaces the previous visual asset's mirrored/front-view approximation with 16 individually illustrated full-body poses: down, right, up and left, four walking phases in each direction. At 384 × 528 pixels (96 × 132 per pose), the new PNG has 2.25 times the original source pixels per pose. The character retains the approved hood, facial hair, burgundy scarf, black coat, crescent and branches, leather crow satchel and gold accents.

The source was isolated from a 4 × 4 cleanly illustrated sprite sheet; exterior white was removed, each silhouette was centered and each foot baseline normalized. The runtime continues drawing at 60 × 88 world units with Canvas smoothing and Matt-v3 14-world-unit distance-based animation. Direction map now matches the real sprite rows.

This is a visual-only update: the existing studio-director identity, AI agent, chat, approvals, job logic, movement rules, and other characters remain unchanged. Old art stays in repo for rollback. Verify appearance in tablet browser after Pages deployment.
