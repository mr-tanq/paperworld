# Chief Human Officer — contemporary visitor (v1)

The human player is intentionally visually different from the Paperworld AI residents. His sprite is based on the user's approved character sheet: short tied-back dark hair with a lighter front streak, short beard, white T-shirt, black jeans, and black Adidas-style trainers.

The 4×4 PNG atlas (128×176, transparent) has rows **down, right, up, left** and four poses per direction. Feet are aligned to the same ground anchor as Matt v3. Animation uses the **same 14-world-pixel-per-frame distance-based gait** as Matt v3, never free-running while idle. Direction changes with actual player travel, and the old placeholder is kept as loading-failure fallback.

This is only an avatar change. Routes, depth sorting, AI Matt, Directors, worker execution, approvals, cloud authorization, and chat remain unchanged. The source sprites are stylized at small size; on-device visual confirmation is required before declaring the animation artistically final.
