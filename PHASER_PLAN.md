# Migrating Liano from PixiJS to Phaser (v3.0.0)

Status: **agreed plan (fourth draft: adds pre-rendered, replaceable art, section 5). M0, M1 and M2 are done (their reports are under each; M1's go/no-go, measured on the iPhone 13 mini, is a go). M3 is done (the rest of its manual sound pass is due now that M5 draws the bananas). M4 is done. M5 is done (its two parity exceptions accepted). M6 is done (its report). M7 is done (its report; the owner finds the performance on the iPhone 13 mini OK) but for the rest of the real-device pass: Phaser is now the default version. M8 follows once M7 is accepted.**

**Nothing is merged into master until every milestone (M0 to M9) is finished and the owner explicitly says to merge.** Milestone PRs go into `phaser` only.

The goal is to replace PixiJS 8 with Phaser, and to keep every bit of the game as it is: the gameplay, all three modes, every feature and setting, the graphics, and the sounds. The player should not be able to tell the versions apart, except that the title screen says v3.

## 1. Decisions

Made with the owner (answers to the planning questions):

| Question | Decision |
|---|---|
| How far into Phaser? | **Adopt Phaser throughout**: Scenes, the Scale Manager, Cameras, Input and the Sound manager, not only the renderer. |
| How to port the graphics? | **Pre-rendered, replaceable art** (section 5): at build time today's drawing code generates an SVG for every piece of art; in the game each object is a rig of named pieces from texture atlases. Today's look stays pixel-identical. |
| Custom art later? | Any piece can be replaced by a **custom PNG or SVG** with the same name. |
| Variety per object? | **Kept exactly**: the code still picks colours, counts, flips, positions, lengths and patterns per object; only the pictures are files. |
| When is art swapped? | **At build time**: drop the file in `art/custom/` and rebuild. |
| How to test the views? | **Pure view-models tested in Node, plus a few browser smoke tests** in CI. |
| Branching? | **Long-lived `phaser` branch**: each milestone is a PR into `phaser`, master is merged into `phaser` regularly, and `phaser` is merged into master once, as 3.0.0, only after all milestones are finished and the owner explicitly says so. |
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
| Version numbers? | `3.0.0-dev.N`, bumped at each milestone merged into `phaser`; `3.0.0` at the end. |
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

**Not part of v3.0.0:** drawing the custom art itself, switching art packs at runtime, and changing hitboxes to fit new art.

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

  As in the Pixi version, no pre-warm is worth it: a new rig costs about as much as a new Pixi view, and the few slow frames are as rare in both.
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
- **Left for the owner** (needs real devices; nothing here can stand in for them):
  - Phaser background movement change: [BACKGROUND_MOTION.md](BACKGROUND_MOTION.md). Moving Images helped a little on the owner's MacBook Air M1; the frame readout shows only 5 late frames in 3,482. Phaser's decorative scenery now follows an eased position and scrolls 20% slower. Canopy/floor remain aligned with gameplay. Pixi, the gameplay camera and rules are unchanged. `?backdrop=tiles` compares drawing paths with the same new scenery motion; Safari validation is still needed.
  - the rest of the real-device pass: desktop browsers (Chrome, Firefox, Safari), an iPad, an Android phone; portrait and landscape; split and shared; both versions side by side;
  - the rest of M3's manual sound pass (the pling, Chrome, Firefox, the iPhone 13 mini).

  If the phone's start is over budget, the first stage's obstacles move to the boot set (M4). The trunks as stretched pieces (M5d) stay an option, not done: the trees are accepted as they are.

### M8. Remove Pixi (S–M)

Only once M7 is accepted: until then the Pixi version is the reference.
- Remove the `pixi.js` dependency, the Pixi version's renderer (the `src/render/` views and `main.js` wiring) and the modules only it uses (its DOM input, fullscreen, pause and sound player, which Phaser has replaced), the parity tool and the `?engine` switch.
- Remove the tests of the Pixi views and modules; their view-model and adapter counterparts stay. Move `src/phaser/` to its final place.
- Keep a small set of reference screenshots of the parity scenarios from the last two-version build (a few MB at most), for later visual checks.
- **Done when:** the build contains no Pixi code, all tests and smoke tests pass, and the bundle size is recorded.

### M9. Cleanup and release (S)

- Rewrite `PLAN.md` (tech stack, performance and hardening, structure, tunables, the art pipeline), the README's technology section and a short "Custom art" section pointing to `art/README.md`, and the `package.json` description; set the version to 3.0.0.
- Merge master into `phaser` one last time, run CI and open the PR into master. It is merged only when the owner explicitly says so, after every milestone is finished. The owner tags `v3.0.0` and writes the release notes.

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
