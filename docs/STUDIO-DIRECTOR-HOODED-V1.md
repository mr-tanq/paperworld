# The Lost Wanderer Studio Director — visual integration v1

The user approved a dark hooded, bearded music-producer character. This change replaces the existing `studio-director` gray placeholder outside The Lost Wanderer Studio with a visual sprite; it does not create a new AI agent or rename an existing agent.

Art source: approved hooded character concept. Transparent indexed PNG 256 × 352, 4 × 4 cells of 64 × 88 px; rendered at 60 × 88 world units for identical scale to player, Matt, Luna, Pokémon and Wellbeing directors. Direction order down / left / up / right; walking frame selection is distance-based (14 world units per frame), and idle holds frame 1. The actor is stationary by default, with no artificial patrol.

**Art limitation:** This is a concept-derived, edited sprite atlas, not 16 independent artist-drawn orthogonal views. The side/back poses are approximations and the gait is subtle rather than fully articulated. Mobile visual approval is needed; do not claim it is a perfect true 4-direction walk cycle. The original approved concept can be used for a subsequent dedicated 16-frame redesign.

Render fallback preserves the previous placeholder if the PNG does not load. No modifications to AI delegation, permissions, credits, Supabase, workflows or other agents.
