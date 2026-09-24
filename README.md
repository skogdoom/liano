# Liano

A one-button browser game. A monkey swings on lianas through the jungle; let go to fly to the next one.

Play it at **https://skogdoom.github.io/liano/**.

## How it plays

- The monkey swings on a liana. Press **Space**, or tap/click, to let go.
- It flies in the direction of the swing and grabs the next liana it touches.
- Obstacles hang above or stand below each gap: fly under or over them.
- Hitting an obstacle or falling off the bottom ends the run.
- Reaching the liana past an obstacle scores a point. Your best score lasts until you reload.
- Every gap can be passed: each one leaves a release window of at least 90 ms.

**M** mutes the sound, **F** (or the button next to the speaker) toggles full screen, **D** shows hitboxes and the predicted flight. On phones and iPads, play in landscape. iPhone Safari has no full screen for web pages: add the game to the Home Screen to play it without the browser bars.

## Technology

JavaScript (ES modules), [PixiJS](https://pixijs.com/) 8 for rendering, [Vite](https://vite.dev/) for dev and build, [Vitest](https://vitest.dev/) for tests. Art is drawn in code, sounds are synthesized with the Web Audio API, and there is no backend.

## Running it

Needs Node.js 22.12 or newer.

```sh
npm install
npm run dev        # play at the printed local address
npm run dev:host   # same, reachable from a phone on your network
npm test           # run the tests
npm run build      # production build in dist/
npm run preview    # serve that build at /liano/, as on GitHub Pages
```

Every pull request is tested and built by GitHub Actions, and every push to `master` is published to GitHub Pages.

After changing a tunable in `src/config.js`, run `npm run windows` to rebuild the table of release windows (the build does this too).

## Disclaimer

Mostly vibe coded: most of the code was written by an AI assistant. It is provided as is, and you run it at your own risk. See [LICENSE](LICENSE) (MIT).
