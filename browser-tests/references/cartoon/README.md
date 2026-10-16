# Accepted cartoon regression references

These 13 PNGs (4.50 MB) record the cartoon appearance accepted by the owner on
2026-10-16, from artwork commit `7abe519c71fede8796601be6146ee22cf5e98b48`.
They cover both player palettes and the shadow, climbing-snake poses, nests,
day/night gameplay, dusk temple lighting, shared HUD and results, and title/Config
menus at 375×600 and 812×250 CSS pixels. Menu fixtures draw the real responsive
Overlays with fixed state/time over a plain background to isolate panel placement.

The scene fixtures use the same fixed seeds, times, crops and poses as the
artwork review. Captures use the 1× cartoon atlas, Phaser 4.2.1, Chromium 154 and
SwiftShader, with gameplay's `maxTextures: 1`. PNG dimensions and SHA-256 hashes
are recorded in `manifest.json`; the menu version label is frozen at dev.9.
The classic references in the parent directory are unchanged.

Run `npm run build`, then `npm run test:browser -- browser-tests/cartoon-reference.spec.js`.
The normal browser suite includes this check automatically. The comparison uses
the existing scene tolerance: fewer than 1% of pixels differ by more than 8/255
per channel, with at most 25 solid differing pixels per million. A negative
control substitutes a classic day image and verifies that the checker rejects it.
No test writes or updates baselines.

For visual inspection, run `npx vite --port 5174` and open
`http://localhost:5174/cartoon-reference.html`, optionally with `?only=scene.day`.
Saved, current and difference images are shown side by side.

After an intended artwork change has been inspected and accepted, update the
manifest's source commit, approval and any deliberate fixture changes. With the
dev server running, explicitly capture replacements:

```sh
node scripts/dev/cartoon-references.mjs --write --replace
```

Set `CHROMIUM` if using a system binary instead of Playwright's bundled one.
The script refuses existing PNGs without `--replace`; it records fresh hashes.
Inspect the captures and differences before committing, then rerun the reference
checks. A failing test alone is never a reason to regenerate these images.

These fixtures are development/test assets, excluded from the production build.
They record accepted artwork, not real-device results. Device checks remain
pending until after integration into `phaser`, before release.
