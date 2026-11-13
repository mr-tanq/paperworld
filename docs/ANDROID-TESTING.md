# PAPERWORLD Prototype 003 — Android tablet testing

This private repository has **no public site** and no deployment.

## Open it privately on Android
1. Sign in to GitHub in your Android browser.
2. Open the private repository `mr-tanq/paperworld`.
3. Choose **Code → Download ZIP** (you may need desktop-site mode).
4. Extract the ZIP using Android's Files app.
5. Open `index.html` from the extracted folder in a browser that permits local file access. Some Android browsers block local JavaScript or CSS; a blank scene does not necessarily mean the app is broken.
6. Keep `index.html`, `style.css`, `village.js` and `manifest.webmanifest` together.

## Manual checks
- Village is visible, with Town Hall, Workshop, trees and three characters.
- Tap a clear ground tile: the player walks toward it.
- Tap a blocked tile: the player does not enter it.
- Drag: camera pans without moving the player.
- Zoom +, − and reset respond.
- Tap the Chief, Workshop and Town Hall buttons: placeholder dialogue changes.
- Rotate tablet and resize: canvas remains usable.
- Confirm status reads **OFFLINE DEMO · NO AI**.

## Automated checks
On any computer with Node.js 20+, run `npm test` (no npm install needed).
`npm run check` also validates JavaScript syntax.

No GitHub Actions workflow has been enabled because private-repository hosted minutes may have billing implications. The checks are committed but are not yet running automatically on pull requests.

## Limitations
No browser automation or Android device test has been run. Local-file browser restrictions vary. No AI agents, remote APIs, payments, or hosting are enabled.
