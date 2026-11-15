# Paperworld high-detail character pass — Human, Matt, Listening Mirror Director
The shared `assets/characters-hq-v1.png` texture is a transparent 256×1056 64-color atlas with 48 frames: 16 per character.
- Groups: 0 Human (white T-shirt with black Lucifer sigil, black jeans and striped dark sneakers, closely clipped sides, tied-back top and white streak); 1 Matt (dark coat, red scarf, shoulder bag); 2 music Director (purple hair, headphones, dark music streetwear).
- Each group has four rows, source order down, left, right, up, and four animation poses. Atlas frame is 64×88 source pixels, rendered at established 60×88 world size (approved size A).
- Removes checker-board background by alpha extraction, aligns all feet to row baselines, and shares lighting/color treatment between characters.
- High-quality browser downsampling is explicitly enabled only inside character rendering. Existing depth sorting, route choice, distance-based phase (14 world units) and idle pose are unchanged.
- The previous per-character sprites are still available and render automatically if the new atlas cannot load.
- The Listening Director remains the same `listening-director` AI identity and does not patrol until existing routes actually move it. No AI, cloud, credits, authentication, Directors or workers changed.
- Artistically exact visual parity cannot be guaranteed at small tablet zoom; verify all four directions and idle with a real Android screenshot before further enlargement.
