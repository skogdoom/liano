# Visual references

These 12 PNGs (about 864 KB in total) are the Phaser side of deterministic parity
scenarios from the last two-engine build, commit
`b60325c3a55b7d609b5569fc092b7134bf85954f`. They were captured at 1× with Chromium
and SwiftShader, before removing Pixi or moving the renderer. The manifest records
their dimensions and origin.

`npm run test:browser` compares the current renderer against these images. For
manual inspection, run the dev server and open `reference.html`, optionally with
`?only=scene.day`. Fixtures retain the original seeds, times, poses, crops and title version label.
The real game continues to show the current package version.
The comparison allows the established antialiasing tolerance: fewer than 1% of
pixels over 8/255 per channel and at most 25 solid differing pixels per million.

Reference images are development/test assets and are excluded from the game build.
Update an image only for an intended visual change, after inspecting the current,
saved and difference pictures. Preserve its dimensions and document the new source
commit in the manifest. Do not regenerate references just to make a failing test pass.

The independent [accepted cartoon reference set](cartoon/README.md) covers the
cartoon pack, including day/night scenes and small-screen menus. It has its own
manifest and browser check; the twelve classic PNGs above stay unchanged.
