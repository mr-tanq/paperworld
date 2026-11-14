# Matt walking polish v2
- Replaces the early concept-sheet crop with the user-approved clean 16-frame walking cycle (down / right / up / left, four steps each).
- Individual sprites have transparent backgrounds and are recentered to the same ground/feet anchor before packing into the 4x4 atlas.
- Gait phase is driven by actual distance traveled (16 world pixels per animation step), replacing frame cycling by wall clock.
- Stops animating when Matt is not actually moving. Feet stay grounded as pose and facing change.
- Image loading failure retains the existing primitive placeholder without crashing the village.
- No Director/Worker behavior, AI, Copilot credits, billing, chat APIs, Supabase schemas, or other projects are altered.
- Manual follow-up: test on Android landscape/portrait and verify sprite size and foot alignment on paths.
