# Pokémon: Echoes — Game Architect Director visual

Approved character: shaggy auburn hair, round dark glasses, short beard, moss-green jacket, black retro-gaming shirt, black/red headphones, hiking-style boots, olive developer backpack with rolled plans and a handheld device.

This is **art for the existing** `pokemon-director` actor associated with the Pokémon Hub. No new AI agents, permissions, prompts, routes or backend operations are introduced.

Sprite: `assets/pokemon-director-walk-hq-v1.png` with four directions (down/right/up/left), four poses per direction, 192×264 palette PNG with alpha, feet aligned to a common 60×88-world-unit character footprint. Frame phase matches Matt v3: one pose per 14 units of actual world movement. When stationary, it shows an idle/neutral frame. Existing gray placeholder remains fallback if asset is unavailable.

Source artwork was segmented to remove the checkerboard-like background and downsampled into a compressed web atlas; matching detail and lighting should be checked at normal tablet zoom. Leave the other three character visuals unchanged.
