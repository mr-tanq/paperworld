# Matt papercraft walking sprite — art pass
- Source: approved Matt concept sheet, extracted into a four-direction 4×4 (16-frame) transparent PNG atlas.
- Row order: down, right, up, left. Four animation frames per row.
- Rendered on the village Canvas anchored to feet, depth sorted with all existing buildings.
- Matt changes facing based on follow-trail movement and idles on frame 0; all existing M/T chat and AI behavior are unchanged.
- The previous vector placeholder remains the fallback if the PNG cannot load.
- This work is visual only: no AI requests, credit use, Supabase migrations, job dispatch, OAuth, deployment or changes to other repos.
- Test in Android tablet landscape and portrait before approving merge. Look at relative scale against existing house doors and confirm no dark rectangular background around sprites.
