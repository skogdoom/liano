# Migrating Liano from PixiJS to Phaser (v3.0.0)

Status: **agreed plan (M8a cartoon pack, M9 cleanup and merge, M9a fullscreen canopy, M9b plan consolidation, M9b.1 test-suite improvements, M9b.2 startup loading indicator, M9c test and verification, M10 release). M0, M1 and M2 are done (their reports are under each; M1's go/no-go, measured on the iPhone 13 mini, is a go). M3 is done (the rest of its manual sound pass is due now that M5 draws the bananas). M4 is done. M5 is done (its two parity exceptions accepted). M6 is done (its report). M7 is done (its report; the owner finds the performance on the iPhone 13 mini OK) but for the rest of the real-device pass: Phaser is now the default version. M8 is done and merged into `phaser` in PR #40 (its report). M8a is complete and integrated into `phaser` through PR #41 (merge `a49b1f2`). The owner accepted the cartoon artwork; automated verification, regression references and the report are complete. M9 is complete: the owner merged PR #42 into `master` on 2026-10-17 (merge `73a36d0`). M9a is complete and integrated into `master` from `canopy` through `d91cfe2` on 2026-10-17; sync `release-verification` before M9c. M9b consolidates and splits the plans by area on `release-verification`; M9b.1 improves test coverage and speed there. M9b.2 adds a startup loading indicator on a new `loading-indicator` branch from `master`, integrated into `master` and `release-verification` before M9c. Final testing and verification, including real-device checks, follows there in M9c. M10 releases the tested result from `master`.**

**M9's migration merge into master is complete.** Implementation milestone PRs targeted `phaser`; the owner merged `phaser` into `master` through [PR #42](https://github.com/skogdoom/liano/pull/42) (merge `73a36d0`). Follow-up work uses `release-verification`, created from that merged `master`, for M9b's plan consolidation, M9b.1's test-suite improvements and all M9c testing and verification. M9a was implemented separately on `canopy`, created from `master`, and integrated into `master` through `d91cfe2`; bring the updated `master` into `release-verification` before final verification. M9b.2 is implemented separately on `loading-indicator`, created from the latest `master`, and integrated into `master` and `release-verification` before M9c. M10 publishes the tested result on `master` only after M9c is complete and its changes are integrated.

The goal is to replace PixiJS 8 with Phaser, and to keep every bit of the game as it is: the gameplay, all three modes, every feature and setting, the graphics, and the sounds. The classic appearance remains the migration reference. M8a adds an optional cartoon art pack based on the two concepts in `docs/`; cartoon graphics are now the default. Gameplay and sounds stay the same with either pack.

## 1. Decisions

Made with the owner (answers to the planning questions):

| Question | Decision |
|---|---|
| How far into Phaser? | **Adopt Phaser throughout**: Scenes, the Scale Manager, Cameras, Input and the Sound manager, not only the renderer. |
| How to port the graphics? | **Pre-rendered, replaceable art** (section 5): at build time today's drawing code generates an SVG for every piece of art; in the game each object is a rig of named pieces from texture atlases. Today's look stays pixel-identical. |
| Custom art later? | Any piece can be replaced by a **custom PNG or SVG** with the same name. |
| Variety per object? | **Kept exactly**: the code still picks colours, counts, flips, positions, lengths and patterns per object; only the pictures are files. |
| When is art swapped? | Custom source files are compiled **at build time**. M8a builds complete classic and cartoon packs; the player selects a pack in Config and the game reloads to load it. |
| Cartoon graphics? | **Planned in M8a, before M9.** Replace all visual asset families using `docs/cover_day.png` and `docs/cover_night.png` as the art-direction references. |
| Classic graphics toggle? | Config shows **Classic graphics: On/Off**. On loads classic, Off loads cartoon. Fresh installs default to Off; deliberate selections persist. Changing the value reloads the game. |
| How to test the views? | **Pure view-models tested in Node, plus a few browser smoke tests** in CI. |
| Branching? | **Long-lived `phaser` branch** through M9 cleanup and the owner-approved merge into `master`. Then create `release-verification` from the updated `master`. Implement M9a on the separate `canopy` branch from `master`, then integrate it into `master` and `release-verification`. M9b consolidates the plans by area, M9b.1 improves the test suite, and M9c performs all final testing, verification and resulting fixes there. Implement M9b.2 separately on a new `loading-indicator` branch from `master`; integrate it into `master` and sync `release-verification` before M9c. Integrate the tested result into `master` before M10 publishes the release. |
| Which Phaser? | **Phaser 4.2.1** (the current `latest`), not 3.90. |
| Sounds? | **Keep the synthesized recipes**: they play through Phaser's audio context and master nodes, so Phaser handles unlock, mute and pause, and every sound stays the same. |
| Both versions? | **Both stay playable side by side** until the Pixi removal milestone (M8), which comes after parity and performance (M7), so they can be compared at any point. |
| Weakest device? | **iPhone 13 mini**: the budgets are set for it (section 6). |
| What counts as identical? | A pixel diff under about 1 % of pixels differing by more than 8/255 per channel on the parity scenarios, **and no more than 25 pixels per million in solid patches of difference** (over the limit with all eight neighbours too: added after M1, where the share alone let wrong art on a small object through); sub-pixel antialiasing differences are accepted. |
| Visual checks after M8? | M8 keeps a small set of reference screenshots of the parity scenarios (a few MB at most) for later visual checks. |
| Budgets? | Those of section 6, with a texture budget of **120 MB at a pixel ratio of 2** (set after M1). |
| Download size? | The roughly +150–170 KB gzipped for Phaser is accepted; a custom build is tried in M0 and M7 but not required. |
| Screen shake? | Our own shake maths drives Phaser's camera, so the death shake stays as it is. |
| Master meanwhile? | Bug fixes only; new visual features wait until 3.0.0 (a fix that changes `src/render/*` gets a matching change in `src/phaser/`). |
| Version numbers? | `3.0.0-dev.N` through M9 integration, M9a, M9b, M9b.1 and M9b.2; prepare `3.0.0` and its release metadata on `release-verification` in M9c before final verification. M10 publishes that tested version from `master`. |
| Browser tests in CI? | **Chromium only.** WebKit behaviour is checked on the iPhone itself. |

Also agreed:

- The simulation (`src/sim/`), the generator, the worker and the pure modules stay exactly as they are. Phaser only replaces what draws, listens and plays.
- The fixed-step loop stays: `Scene.update` feeds our accumulator, with Phaser's delta smoothing turned off.
- Our own screen-shake maths and camera interpolation stay, driving Phaser cameras, so the shake looks the same.

## 2. What the migration touches

**Stays untouched** (about half of the code, 3,600 of 7,500 lines, and most of the 512 tests): `src/sim/*`, `config.js`, `layout.js` (pure), `obstaclePrefetch.js` and the worker, `loop.js`, `render/interpolate.js`, `render/camera.js`, `render/shake.js`, `render/fpsMeter.js`, `render/shapes.js` (pure), `audio/recipes.js`, `audio/sounds.js`, and the whole sim test suite.

**Rewritten** (about 3,900 lines):

| Area | Files | Lines | What happens |
|---|---|---|---|
| Entry and scene wiring | `main.js` | 353 | Becomes Phaser scenes and a thin boot. |
| Drawing code (Pixi `Graphics`, `Container`, `Text`) | `render/*View*.js`, `background.js`, `overlays.js`, `hud.js`, `pane.js`, `debugOverlay.js`, buttons | about 3,000 | The drawing code becomes the art generator, run at build time; scene graphs, tints, clips and text are rewritten as rigs of pieces. |
| Input | `input.js` | 114 | New adapter on Phaser's Input; same semantics. |
| Fullscreen, pause | `fullscreen.js`, `pause.js` | 125 | Move onto Phaser's Scale Manager and game events; same rules. |
| Audio player | `audio/player.js` | 237 | Moves onto Phaser's sound manager and its `AudioContext`; same recipes. |

How Pixi is used today (counted in `src/`): 241 `fill`, 76 `poly`, 71 `circle`, 70 `moveTo`, 69 `stroke`, 58 `ellipse`, 55 `lineTo`, 42 `rect`, 30 `clear`, 17 `quadraticCurveTo`, 10 `bezierCurveTo`; 36 round line caps and 11 round joins; 6 `Text` objects; 5 container tints; 1 additive blend; 1 mask (the split-screen clip); 2 render groups. There are no sprites, textures, gradients (the sky is drawn in 32 bands) or filters.

## 3. Target architecture

New code goes in `src/phaser/`, next to the untouched `src/render/`, until Pixi is removed (M8).

**Two playable versions until M8.** `?engine=pixi` and `?engine=phaser` pick the version. Each is a complete game: the Pixi version keeps today's renderer, input, fullscreen, pause and sound player unchanged; the Phaser version uses Phaser for all of them. Both share the simulation, the layout, the loop and the sound recipes. Each version is loaded with a dynamic import, so a page downloads only its own library. Pixi is the default until the end of M7, then Phaser, with Pixi one URL parameter away until M8 removes it. Master (and the live game) stays on Pixi throughout, since `phaser` is merged into it only at the end.

```
Phaser.Game (WebGL, our canvas, audio on, delta smoothing off)
 ├─ BootScene     loads the texture atlases (a small boot set first, the rest during the title)
 ├─ PlayScene     the worlds: one Phaser Camera per pane (viewport, zoom, scroll)
 └─ UIScene       HUD, overlays, buttons, debug text, notices (own camera, on top)
```

| Pixi today | Phaser |
|---|---|
| `Application`, `ticker` | `Phaser.Game`; `Scene.update(time, delta)` feeds our accumulator (`fps.smoothStep: false`). |
| `renderer.resize(w, h, resolution)` with `autoDensity` | Scale Manager plus a manual pixel-ratio step (Phaser 4 has no `resolution` or `autoDensity`): canvas backing size = CSS size × ratio, camera zoom × ratio, text `resolution` = ratio. |
| `Container` trees | Containers or Layers in a Scene, shown by cameras. |
| `Graphics` drawing code | At build time the same code generates an SVG per piece; at runtime the pieces are sprites from texture atlases, arranged in rigs (section 5). |
| Redrawn `Graphics` (wings, legs, flames) | Flipbooks (frames of a piece) or joints (a piece rotating about a pivot) (section 5). |
| `container.tint` | `setTint` (multiply) on the pieces; a colour-matrix filter on a container where one tint covers a group. |
| `blendMode = 'add'` (temple glow) | `setBlendMode(ADD)` on the glow image. |
| Stencil mask (split-screen clip) | Camera viewports clip for free. |
| Render groups (parallax layers) | Backdrop tiles from the atlas on `TileSprite`s that scroll at their parallax factor. |
| `Text` | `Phaser.GameObjects.Text` (stroke, shadow and `resolution` exist). |
| DOM key and pointer handlers | Phaser Input (`KeyboardPlugin`, pointers), behind the same press/consume semantics. |
| Our `SoundPlayer` and its context fixes | Phaser `WebAudioSoundManager` (its `context`, `masterMuteNode` and `destination`); our recipes connect to it. |
| Our fullscreen module | `scale.startFullscreen` and its events, keeping the iPhone and home-screen exceptions. |

## 4. What Phaser 4.2.1 does and doesn't offer

Checked by installing `phaser@4.2.1` and reading its source and bundled docs:

- **Graphics** has `moveTo`, `lineTo`, `arc`, rectangles, circles, ellipses, triangles and point lists, but **no quadratic or bezier curves** (the `Curves` classes sample them into points), and **no line cap or join options** (no `lineCap` anywhere in its Graphics renderers). Its own docs say the command buffer is **replayed and re-tessellated every frame**, that it is "expensive to render", and advise `generateTexture` for static art. This is why the art is baked.
- **No `resolution` or `autoDensity` in the game config**, and `devicePixelRatio` is only read for an `OS.pixelRatio` value. HiDPI crispness must be built by hand (section 7, R3).
- **Containers and Graphics have no tint.** Images and Sprites do (multiply by default; fill, add, screen and others exist). v4 filters can be enabled on any object, including a container.
- **Cameras**: viewport, zoom, scroll and `ignore(...)` per camera, which fits split screen, shared zoom and the pane clip.
- **Sound**: `WebAudioSoundManager` exposes its `context`, `masterMuteNode`, `masterVolumeNode` and `destination`, and handles the browser unlock (`locked`, an unlock on first input).
- **Cannot be imported under Node** (`window is not defined`). Pixi 8 can, which is why a dozen of our test files build real Pixi views headlessly today.
- **Size**: `phaser.esm.min.js` is 1.38 MB, **356 KB gzipped**. Today's whole game (Pixi included) is 207 KB gzipped, so the download grows by roughly 150–170 KB gzipped unless a custom build (`phaser-core`, `phaser-no-physics`) trims it.

## 5. Pre-rendered, replaceable art

Every picture in the Phaser version comes from an image with a stable name. The defaults are generated from today's drawing code, so the game looks exactly as it does now; later an artist can replace any of them with a custom PNG or SVG, and rebuild, without touching code. (The Pixi version is not affected: it keeps drawing live until M8.)

**Pieces and rigs.** Each object (the monkey, a liana, each obstacle kind and decoration, the temple, the backdrop layers, the HUD icons, buttons and panels) is a *rig*: named *pieces* that the code places, rotates, flips, stretches, tints and animates. The code keeps choosing everything that varies per object today, exactly as now; only the pictures of the pieces are files.

| Variety today | In a rig |
|---|---|
| Position, flip, rotation, scale (a bird on a branch, the way a snake faces, the stage's obstacle scale 1.0–1.3) | Transforms of a piece. |
| A choice from a list (bird colours, nest contents, bat looks, temple looks, coil counts, the player and shadow palettes) | One piece per choice: `bird.blue`, `nest.eggs`, `monkey.p2.arm`, ... |
| A length that follows the obstacle or the swing (trunks, vines, the spider's thread, the liana's rope) | Stretchable pieces: a 3-slice (top, repeating middle, bottom), or a textured rope along the curve the code computes. |
| A pattern per object (each liana's leaves) | The rope plus leaf pieces the code places as today. |
| Motion redrawn every frame (wings, legs, tails, eyes, flames, bees) | A flipbook (frames of one piece) or a joint (a piece turning about a pivot). |
| The stage tint | Applied at runtime; pieces are drawn in daylight colours, as the code draws them today. |

M4 lists every object kind with its pieces and how each kind of variety maps. Where exact parity is impossible (a continuous change of shape that neither a transform nor a few frames can match), the case is listed with its measured diff for approval.

**Generated defaults.** A generator (`npm run art`) runs the existing drawing functions in Node, through a recorder of the Pixi `Graphics` calls the code uses, and writes each piece, frame and variant as an **SVG** into `art/generated/`, plus `art/manifest.json`. SVG has everything the drawing code uses (curves, round caps and joins, alpha), so the vectors are exact, and an artist can open them in Inkscape, Illustrator or Figma. As with the window table, the generated files are committed and CI checks they are up to date.

**Contracts.** Each piece has a manifest entry: its key, what it is for, its logical size, its anchor or pivot, the largest scale it is shown at, its frames and frame rate (flipbooks), whether the stage tint applies, its attachment points (such as the monkey's shoulders), and for obstacles the hitbox outline. The generator writes these guides into each SVG as a hidden layer, so an artist sees where the hitbox is and where the pieces join.

**Overrides.** A custom piece goes in `art/custom/<key>.svg` or `<key>.png` (a PNG at least twice the logical size). An optional `<key>.json` beside it may change the frame count, frame rate or pivot within the limits the contract allows. A validator (`npm run art:check`, also run in CI) checks size, aspect, frames and padding, and warns where the art strays far from the hitbox. The hitboxes don't change with the art: they are gameplay.

**Atlases.** The build rasterizes every piece (the custom one if present, else the generated one) and packs them into texture atlases at 1×, 2× and 4× (picked by device pixels per world unit; 4× for large windows on desktops), sized for the iPhone 13 mini's texture limit. The game loads the set that matches the screen: a small boot set (title, monkey, first stage) first, the rest during the title. Atlases are build output, not committed. Pieces from one atlas are drawn in one batch, so there should be fewer draw calls than today.

**Tools.** An art gallery page (dev only) shows every piece with its contract: the default and any custom version side by side, flipbooks playing, hitbox and pivot overlays, and the piece in a game scene. `art/README.md`, generated from the manifest, is the guide for an artist.

**Still drawn live:** text (Phaser Text, the same fonts) and the debug view (Phaser Graphics, dev only).

**Scope update for M8a:** producing the built-in cartoon artwork and selecting classic/cartoon through a Config-triggered reload are now planned before the v3.0.0 release. Arbitrary third-party pack selection, swapping loaded textures during play, and changing hitboxes to fit art remain outside this milestone.

## 6. Target device and budgets

The weakest device is an **iPhone 13 mini**: A15 chip, 4 GB of memory, a 60 Hz screen, 375 × 812 CSS pixels at a pixel ratio of 3 (the game caps it at 2, as today, so the canvas is 750 × 1624 in portrait), and Safari's WebKit engine (every browser on iOS uses WebKit). Proposed budgets, measured on that phone:

- **Frame rate:** a steady 60 fps in every mode, split screen included: no frames over 34 ms in a normal run (the debug view's `slow` counter), and the JS part of a frame no more than about twice today's.
- **Start:** a playable title within about 1.5 s of the page loading (once cached), loading and decoding the boot atlas included.
- **Texture memory:** at most **120 MB at a pixel ratio of 2** (set after the M1 spike; well under the 150 MB the plan aimed for). iOS reloads a page whose memory grows too large, and WebGL textures count towards it. The phone's texture size limit, read in M1, is 16384 pixels.
- **Memory over time:** no growth of the post-GC heap over 30 game-minutes (measured in Chrome, which reports the heap; Safari doesn't).

Measuring on the phone: `?frames=1` shows a frame-time readout in either version (frames that came late, once or more than once, and the worst; tap it to start counting again). It draws nothing on the canvas, unlike the debug view (D), whose own drawing makes frames slow (M7). Safari's Web Inspector (from a Mac) gives timelines and memory. CI runs the browser tests in Chromium only, so anything WebKit-specific is caught on the phone.

## 7. Risks and how the plan deals with them

| # | Risk | Mitigation | Where |
|---|---|---|---|
| R1 | The Graphics API gap (curves, caps, joins) breaks "identical". | The drawing code never runs in Phaser: at build time it generates SVG, which has curves, caps and joins. The recorder and SVG writer are pure and tested in Node. | M1, M4 |
| R2 | Textures cost memory, the tightest limit on the iPhone 13 mini. A full-screen backdrop layer at 2× is ~15 MB, and there are five layers. | Backdrop tiles instead of full strips; soft scenery packed at a lower scale; 1× atlases on 1× screens; a measured texture budget with a go/no-go gate (section 6). | M1, M4, M7 |
| R3 | **HiDPI.** No `resolution` in Phaser. | Canvas size = CSS size × ratio (capped at 2 as today), camera zoom × ratio, text `resolution`, and atlases at 1× and 2×. Prototyped in the spike. | M1, M2 |
| R4 | **Animated art** (wings, legs, tails, eyes, flames, bees, spider threads, settling lianas) is redrawn every frame today. | Joints for what turns (monkey limbs, swinging lianas, tails), flipbooks for what changes shape (wings, bees, flames), ropes and stretch pieces for what changes length; each flipbook's frame count is chosen so the diff stays within tolerance. | M4–M5 |
| R5 | **Tinting** whole layers and the temple. | Backdrop and temple pieces are sprites, and tint multiplies as today; the fires are not tinted. | M5 |
| R6 | **Tests**: Phaser can't load in Node. | Split each view into a plain view-model (what to draw, where, how: tested in Node as now) and a thin Phaser adapter (smoke-tested in a real browser). | M0, throughout |
| R7 | **Audio parity and unlock**: the earlier sound bugs (suspended contexts after tab switches) were subtle. | Our recipes connect to Phaser's context and master nodes. The existing debug state (`sound running`, `locked`, `rebuilt`) and the player tests are carried over, plus an offline render of each recipe compared old against new. | M3 |
| R8 | **Input semantics** (key repeat ignored, `consumePress`, touch rules, buttons intercepting taps). | Keep our semantic layer and feed it from Phaser Input; `input.test.js` adapted to drive the adapter with synthetic events. | M3 |
| R9 | **Fullscreen, safe areas, iOS** quirks, portrait follow. | `layout.js` stays authoritative; the Scale Manager only provides the size; fullscreen via `scale.startFullscreen` on `pointerup`, keeping the exceptions. | M2 |
| R10 | **WebGL context loss** (phones backgrounding the page). | Keep our pause-and-notice handling. Atlases are images, so Phaser uploads them again after a context loss; nothing has to be redrawn. Tested with the `WEBGL_lose_context` extension. | M2 |
| R11 | **Startup time**: loading and decoding the atlases. | A small boot atlas first, the rest during the title; budget in section 6. | M1, M7 |
| R12 | **Performance**: Phaser replays Graphics every frame. | Nothing in the game is Graphics at runtime (only the debug view). Pieces are batched sprites. Measured with the existing long-run harness, ported. | M1, M7 |
| R13 | Phaser 4 is young (4.0.0 came out in April 2026, 4.2.1 in July). | Pin 4.2.1; the spike exercises exactly the features we need; a short list of known-bad areas kept in this document. | M1 |
| R14 | Master keeps changing `src/render/*` during the migration. | Merge master into `phaser` regularly; a visual change on master needs a matching change in `src/phaser/` (a checklist item on each such PR). | workflow |
| R15 | Two versions to keep working until M8. | The shared code (sim, layout, loop, recipes) is untouched; each version's own code lives in its own folder; CI runs both versions' tests and smoke tests. | M0–M8 |
| R16 | **Rig fidelity**: rebuilding each object from pieces must match today's drawing. | The parity tool on every kind and variant; the M4 inventory lists any case that can't match exactly, with its diff, for approval. | M4–M5, M7 |
| R17 | **Rasterizers differ**: the same SVG renders slightly differently in different tools. | The spike compares a browser rasterizer (Chromium through Playwright, already in CI) with a pure-npm one (resvg) against Pixi's output, and the closest is used for every piece. | M1 |
| R18 | **Custom art breaks things later** (wrong size, frames or pivot). | The contracts, the validator in CI and the gallery; a replacement drill in M7 proves the path. | M4, M7 |
| R19 | **Detailed cartoon art obscures hazards or reintroduces visible stutter.** | Approve art at actual game sizes; keep readable silhouettes, established motion/softening and texture budgets; check fast pans and catches in Safari with both packs. | M8a |
| R20 | **Pack selection mixes assets, downloads both packs, or loses settings on reload.** | Separate complete catalogs; resolve selection before loading; fetch only the selected pack; reuse and test the Config reload/settings behavior. | M8a |

## 8. Milestones

Sizes are relative: S (about a day of focused work), M (a few days), L (a week or more).

### M0. Groundwork and the parity tool (M)

- Add `phaser@4.2.1` next to `pixi.js`; Vite config; report the bundle, try the custom entries and record what each saves.
- Create `src/phaser/` and the `?engine=pixi|phaser` switch, each version behind a dynamic import; the game still defaults to Pixi.
- **Parity tool**: a dev-only page that renders the same scenario with Pixi and with Phaser and reports a pixel diff, so "identical" is measured, not judged by eye. Scenarios come from deterministic states (fixed seed, stopped ticker, fixed time): title in each mode and settings combination, each stage and time of day, a gallery of every obstacle kind, decoration and temple variant, every liana state, monkey poses, HUD with hearts and bananas, split and shared panes, pause, results, the debug view. The tool goes with Pixi in M8.
- CI: a Playwright job (Chromium only) for the smoke tests of both versions, kept separate from the fast `npm test`.
- Define the test split for views: for each of the ~11 Pixi-touching test files (hud/banana, branchDecorations, debugOverlay, hearts, interpolate, lianaView, shadow, swing, stageViews, templeFire, split) list which assertions the Phaser version's view-models must also cover. The Pixi tests themselves stay as they are until M8.
- **Done when:** `?engine=phaser` boots a blank scene, `?engine=pixi` (and no parameter) plays the game as today, the parity page runs one scenario both ways, and CI runs a smoke test of each.

**M0 report (done, version 3.0.0-dev.1).**
- **The switch.** `index.html` loads `src/boot.js`, which reads `?engine` (`src/engine.js`, unit tested) and imports `src/main.js` (the Pixi version, unchanged) or `src/phaser/main.js`. The Phaser version so far is a placeholder scene that names itself ("Phaser 4.2.1: not playable yet"), with Phaser's sound turned off until M3 and its frame-time smoothing off. `boot.js` marks the page (`data-engine`, `data-ready`) for the browser tests and shows the error screen if a version fails to load.
- **Download.** Each version is its own chunk, so a page loads only its own library. The Pixi version downloads what it did before (its main chunk 177 KB, 56 KB gzipped, plus Pixi's chunks). The Phaser version's chunk is 1,375 KB, **358 KB gzipped**: Phaser's own ESM build, all of it.
- **Custom Phaser builds** (Phaser's source entries built with Vite, gzipped at level 9): the ESM build as shipped 352 KB; `src/phaser.js` 347 KB; `src/phaser-no-physics.js` 302 KB; no physics and WebGL only **296 KB, 56 KB (16 %) less**. The last one boots and draws in Chromium. It needs two build tweaks: Node's `global` mapped to `globalThis`, and a transform that replaces Phaser's feature flags (`typeof CANVAS_RENDERER` and the like) the way its webpack build does. It is left for M7, since the dev server's dependency pre-bundling needs the same transform.
- **Parity page** (`parity.html`, dev only, `src/parity/`): draws each scenario with both libraries at a pixel ratio of 1 and shows the two pictures and their differences. The diff (`src/parity/diff.js`) is unit tested. Its one scenario so far, basic shapes drawn with each library's own calls, differs on **0.23 %** of the pixels, all on antialiased edges (largest difference 64/255): inside the 1 % limit.
- **Browser tests** (`npm run test:browser`, Playwright in Chromium, `browser-tests/`): the production build starts without errors as the default, the Pixi and the Phaser version; the Pixi version starts a run on Space (dev hooks); the parity page draws its scenarios with both versions. CI runs them as a job of their own ("Browser tests") after `npm run build`. Locally `CHROMIUM` can point at another Chromium.
- **The view tests**: appendix B lists what the Phaser version must also cover. Most of the ~11 files test plain helpers (text lines, tints, banner fades, decoration data) rather than Pixi objects. Only about 18 tests build Pixi objects. Moving those helpers out of the Pixi view files into shared modules (in M5 and M6) lets one set of tests cover both versions.

### M1. Spike: prove the approach and set the budgets (M, a decision gate)

Build the minimum of M4 and M2, the whole path from drawing code to SVG to atlas to rig, for three representative objects:

1. one **backdrop layer** (large, soft, tinted, tiled and scrolling);
2. the **panther** on a branch (a rig with joints and a flipbook for the eyes and tail);
3. a **liana** with its own leaf pattern (a rope with leaf pieces, swinging and settling).

Measure on desktop, with CPU/GPU throttling, and **on the iPhone 13 mini**: pixel diff against Pixi, atlas size and texture memory, load and decode time, per-frame JS time, draw calls, the phone's texture size limit, and crispness at 1×, 1.5× and 2× pixel ratios. Compare the two rasterizers (R17). Replace one piece with a hand-made placeholder, as a PNG and as an SVG, and confirm nothing else has to change. Also try Phaser's native Graphics for the same three objects, to confirm the decision with numbers.
- **Done when:** a short report in this document records the numbers and the choices: the rasterizer, the atlas scales and sizes, the rig patterns, the HiDPI method, startup time, the texture budget. **Go/no-go**: if the section 6 budgets can't be met on the phone, stop and revise the plan before M2.

**M1 report (version 3.0.0-dev.2; desktop done, the phone pending).**

What was built (all dev only, removed or replaced in M4):
- `src/art/recorder.js` records the Pixi `Graphics` calls, `src/art/svg.js` writes them as SVG; tested in Node, and checked against Pixi's own instructions for a liana. To give the rigs the pieces separately, the three objects' drawing code was split into exported functions (`lianaShape`, `drawTrunk`, `drawBranchBody`, `drawPantherBody`, ...); the Pixi version draws exactly as before (its recorded instructions were compared before and after for 67 branches, the lianas and the backdrop).
- `npm run art` writes `art/generated/*.svg` and `art/manifest.json` for 11 pieces (28 frames, `src/art/spike.js`); a test fails when they are out of date. `npm run art:atlas` packs the atlases into `art/build/` (not committed; CI builds them before the browser tests).
- Rigs in Phaser (`src/spike/rigs.js`), parity scenarios for them (`src/parity/spikeScenarios.js`), a rasterizer comparison page (`spike/compare.html`) and a bench page (`spike/bench.html`, `npm run spike:bench` for a production build on the local network).

**Rasterizer: resvg** (`@resvg/resvg-js`, pure npm). Against Pixi's own drawing of every piece frame, resvg differs on 0.14 % of the pixels and Chromium on 0.16 %; both differ only on antialiased rims a pixel wide (Pixi multisamples, the rasterizers compute coverage). resvg needs no browser and renders the 28 frames at both scales in under half a second.

**Parity** (share of pixels over 8/255; "solid": over the limit with all eight neighbours too, see below). The browser test now requires every scenario to pass.

| Scenario | 1× | 1.5× | 2× |
|---|---|---|---|
| Far backdrop, by day | 0.08 % | | 0.23 % (59 solid: the 1× tile stretched) |
| Far backdrop, dusk tint | 0.47 % | | |
| Branch with a panther, eyes open | 0.65 % | 0.29 % | 0.33 % |
| The same, blinking | 0.62 % | 0.28 % | 0.33 % |
| Lianas: rest, swinging, settling, lit tip | 0.81 % | 0.62 % | 0.41 % |
| Native Phaser Graphics (backdrop, panther, lianas) | 0.02–0.06 % (36 solid: no round caps) | | |

**Bake scales.** Pieces are rasterized at their largest game scale (obstacles 1.3, stage 4) times the atlas scale (1 or 2). Thin strips (the rope, the tip flash) are rasterized at twice that: a thin strip at an angle samples more smoothly scaled down (the lianas went from 1.04 % to 0.81 % at 1×). Backdrop tiles only at 1×: stretched on 2× screens they differ by 0.23 %, and a 2× tile would cost 56 MB instead of 14 MB.

**Atlases.** The spike's pieces: `atlas@1x` 1024 × 232 (15 KB PNG, 0.9 MB as a texture), `atlas@2x` 2048 × 448 (35 KB, 3.5 MB), the far backdrop tile 2048 × 1790 (189 KB, 14.0 MB). Most of the atlas area is the rope (420 units at 4 px a unit at 2×). Shelf packing into one SVG, rendered once per scale.

**Rig patterns**, all proven in the parity scenarios:
- *plain piece* (the branch, the panther's body): an Image whose origin is the drawing's origin;
- *stretch piece* (the trunk, drawn 100 units tall and scaled to each trunk's length; the bark lines, turned and stretched): exact for straight-sided shapes;
- *flipbook* (the tail, 16 frames picked from its swish; the eyes, open and shut);
- *joint* (the ear folding about its base; the body breathing);
- *rope* (the liana's rope and tip flash): a straight strip piece bent along the points the code computes, on a Phaser `Rope`. A Rope spreads its texture evenly over its points, which squashed the round caps; the rig lays it by distance instead (`bendStrip`, tested);
- *placed pieces* (each liana's leaves, where and as the code places them today);
- *tinted tile* (the backdrop: a `TileSprite` scrolled with `tilePositionX` and tinted).

**HiDPI method.** The Scale Manager in `NONE` mode with a canvas of the CSS size times the pixel ratio (capped at 2) and `scale.zoom` of 1/ratio, so the canvas keeps its CSS size; the camera zooms by the fit times the ratio. The 1× atlas on 1× screens, the 2× atlas on anything denser (1.5× screens scale it down: 0.28–0.62 % above). M2 does the same with resizing.

**Performance** (the bench: 24 branches with panthers, 24 lianas swinging, settling and blinking, the far backdrop scrolling, in a 1280 × 720 view; headless Chromium with software WebGL, so the CPU times compare, the frame rates only relatively):

| | JS per frame (mean, 95th percentile) | Draw calls | Textures |
|---|---|---|---|
| Pixi (today) | 3.7 ms, 6.1 ms | 99 | (none) |
| Phaser, atlas rigs, 1× / 1.5× / 2× | 1.0 / 1.2 / 1.4 ms, under 2.1 ms | 50 | 14.9 MB (1×), 17.5 MB (2×) |
| Phaser, native Graphics | 29 ms, 41 ms | 6 | none |

With a screenful (4 branches, 4 lianas): atlas rigs 0.47 ms and 10 draw calls, Pixi 1.4 ms and 19. In software WebGL the atlas version also draws 3–4 times faster (19 fps against 5).

**Native Graphics**, for comparison: it looks nearly identical (curves sampled, no round caps or joins), but Phaser rebuilds a Graphics' geometry every frame: the static backdrop alone costs 23 ms a frame (0.26 ms as a tile). With no way to replace its art either, this confirms the plan: native Graphics only for the debug view.

**Start** (production build, local server): the first frame 1.1–1.3 s after navigation for all three; loading and decoding the art 80 ms (1×) to 110–160 ms (2×).

**Custom art.** `art/custom/panther.eyes.0.png` (a magenta placeholder of any size, stretched over the piece's box) and `art/custom/liana.leaf.1.svg` (a blue diamond in the piece's box) were packed into both atlases and showed in the Phaser rigs with no code change; removing them brought the generated pieces back.

**What the parity share misses.** The magenta eyes still passed, at 0.71 %: a small object on a large picture moves the share very little. So the parity page now also counts *solid* pixels (over the limit with all eight neighbours too). Antialiasing rims leave next to none (0–2 on the panther), while wrong art leaves a patch (the magenta eyes 96 at 1×, 472 at 2×). The same count found the rope's flat ends (18 at 1×, 209 at 2×) before they were fixed. It is now part of "identical" (section 1): at most 25 solid pixels per million. The native Graphics scenarios, which miss the round caps, would fail it and were dropped from the parity page once M1 had recorded them.

**Phaser 4.2.1 notes** (the known-bad list, R13):
- `Rope` spreads its texture evenly over its points, not by distance (the rigs set the UVs themselves).
- A `Rope` breaks the sprite batch, so each liana costs two draw calls. In M5a all ropes go in one layer and all leaves in another.
- `Graphics` geometry is rebuilt every frame: never for static or large drawing.
- No `resolution`: the HiDPI method above.

**Texture budget (proposed).** An estimate for the whole game at a pixel ratio of 2:
- backdrop tiles at 1×: three parallax layers like the far one, at about 14 MB each, plus smaller canopy and floor strips, about 45–55 MB;
- object atlases at 2×: two to four 2048 × 2048 sheets at 16 MB each, about 32–64 MB.

That is 80–120 MB, so the budget is **120 MB at a ratio of 2** (agreed after M1). If the phone needs less:
- the upper part of each backdrop tile (only seen in tall portrait views) becomes a smaller repeating tile;
- mostly empty layers are trimmed.

**On the iPhone 13 mini** (Safari, landscape, a pixel ratio of 2, the bench built for production and served from a computer on the same network):

| | fps | worst frame | `slow` | JS per frame | Draw calls |
|---|---|---|---|---|---|
| Atlas rigs, 4 branches + 4 lianas (about a game screen) | 60 | 17 ms | 0 | 3.5 ms | 10 |
| Atlas rigs, 24 + 24 | 60 | 20 ms | 0 | 5.8 ms | 50 |
| Pixi (today), 4 + 4 | 60 | 17 ms | 1 | about 3 ms (one frame's reading) | 19 |
| Pixi (today), 24 + 24 | 50 | 27 ms | 1 | (one frame's reading only) | 99 |
| Native Phaser Graphics, 4 + 4 | 4 | 260 ms | 44 | 255 ms | 5 |

Other numbers from the phone:
- The texture size limit is **16384** pixels (the plan had assumed 4096).
- Loading and decoding the 2× art took 42–52 ms.
- The pages started 9–10 s after navigation. That is the 1.7 MB bench bundle, which holds both libraries, fetched over Wi‑Fi on a first load; it says nothing about the game's start, which M7 measures on the real build.

The atlas rigs hold 60 fps under the stress load, where Pixi drops to 50, and native Graphics is unusable on the phone.

**Go/no-go: go.**
- The section 6 frame-rate budget is met with room to spare.
- The texture size limit is no constraint.
- Parity is within the limit everywhere, and art can be replaced with no code change.

### M2. Platform: Game, Scenes, Scale, lifecycle (M)

- `Phaser.Game` config (WebGL, antialias, our canvas, audio on, `fps.smoothStep: false`, no auto-pause surprises); Boot, Play and UI scenes.
- Scale Manager and the pixel-ratio method from M1; `layout.js` feeds the letterbox, safe areas, the portrait and landscape frames, and the shared zoom; resize, rotate and pixel-ratio changes.
- The letterbox, loading the atlases, the fatal overlay (DOM, unchanged), `window.__liano` dev hooks.
- Pause on blur or hidden, `P`, `Esc`, context loss and restore (pause, notice; the atlases upload again by themselves).
- Fullscreen on Phaser's Scale Manager with the existing exceptions and the `pointerup` rule.
- **Done when:** every layout shape (the cases `layout.test.js` covers, plus a phone, an iPad, portrait) draws a correct letterboxed empty frame; fullscreen and context-loss smoke tests pass; `layout`, `pause` and `fullscreen` tests pass, adapted.

**M2 report (done, version 3.0.0-dev.3).**
- **Shared with the Pixi version** (moved out of `main.js`, which now uses them; unit tested):
  - `src/screen.js`: the pixel ratio, the safe-area probe, the once-a-frame screen-change watch (resize, rotation, the iOS address bar, a pixel-ratio change without a resize), the home-screen check and the gesture blocking.
  - `src/controls.js`: the buttons' tap targets and where a pointer is among them.

  `layout.js`, `pause.js` and `fullscreen.js` are used unchanged, so their tests stand as they are.
- **The game** (`src/phaser/main.js`): WebGL, antialiased, Phaser's frame-time smoothing off. The Scale Manager in `NONE` mode with the M1 HiDPI method (`src/phaser/view.js`):
  - the canvas is the window's CSS size times the pixel ratio (capped at 2), shown at the CSS size;
  - each scene's camera has the layout's view as its viewport (whole pixels), zoomed by the layout's scale times the ratio;
  - outside the viewport is the black background: the letterbox, with nothing drawn over it.

  The view's corners land exactly where the Pixi version draws them, which is tested for 8 window shapes at 3 ratios.
- **Scenes** (`src/phaser/scenes.js`):
  - Boot: has the slot for loading the atlases (M4), then starts the others.
  - Play: draws the empty frame (the view and the world band in it).
  - UI: shows the version, "Paused", and a stand-in full-screen button.

  They follow a `layout` event from the platform, which also holds the pause and full screen.
- **Pause**: `pause.js` as in the Pixi version: blur, hidden, a lost context, and P. Phaser itself stops its loop while the page is hidden; on blur it keeps drawing, as the Pixi version does.
- **Context loss**: Phaser's renderer events pause the game and show the notice; after 5 s without a restore, the error screen. Phaser uploads the textures again by itself.
- **Full screen** through the Scale Manager (`src/phaser/fullscreen.js`):
  - The whole page goes full screen (`fullscreenTarget` is the document's root), so the HTML overlays stay visible.
  - Same interface as `fullscreen.js`, so the F key and the button's pointerup rule are shared.
  - Phaser ignores a refused request's promise, which would reach the error screen, so the adapter makes the request and ignores the refusal.
  - The home-screen app and iPhone Safari get no button.
- **Errors**: an error anywhere shows the error screen and stops Phaser's loop. `window.__liano` has the game, the platform, the layout, the camera, the pause and full screen.
- **Browser tests** (`browser-tests/platform.spec.js`, 15 tests), checking the snapshot's pixels where it matters:
  - the letterboxed frame at 7 window shapes: 16:9, a phone in landscape, an ultra-wide with bars, an iPad, two portrait phones, 1.5×;
  - following a resize to portrait, and a pixel-ratio change (watching the ratio's media query is unit tested: in CI's Chromium an emulated change did not reach it);
  - F into and out of full screen, for both versions;
  - the button's tap entering full screen on release;
  - a lost and restored context, for both versions;
  - P pausing and resuming.
- **Found for M3**: Phaser 4.2.1's keyboard plugin queues a frame's key events and hands a scene the whole queue again with each new event. Its duplicate check compares only with the previous event, so two presses in one frame toggle twice. P is read from the DOM until then; the input adapter in M3 has to read keys so that each press counts once.
- **Left for later**:
  - Phaser's audio stays off until M3, which wires the sound.
  - Esc is a game action (back to the title) and comes with the input (M3).
  - The two-player frame and the shared zoom come with the panes and modes (M6); `layoutFor` and `paneLayouts` already cover them.
  - Loading the atlases comes with the art pipeline (M4).

### M3. Input and audio on Phaser (M)

- **Input** adapter on Phaser's keyboard and pointers: `KEYS`, key repeat ignored, shift avoided, the toggle keys (`D G H S M F P Esc 1 2 3`), `consumePress`/`consumeModePick`, touch taps, the buttons' tap interception, `accepts` (no input while paused or just resumed). `input.test.js` adapted.
- **Audio** on Phaser's `WebAudioSoundManager`: our recipes (`audio/recipes.js`, unchanged) connect to its `destination`; mute, pause, volume, unlock and resume handled by Phaser, plus the extra recovery we had to add (rebuilding a context that stays suspended, the clock check) if Phaser's own handling doesn't cover the cases we hit; the debug `sound` line kept.
- **Done when:** the player, sounds and recipes tests pass adapted; an offline render of every sound matches the current one sample for sample (the same recipes, so it should); a manual pass on desktop Chrome, Firefox, Safari and the iPhone 13 mini confirms sound survives tab switches and reloads.

**M3 report (version 3.0.0-dev.4; the manual sound pass is done in Safari on macOS, the rest follows M5).**
- **The game runs in the Phaser version.** What both versions do apart from drawing moved out of the Pixi `main.js` into `src/driver.js`:
  - presses applied at sim-step boundaries;
  - the toggle keys;
  - pause (P pauses only a run);
  - the obstacle prefetch;
  - the sounds for each frame's events.

  It is unit tested, and the Pixi version uses it unchanged in behaviour. The Phaser version runs it on every Phaser step. Until M5 and M6 draw the game, its UI scene shows a readout: mode, state, score, the settings, the keys and, with D, the frame rate and the sound's state. Stand-in mute and full-screen buttons sit where the Pixi version's are. The two-player modes switch to the 16:9 frame.
- **Input on Phaser** (`src/phaser/input.js`). Phaser's keyboard and pointers become the event sources `input.js` reads, so its rules hold unchanged:
  - key repeat ignored;
  - Space kept from scrolling;
  - the toggles;
  - presses queued for the next step;
  - no presses while paused or just after resuming;
  - taps on the buttons kept out.

  Each key event is passed on once, against the replay found in M2. Phaser reads mouse and touch events, so each pointer is described as a pointer event: the kind, the button, and the touch's own page position. Phaser allows one touch pointer by default; the game asks for 4, since every finger is a press, as in the Pixi version. F and the full-screen button stay on DOM events, which keeps the request inside the gesture (`fullscreen.js`, shared).
- **Sound on Phaser** (`src/phaser/sound.js`). The recipes (`audio/recipes.js`, unchanged) play through Phaser's audio context and its master mute and volume nodes. Phaser unlocks the context at the first gesture, and mute is Phaser's mute node. The player itself (`audio/player.js`) gained a few hooks and is otherwise the same code in both versions.
  - **Pause:** Phaser resumes a suspended context every frame while the game has focus, which would undo the game's pause and mute. The player sets the flag Phaser keeps for a lost focus while the context is to stay suspended.
  - **Recovery:** a context that stays stuck is replaced at the next gesture through Phaser's `setAudioContext`, which also makes new master nodes; mute is applied to them again.
  - **Refusals:** Phaser calls `resume()` and `suspend()` without handling a refusal, which would reach the error screen; the player marks them as handled.
- **Findings:**
  - Phaser's `mute` reads its mute node's current value. A suspended context never updates it, so it can read `false` while muted. Nothing in the game reads it.
  - Chromium's offline rendering is not bit-for-bit repeatable: two renders of the same graph differ by up to 6e-8, one 24-bit step. "Sample for sample" is therefore checked as within 1e-6, far below a 16-bit step (3e-5).
  - Phaser creates its audio context at boot, before any gesture. Browsers log a warning for that, not an error.
- **Tests:**
  - Unit tests: the driver (8), the input adapter (7, including two presses in one frame), the Phaser sound player (5). The player tests stand unchanged.
  - Browser tests (`browser-tests/game.spec.js`):
    - the Phaser version plays: Space starts a run, Esc goes back to the title, 2 picks the shared mode and its frame;
    - two P presses in one frame count once each;
    - a tap starts a run, but a tap on the mute button mutes instead;
    - the sound starts at the first gesture on Phaser's context, plays, and mute keeps the context suspended;
    - every recipe rendered offline through the Phaser path matches the Pixi path (15 sounds, the largest difference under 1e-6).
  - CI runs the browser tests one at a time: two software-rendered pages at once starved each other on the runner.
- **Manual sound pass:** done in Safari on macOS. Space, the crash on a fall, tab switches, reloads and M all work. The rest moves to after M5, when the game is drawn: the pling needs a banana to be caught, and Chrome, Firefox and the iPhone 13 mini still need checking. How it is done:
  1. Run `npm run dev:host` and open the printed address with `?engine=phaser` on desktop Chrome, Firefox and Safari, and on the iPhone 13 mini.
  2. Start a run and let the monkey fall, which plays the crash; take bananas, which play the pling.
  3. Switch tabs and back, lock and unlock the phone, and reload; the sounds should still play. D shows the sound's state.

### M4. The asset pipeline: generated, replaceable art (L)

- **Inventory**: every object kind, its pieces, what varies per object and how each maps (section 5); the cases that can't match exactly, with their diffs, for approval.
- **Recorder and SVG writer** for the Pixi `Graphics` calls the code uses (`moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo`, `arc`, `circle`, `ellipse`, `rect`, `roundRect`, `poly`, `closePath`, `fill`, `stroke` with width, colour, alpha, cap and join, `clear`); pure, tested in Node.
- **Generator** (`npm run art`): runs the drawing functions for each piece, frame and variant, writes `art/generated/*.svg` (with the hidden guide layers) and `art/manifest.json`; CI checks they are up to date.
- **Contracts and overrides**: `art/custom/`, the optional sidecar JSON, the validator (`npm run art:check`, in CI).
- **Build step**: rasterize and pack the atlases at 1× and 2×; a loader that picks the set by pixel ratio, the boot set first.
- **Runtime helpers**: rigs (pieces with pivots and attachment points), flipbooks, 3-slice stretch pieces, ropes, tint groups, the additive glow.
- **The art gallery page** and the generated `art/README.md`.
- **Done when:** every piece is generated and shown in the gallery; the gallery shapes are within the parity tolerance (section 1); the recorder, writer, manifest and validator tests pass in Node; replacing one piece with a placeholder in a test build shows in the game with no code change; atlas sizes and load time are inside the budgets.

**M4 inventory** (from the drawing code; how each kind of variety maps to pieces, section 5). *Exact*: the rig reproduces the drawing up to antialiasing. *Close*: a continuous change approximated, checked against the parity limit.

| Object | Pieces | Variety and how it maps |
|---|---|---|
| Liana (3 palettes: green, gold, shadow grey) | rope strip, tip flash strip, leaf (light, dark) | Bent rope (M1); leaves placed per liana. Exact. |
| Monkey (2 palettes + shadow) | tail, torso, head, eyes, dead eyes, arm, leg | Limbs turn about their pivots, body turns, facing flips, blink alpha. Exact. |
| Branch | body, bark line, trunk | Bark lines placed and stretched (M1); trunk stretched. Exact. |
| Supports (vines, trunks, stems, ledges) | vine strip and end, trunk, stem, hive trunk, sling, ledge | Trunks and stems stretched; a vine from the canopy is a strip bent along its curve, with round ends. Exact (vines close). |
| Thorn bush | bush circles, highlight, thorn | Thorns placed and turned per bush. Exact. |
| Rock | 24 outlines (body with facets), ledge, stem | **Decided after M4's inventory: a fixed set of 24 outlines**, one picked per gap in both versions (a random outline per gap cannot be pre-rendered). Exact. |
| Beehive | nest, bee body, bee wing | Bees placed per frame, wings beat (scale). Exact. |
| Temple (4 looks) | per look: the top (shrine, tiers, the stairs on them, the look's details and braziers), the base's first repeat, the base and stairs repeats; flame flipbook (7 sways × 7 heights), glow; haze; moss, vine, leaf (8 greens) | Base and stairs stacked down to the floor, the last copy cropped; moss and leaves placed; vines along their curves; the glow sixteen discs, scaled, faded and added (M5d). Exact, vines and the flame close; the last rows above the floor close (under the fringe). |
| Decorations: panther | as M1 | Exact (tail flipbook). |
| bird | tail, body, head (3 colourings) | Head and tail turn. Exact. |
| snake | coil band (trunk, limb), tail (trunk, limb), scale mark, neck strip and end, head, tongue | Limb bands stretched across to the limb's thickness, the neck a strip along its curve. Close. |
| hanging monkey | arms, leg segment and end, body, tail flipbook (13), eyes | Legs from a segment and round ends. Exact (the tail close). |
| nest (3 states) | back, front, rim, twigs (dark, light, rim) with ends, egg, shell, chick, beak flipbook (9), cap, leaf | Twigs from segments and round ends; the egg rocks. Exact (the beak close). |
| hanging bat (4 looks) | body, ear flipbook (9), eyes (shut, open) | Close (the ear's twitch in 9 steps). |
| owl | body, skull, face disc, eye, pupil, beak | Face and pupils slide, blink. Exact. |
| flowers | stem, leaf (2 greens), petal, heart (white, tinted per colour) | Stems stretched (a quadratic curve stays itself under scaling, its line and ends a little thinner along it), petals placed. Close. |
| coconuts | frond, stem segment and end, nut (with highlight and eyes), hair | Nuts scaled, hairs placed and turned; the stem's bend is round instead of mitred. Close at the bend. |
| Spider | body, leg segment and joint, thread | Legs from two turned segments and round joints (exactly the drawn line); thread stretched. Exact. |
| Snake (moving) | stalk strip and end, stalk leaf (2 sides), coil, head | Head flips; the stalk bent along its curve. Exact (the stalk close). |
| Birds (red, blue, purple) | body, wing flipbook (33) | Close (the wing in 33 steps). |
| Bats (4 looks, flying and circling) | body, wing flipbook (41) | Close (the wing in 41 steps). |
| Banana, heart | banana, glint, field heart, HUD heart (filled, outline), HUD and results bananas | Exact. |
| Backdrop | sky (32 bands, stretched), far, mid, near (two strips: under the canopy, along the floor), canopy and floor tiles, floor fill | The far and mid tiles at 1× (M1), the near, canopy and floor tiles up to 2× (M5d); tinted. Exact (the sky's band edges blend when stretched; the far and mid edges soft on 2× screens, M5). |
| HUD and overlays | panel (9-slice), banana icon, off-screen arrow, mute and full-screen icons | Text stays Phaser Text. Exact. |
| Debug view | | Phaser Graphics (dev only). |

**M4 report (version 3.0.0-dev.5).**
- **Every picture is a piece.** 173 pieces, 591 frames, generated into `art/generated/` (SVG, committed) with `art/manifest.json`, from the game's own drawing code. The inventory above is updated with what each piece became. The definitions are in `src/art/pieces/`.
  - To get there, the drawing code was split into exported functions, one per piece, with placement and pose computed apart from drawing. The Pixi version is unchanged: `scripts/dev/dump-views.mjs` records everything the Pixi views draw (every obstacle and decoration at two scales, every temple look by day and night, the moving obstacles at several times, games in each mode), and the dump was the same after every step.
  - Rocks come in **24 outlines**, one picked per gap in both versions (decided after the inventory).
  - Obstacles are **not tinted**, as today; the temple and the backdrop are. The temple's flames and glow are not.
  - Lines (legs, twigs, a coconut's stem) are a straight **segment** piece, stretched and turned, plus a round **joint** piece at each end and corner: together exactly a line with round ends and joins. Curves (vines, stalks, the snake's neck) are strips bent along the curve, with joints for their round ends.
  - The temple's base and stairs reach the floor, which depends on how high the temple stands. They are pictures that repeat (92 px of base, 8 steps of stairs), stacked down to the floor with the last one cropped. The fixed part above them is one picture per look.
  - The haze is soft, so it is rasterized at half the scale, and only its top half is kept (the floor hides the rest). The floor tile keeps only its top 74 px; below it a stretched square of the floor's colour.
- **Atlases at 1×, 2× and 4×.** The scale is picked by device pixels per world unit (the layout's scale × the pixel ratio), allowing 1.25× upscaling. On a laptop or desktop with a large window this exceeds 2: 1920 px wide at a ratio of 2 is 3 px per unit. So a 4× set was added; phones use 1× or 2×.
- **Texture memory** (atlases and tiles, one scale loaded at a time): **48 MB at 1×, 86 MB at 2×**, 234 MB at 4×. The build reports it, and **fails** over 120 MB at 2× (the budget) or 300 MB at 4× (a ceiling, agreed after M4, so the desktop set cannot grow unnoticed). The tiles are 35 MB of that; the top of each tall layer could still become a small repeating tile if the phone needs less (section 6).
- **Load times** (Chromium in the CI container, dev server, not the phone): the boot set in 0.26 s at 1× and 0.45 s at 2×; the main set behind the title in 0.6 s and 1.7 s. M7 measures the start on the iPhone 13 mini against the 1.5 s budget.
  - Boot set: the backdrop, player 1's monkey, the green lianas, bananas, hearts and the UI.
  - Main set: everything else. **Agreed after M4:** in M5 a run waits for the main set (Space pressed before it is in starts the run as soon as it arrives). If M7 finds the wait noticeable on the phone, the first stage's obstacles move to the boot set.
- **Runtime helpers** (`src/phaser/art.js`, unit tested):
  - images with their pivot, flipbook frames, strips bent along a rope (M1), tiles;
  - `column` stacks a repeating piece down to a depth;
  - `nineSlice` makes a panel (9-slice);
  - `glow` adds a piece's light to what is behind it;
  - `tint` tints the pieces of a group that take the stage tint and leaves the others.
- **The gallery** (`art.html`, at `?scale=1|2|4`) shows every piece and frame from the built atlases next to the game's drawing of it, with the difference and the guides. Results:

  | Atlas scale | Pixels differing | Solid per million | Frames over their limit |
  |---|---|---|---|
  | 1× | 0.40 % | 0 | none |
  | 2× | 0.40 % | 2.9 | none |
  | 4× | 0.22 % | 15.9 | none |

  How it judges: the share and the solid patches per million are taken over all frames together, as if the pieces covered a scene (limits 1 % and 25). A single frame fails if its solid patches alone would fail a 1280 × 720 view at that density (23 px at 1×, 92 at 2×, 369 at 4×). Judged per million of its own few thousand pixels, one solid pixel would fail it.

  The game's drawing is made at the final size, because Pixi builds a drawing's triangles in its own units, and a container scaled up shows their corners. An empty frame (a bird's wing seen edge on) is compared with an empty cell.

  What is left are rasterizer differences on tiny round shapes: Pixi cuts a very sharp round join short (the bats' wing tips) and starts an arc's round end differently (the speaker's waves). That is up to 30 solid pixels at 4× in such a frame. The atlas has the true round shape. The browser test checks the gallery at 2×.
- **The art guide**, `art/README.md`, is written by `npm run art` from the manifest: how to replace a piece, and every piece's contract (files, box, scale, kind, tint, joins, hitbox, purpose). A test checks it is up to date.
- **Replacement drill** (`scripts/dev/replacement-drill.mjs`). Placeholders replaced one piece of each kind: plain (`branch.body`), flipbook (`panther.tail`, all 16 frames), joint (`monkey.p1.arm`, with a pivot sidecar), stretch (`branch.trunk`), rope (`liana.green.rope`) and tinted tile (`backdrop.far`, as PNGs at 2×).
  - `art:check` accepted them. It warned that the branch placeholder strays past the hitbox, and refused a picture in the wrong aspect; the build stopped on that too.
  - The build used the placeholders. The gallery marked the 21 frames custom and still passed.
  - The parity page's Phaser rigs showed them with no code change: the trunk stretched, each tail frame its own colour, the rope bent, the backdrop tinted at dusk.
  - Then the drill was reverted. M7 runs it again on the finished rigs.
- **Close, not exact**, as listed in the inventory (**accepted after M4**, as is the gallery's judging above). Each is within the gallery's limits; M5's scene parity measures them in place, and one that fails there gets more frames, a closer reference size or a piece of its own:
  - quantized motion: the wings, flame, tails, the bat's ear and the chick's beak;
  - stretched curves: vines, stalks, flower stems, the snake's coil bands;
  - the coconut stem's bend;
  - the stretched sky;
  - the temple's last base rows at the floor;
  - the haze at half scale.

### M5. World rendering (L, in four parts)

For each part: rigs built from the M4 pieces, a view-model (tested in Node) and a Phaser adapter.

- **M5a, the monkey and the lianas.** Monkey (poses, body rotation easing, facing, blink, the death spin, the two-player palettes), lianas (rest, swinging, settling, tip flash, the shared-screen pair that bows apart, golden and green sets), interpolation between steps, the shadow monkey and its fading grey lianas.
- **M5b, static obstacles and decorations.** Obstacles are in the main art set: a run waits for it (agreed after M4). Branch (with the nine decorations), thorn bush, rock, beehive, the vines and trunks, the day and night decoration sets, the hanging bats and owls.
- **M5c, moving obstacles and bananas.** Spider with its thread, snake, bird, blue bird, purple bird, bat, circling bat (their wing, leg and eye animation as flipbooks and joints), bees, bananas with the glint, "+1" and "+1 ♥" pops, the heart on the field.
- **M5d, the temple and the world around it.** The four temple looks, the stage tint, haze, moss, the fires (flicker, additive glow, fire kept untinted), then the backdrop: sky bands, the three parallax layers, canopy, floor, the stage and time-of-day tint transitions, dawn.
- **Done when:** each part's parity-tool scenarios are inside the tolerance, its view-model tests pass, and the frame-time and memory budgets still hold with everything on screen. After M5c (bananas drawn): the rest of M3's manual sound pass (the pling, Chrome, Firefox, the iPhone 13 mini).

**M5 report (version 3.0.0-dev.6).**
- **The Phaser version draws the world**: per world a pane (`src/phaser/world/`). Behind is the backdrop (the sky, the far, mid and near layers). Then the obstacles with their decorations, the lianas, the monkeys, the shadow and the bananas. In front are the canopy and the floor. The death shake, the camera scroll and the interpolation between steps work as in the Pixi panes. The HUD and the overlays are M6.
  - Each rig places its pieces in the order the Pixi view draws them.
  - A run waits for the main art set (agreed after M4): a press before it is in starts the run once it arrives.
  - **Each pane has a Phaser camera** whose viewport is the pane's rect (`rectCamera` in `src/phaser/view.js`), so it clips the pane and draws only it. This was planned for M6, but split screen needs it now: the lower pane's backdrop reaches far above its band (for taller views) and covered the upper pane, monkey included. A browser test checks that the two split panes show the same picture at the start.
- **View-models** (`src/views/`, no Pixi; both versions draw from them):
  - the monkey's pose;
  - each liana's placement, culling and lit end;
  - the banana's bob and the pop;
  - the stage tint easing, the sky's layout and the layers' scroll;
  - the temple's flame and glow layers.

  Moving them changed nothing the Pixi version draws (`scripts/dev/dump-views.mjs`, the same before and after). They are tested in Node (`tests/views.test.js`), and a test checks that the Phaser version imports no Pixi.
- **Parity: 103 scenarios, 94 inside the limits.**
  - Every object passes: each obstacle kind and decoration (hanging and standing, at scale 1 and 1.3), each moving kind (two of each, at three moments), the monkeys, the lianas (between steps too), the shadow and the bananas, at 1× and 2× (`world.*`, 64 scenarios). M1's spike scenarios pass too.
  - The whole-pane scenes (`scene.*`) pass at dusk and night, and by day at 1×: a run, the same run further on, each temple look, and the fire at dusk.
  - The nine that fail are all by day, and they are the two exceptions below (accepted).
  - The browser tests in CI run them all (in about two minutes). Every object scenario must pass, and every scene but the exceptions; the exceptions must stay no worse than measured (under 1.5 % and 160 solid per million). The parity page's `?only=` takes several prefixes, comma-separated.

  | Scene | 1× share, solid per million | 2× share, solid per million |
  |---|---|---|
  | `scene.day`, `scene.ahead` | pass | 0.38–0.41 %, **66–140** |
  | `scene.temple.0–3.day` | **1.00–1.22 %**, 5–23 (look 2 passes) | 0.72–0.79 %, **73–76** |

- **Exceptions, accepted by the owner after M5:**
  1. **The far and mid layers by day on 2× screens** (all the 2× failures). Their tiles are 1× (decided in M1, where the far layer alone measured 59 solid pixels at 2×). Stretched, they soften the trunks' long straight edges, which Pixi draws hard at any density. With those two layers hidden, the same scenes pass (0–5 per million).
     - Making both tiles 2× would add 85 MB: 190 MB at 2×, over the 120 MB budget.
     - Possible later (M7): draw the trunks as stretched pieces apart from the tiles. That gives hard edges at any density, at little memory. The far trunks are rectangles, but the mid trunks lean and have stubs, so they would need pieces of their own.
     - Accepted as is; the trunk pieces stay an option for M7.
  2. **The temple by day at 1×**: 1.17–1.22 % of pixels differ (look 2: 1.00 %), all rims. The solid patches are within the limit.
     - Cause: the stone has many long edges, light against dark. A sprite between pixels samples between texels, so its edge spreads over two pixels where Pixi's covers one.
     - Tried:
       - the stone rasterized at 2× density: 1.12–1.15 %;
       - the camera on a whole pixel: 1.01–1.08 %;
       - the stone at scale 1 instead of the 1.3 the game draws it up to: 0.88–1.01 %. This breaks the contract (section 5): stage 4's temples would be stretched.
     - None passes; the stone stays at its contract's scale, rasterized at 1× density (17 MB less at 1× than the 2× density try).
     - Accepted.
- **Decisions in M5:**
  - **Front tiles up to 2×** (this changes M1's "tiles at 1×"). The near, canopy and floor layers are dark against light, and their 1× edges failed at 2×. The near layer is now two strips, under the canopy (100 px) and along the floor (124 px); the middle was empty. The far and mid tiles stay at 1×.
  - **Twice the density** for pieces that turn or sit between pixels: the monkey's parts, liana leaves, decorations, the panther, bees, the banana, heart and glint, and the temple's leaves and vines. A piece's contract may say so (`density`: at least that many pixels per unit at its scale).
  - **The shadow's pieces are generated see-through.** A piece's alpha applies to each shape, as Pixi blends them, so the rig shows them opaque.
  - **The beehive's trunk**, whose top shows, is drawn at its longest and only ever shrunk.
  - **The temple's glow** is sixteen additive discs, faded and scaled as Pixi draws them. One baked glow picture was brighter than Pixi's sixteen layers, each rounded to 8 bits.
  - **The Pixi "+1" pops stroke with round joins**, as Phaser strokes all text (a barely visible change in the Pixi version).
  - **The sky** is a piece 4 px wide, stretched. A stretched piece is cropped 1 px at each edge, so it does not take in its transparent padding.
  - **Atlases**:
    - the packer places cells on a skyline;
    - a page is at least 2048 px wide (the temple's top, 1228 px wide, did not fit 1024);
    - strips go on each set's first page.
  - **Scenarios show what the game shows**:
    - obstacles cropped between the canopy strip and the floor;
    - lianas at their spacing;
    - bananas at the height the game hangs them;
    - the temple and the backdrop in a whole pane.
- **Phaser 4.2.1 notes** (adding to M1's):
  - `Rope` always draws from its texture's first image, whatever page its frame is on.
  - `scene.make.container` sets the container's blend mode to normal, and a container with a blend mode ignores its children's. The rigs make containers with `blendMode: -1` (skip), so the glow adds.
  - `Rope` has no `setTint`: `setColors`.
  - Text:
    - it strokes with round joins, always;
    - it measures a font on `|MÉqgy`, Pixi on `|ÉqÅM`, so `src/phaser/text.js` sets Pixi's;
    - it rounds its width up, so it is centred on the measured width.
  - A stretched frame takes in its transparent padding at the edges.
  - A `TileSprite` wraps its texture up and down as well as sideways. A tile's top edge could show its bottom row, which drew a dark line along the top of the floor at some window sizes. Each tile image now has a copy of its first row above it and of its last row below it, and the game shows only the rows between (`TILE_EDGE`). A browser test checks the tile edges at four window sizes that showed the line.
- **Texture memory: 47 MB at 1×, 105 MB at 2×, 250 MB at 4×** (M4: 48, 86, 234). The rise at 2× is the front tiles at 2× and the denser pieces; the build fails over 120 MB at 2× or 300 MB at 4×.
- **Frame time** (headless Chromium, software WebGL, 1280 × 720, a bot playing for 25 s; CPU time of each animation frame, so it compares, while the frame rates compare only relatively):

  | | Median, 95th percentile | Frames drawn |
  |---|---|---|
  | Pixi, one player | 0.9 ms, 3.2–4.8 ms | 180–196 |
  | Phaser, one player | 1.1 ms, 2.3–2.7 ms | 335–343 |
  | Pixi, split screen | 0.8 ms, 2.4 ms | 74 |
  | Phaser, split screen | 1.8 ms, 3.7 ms | 225 |

  Phaser draws two to three times as many frames in the same time, at a similar cost per frame. M7 measures on the iPhone 13 mini.
- **Still to do**: the rest of M3's manual sound pass (the pling, Chrome, Firefox, the iPhone 13 mini), by the owner.

### M6. Panes, HUD, overlays and the three modes (L)

- Phaser cameras per pane: viewport (clip), zoom, scroll from our camera, shake from our `Shake` maths; single pane, shared screen (zoom 0.75, leader camera, portrait follow-the-anchor), split screen (two panes, each its own world).
- HUD (scores, banana count, hearts rows, "OUT"), the title (mode picker, controls, version, settings line for slipping, lives and shadow), stage banners, the pause and results panels, the off-screen monkey indicator, game-over panels, the mute and fullscreen buttons, the notice, the debug overlay (per pane), text with stroke, shadow and the pixel-ratio `resolution`.
- Reduced-motion, safe-area insets, touch layout, portrait text scale.
- **Done when:** all of `PLAN.md`'s modes and settings work on the Phaser renderer (the checklist in section 10), parity scenarios inside tolerance, `hud/banana/hearts/split/stageViews/debugOverlay` tests pass in their new form.

**M6 report (version 3.0.0-dev.7).**
- **The Phaser version draws everything the Pixi version does.** The UI scene has:
  - the mute and full-screen buttons;
  - the HUD: scores, banana counts, heart rows and "OUT";
  - the overlays: the title (mode picker, settings line, keys, version), the results, the pause panel, the stage banners and "out" notes per pane, and the arrow over a monkey above the view;
  - the debug view (D), drawn in every pane.

  The M2 readout and the stand-in icons are gone. Each world pane has its own Phaser camera, whose viewport is the pane (M5), and shared screen uses the zoom and the leader camera of the rules (`game.sharedView`).
- **View-models** (`src/views/`, no Pixi; both versions draw from them):
  - `hud.js`: placements, texts, heart rows and the tally;
  - `overlays.js`: the panels and their texts, the prompts per input, the settings, the results, the banners, the "out" notes and the arrow;
  - `buttons.js`: the icons and their places;
  - `debug.js`: the debug drawing and numbers.

  The Pixi HUD, overlays, buttons and debug overlay draw from them, and the view dumps are the same as before. They are tested in Node (`tests/hudView.test.js`, `tests/overlaysView.test.js`); the Pixi view tests still pass.
- **Parity: 21 more scenarios (`ui.*`, each at 1× and 2×), all within the limits.**
  - The HUD: single player (and more lives than hearts), shared and split screen, portrait.
  - The title: settings off and on, shared screen, touch, portrait.
  - The results: single player, fading in, two players.
  - The pause panel: by P and by the window; the banners: one pane, and split screen with an "out" note; the arrow.
  - The buttons, on and off, and in portrait.

  The browser test runs them with the object scenarios. The buttons are measured over the view's top-left corner, as large as the HUD's. Their remaining difference is the round ends of the speaker's waves, which Pixi cuts short, as in M4's gallery.
- **Text, as Pixi lays it out** (`src/phaser/text.js`, adding to M5c):
  - Pixi's drop shadow is the canvas shadow. A canvas shadow ignores the canvas's scale, so its offset and blur are scaled by the text's resolution. Phaser cuts a shadow off at the text's edges, so the text gets room round it, a whole number of pixels so the glyphs fall on the pixels as Pixi's do.
  - Sizes as Pixi measures them:
    - a line is as wide as the larger of its advance and its glyphs' reach;
    - a shadow's distance is added to the width and height;
    - the anchor is on the texture, the size rounded up to whole units, then to whole pixels at the resolution.
  - Phaser rounds a line's position to a pixel (`autoRound`): off, as Pixi does not.
  - A text whose canvas would be a fraction of a pixel wide or tall at its resolution (1.69 on a portrait phone) gets the fraction as padding at its right and bottom. The canvas can only be whole pixels; the fraction would stretch the text, and a fixed size would shift centred lines. It is aimed a hair over the whole pixel, as the canvas truncates its size.
  - **Text is rasterized at the screen's density, times its scale when it is enlarged** (portrait's UI scale). A text drawn smaller (the split-screen banners) is drawn full size and shrunk, as Pixi does. Enlarged Pixi text is that much softer: the parity scenarios set the Pixi texts to the same resolution, so they compare.
- **Decisions in M6:**
  - The UI and HUD pieces are rasterized at a whole 2 per unit (the largest UI scale, 1.8, rounded up), so they shrink evenly on other screens. Texture memory is **47 MB at 1×, 106 MB at 2×, 251 MB at 4×**.
  - The Pixi heart count strokes with round joins, as Phaser strokes all text (as the M5c pops do).
  - **The debug view is Phaser Graphics** (section 5: dev only). Its drawing is shared code written against Pixi's Graphics calls. The Phaser version records the calls with the art recorder and replays them (`src/phaser/graphics.js`), curves as points along them.
  - The parity tool's scenarios are whole units across and down: a canvas a fraction of a pixel off its size squeezes the picture differently in each library.
- **Checklist (section 10) on Phaser**:
  - Modes: 1P, shared and split, the mode picker, the results, play again, and Esc. The browser tests now end a run by a fall and check the results and play again, with and without reduced motion (no death shake).
  - Settings and keys: G H S D M F P, Esc, and 1 2 3.
  - Layouts: landscape shapes, portrait (the UI enlarged, the panels below the band), the 16:9 frame for two players, and safe-area insets through the shared layout.
  - Touch: the prompts for touch, and taps on the buttons.
  - The remaining items are M7's: the real-device pass, performance on the iPhone 13 mini, and the replacement drill on the finished rigs.
- **Frame time** (as measured in M5: headless Chromium, software WebGL, 1280 × 720, a bot playing for 25 s): Pixi 0.8 ms median and 2.5 ms 95th percentile per frame, Phaser 1.2 ms and 3.4 ms; in split screen, Pixi 1.0 ms and 2.7 ms, Phaser 1.5 ms and 2.7 ms. Phaser draws two to four times as many frames in the time.
- **Still to do**: the rest of M3's manual sound pass (the pling, Chrome, Firefox, the iPhone 13 mini), by the owner.

### M7. Parity, performance and polish (M–L)

- Run the whole parity set; fix every diff above tolerance or record a reviewed exception.
- Port the long-run harness (`scripts/longrun.mjs`) and the measurement scripts to Phaser and re-run the benchmarks from the performance work: frame time, heap over 30 game-minutes in the four scenarios, draw calls, the leak check, 90/120/144 Hz motion, first-appearance hitches. The **budgets** are those of section 6, on the iPhone 13 mini.
- Bundle: custom Phaser build or lazy features if the size is a problem.
- Real-device pass: desktop browsers, the iPhone 13 mini, an iPad, an Android phone; portrait and landscape; split and shared; both versions side by side.
- **Replacement drill**: in a test build, swap one piece of each kind (plain, flipbook, joint, stretch, rope, tinted) for placeholder art, check the game, gallery and validator handle them, then revert.
- Make Phaser the default version; Pixi stays reachable with `?engine=pixi`.
- **Done when:** parity and budgets are met or each exception is accepted in writing here.

**M7 report (version 3.0.0-dev.8).**
- **Phaser is the default version.** `?engine=pixi` gives the Pixi version until M8.
- **Parity:** the whole set (the object, scene and UI scenarios, each at 1× and 2×) passes within the limits, apart from the two scene exceptions accepted in M5. Nothing new.
- **Bundle: Phaser built from its source** (`vite.config.js`):
  - without physics, through Phaser's own `phaser-no-physics.js` entry;
  - WebGL only: its feature flags (`typeof WEBGL_RENDERER` and the like) are replaced as Phaser's webpack build does, in the build and in the dev server's pre-bundling;
  - Node's `global` mapped to `globalThis`.

  The Phaser chunk shrinks from 377 to **322 KB gzipped**. A first visit to the Phaser version downloads 363 KB of scripts gzipped against the Pixi version's 201 (+162 KB, within the +150–170 KB accepted in section 1). The art adds 1.1 MB of PNG at 1×. Lazy features would gain little: what is left is the renderer, the scene system, the loader, text and sound, all of which the game uses.
- **Start** (the production build served locally, headless Chromium, software WebGL): a playable title 792 ms after navigation, against 251 ms for Pixi. The difference is the larger script and the boot atlas. The 1.5 s budget is for the iPhone 13 mini and is measured there (below).
- **Long-run check** (`scripts/longrun.mjs`, now `ENGINE=phaser` too; dev server, headless Chromium, software WebGL, 33 ms of game time a frame, drawn every 90th frame, the heap sampled after a GC). Four scenarios of 30 game-minutes, no errors:

  | | Gaps | Post-GC heap (MB), start → end | Draw calls a frame | Render a frame |
  |---|---|---|---|---|
  | Phaser, solo | 705 | 78.8 → 72.9 | 11–22 | 0.74 ms |
  | Phaser, solo, everything on | 814 | 79.6 → 79.7 | 12–23 | |
  | Phaser, shared | 713 | 76.9 → 74.0 | 13–22 | |
  | Phaser, split | 715 | 77.0 → 72.6 | 21–44 | 1.15 ms |
  | Pixi, solo | 731 | 45.3 → 48.5 | 27–36 | 1.79 ms |
  | Pixi, solo, everything on | | 45.3 → 54.5 | | |
  | Pixi, shared | | 44.1 → 47.6 | 33–40 | |
  | Pixi, split | | 56.7 → 59.7 | 55–80 | 3.47 ms |

  - **No growth.** The Phaser heap is flat or falls in all four. The dev server's heap is larger for Phaser (its unminified source); the production build is smaller (below).
  - **Bounded**: scene nodes 226–485 (416–908 in split screen), textures 40–44, of them 0–4 made at run time (text).
  - **Half the draw calls of Pixi and less than half its render time**: the pieces batch, where each Pixi Graphics over 200 points was a draw of its own.
  - **No slowdown**: the JS side of a frame has a median of 0–0.1 ms and a p95 of 0.2–0.4 ms in both versions, the same through the run.
- **Leak check over restarts** (45 runs ended by a fall, the post-GC heap on the dev server): Phaser 24.0 MB after 1, 25.0 after 5, 26.5 after 15, 26.8 after 25 to 45: flat after 15. Pixi 20.0, 22.0, 25.6, 28.5, 29.8 (still growing, as in PLAN.md's checklist).
- **Memory in the production build** (JS heap after a GC, 1280 × 720): Phaser 7.6 MB at the title and 9.6 MB after a minute of play; Pixi 11.3 and 13.4 MB. Texture memory is unchanged since M6 (47 MB at 1×, 106 MB at 2×).
- **Motion** (`MOTION=1`: drawn frames in play in which neither the camera nor player 1's monkey moved, 2 game-minutes at each rate): **none** at 60, 90, 120 or 144 Hz (7,235, 10,823, 14,411 and 17,282 frames). The Phaser version draws between sim steps as the Pixi version does (PLAN.md, "Drawing between sim steps"), whose run of this check found none at 60, 90 and 144 Hz either.
- **First-appearance hitches** (`HITCHES=1`: 8 game-minutes, every frame drawn with the draw calls stubbed, the page yielding each frame):

  | | Frames | Median | p99 | Worst | Over 8 ms | Over 16 ms |
  |---|---|---|---|---|---|---|
  | Phaser, a new obstacle view | 227 | 1.1 ms | 8.4 ms | 17.8 ms | 3 | 1 |
  | Phaser, the others | 18,013 | 0.7 ms | 2.2 ms | 11.1 ms | 2 | 0 |
  | Pixi, a new obstacle view | 218 | 1.2 ms | 4.2 ms | 15.5 ms | 1 | 0 |
  | Pixi, the others | 18,022 | 0.8 ms | 2.3 ms | 13.1 ms | 3 | 0 |

  These measurements did not justify pre-warming at the time: a new rig costs about as much as a new Pixi view, and the few slow frames are as rare in both. The later owner-requested startup preparation warms the finite builder paths, caches sound recipes and replaces changing HUD text uploads with glyph atlases; see [BACKGROUND_MOTION.md](BACKGROUND_MOTION.md#startup-preparation-and-obstacle-motion).
- **A stutter at each grab, fixed.** The owner saw the background stutter a little at each grab in Safari on a MacBook Air M1. A grab scores, and the Phaser version redrew the score text and uploaded it to the GPU three times: once for the new text and twice to fit its padding to whole pixels. That is the canvas's blurred shadow drawn three times and three uploads, where Pixi makes one. The padding is now set only when it changes, so a new text costs one redraw and one upload. In Chromium a grab's frame went from a median of 1.4 ms to 1.2 ms, and its worst from 12.5 ms to 7.4 ms. The hitch check (`HITCHES=1`) now also reports the grab frames and the texture uploads.
- **Replacement drill on the finished rigs** (`scripts/dev/replacement-drill.mjs`, the same six pieces as in M4: plain, flipbook, joint, stretch, rope, tinted tile):
  - `art:check` accepted them, with the same warning (the branch placeholder strays past the hitbox). It refused a picture in the wrong aspect, and so did the build.
  - The gallery marked the 21 frames custom and still passed (594 frames, 0.52 % differing).
  - The game and the parity page showed them with no code change: the red far backdrop, darker at dusk; the red rope bending; player 1's red arms turning about their pivot; the branches' red bodies and stretched trunks; each frame of the panther's tail its own colour.
  - Reverted; the art rebuilt as before.
- **On the iPhone 13 mini** the owner finds the performance of the Phaser version OK.
- **The debug view is no way to judge smoothness.** It redraws its texts and shapes every frame. Over a game-minute in Chromium (drawing stubbed), a frame's median goes from 0.7 to 4.6 ms in the Phaser version, with 339 frames over 8 ms, 16 over 16 ms and the worst at 60 ms. In the Pixi version it goes from 0.6 to 3.7 ms, with 59 over 8 ms and the worst at 18 ms. The owner's first check in Safari on a MacBook Air M1 used it and saw frames over 17 ms, some over 60, in both versions. `?frames=1` is the readout to use instead (section 6).
- **The owner's check in Safari (MacBook Air M1):** a slight stutter of the background while swinging, in both versions (Pixi seemed best); scrolling the backdrop by whole device pixels made no difference. A slight stutter at a crash with the shadow on, in the Phaser version; in Chromium a death costs that version at most 4–5 ms in a frame, with the shadow on or off (Pixi up to 15 ms, as its results appear). Measured with `?frames=1` on the production build, the Phaser version missed 1 frame in 4,479, yet the background still stuttered while swinging and between lianas.
- **The stutter was the clock, in both versions, fixed.** Safari gives frame times rounded to a whole millisecond, so on a 60 Hz screen the frames are said to come 16, 17, 17, 16 … ms apart (the readout's "59 Hz": a typical 17 ms) while the screen shows one every 16.67 ms. Moving the game on by those amounts made steady motion uneven by up to 6 % a frame. With frame times rounded so in Chromium, the drawn moves of the world and the backdrop in a swing went from 0.5 % uneven (neighbouring frames' moves compared) to 4 %, in a pattern of three frames. The shared driver now evens the frame times out (`src/frameClock.js`): a frame counts as the whole number of refresh intervals it is nearest to (one, or more when frames were missed), within 40 % of an interval; the interval is learnt from the frames. What that leaves out is paid back a little at a time once it passes 3 ms, so the game's time stays with the real time. A pause or a stall counts as it is, and a new refresh rate is learnt again. With it the moves are 0.1 % uneven with rounded frame times, and it takes frame times a few ms early or late as well. The owner found it slightly better in Safari, with the dark green trees (the mid and near layers) still stuttering most. The readout (`?frames=1`) now also gives the spread of the frame times the browser reports and the game's work in a frame.
- **Shaders compiled in play, fixed.** With the late frames listed, the owner's readout in Safari showed a 76 ms frame right after the first beehive appeared, the work before it 1 ms. Phaser 4 draws a batch of images (and of tiles and ropes) from up to 16 textures with a shader made for the exact number in the batch, and compiles each the first time it is needed: in 8 game-minutes in Chromium, 9 shaders were compiled, 3 of them in play (at the first beehive, the first moving snake, a bird). Safari is slow to compile them. A first fix used the shader for 16 textures for every batch: no compiles in play, but every pixel then picks its texture among 16, and Safari drew at 40 fps. Now a batch takes one texture (`src/phaser/shaders.js`), as Phaser does by default on phones: one shader per kind of batch, compiled before the title (none in play, in any mode), and the cheapest per pixel. In Chromium's software renderer a frame takes 4.0 ms to draw against 9.0 ms with Phaser's default and 10.7 ms with 16 textures, with 22 draw calls against 27. A browser test checks it.
- **A text's resolution set with one redraw.** The same readout showed 107 ms after about 25 small texture uploads: the HUD's texts at the start of a run, each redrawn and uploaded three times, as Phaser's shadow, padding and resolution setters each redraw. They are now set together and the text redrawn once, its padding fitted to whole pixels at the same time: 9 uploads as a run starts, not 21.
- **The background's stutter was its motion, in both versions; the camera and the layers changed.** With frames on time (59 Hz, 0.1 % late), the owner still saw the background stutter, the dark green trees most, in Pixi too. Two causes, measured in the game:
  - **The camera passed on every change of the monkey's speed.** It eased towards the monkey through one lag, so its speed is set by how far behind it is: a catch, which turns the monkey's speed at once, changed the camera's speed by a median 1.25 units a frame in one frame (6 times the usual), and every swing pulled the view back and forth. A pane's camera now eases through two lags of 12/s in a row (`CAMERA_EASE`, solved exactly so the steps do not matter): at a catch its speed changes by a median 0.34 units a frame, and the monkey stays within about 120 units of its spot (about 90 before). The owner also tried following the liana's anchor (no swaying, but a jump at each release), and a target gliding between anchors (`?camera=glide`: the view never moving back), and found the two lags the more fun to play. The shared screen's camera, whose position decides who falls behind, keeps its one lag. Swinging, the camera still pulled the whole world (lianas, obstacles, floor) back and forth, a median 8 units a frame, which looked stepped too: a landscape pane's camera now follows the liana's anchor plus three quarters of the swing about it (`CAMERA_SWAY`, the owner's pick of 1, 0.75, 0.6, 0.4, 0.25), with no jump at a catch or release (`SwingTarget`). The floor and canopy must move with the world, so their sharp edges still look stepped at times in fast flight (the owner noticed the foreground shrubbery); so the build now softens them: a sideways blur of 0.4 units (a little under a pixel on a 2× screen), wrapped around the repeat, in sRGB (`soften` in a tile's contract; the art guide lists it; the gallery blurs its reference the same way, 0.3 % of their pixels differing). Their vertical edges, which move, are softer; their horizontal ones stay sharp. The whole-scene parity stays within its limits (the Pixi version draws them sharp).
  - **The trees moved too many pixels a frame.** The mid layer's trunks are wide, dark and hard-edged; in flight they moved 4–5 points a frame on a MacBook Air, and an edge moving that far each frame looks stepped at 60 Hz however smoothly the frames come. Slower layers took the stutter away (the owner's tries: at half speed almost gone, at a third nearly gone): the layers now scroll at 0.06, 0.12 and 0.3 of the camera's speed (0.15, 0.4 and 0.7 before), in both versions.
- **Left for the owner** (needs real devices; nothing here can stand in for them):
  - Phaser background integration on `phaser-m7-codex`: [BACKGROUND_MOTION.md](BACKGROUND_MOTION.md). The owner's `phaser-m7` camera, swing-target, layer-speed and build-time softening changes are merged. Moving Images are retained; the Codex-only scenery follower and speed multiplier are removed. Experimental tree exposure is off by default (`?motionblur=on` to compare). The owner still reports whole-scene freezes/jumps and uneven gameplay motion. `?frames=1` on Phaser now offers **Save frame trace** for the last 1,800 real update/render frames; the complete render-loop probe found no repeated submitted poses in Chromium. The owner's Safari trace confirms correct position interpolation and low CPU work, but exposes two callback-phase disturbances amplified into double/half movement steps. Phaser now uses a clock that absorbs those disturbances while preserving missed frames and elapsed time; The next Safari capture has no late callbacks or repeated active poses and game steps stay within 16.60–16.72 ms. The floor shrubbery now gets slightly stronger horizontal build-time softening (0.8 units; canopy stays at 0.4), as requested. Occasional perceived stutter and actual display presentation still need device validation.
  - the rest of the real-device pass: desktop browsers (Chrome, Firefox, Safari), an iPad, an Android phone; portrait and landscape; split and shared; both versions side by side;
  - the rest of M3's manual sound pass (the pling, Chrome, Firefox, the iPhone 13 mini).

  If the phone's start is over budget, the first stage's obstacles move to the boot set (M4). The trunks as stretched pieces (M5d) stay an option, not done: the trees are accepted as they are.

### M8. Remove Pixi (S–M)

Only once M7 is accepted: until then the Pixi version is the reference.
- Remove the `pixi.js` dependency, the Pixi version's renderer (the `src/render/` views and `main.js` wiring) and the modules only it uses (its DOM input, fullscreen, pause and sound player, which Phaser has replaced), the parity tool and the `?engine` switch.
- Remove the tests of the Pixi views and modules; their view-model and adapter counterparts stay. Move `src/phaser/` to its final place.
- Keep a small set of reference screenshots of the parity scenarios from the last two-version build (a few MB at most), for later visual checks.
- **Done when:** the build contains no Pixi code, all tests and smoke tests pass, and the bundle size is recorded.

**M8 report (implementation done, version 3.0.0-dev.9, branch `phaser-m8`).**

- Removed `pixi.js` and its transitive packages, the old game entry and view adapters,
  the DOM fullscreen implementation, the engine selector, the parity page and M1 spike
  pages. An old `?engine=pixi` URL now opens the sole Phaser game.
- Put the game entry in `src/main.js`, scenes/platform adapters in `src/platform/`,
  rendering adapters and world rigs in `src/render/`, and the sound manager/cache in
  `src/audio/`. Pure view-models stay in `src/views/`.
- Kept the input queue/toggle semantics, pause state, fullscreen gesture controls and
  sound synthesis/recovery used by Phaser. They are shared infrastructure, not a
  second engine. Simulation, generation, physics and worker logic are unchanged.
- Removed Pixi-object tests and retained the view-model, native adapter, gameplay and
  lifecycle checks. The long-run and motion tools now use the sole game.
- Saved 12 Phaser-side images from the last two-engine build, commit
  `b60325c3a55b7d609b5569fc092b7134bf85954f`: about 864 KB, at 1×. They cover monkeys,
  shared lianas, the shadow, static/moving obstacles, bananas, day/night scenes,
  temple fire, HUD, title and results. `browser-tests/references/README.md` records
  their origin and how to inspect them. The dev-only `reference.html` and browser
  check compare the renderer against them with the established tolerance. Fixed
  fixtures retain the captured title version; the real game uses the current version.
- Kept the artist’s gallery, comparing atlas frames against browser-rasterized generated
  SVGs instead of importing Pixi. All 594 frames pass at 2×, with 0.17% differing pixels.
- **Validation:** `npm test`: 66 files, 727 tests passed. `npm run art:check` and
  `npm run build` passed; the generated art and window table remain unchanged.
  All 72 Chromium browser checks passed across the full run and one focused retry:
  71 passed in the full run, and the landscape game-over touch check timed out during
  a tap, then passed on its own in 5.7 s. Two unit timing assertions failed while
  browser rendering ran concurrently; the subsequent isolated full unit run passed.
  No assertions or timing budgets were relaxed. A source comparison also confirmed
  that moved native modules changed only their imports, comments and worker URL.
- **Bundle:** the build emits no Pixi library or alternate-engine chunk. The main
  chunk is 1,381.93 KB raw / 368.14 KB gzipped (Vite's report). All emitted JavaScript,
  including the worker and optional diagnostics, totals 1,440,082 bytes raw and
  379,797 bytes with gzip level 9. Reference screenshots and dev pages are excluded
  from the production build.

### M8a. Cartoon sprite sheets and the classic graphics toggle (L)

**Status: complete and integrated into `phaser` through [PR #41](https://github.com/skogdoom/liano/pull/41) on 2026-10-16 (merge `a49b1f2`).** This milestone is between M8 (Pixi removal) and M9 (cleanup and merge). The owner approved continuing from the corrected style sample. The complete production pack and reload selector are implemented; cartoon is now the default, and the owner has accepted its appearance through `7abe519`. Final automated verification, approved regression references and the report are complete. By the updated owner decision, real-device checks follow in M9c on `release-verification`, a new branch created from `master` after M9, before release.

**Outcome.** Prepare and integrate a complete cartoon sprite pack that can replace all current graphics, alongside a complete classic pack. The Config menu selects between them through **Classic graphics: On/Off** and reloads the game when the value changes. Cartoon is now the default. Both packs use the same rules, physics, generated levels, obstacles, animation timing, camera motion, modes and sounds.

#### Art direction and source references

The visual references are [the day concept](docs/cover_day.png) and [the night concept](docs/cover_night.png). They guide new artwork; they are not stretched over the game as full-screen backgrounds or mechanically cropped into finished sprites.

- **Monkey:** the expressive brown monkey with a light muzzle/belly, large readable eyes, rounded ears, curled tail and long reaching limbs. Keep a distinct player-2 palette and the translucent grey shadow, with matching green/gold/shadow lianas.
- **Jungle:** layered foliage framing the action, broad leaves and ferns, hanging vines, humid blue-green distance and mist, with warm daylight and cool moonlit night. Adapt the concepts' perspective to the game's side-view layers and seamless horizontal repeats.
- **Temples:** stepped, weathered stone, carved geometric motifs, climbing greenery and warm firelight against cool night colours. Keep all four existing temple looks and their established fire behavior.
- **Creatures and small props:** adapt the concepts' panther, snake, parrots, bats, spider and nest; extend the same shape language, materials and palette to every existing animal, plant, rock, hive, pickup and icon that is not pictured explicitly.
- **Menus:** carry the stone lettering, vines and carved sun/spiral motif into the cartoon title treatment, panels and icons. Keep instructions, scores, settings and the version as crisp live text, rather than baking variable text into sheets.
- **Art direction confirmed by the owner:** a cohesive painted cartoon style for both characters and scenery. Retain the concepts' atmosphere while simplifying fine detail for small screens; the backgrounds belong to the same cartoon world as the monkey.

Approve a small style sample at actual game size before producing the full pack: a hanging/flying monkey, a liana, a branch with a creature, a temple, a day/night background strip and a menu sample. Check outline weight, palette, shading, joint overlaps and hazard readability together. The owner approved continuing from the corrected sample; the production pack now uses component masters and the existing articulated rigs.

#### M8a.1. Inventory and sprite contracts

Use `art/manifest.json` and the M4 inventory as the authoritative starting point: **175 pieces and 594 frames** at the M8 baseline. Prepare a coverage checklist mapping every stable piece/frame key to its cartoon source, sheet, cell, pivot, attachments, animation and completion/review state.

| Asset family | Cartoon coverage and behavior to preserve |
|---|---|
| Players and shadow | Both monkey palettes; tail, torso, head, arms, legs, open/dead eyes; hanging, flight, facing, blinking and death poses; matching shadow assets and opacity. |
| Lianas and supports | Green, gold and shadow ropes/leaves; slipping-tip flash; swinging, settling and shared pairs; branch trunks, canopy vines, stems, ledges, hive support and slings. |
| Static obstacles | Branches, thorn bushes, six distinct cartoon stone variants (classic retains 24), beehives and their bees; high/low placements and existing obstacle scales. |
| Branch decorations | Panther, perched bird, perched snake, hanging monkey, nest in all three states, hanging bat in all looks, owl, flowers and coconuts; every current variant and animation. |
| Moving obstacles | Spider/thread, moving snake, red/blue/purple birds, flying and circling bats; all wing, leg, eye, coil and stalk frames/joints. |
| Temples | All four looks; top, repeated base/stairs, details, moss/vines/leaves, haze, flame frames and additive glow. |
| Scenery | Sky, far/mid/near layers, near canopy strip, ceiling canopy, floor shrubs and floor fill; day, afternoon, dusk, night and dawn presentation. |
| Pickups and UI | Bananas/glints, field/HUD hearts, banana tally icons, mute/fullscreen icons, panels, off-screen indicator and cartoon title artwork; title, Config, pause, results and stage banners use a coherent theme. |

Keep existing keys, frame ordering, logical dimensions, pivots, attachment points, strip lengths, 9-slice regions and tint/alpha contracts. Start with the existing joints and flipbook frame counts; the sheets must support continuously varying swing angles and poses through the rigs. A single painted swing pose is not a substitute for the monkey's complete rig.

Allow presentation-only catalog additions where the concepts need them (for example the cartoon wordmark or a moon/cloud decoration). Specify their placement and stage visibility, include them in coverage and memory budgets, and leave classic unchanged. Pack-specific presentation metadata may extend the renderer; collision geometry, simulation state and motion behavior remain shared. Inspect every hazard silhouette against its existing hitbox guides so the new art communicates the same safe gaps and contacts.

#### M8a.2. Produce the artwork and master sheets

Produce clean transparent PNG sprites, with editable layered/vector masters where practical. Proposed source location: `art/packs/cartoon/`, with a source inventory and sheet-layout metadata kept under version control. Preserve `art/generated/` as the classic source; cartoon files must not globally overwrite it or the classic `art/custom/` overrides.

- Work by coherent families: monkey/lianas first, obstacles/decorations/moving creatures next, then temples/scenery and UI. Review a family in the game before expanding to the next.
- Keep component lighting, scale, palette and stroke weight consistent across sheets. Place joints with sufficient overlap, and check mirrored poses for seams. Align flipbook frames to a common pivot and scale, without frame-to-frame position drift.
- Provide transparent padding and extruded atlas edges to prevent colour bleed and dark halos. Keep ropes/stalks straight for bending, panels sliced, and trunks/temple bases/stairs suitable for stretching or repetition.
- Make horizontal scenery tiles seamless, including through stage transitions. Preserve the established build-time horizontal softening and layer speeds; adapt detail density rather than increasing runtime blur or changing movement to disguise artifacts.
- Use the day and night references to define a readable palette through the complete time-of-day cycle. Prefer shared day-colour assets with the existing tint/emissive rules. Where tinting cannot express a needed night feature, use explicit decorative variants and a bounded presentation transition; account for both variants' memory if they overlap.
- Ensure raster sources have sufficient resolution for their maximum logical scale and 1×/2×/4× outputs. Export sprite-sheet PNGs and machine-readable frame/cell metadata, together with previews and the source-to-runtime-key mapping. Keep deterministic atlas packing in the existing build pipeline.

#### M8a.3. Build and load two complete packs

Add pack-aware validation/build/catalog loading to the existing art pipeline. Proposed output layout: `public/art/classic/` and `public/art/cartoon/`, each with its own catalog, boot/main sheets, frames and repeating tiles at the existing supported scales. Keep the distinction between sprite sheets for packed pieces and separate repeating textures where the renderer needs tiles.

- Classic wraps the current generated/override pipeline and preserves its appearance. Cartoon must cover every required frame; fail validation/build on missing, duplicate or incompatible entries instead of silently mixing classic pieces into it.
- Validate sheet bounds, dimensions, frame ordering, alpha, padding, pivots, attachments, tint rules and animation metadata. Keep the existing validator's art-versus-hitbox checks and add pack coverage checks.
- Resolve the pack choice before the first catalog/atlas request. Download, decode, prepare and warm only the selected pack. Ship both packs, but avoid fetching or holding both in memory for a normal session; a full reload disposes the previous game's resources.
- Apply the existing quality/resolution choice independently of art style. Each loaded pack must satisfy the **120 MB at 2×** and **300 MB at 4×** texture limits. Report compressed download size, decode time and startup time for each; validate the section 6 startup and frame budgets on the iPhone 13 mini and Safari on the MacBook Air M1 after integration into `phaser`, before release.
- Keep the M7 improvements: prepared glyphs/sounds, warm rig paths, one texture per batch, movement interpolation and camera behavior. Cartoon selection does not enable motion-blur experiments.
- Extend the dev gallery to select a pack and inspect sources, sheets, frame animations, pivots, hitboxes, repeating seams and representative assembled rigs. A failed pack load must show a clear error with an action to reload classic, without a reload loop or a partly mixed scene.

#### M8a.4. Config selection and reload behavior

Add a clearly labelled **Classic graphics: On/Off** row inside the existing title Config submenu, available by click/tap and a labelled keyboard shortcut confined to that submenu. It is a separate setting from Performance/Balanced/Sharp/Auto. Fit the added row and its touch target on the iPhone 13 mini in both orientations, including Safari's reduced visible area.

- **On = classic; Off = cartoon.** With no valid saved choice, default to cartoon. Save deliberate choices in local storage so they survive browser reloads; blocked storage must still permit switching for the current URL.
- Provide an explicit `?art=classic|cartoon` override for testing and blocked-storage fallback. If the URL contains `art`, use its value (an invalid value resolves to cartoon); otherwise use a valid saved preference, then cartoon. Invalid saved values also resolve to cartoon. Test URL overrides do not silently rewrite saved preferences.
- Changing the value saves the choice, consumes the menu input and performs a full navigation/reload. Selecting the current value does not reload. Restart at the title; preserve the chosen player mode, lives, slipping, shadow, mute preference and quality setting, and retain unrelated query parameters/hash. Mobile continues to support 1P only.
- Ensure quality changes preserve art selection and art changes preserve quality selection. Prevent double navigation and accidental game starts from the selecting key/tap. Identify the loaded pack in the existing frame trace to make device comparisons reproducible.

#### M8a.5. Verification and completion

- Unit tests cover complete pack contracts, coverage/validation, selection precedence, cartoon default, preference persistence/blocked storage and reload URL preservation. Simulation tests remain unchanged.
- Browser checks exercise both packs: startup, every asset family/variant and animation, all supported modes, settings, HUD/results, resize/rotation, context loss/restore, and the Config toggle by keyboard, mouse and touch. Verify a single reload on change, no reload on the current choice, and that only the selected pack's requests are made.
- Keep the M8 classic reference PNGs unchanged and passing. Add a small approved cartoon reference set for later regressions, including day/night scenes and small-screen menus; assess cartoon fidelity against the concepts and gameplay readability.
- Inspect fast swings, catches, large temples, moving obstacles, lianas and foreground shrubs on Safari on the MacBook Air M1 and iPhone 13 mini at the current default quality. Run this real-device pass in M9c on `release-verification`, created from `master` after M9, as requested by the owner. Record startup/texture/frame results against the existing budgets and any concrete exceptions for the owner to review before release. This pass does not block M8a integration or the M9 migration merge.
- Document the sheet formats, sources, key mapping, editing/export process, pack selection and build/gallery workflow in the art guide, and add the milestone report and measured sizes here.

**Done when:** the owner approves the cohesive concept-derived artwork; cartoon assets replace every required current visual family without hidden classic fallbacks; both complete packs build and fit the existing budgets (or explicitly accepted exceptions); classic defaults to Off; Config switches correctly by reload on desktop/mobile; tests and classic/cartoon visual checks pass; the milestone report and asset-editing guide are complete. These requirements gate integration into `phaser`; mobile layout and reload behavior can be verified in automated browser checks beforehand. Real-device gameplay, startup and frame checks remain pending until after integration, and must be completed before release. M9 starts afterward. The owner explicitly changed the defaults to Classic graphics Off and Shadow Off.

**Historical M8a implementation report (initial review build, version 3.0.0-dev.9).** The finalized report below supersedes these initial counts, sizes and acceptance notes.

- Produced an independent cartoon source set covering all **175 baseline pieces** plus the explicit stone/sun wordmark. The current set has **576 required frames / 577 including the wordmark** after reducing the static cartoon stones from 24 to six; all animated flipbooks retain their original counts. Painted PNG masters supply monkey components, including separate fur-covered torso/arm/leg masters, creatures, foliage/wood, distant scenery, a level branch aligned with its collision guide, cleaned snake components, a lighter spider body, highlighted birds/bats, separate waterfalls refined climbing-snake coils and a scalloped bat wing. Editable vector recipes supply strips, repeatable stone, animated wings/fire, small props and UI. No classic drawing is reused as a fallback. Production frames are marked painted; complete owner review is not claimed.
- Kept the classic generated/override pipeline intact. Builds emit separate `public/art/classic/` and `public/art/cartoon/` catalogs, boot/main sheets and tiles at 1×/2×/4×. Coverage, frame order, box/scale/pivot/attachment/tint/alpha/animation contracts are validated. Missing/incompatible sources, empty sprites, incorrect shadow alpha and texture-budget overruns fail the build. Cartoon cells have isolated rasterization and independent one-pixel extrusion margins inside the two-pixel gap; tiles retain wrapped softening and edge rows.
- Config now has **X · Classic graphics: On/Off**, clickable/tappable on desktop and mobile. On means classic; Off means cartoon. Shadow defaults to Off on desktop/mobile; explicit On is preserved across graphics/quality reloads. Choices persist, explicit `?art=classic|cartoon` overrides do not rewrite storage, and invalid/blocked storage defaults safely to cartoon. Changes navigate once to the title, preserving mode, lives, slipping, shadow, mute, resolution, unrelated parameters and the hash; selecting the current value does not reload. The added row fits the existing small-screen layouts with 44-pixel minimum targets. Mobile remains 1P only.
- Resolve selection before loading and prepare only the selected pack. The frame trace and startup metadata identify `artPack`. Failed cartoon loading displays a clear error and an explicit action to reload classic. Physics, world generation, camera/interpolation, layer speeds, animation timing and sound recipes remain unchanged; M7 preparation and softening stay in place.
- Readability follow-up: muted the distant jungle's saturation/contrast and added a dark rim and a crosswise highlight to green lianas, so their lower ends stay as readable as their upper ends. Background trees now form an irregular, repeatable grove with varied widths, heights, lean, mirrored bark and three green tones. The foreground frond roots fade into a matching dark floor color, so extended portrait views do not expose a hard teal boundary. These changes are baked into the cartoon exports, with the same tile period, texture dimensions, attachment contracts and layer speeds; they add no runtime filter passes.
- Removed the faint matte around both snake components (shared by climbing/perched snakes) and moved sound waves clear of the speaker. Increased only the cartoon ghost monkey's baked opacity from 36% to 56%; its vines and classic graphics retain 36%. This deliberate pack alpha policy is enforced by source generation, inventory and contract validation; other alpha/geometry changes still fail validation.
- Obstacle readability: the spider has a medium plum body with pale contour highlights, matching brighter legs/joints and lighter silk. Rocks use warm granite faces, a darker outline and a lit upper rim. Standing stones have per-outline seating offsets derived from the painted ledge curve, closing small gaps without moving hanging rocks or changing collision geometry. Upper vines overlap each painted rock's actual top edge so no gap remains above suspended stones. Birds have stronger gold feather/wing highlights; bat bodies and animated wings have lighter fur/membranes and pale leading edges, including the charcoal variant. Sizes, hitboxes and motion are unchanged. Added fixed day/night jungle review scenes at `/rigs.html?art=cartoon&only=scene.obstacles.day` (or `scene.obstacles.night`), plus `scene.flying.day`/`scene.flying.night`, to inspect their contrast through the actual game rigs.
- Corrected the branch snake's assembly: each band is a single strand crossing the wood, rather than a complete climbing-snake body repeated for every wrap. Neck, end caps, tail and head now fit those strands. Bananas have a stronger dark outline and brighter yellow fill at game/HUD/results sizes. Cartoon coconuts attach at the painted branch's underside (`presentation.coconutRootY`), 10 logical pixels above the collision-box-based classic anchor; classic placement and obstacle hitboxes are unchanged.
- Fit branch-snake wraps to the painted limb's thickness (`presentation.snakeLimbThickness`). Blue bird bodies/wings now use lighter cyan and pale highlights; the hive's support is a shaded wooden twig with a short attaching stalk, rather than a gold ribbon. Waterfalls are removed from the mirrored forest master and placed separately: one large and one small per complete 2048-unit panorama, with the same far-layer speed and texture dimensions.
- Hanging obstacles' support vines now have a pale green center, dark rim and crosswise shading, with matching end caps. These baked textures keep the original support-vine box/width and curve placement, and retain their highlight along the whole hanging length.
- Climbing snakes now have rounded overlapping coils, a short tapered tail and a smaller head with a connected neck. The cartoon head leads up/down with its face upright. At each reversal the head and neck retract/fade into the coils, change ends only while fully concealed, and emerge at the new leading end. The 240 ms retreat/return replaces the visible slide across the coil front; timing comes from drawing time and remains the same for different climbing periods. The hanging monkey uses brighter copper-red arms/body/tail and matching painted articulated legs/feet, with its hands attached to the painted branch and its face ahead of its raised arms. Player limbs are registered by painted shoulder/palm/hip landmarks, so the visible arm joint coincides with its pivot and the palm with the existing grip distance; the torso's shoulders share those anchors. Cartoon arms and legs render behind the torso, with heads/eyes foremost (`presentation.monkeyLimbsBehindBody`), for both players and the shadow. Fur replaces the exposed skin-colored joint caps on the torso and moving limbs, including the shared hanging-monkey components; the torso covers their turning roots. Classic art/poses, simulation and grip physics remain unchanged.
- Temple holders and flames now share brazier centers and a common base height; roof/corner/fringe foliage uses painted leaves registered at their stems, with roof leaves kept inside the source bounds. Flying bats use a separate painted scalloped wing, registered by shoulder/tip landmarks across the original 41-frame flap cycle for all four palettes. The wing now draws over the near flank at its painted shoulder. Torchlight uses an opaque source with the classic layered falloff, plus a subtle cartoon daytime light. Hanging legs use exported hip landmarks; palms sit behind the branch with fingertips over the top. Hanging eye frames share the head transform and painted eye landmarks: open pupils stay inside the original whites, and the shut frame covers them with aligned eyelids.
- Extended `/art.html` with pack selection, source/atlas comparison, frame sliders/animation and repeat seams. `/rigs.html` uses the actual game rigs for fixed poses, every obstacle family, day/night/temple scenes and UI, with optional 2× rendering. `/cartoon.html` retains the approved style sample and points to the playable pack. The authoring guide documents masters, crops, recipes, coverage, exported placements and editing/build commands.
- **Texture/download sizes:** decimal MB; downloads include the selected catalog, atlas JSON/PNG and unique tiles, before any HTTP transfer compression. Texture sizes include both sets and tiles; PNG sources/review pages are excluded from the production build.

| Pack | Texture 1× | Texture 2× | Texture 4× | Download 1× | Download 2× | Download 4× |
|---|---:|---:|---:|---:|---:|---:|
| Classic | 46.6 MB | 105.6 MB | 254.2 MB | 1.17 MB | 2.20 MB | 4.09 MB |
| Cartoon | 47.8 MB | 110.8 MB | 282.0 MB | 7.39 MB | 11.12 MB | 22.03 MB |

- Both packs satisfy 120 MB at 2× and 300 MB at 4×. The painted pack has a larger compressed download; the loader still fetches only that pack and scale. Startup/decode timing and the cached 1.5-second/60 Hz budgets must be checked on Safari M1 and iPhone 13 mini after integration into `phaser`, before release; Chromium software rendering is not a substitute for those device results.
- Validation: production build and source/inventory checks pass; the latest full unit run passed **71 files / 767 tests**, with focused checks after later changes. Classic references and the classic gallery remain passing (0.17% differing pixels). The cartoon gallery's aggregate comparison is about **1.43%**, above the gallery's 1% aggregate guide; **36 frames** remain flagged at 2×. The current built/source/difference images are visible in the artwork review, with no relaxed thresholds or hidden flags. All **82 Chromium browser checks** pass across the full run and focused retries: 81 passed in the full run; the newly added mode test queued a redundant mode key with Start, then passed after waiting for mode selection appropriately. The anatomy follow-up passed 22 focused unit checks. The lighting/attachment follow-up passes 20 focused unit checks and ten browser checks, including the unchanged classic references; native pixel comparisons confirm warm light on the stone by day/dusk/night and unchanged classic daylight behavior. The joint-layer follow-up passes 20 focused unit checks and ten browser checks; 18 native poses cover both players and the ghost through hangs, swings, flights, catch corrections and falls, alongside the animated hanging decoration. The hanging-eye correction passes 18 focused unit checks and three browser checks, with native open/blink inspection in both facing directions using 4× atlas art. The concealed snake-turn/rock-seating follow-up passes 27 focused unit checks, including art defaults/reload persistence and painted registration, plus 17 browser checks for art selection, mobile/desktop menus and unchanged classic references; a native 60 fps preview includes normal-speed climbing and a quarter-speed reversal, while all 24 standing stone variants and hanging-vine endpoints are inspected through the native rigs. The brighter copper-red hanging palette also passes the focused gallery/pose/classic-reference checks. The pause/floor follow-up passes the full 71-file / 760-test unit suite and three browser checks: Escape exits manual pause to the title; Space/Enter/click/tap resume without releasing the monkey; focus/context-loss guards remain active. The floor blend is baked into the foreground tile and matching fill. No visual or timing thresholds were relaxed.
- **Current acceptance and integration gates (owner decision, 2026-10-16):** the owner accepts the cartoon graphics through `7abe519`. Final automated verification is complete, thirteen approved captures are promoted to regression references, and the final report below records current sizes and the 38 source/atlas comparison flags (1.57% aggregate). Integration into `phaser` is complete through PR #41 (merge `a49b1f2`). Real-device gameplay/startup/frame and mobile usability checks remain pending for M9c on the new branch created from `master` before release and are not recorded as passed. M8a is integrated; M9 cleanup and merge is next.
- Climbing-snake wrap follow-up: the painted coils alternate behind and in front of their green stalk, using non-overlapping crops of the existing atlas frame. Rear and front sections share drawing time and scale; head-reversal behavior and collision geometry are unchanged.
- First artwork-note pass (drawing defects): player/ghost tail roots now register inside the painted rear hip; climbing-vine leaves render behind both coil layers; a short neck connects the coil to the rotated/scaled cheek behind both coil layers, concealing its flat edge; the sandstone doorway's stray spiral is removed. Refreshed monkey poses, snake fixtures/clips, world lighting and temple review captures remain candidates. Source/inventory checks, 16 focused tests, the cartoon gallery/rig browser checks and unchanged classic references pass. The same eight source-comparison flags remain. Nests, decoration placement and contrast were addressed in the later branch-decoration pass below.

- Monkey-appearance pass: all painted monkeys share a new larger-foot leg master registered to the existing hip and foot endpoints. The hanging decoration has a dedicated brighter smiling face, fuller pupils, less flattened proportions and matching lighter reddish limbs. Player/ghost pupils and fallen crosses now follow the painted head transform and each socket's center, size and angle; crosses stay inside the eye whites. Candidate poses, blink samples, world lighting and review motion are refreshed. Sixteen focused unit checks, source/inventory checks, the production build and eleven browser checks pass; the same eight source/atlas flags remain (1.19% aggregate). Artwork acceptance remains pending.

- Monkey-proportion follow-up: slimmed the painted furry arm shafts and widened the thighs/calves while retaining hand/foot sizes and registered limb lengths. Both players, the ghost and the hanging decoration use a thinner curled tail master, with its root registered inside the hip. Cartoon rigs mirror the front leg to form a left/right pair with both big toes on the inside, while retaining hip/foot endpoints; classic legs keep their original orientation. The revised sources pass sixteen focused unit checks, source/inventory validation, the production build and ten browser checks, including unchanged classic references. The same eight source/atlas comparison flags remain (1.19% aggregate); artwork acceptance is still pending.

- Flying-creature pass: all three birds and all four flying/circling bat looks now have a larger near wing and a shaded far wing, turning about their painted shoulders. Constant-length painted wing profiles retain their area through the flap; one silhouette-based fit protects every frame from atlas clipping. Birds use a wingless body and separate feather fans; blue has mint/indigo wing accents, purple has coral/teal, and eyes/mouth/beaks/feet retain the red bird's colours. Bird-wing cells rasterize at 2.5× baseline density to support the larger presentation. Frame counts, flap timing, flight paths, collision shapes and classic rendering are retained. All 47 focused art tests, source/inventory validation, production build and 11 browser checks pass. Native review covers 126 flight poses in both directions, day/night jungle fixtures and normal/quarter-speed animation. The gallery records 33 current flags (1.36% aggregate); artwork/device acceptance remains pending.

- Branch-decoration/contrast pass: nests now have a dark open interior, woven shallow front wall and open lip, so empty, egg and hatched chick/shell states are distinct. The cartoon panther sits two units lower and hanging bats anchor at the painted branch underside. Coconuts and flowers have darker outlines with brighter highlights; perched-snake bands, neck and tail have warmer dark edges and lighter rims to separate them from green leaves. Source contracts, animation, collision shapes and classic graphics are retained. The review includes refreshed decoration fixtures and enlarged day/night contact/contrast sheets. Source/inventory validation, 21 focused tests, the production build, nine browser checks and the review-page smoke check pass. The same 33 comparison flags remain (1.36% aggregate); artwork/device acceptance is pending.

- Stone/leaf-contrast follow-up: the cartoon pack now has six painted stones—sandstone, slate, ochre, granite, mossy grey and banded limestone—with distinct silhouettes and surface features. It contains 576 required frames / 577 including the wordmark; classic retains 24 stone variants. The seeded selector uses the loaded pack's static frame count. Platform seating and hanging-vine endpoints follow the actual painted contours; collision and animation contracts are retained. The perched snake has its own copper/orange painted head and matching copper/gold body so it separates from green branch leaves. The review includes six standing/hanging designs, jungle rock fixtures and refreshed day/night snake-over-leaf sheets. The full 71-file / 767-test suite, 47 focused checks after the palette change, production/source/inventory checks and 11 browser checks pass. The recovery test waits for its bootstrap hook before changing options after an early load failure. The gallery has 34 flags (1.40% aggregate), including a source/atlas sampling difference on the new perched head; all current comparisons remain visible without relaxed thresholds. Owner artwork/device acceptance remains pending.

- Hanging-stone follow-up: cartoon hanging rocks omit the green side sling; the top vine retains its registered endpoint. Classic keeps its existing sling. The six standing/hanging variants and day/night jungle rock previews are refreshed. Source/inventory checks, 17 focused tests, the production build and three browser checks pass.

- Painted-support pass: stone shelves, thorn-bush shelves and beehive crossbars share a painted wood master with bark ridges, end grain and edge highlights. The three vertical support pieces use a dedicated straight shaft, eliminating the stretched side-branch stub and root flare. Stone seating follows the actual painted shelf edge, verified against rasterized pixels for all six designs; hanging stones retain their top vines and omit side slings. Horizontal branch artwork rasterizes at twice its baseline density, preserving logical geometry. All 13 affected obstacle/branch fixtures now have 2× review captures; the two whole-world views with standing branches and the six-stone sheets are refreshed. Source/inventory validation, production build, 47 focused tests and four browser checks (including classic references and atlas borders) pass. The gallery has 36 visible flags (1.43% aggregate), with the two painted shelf sampling differences added; no comparison thresholds were changed. Owner artwork/device acceptance remains pending.

- Branch-join/hive-tie follow-up: low cartoon branches hide their sawn end beneath a foreground pole, while hanging branches and classic retain their existing ends and order. The hive tie now draws behind the crossbar and emerges from its underside. Native high/low rigs at both obstacle scales, 22 fixture captures, 19 focused tests, source/inventory checks, the production build and three browser checks pass. Review fixtures and world views are refreshed; 36 source/atlas flags remain visible (1.43% aggregate). Owner artwork/device acceptance remains pending.

- Perched-snake anatomy follow-up: a slender curved painted tail replaces the leaf-like triangle; foliage remains green. Coils and neck share the head/tail’s orange-and-cream palette. The animated neck registers inside the rear of the head, with its root behind the coil and no exposed circular caps. Classic retains its placement and layers. Six native limb/pole poses, refreshed day/night context, 19 focused tests, source/inventory checks, the production build and three browser checks pass. The same 36 comparison frames remain visible (1.44% aggregate); owner artwork/device acceptance remains pending.

- Branch-pole detail follow-up: cartoon branch-bearing poles get two or three small, static, seeded leaf sprigs, trailing vines or cut branch ends. Existing painted pieces are reused with roots behind the pole and vines in front; there are no new atlas frames. The detail seed is independent of bark, animals and gameplay. Platform/hive supports, hanging branches and classic stay unchanged. Source/inventory validation, the production build, 13 focused tests, three browser checks and 80 native rig comparisons pass. Review fixtures, world views and an eight-pole sheet are refreshed. Owner artwork/device acceptance remains pending.

- Natural-pole/snake consistency follow-up: cut stubs are longer and tilted roughly 45° up/down; fine creepers follow the pole edge with leaves attached to their stems and roots behind the shaft. Perched coils and neck share a painted skin, with no legacy stripe/diamond overlays; the tail is shortened and tucked beneath the last coil. A painted mouth landmark anchors the tongue to the mouth through head rotation and mirroring. Snake rigs reserve their full occupied height plus the pole details’ upward reach, preventing overlap. Source/inventory checks, production build, 19 focused tests and three browser checks pass; native previews cover six snake poses, 16 pole variations, 80 support-scope/repeatability checks and 768 snake-clearance checks. The same 36 source-comparison flags remain visible (1.45% aggregate). Owner artwork/device acceptance remains pending.

- Snake-continuity/attachment follow-up: painted heads face back over the coils and cubic necks follow the same belly orientation and join tangent as the body. A fuller hook tail has a continuous inner belly, uniform scale, a body-width registered root and tangent-aligned attachment; pole clearance includes the larger curl. Sawn stubs taper toward the cut end and left stubs tuck 2.5 world pixels farther behind the shaft. Static stub strips bind their actual atlas page. All six standing rocks sit two world pixels deeper into their shelves, with a strict raster contact-depth check; hanging rocks/classic/collision shapes retain their placement. Source/inventory validation, the production build, 19 focused tests and four browser checks pass, including context recovery; native checks cover 160 support rigs at two atlas densities, 768 snake-clearance poses, mirrored snake/stone sheets and refreshed fixtures/context views. The same 36 source-comparison flags remain visible (1.46% aggregate). Owner artwork/device acceptance remains pending.

- Tapered-wrap/neck-emergence follow-up: The final coil tapers from body width into a short painted tail that stays visible and follows the wood closely. Pole wraps fit the painted shaft. The neck crosses behind the wood and emerges just beyond the headward coil (slightly higher on poles). The pole neck/head sit lower for a compact rise; horizontal heads have a gentler angle, and tongues follow the mouth. Source/inventory validation, the production build, 19 focused tests and four browser checks pass. Native review includes six mirrored poses, 768 clearance poses, fixtures and day/night world views. The same 36 comparison flags remain visible (1.45% aggregate). Owner artwork/device acceptance remains pending.

- Branch-fit/green-palette follow-up: Branch neck roots extend into the painted bark, front branch wraps sit two world units lower, and pole heads sit 1.5 units lower over the neck end. Tail tips have a slightly longer, more open curve. A green palette shares all copper geometry and animation, preserving pale details, gold eyes, tongue color and alpha; colors alternate by branch gap independently of pose/gameplay randomness. Source/inventory checks, production build, 19 focused tests and four browser checks pass, including unchanged classic references and context restoration. Native previews cover both colors on branches/poles and 768 clearance poses. Cartoon coverage is 181 pieces/584 frames including the title; the gallery has 37 flags (1.46% aggregate). Copper placement and the green palette were accepted by the owner; overall M8a acceptance remains pending.

- Accepted eye/pole-stub follow-up: Hanging-bat eyes are smaller in all four palettes. Panther eyes follow the painted sockets with perspective sizing, and the legacy ear overlay is hidden to remove the gray forehead oval. Cut branch stubs point 45° upward on both sides; later seeded pole decoration choices retain their positions. Source/inventory checks and the production build pass, along with unchanged classic references, 80 native support/angle checks and 768 snake-clearance poses. The updated review page and affected fixture/context/world images cover the accepted changes. The same 37 gallery flags remain (1.46% aggregate), with unchanged thresholds. Owner accepted these changes; overall M8a artwork/device acceptance remains pending.

- Accepted panther-tail/bat-ear follow-up: The panther has a painted fur-and-spots tail matched to its body, attached behind the rear haunch with a fixed root and shared breathing transform. Its sixteen-frame sway retains a covered join and clear atlas edges. The legacy hanging-bat ear overlay is hidden in all four palettes, removing the triangular artifact. Source/inventory checks and the production build pass, plus unchanged classic references. All 16 tail frames retain an opaque attachment point inside the haunch and clear frame edges; native previews cover both panther directions and all four bat palettes. The review gallery has 37 flags (1.52% aggregate), with unchanged thresholds. Owner accepted both changes. Overall M8a artwork/device acceptance remains pending.

- Accepted spider follow-up: The spider has brighter lavender fur and two larger, separated yellow eyes with small pupils. Its eight legs use 24 complete antialiased poses, replacing separately rotated narrow strips that appeared jagged at game size. Classic rendering, movement and collision shapes are unchanged. Source/inventory checks, production build, 16 focused tests and unchanged classic browser references pass. All 24 poses retain eight distinct, unclipped legs. Native review covers both spider fixtures at 1×/2×, day/night gameplay scenes and an animated game-size/close-up board. Cartoon coverage is 182 pieces/608 frames including the title; texture memory is 115 MB at 2× and 293 MB at 4×, within unchanged limits. The gallery retains 37 flags (1.53% aggregate), with unchanged thresholds. Owner accepted the final animated day/night preview. Overall M8a artwork/device acceptance remains pending.

- Accepted painted-owl/bat-eye follow-up: The owl now matches the painted animals with textured feathers, layered wings, a cream facial disc and a rounded amber beak with a short hooked tip. Its head turns, pupils, blink and breathing remain articulated, with the face kept inside the head and toes meeting the branch. Hanging-bat eyes register to the painted sockets per palette, accounting for the taller brown body frame and removing dark crescents beneath the whites. Classic artwork, movement and collision shapes are unchanged. Source/inventory checks, production build, 16 focused tests and unchanged classic browser references pass. All four bat eye pairs and the owl beak have clear top/bottom atlas margins at 4×. Native review covers both fixtures at 1×/2×, all four bat palettes, owl turns/blink and day/night game-size and enlarged previews. The gallery retains 37 flags (1.53% aggregate), with unchanged thresholds; texture memory remains 115 MB at 2× and 293 MB at 4×. Owner accepted the final beak preview after reviewing the owl and bat-eye corrections. Overall M8a artwork/device acceptance remains pending.

- Accepted painted-nest follow-up: The three nest states share a shallow painted chestnut bowl and a pale ivory speckled egg. The hatched state omits the loose shell cap and places a slim, golden-yellow chick lower and centered within the lower shell. Its head and animated beak clear the rim; mirrored poses preserve the same seating. Classic artwork and behavior are unchanged. Owner accepted the centered hatchling preview. Source/inventory checks, atlas and production builds, 16 focused tests and the unchanged classic browser reference pass. Native 1×/4× previews cover empty, intact, hatched, mirrored and open-beak poses by day and night; an eight-second pose sweep confirms the beak clears the rim. The real nest fixture was refreshed at 1×/2× along with decoration contexts and affected world scenes. Gallery comparison now reports 38 flags (1.57% aggregate), including nest.back source/atlas resampling differences; thresholds are unchanged. Texture memory remains 115 MB at 2× and 293 MB at 4×. Overall M8a artwork/device acceptance remains pending.

**M8a final report (2026-10-16, finalized for integration).**

The owner accepts the cartoon appearance through artwork commit `7abe519`.
Implementation, artwork review, automated verification and regression references
are complete on `phaser-sprites`. This report closes the work before integration;
real-device testing will take place on `phaser` afterward and is not an
integration prerequisite. The integration record below documents the completed merge.

The production pack has **182 pieces / 608 frames** including the wordmark
(181 required pieces / 607 frames in the inventory), with independent classic
and cartoon catalogs and no hidden classic artwork fallback. Cartoon graphics
and Shadow Off are the fresh-install defaults. Deliberate art-pack choices
persist; switching packs preserves the current match settings and quality.
The art guide covers sources, sheet contracts, exports, pack selection and the
capture/replacement workflow. These final counts and measurements supersede the
initial implementation report above.

| Automated verification | Final result |
|---|---|
| Unit suite | 71 files / 769 tests pass |
| Browser suite | 90 checks pass across the full run and focused reruns |
| Artwork sources and coverage | Deterministic regeneration; validation passes |
| Production build and window table | Build passes; generated table unchanged |
| Classic regression references | All 12 original PNGs unchanged; comparison passes |
| Cartoon regression references | 13 accepted captures (4.50 MB); all comparisons pass |
| Reference negative control | Deliberately incorrect day image rejected |

The browser pass corrected stale gallery/coverage expectations to use the current
manifests and explicitly selects classic for its strict source comparison.
Image/TileSprite comparisons exercise both packs: classic retains its original
tighter limit; cartoon uses the existing scene-parity limits with solid-patch
detection. All six size/pack combinations pass with no solid differences.
The offline audio test stops the live game loop before resetting global
randomness, avoiding duplicate Phaser texture keys. These are test corrections;
production artwork and gameplay are unchanged.

The cartoon references cover player/shadow/snake/nest poses, day/night gameplay,
dusk temple lighting, shared HUD/results and title/Config menus at 375×600 and
812×250. They compare runtime output with accepted runtime captures using the
existing scene tolerance; tests never regenerate the PNGs. Separately, the
source/atlas gallery retains **38 flags / 1.57% aggregate** for visible inspection.
No gallery threshold was changed to hide browser/source resampling differences.

Decimal MB; downloads include the selected catalog, atlas JSON/PNG and unique
tiles, before HTTP compression. With JSON gzipped, selected-pack transfers are
0.98/2.01/3.90 MB for classic and 7.40/11.52/23.84 MB for cartoon at 1×/2×/4×.
Both packs satisfy the enforced 120 MB at 2× and 300 MB at 4× texture budgets.

| Pack | Texture 1× | Texture 2× | Texture 4× | Download 1× | Download 2× | Download 4× |
|---|---:|---:|---:|---:|---:|---:|
| Classic | 46.61 MB | 105.64 MB | 254.21 MB | 1.17 MB | 2.20 MB | 4.09 MB |
| Cartoon | 49.63 MB | 114.98 MB | 292.55 MB | 7.59 MB | 11.72 MB | 24.04 MB |

**Deferred device testing and subsequent reporting.** All results above are
Chromium/build results. Safari on the MacBook Air M1 and iPhone 13 mini still
needs startup/decode, frame pacing, gameplay, rotation, menu and graphics-switching
checks after integration into `phaser`, before release. This finalized report
records the completed work before integration. After real-device testing has
finished on `phaser`, add a dated follow-up there recording the tested commit,
devices/browser versions, results and any findings that change the implementation,
artwork, references, measurements or acceptance decisions. Document resulting
changes and their validation in that follow-up; do not treat deferred checks as
already passed or leave this report awaiting their results.

**M8a integration record (2026-10-16).** M8a was integrated from `phaser-sprites` into `phaser` through [PR #41](https://github.com/skogdoom/liano/pull/41) on 2026-10-16 (merge commit `a49b1f2`). GitHub CI passed both Test and build (769 unit tests) and Browser tests before the merge. All 90 browser cases passed: 88 on the first attempt and two after individual retries for Chromium context/page creation failures; the full suite was not rerun after those failures. CI permits one fresh-worker retry after reproduced Chromium context-creation failures before test bodies ran; all assertions and timeouts remain unchanged. Artwork approval, automated verification, regression references and the finalized report are complete. Real-device checks remain pending on `phaser`; findings and resulting changes will be documented there after testing finishes, before release.

**Planning update (2026-10-16, after integration).** The owner moved all remaining testing and verification to M9c on a new `release-verification` branch created from `master` after the M9 migration merge. M9a implements the 1P fullscreen canopy fix on that branch first, followed by M9b plan consolidation and splitting by area. This supersedes the earlier `phaser` testing location and pre-merge verification timing in the M8a reports; completed results and pending device-check status are unchanged. Add device findings only after testing finishes on the new branch.

### M9. Cleanup and merge (S)

**Status: complete; the owner merged [PR #42](https://github.com/skogdoom/liano/pull/42) into `master` on 2026-10-17 (merge `73a36d0`).** The README now describes Phaser, both art packs and custom artwork; package metadata describes the game. Version remains `3.0.0-dev.9`. The final sync found `master` (`ebc23a7`) already contained in `phaser`, so no conflicts or merge commit were needed. Plan consolidation remains M9b; all remaining testing and verification remains M9c on the new branch created from `master`.

**Integration follow-up.** The merged tree matches the reviewed `668dd2a`, including the custom-tile replacement fix and the Pages dependency on both CI jobs. The local audit/M9b.1 plan commit `28d5015` was not part of PR #42; it is preserved as `9f5a925` on `release-verification`, created from merge `73a36d0`. Real-device verification remains pending; this records integration, not release acceptance.

Work took place on `phaser` after M8a integration. This milestone completed the
migration cleanup and merge into `master`. Remaining manual and real-device
verification belongs to M9c after this merge.

- Update the README's technology section and add a short "Custom art" section pointing to `art/README.md`; update the `package.json` description. Plan consolidation and restructuring belongs to M9b. Keep the version in the `3.0.0-dev.N` series through this milestone.
- Merge `master` into `phaser` one last time and resolve conflicts. Carry all outstanding manual/device checks and verification work into M9c without marking them passed.
- Open the `phaser` → `master` PR. Merge only when cleanup is complete and the owner explicitly says to merge. This completes M9; it does not authorize a release.
- **Done when:** cleanup is complete and the migration has been merged into `master` with the owner's explicit approval. M9a, M9b, M9b.1, M9b.2 and M9c remain required before M10.

### M9a. Fullscreen canopy coverage (S)

**Status: complete and integrated into `master` through `d91cfe2` on 2026-10-17.**
The owner authorized merging `canopy`; the integration fast-forwarded to the
tested branch head, including the regular Safari portrait correction. The
implementation used a separate branch from `master`, as requested. Bring the
updated `master` into `release-verification` before M9c; final manual and
real-device verification remains pending there.

- Determine why 1P fullscreen exposes sky above the canopy, including the interaction between viewport size, camera framing and canopy placement/coverage.
- In 1P landscape fullscreen, adjust the framing or canopy coverage so no sky is visible above the canopy. Regular portrait browser views retain half the pre-M9a space above the world; portrait fullscreen/home-screen mode retains a quarter. Cover fullscreen entry/exit, resize and rotation, and both classic and cartoon packs without changing gameplay geometry.
- Sky above the canopy remains acceptable in 2P shared mode; preserve its framing and the other supported layouts. On short landscape views, keep the floor at its normal world height and omit ground foliage if the visible bottom is above the ground line; do not raise greenery into the view.
- Record the chosen approach and affected scenarios for M9c's automated and real-device checks.
- **Done when:** the 1P fullscreen fix is implemented on `canopy`, focused checks pass and it is ready for integration and M9c verification, with the 2P shared exception documented. Integrate into `master` and sync `release-verification` before M9c.

**Implementation record (2026-10-17).** Taller layouts reserved a positive
`bandTop` above the world, while the canopy remained a fixed strip at world y=0.
That exposed scenery and sky above it in 1P fullscreen. `layoutFor` now anchors
the solo world band at the top in landscape fullscreen/home-screen mode.
Following the owner's portrait adjustment, portrait fullscreen/home-screen mode
retains a quarter of its pre-M9a space above the world (10% of spare height, rather than
40%). Regular portrait browser views now use 20% of spare height, down from 40%,
so the reduction also applies in iPhone Safari without page fullscreen. World
scale, horizontal camera targets and gameplay geometry stay the same. Fixed
multiplayer layouts bypass this adjustment, so
2P shared retains its extra sky and split mode keeps its existing panes.
Fullscreen entry/exit, resize, rotation and mode changes use the existing layout
callbacks. The floor fill extends to the actual visible bottom plus the shake
margin, including tall portrait views beyond the original fixed extension.
No artwork or regression references changed.

**Focused validation:** 55 layout, Phaser view and screen unit tests passed,
along with six Chromium browser cases and the Vite production build. The new
browser checks exercise both art packs through fullscreen entry/exit, 4:3 and
phone portrait/landscape resizing, mode changes and home-screen startup. They
check actual canopy/floor pixels with a visible-background negative control and
the full ±9-unit death-shake offset. Portrait checks also verify that the restored
space above the canopy remains visible. Home-screen coverage is emulation; physical
Safari/iPhone/iPad/Android checks remain pending in M9c.

**Portrait follow-up (2026-10-17):** after the owner's request to keep half the
former overhead space, the updated framing passed the same 55 focused unit
tests, all three canopy browser cases and the production build. Landscape and
multiplayer framing retain their initial M9a behavior.

**Short-landscape follow-up (2026-10-17):** at the owner's request, the floor
now stays at its normal world height rather than being lifted into cropped
landscape views. If the screen ends above the ground line (world y=660), both
the foreground floor and the near ground ferns are hidden, leaving the jungle
background visible at the bottom. This also applies with browser bars showing;
foliage returns when resizing/rotation reveals the ground line. Portrait and
multiplayer layouts keep their existing ground coverage. No gameplay geometry
or artwork changes. Validation passed: 55 focused unit tests, all three canopy
browser cases and the production build. Browser checks cover foliage disappearing
in a short landscape view and returning in a taller landscape view, in both art
packs. A rendered windowed-phone preview also confirmed the foliage is omitted.

**Second portrait reduction (2026-10-17):** the owner requested half the remaining
overhead space. Portrait fullscreen/home-screen mode now uses 10% of spare
height, down from 20%. The same 55 focused unit tests, three canopy browser
cases and production build passed again.

**Regular Safari portrait correction (2026-10-17):** the owner's iPhone 13 mini
screenshot showed the regular browser view, which the earlier fullscreen-only
reductions had missed. Normal portrait spacing now uses 20% of spare height
instead of 40%; fullscreen/home-screen spacing stays at 10%. At a 375 × 812 CSS
viewport, the world-band offset is 113.31 CSS pixels instead of 226.62. A new
mobile-browser check verifies this without activating fullscreen, including
shorter viewports representing visible browser bars. Validation: 85 focused
unit tests, four canopy browser cases and the production build passed; both
saved portrait menu references match exactly. This is browser emulation; final
physical-device verification remains in M9c.

### M9b. Plan consolidation and area plans (M)

Work on `release-verification` after M9a and before M9c testing and verification.
Consolidate `PLAN.md` and `PHASER_PLAN.md` into one authoritative plan, then move
its detailed content into referenced files by area to keep the main file short.

- Inventory and reconcile both plans: current requirements, architecture and decisions, milestone status/dependencies, acceptance gates, budgets, pending work and completed reports. Preserve outstanding checks and accepted exceptions without duplicating or dropping requirements.
- Use `PLAN.md` as the single main plan and entry point. Keep its current status, concise roadmap, milestone dependencies and links to the detailed area plans. Retire `PHASER_PLAN.md` as an independent plan; replace it with a short pointer if needed for existing references.
- Split the consolidated detail into focused files under `docs/plans/`, for example gameplay and controls, architecture and performance, artwork and asset pipeline, testing and device verification, release workflow, and historical milestone reports. Give each requirement and decision one authoritative location, referenced from the main plan.
- Bring the consolidated descriptions of the tech stack, project structure, tunables, performance/hardening and art pipeline up to date. Preserve milestone identifiers, completed results, accepted artwork decisions and the pending status of device checks when moving historical material.
- Update references in the README, art guides, review pages/metadata and other documentation to the main plan or relevant area file. Keep navigation between the main plan and area plans clear, and carry link/completeness checks into M9c.
- **Done when:** `PLAN.md` is a compact, authoritative roadmap linking to the area plans, the two original plans no longer compete, and all requirements, reports and pending gates have a documented home ready for M9c verification.

### M9b.1. Test suite coverage and performance (M)

Work on `release-verification` after M9b and before M9c. Use the
[test-suite audit](docs/TEST_SUITE_AUDIT.md) as the starting point. Improve test
coverage and speed without changing gameplay or weakening the checks.

- Record reproducible per-test, setup/build and retry timings on the same CI runner. Add source-mapped line/branch coverage for all relevant source files, including unimported files; distinguish Node coverage from browser integration coverage and real-device verification. Define coverage expectations by critical behavior rather than chasing one overall percentage.
- Investigate recurring Chromium context/page/startup timeouts with failure diagnostics and guaranteed cleanup of manually created pages/contexts. Keep isolated tests and individual failed-case retries; do not hide failures with longer timeouts, weaker assertions or a full-suite rerun.
- Reuse immutable, deterministic seed/gap corpora within solver/generator/grade tests and remove redundant full table recomputations across tests/build jobs where the same result is checked repeatedly. Preserve uncached determinism tests, solver-versus-world checks, statistical sample diversity, moving-arrival phases, boundary cases and the full long-run resource-bounds soak.
- Batch per-pixel assertions into equivalent aggregate checks with useful failure coordinates. Remove temporary-array allocation and repeated scans/readbacks in image comparisons while retaining every existing image scenario, tolerance, solid-patch check, reference PNG and negative control.
- Map overlapping browser checks to distinct requirements before consolidating them: modes/input, pause, layout/quality/reload, context recovery and audio routing/cache equivalence. Keep the separate failure modes those layers protect; avoid duplicating the whole browser matrix for both art packs.
- Close important gaps efficiently: exercise ready-to-play production builds and their worker/assets under `/liano/`; explicitly cover classic and cartoon context recovery; test worker-error fallback and initial catalog/texture load failures. Keep Safari/iPhone/iPad/Android acceptance in M9c as real-device work, not Chromium user-agent emulation.
- Benchmark sharing or caching identical art/build outputs between CI jobs, keyed by all relevant inputs/tool versions. Preserve cold-build coverage, freshness checks and both deployment gates; avoid serializing browser startup behind the entire unit suite unless the measured critical path improves. Add durable timing/failure artifacts so later regressions are visible.
- **Done when:** before/after measurements demonstrate faster stable checks, every removed or combined check has a documented replacement, critical gaps are covered, known bad cases still fail, and the complete retained suite passes with unchanged thresholds and references. Record remaining coverage limits and carry them into M9c.

### M9b.2. Startup loading indicator (S)

**Status: planned; implementation and branch creation pending.** After M9b.1 and
before M9c, create a new `loading-indicator` branch from the latest `master`.
Implement the indicator there, integrate the completed change into `master`,
then bring the updated `master` into `release-verification` before final testing.
Keep the version in the `3.0.0-dev.N` series.

- Show a small loading indicator when opening the game takes noticeable time, covering resource downloads and setup. Start with a short delay (around 250 ms) to avoid a flash on fast or cached loads. Make the shell available from the initial HTML/CSS, before the large game module, art catalog or atlases have downloaded; do not require another image, font or script download to display it.
- Keep it visible through the boot and main art sets, sound preparation and initial world/rig setup, until the first fully prepared title/game frame has rendered and input can be handled. The current `src/boot.js` `data-ready` flag follows the `main.js` import and fires too early for this purpose; use a readiness signal shared with the existing startup checks rather than another independent timer. Keep animation responsive during lengthy setup, yielding between setup batches if needed.
- Match the jungle game's palette and keep the presentation simple and readable in portrait, landscape, fullscreen, safe areas and both graphics modes. Use an accessible status announcement and respect reduced motion. Use indeterminate progress or truthful phase text when total work is unknown; never show a fabricated percentage or imply completion while setup continues.
- Preserve existing startup input gating and audio-unlock behavior. An input during loading must not accidentally start or release the monkey. Remove the indicator and its timers/listeners when ready. Failed script, catalog or atlas loads and setup errors must hand over to the existing error/reload interface; preserve worker fallback and graphics-restoration notices.
- Add focused checks using controlled delayed downloads/setup, not long sleeps: slow game-bundle and main-art loading keep the indicator visible until actual readiness; fast/cached startup avoids a flash; a failed resource shows the existing error interface; startup input remains gated. Reuse the M9b.1 production-startup readiness coverage at `/liano/` and exercise both packs without duplicating the full browser matrix. Carry cold/warm mobile startup, rotation and visual checks into M9c.
- **Done when:** slow startup has visible feedback throughout downloads and setup, fast startup stays unobtrusive, failure and input behavior remain correct, focused checks pass, and the change is present on `master` and `release-verification` before M9c.

### M9c. Test and verification (M)

Execute after M9a, M9b, M9b.1 and M9b.2 and before M10. All final testing and
verification takes place on `release-verification`, the new branch created from
`master` after M9. Make
resulting fixes and document the results on that branch.

- Complete all remaining manual and real-device verification from the migration plan, including the deferred M3 sound, M7 performance and M8a artwork/device checks. Cover desktop browsers, Safari on the MacBook Air M1 and iPhone 13 mini, the remaining iPad/Android checks, supported modes, gameplay, audio, startup/texture/frame budgets, rotation, menus and graphics switching.
- Verify M9a's canopy fix in 1P fullscreen with both art packs, including fullscreen entry/exit, resize and rotation. Include 2P shared and the other supported layouts in regression coverage; sky above the canopy is allowed in 2P shared.
- Verify M9b's plan restructuring: references resolve, the main plan links to each area plan, and requirements, reports, acceptance gates and pending work from both original plans remain accounted for.
- Review M9b.1's coverage map and before/after timing report; confirm critical negative controls, retained regression scenarios and the complete suite still pass, and record any accepted remaining limits.
- Verify M9b.2's loading indicator on cold and cached startup, slow downloads and resource failures, including real-device setup delays, reduced motion, rotation and both graphics modes. Confirm it covers the whole wait, disappears at actual readiness and leaves no stuck overlay or unintended input.
- Run the full automated suite, artwork/source validation, classic and cartoon regression comparisons, production build, generated-table checks and CI on this branch. For Chromium context-creation timeouts, rerun only the failed cases rather than the full suite. Resolve failures and repeat checks affected by fixes.
- Prepare the `3.0.0` version, release-specific documentation and metadata on this branch before the final verification pass. Verify the built game at `/liano/` and record the tested commit and corresponding release artifacts.
- After real-device testing finishes, add the dated follow-up to the finalized M8a report on this branch: tested commit, devices/browser versions, results, findings that change the implementation or conclusions, resulting changes and validation. Historical M8a reports remain records of the completed work; their earlier instruction to test on `phaser` is superseded by this milestone.
- Resolve or obtain explicit acceptance of concrete exceptions. Integrate the tested branch into `master` with the owner's explicit approval before M10. If `master` changes during verification, bring those changes into `release-verification` and complete the affected checks there before integration; preserve the tested release contents.
- **Done when:** all required testing and verification is recorded and accepted, checks pass, and the tested `3.0.0` contents and reports are integrated into `master`. M10 may then begin.

### M10. Release (S)

Work takes place on `master` at the end, after M9, M9a, M9b, M9b.1, M9b.2 and M9c are complete and
the tested release candidate is integrated. All final testing and verification was
performed on `release-verification`, created from `master` after M9.

- Publish the `3.0.0` contents, metadata and artifacts verified in M9c. Any further change requiring testing returns to `release-verification` and M9c before release.
- The owner tags the tested release on `master` as `v3.0.0` and publishes the prepared release notes and release.
- **Done when:** `v3.0.0` identifies the tested `3.0.0` release on `master`, and its artifacts, release notes and release are published.

## 9. Tests

| Kind | Now | After |
|---|---|---|
| Sim, generator, solver, layout, loop, scoring, physics, windows, passive-player, etc. (about 400 tests) | Node | Unchanged. |
| View logic (lianas, monkeys, hearts, hud, banana pops, shadow, temple, branch decorations, stage views, debug text; about 100 tests across 11 files, part of them touch Pixi objects) | Node, with real Pixi objects | Until M8 they stay as they are, for the Pixi version. The Phaser version gets **view-models** (plain data and functions: positions, rotations, alphas, which pieces show, text content, texture keys) tested in Node; its adapters are exercised by smoke and parity tests. M8 removes the Pixi tests. |
| Input, pause, fullscreen, audio player | Node with fakes | Unchanged for the Pixi version until M8; the Phaser adapters get synthetic-event tests of the same semantics. |
| Art generator, manifest and validator | none | Recorder and SVG-writer tests, manifest and contract checks, and the up-to-date check, in Node; atlas loading in the smoke tests; pixel checks in the parity tool. |
| New: smoke tests (Playwright, Chromium, in CI) | none | For both versions until M8: the page boots without errors; each mode starts and a key press lets go; resize and rotate; fullscreen request; context loss and restore; sound context state; no console errors over a short bot-driven run. |
| New: parity (dev tool; a few scenarios as CI checks once stable) | none | Pixel diff Pixi against Phaser until M8; afterwards the small set of reference screenshots kept in M8. |

CI gets a second job for the browser tests. `npm test` stays fast and Node-only.

## 10. Definition of done: parity checklist

Everything below must work on the Phaser renderer as on v2.3:

- Modes: 1P, 2P shared screen, 2P split screen; the title mode picker; results; play again; `Esc`.
- Rules the renderer shows: slipping and held grips with the tip blink; hearts and lives (`H`); the shadow monkey and its lianas (`S`); bananas and the tally; stages, the banner and the time-of-day tints (day, late afternoon, dusk, night, dawn, and past stage 4).
- All obstacles and decorations, the temple (four looks), bats at night; the high/low mix is sim-side.
- Settings and keys: `G H S D M F P Esc 1 2 3`, debug view in every pane, fullscreen button and exceptions.
- Layouts: landscape (16:9, wider, narrower), portrait, iPad, notches and safe areas, shared zoom, split panes.
- Motion: interpolation between steps at 60/90/144 Hz, death shake, reduced motion, high-refresh behaviour.
- Robustness: pause on blur, context loss notice and restore, fatal overlay, sound recovery after tab switches.
- Sounds: every recipe identical; mute; pause.
- Every picture comes from a named piece in the manifest, and replacing a piece with a custom PNG or SVG needs no code change.
- Version on the title screen; Pages deploy at `/liano/`; the window-table check in CI.
- Performance within the section 6 budgets on the iPhone 13 mini.

## 11. Open questions

**M8a art direction, answered:** the owner chose a cohesive painted cartoon style for both characters and scenery, based on the day/night concepts. There are no unresolved planning questions for this milestone. The owner authorized implementation and approved continuing from the corrected style sample. The owner has now accepted the full cartoon appearance through `7abe519`. Final automated verification, reference promotion and reporting are complete, and M8a is integrated into `phaser` through PR #41. Real-device checks are assigned to M9c on the new branch created from `master` after M9 and remain a pre-release requirement.

Every question from the first two drafts is answered in section 1. New questions that come up during a milestone are added here and asked before that milestone's PR is merged into `phaser`.

From M1:
1. ~~**The iPhone 13 mini numbers.**~~ Answered: in the M1 report (a go). To measure again, on a computer on the same network as the phone run `npm ci`, `npm run art:build`, `npm run spike:bench`. Then, in Safari on the phone, open the printed network address followed by `spike/bench.html?engine=atlas&branches=4&lianas=4` (or `engine=pixi`). The `result` line comes after 12 s.
2. ~~**Solid patches as part of "identical"?**~~ Accepted: a scenario also fails with more than 25 solid pixels per million (section 1). The spike's correct rigs score 0–16 per million; the magenta eyes 640; the rope's flat ends 49 (1×) and 142 (2×).
3. ~~**The texture budget.**~~ Accepted: 120 MB at a pixel ratio of 2 (section 6).

## 12. Appendix: Pixi use by file

| File | Lines | Pixi features | Approach |
|---|---|---|---|
| `render/obstacleViews.js` | 1,238 | Graphics (all kinds), containers, clear/redraw animation, additive glow, container tint on the temple | Rigs of generated pieces: joints, flipbooks, stretch pieces, variants; the largest item (M4–M5d). |
| `render/overlays.js` | 367 | Text, Graphics, containers, drop shadows | UIScene with Phaser Text and generated panel pieces (M6). |
| `render/background.js` | 258 | Render groups, container tint, Graphics, 32-band sky | Generated backdrop tiles, tinted, on scrolling `TileSprite`s (M5d). |
| `render/lianaView.js` | 166 | Graphics, rotation of a pre-drawn liana, redraw on state change | A rope plus leaf pieces placed per liana, as today (M5a). |
| `render/monkeyView.js` | 156 | Containers of Graphics parts, rotations | A rig of generated parts with joints, one set per palette (M5a). |
| `render/bananaView.js` | 147 | Graphics, Text pop-ups | A generated banana piece, Phaser Text (M5c). |
| `render/debugOverlay.js` | 196 | Graphics (live), Text | Native Phaser Graphics is fine here (dev only) (M6). |
| `render/pane.js` | 141 | Containers, mask clip | Cameras (M6). |
| `render/hud.js`, `heartView.js`, buttons, `shadowView.js` | about 440 | Text, Graphics, containers | UIScene and generated pieces (M5a, M6). |
| `main.js` | 353 | `Application`, ticker, stage, canvas | Scenes and Game config (M2). |

## Appendix B: view tests the Phaser version must also cover

From M0. "Shared" means the test checks a plain helper (no Pixi object) that both versions can use once it moves out of the Pixi view file; "Phaser" means the Phaser version's view-model needs a test of the same behaviour.

| Test file | What it checks | For the Phaser version |
|---|---|---|
| `banana.test.js` | `bananaLine`, the results tally text | Shared (move out of `hud.js`) |
| `split.test.js` | `playerLine`, the results line per player | Shared (move out of `hud.js`) |
| `swing.test.js` | `tipFlashOn`, when the vine end blinks | Shared (move out of `lianaView.js`) |
| `stageViews.test.js` | `bannerAlpha`, `STAGE_NAMES`, `STAGE_TINTS`, `tintBetween`; the backdrop easing its tint from stage to stage | Shared, and Phaser: the backdrop rig eases its tint the same way |
| `branchDecorations.test.js` | Decoration data (`DECORATIONS`, `NEST_STATES`, `FLOWER_COLORS`, `BAT_LOOKS`) and shares; each decoration animates in both directions | Shared data; Phaser: every decoration rig animates both ways (its flipbooks and joints) |
| `templeFire.test.js` | `darknessOf`; the fire kept out of the tint, the stone tinted; the light round the braziers in the dark stages; no fire on the other temples | Shared `darknessOf`; Phaser: the same three behaviours on the temple rig |
| `hearts.test.js` | `heartsFor` (filled, outlined, the number past five); the drawn row with the number at the top left of the first heart | Shared `heartsFor`; Phaser: the heart row's pieces and the number's place |
| `lianaView.test.js` | A swinging liana turns about its anchor, its tip lands where the old drawing put it, it changes look only when its state does, and the tip blinks | Phaser: the liana rig's rotation, tip position, pieces per state and blinking end |
| `interpolate.test.js` | Lianas and monkeys drawn between sim steps; jumps and shadow frames drawn as they are | Phaser: the same through the rigs (the `blend` maths is shared already) |
| `shadow.test.js` | The shadow drawn: a grey, see-through liana of its own while hanging, nothing without | Phaser: the shadow rig (the rest of the file is simulation) |
| `debugOverlay.test.js` | One debug layer per pane, each player's numbers in their own pane, following mode changes, nothing while hidden | Phaser: the same per camera |
