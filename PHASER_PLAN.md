# Migrating Liano from PixiJS to Phaser (v3.0.0)

Status: **agreed plan (fourth draft: adds pre-rendered, replaceable art, section 5). M0 is done (its report is under M0); M1 is next.**

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
| What counts as identical? | A pixel diff under about 1 % of pixels differing by more than 8/255 per channel on the parity scenarios; sub-pixel antialiasing differences are accepted. |
| Visual checks after M8? | M8 keeps a small set of reference screenshots of the parity scenarios (a few MB at most) for later visual checks. |
| Budgets? | Those of section 6. |
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

**Atlases.** The build rasterizes every piece (the custom one if present, else the generated one) and packs them into texture atlases at 1× and 2× (the pixel-ratio cap), sized for the iPhone 13 mini's texture limit. The game loads the set that matches the screen: a small boot set (title, monkey, first stage) first, the rest during the title. Atlases are build output, not committed. Pieces from one atlas are drawn in one batch, so there should be fewer draw calls than today.

**Tools.** An art gallery page (dev only) shows every piece with its contract: the default and any custom version side by side, flipbooks playing, hitbox and pivot overlays, and the piece in a game scene. `art/README.md`, generated from the manifest, is the guide for an artist.

**Still drawn live:** text (Phaser Text, the same fonts) and the debug view (Phaser Graphics, dev only).

**Not part of v3.0.0:** drawing the custom art itself, switching art packs at runtime, and changing hitboxes to fit new art.

## 6. Target device and budgets

The weakest device is an **iPhone 13 mini**: A15 chip, 4 GB of memory, a 60 Hz screen, 375 × 812 CSS pixels at a pixel ratio of 3 (the game caps it at 2, as today, so the canvas is 750 × 1624 in portrait), and Safari's WebKit engine (every browser on iOS uses WebKit). Proposed budgets, measured on that phone:

- **Frame rate:** a steady 60 fps in every mode, split screen included: no frames over 34 ms in a normal run (the debug view's `slow` counter), and the JS part of a frame no more than about twice today's.
- **Start:** a playable title within about 1.5 s of the page loading (once cached), loading and decoding the boot atlas included.
- **Texture memory:** a budget set in the M1 spike, aimed well under 150 MB at a pixel ratio of 2. iOS reloads a page whose memory grows too large, and WebGL textures count towards it. The texture size limit is read on the phone in M1; until then the plan assumes 4096 pixels.
- **Memory over time:** no growth of the post-GC heap over 30 game-minutes (measured in Chrome, which reports the heap; Safari doesn't).

Measuring on the phone: the debug view's frame line (`fps`, `worst`, `slow`) works in Safari; Safari's Web Inspector (from a Mac) gives timelines and memory. CI runs the browser tests in Chromium only, so anything WebKit-specific is caught on the phone.

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

### M2. Platform: Game, Scenes, Scale, lifecycle (M)

- `Phaser.Game` config (WebGL, antialias, our canvas, audio on, `fps.smoothStep: false`, no auto-pause surprises); Boot, Play and UI scenes.
- Scale Manager and the pixel-ratio method from M1; `layout.js` feeds the letterbox, safe areas, the portrait and landscape frames, and the shared zoom; resize, rotate and pixel-ratio changes.
- The letterbox, loading the atlases, the fatal overlay (DOM, unchanged), `window.__liano` dev hooks.
- Pause on blur or hidden, `P`, `Esc`, context loss and restore (pause, notice; the atlases upload again by themselves).
- Fullscreen on Phaser's Scale Manager with the existing exceptions and the `pointerup` rule.
- **Done when:** every layout shape (the cases `layout.test.js` covers, plus a phone, an iPad, portrait) draws a correct letterboxed empty frame; fullscreen and context-loss smoke tests pass; `layout`, `pause` and `fullscreen` tests pass, adapted.

### M3. Input and audio on Phaser (M)

- **Input** adapter on Phaser's keyboard and pointers: `KEYS`, key repeat ignored, shift avoided, the toggle keys (`D G H S M F P Esc 1 2 3`), `consumePress`/`consumeModePick`, touch taps, the buttons' tap interception, `accepts` (no input while paused or just resumed). `input.test.js` adapted.
- **Audio** on Phaser's `WebAudioSoundManager`: our recipes (`audio/recipes.js`, unchanged) connect to its `destination`; mute, pause, volume, unlock and resume handled by Phaser, plus the extra recovery we had to add (rebuilding a context that stays suspended, the clock check) if Phaser's own handling doesn't cover the cases we hit; the debug `sound` line kept.
- **Done when:** the player, sounds and recipes tests pass adapted; an offline render of every sound matches the current one sample for sample (the same recipes, so it should); a manual pass on desktop Chrome, Firefox, Safari and the iPhone 13 mini confirms sound survives tab switches and reloads.

### M4. The asset pipeline: generated, replaceable art (L)

- **Inventory**: every object kind, its pieces, what varies per object and how each maps (section 5); the cases that can't match exactly, with their diffs, for approval.
- **Recorder and SVG writer** for the Pixi `Graphics` calls the code uses (`moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo`, `arc`, `circle`, `ellipse`, `rect`, `roundRect`, `poly`, `closePath`, `fill`, `stroke` with width, colour, alpha, cap and join, `clear`); pure, tested in Node.
- **Generator** (`npm run art`): runs the drawing functions for each piece, frame and variant, writes `art/generated/*.svg` (with the hidden guide layers) and `art/manifest.json`; CI checks they are up to date.
- **Contracts and overrides**: `art/custom/`, the optional sidecar JSON, the validator (`npm run art:check`, in CI).
- **Build step**: rasterize and pack the atlases at 1× and 2×; a loader that picks the set by pixel ratio, the boot set first.
- **Runtime helpers**: rigs (pieces with pivots and attachment points), flipbooks, 3-slice stretch pieces, ropes, tint groups, the additive glow.
- **The art gallery page** and the generated `art/README.md`.
- **Done when:** every piece is generated and shown in the gallery; the gallery shapes are within the parity tolerance (section 1); the recorder, writer, manifest and validator tests pass in Node; replacing one piece with a placeholder in a test build shows in the game with no code change; atlas sizes and load time are inside the budgets.

### M5. World rendering (L, in four parts)

For each part: rigs built from the M4 pieces, a view-model (tested in Node) and a Phaser adapter.

- **M5a, the monkey and the lianas.** Monkey (poses, body rotation easing, facing, blink, the death spin, the two-player palettes), lianas (rest, swinging, settling, tip flash, the shared-screen pair that bows apart, golden and green sets), interpolation between steps, the shadow monkey and its fading grey lianas.
- **M5b, static obstacles and decorations.** Branch (with the nine decorations), thorn bush, rock, beehive, the vines and trunks, the day and night decoration sets, the hanging bats and owls.
- **M5c, moving obstacles and bananas.** Spider with its thread, snake, bird, blue bird, purple bird, bat, circling bat (their wing, leg and eye animation as flipbooks and joints), bees, bananas with the glint, "+1" and "+1 ♥" pops, the heart on the field.
- **M5d, the temple and the world around it.** The four temple looks, the stage tint, haze, moss, the fires (flicker, additive glow, fire kept untinted), then the backdrop: sky bands, the three parallax layers, canopy, floor, the stage and time-of-day tint transitions, dawn.
- **Done when:** each part's parity-tool scenarios are inside the tolerance, its view-model tests pass, and the frame-time and memory budgets still hold with everything on screen.

### M6. Panes, HUD, overlays and the three modes (L)

- Phaser cameras per pane: viewport (clip), zoom, scroll from our camera, shake from our `Shake` maths; single pane, shared screen (zoom 0.75, leader camera, portrait follow-the-anchor), split screen (two panes, each its own world).
- HUD (scores, banana count, hearts rows, "OUT"), the title (mode picker, controls, version, settings line for slipping, lives and shadow), stage banners, the pause and results panels, the off-screen monkey indicator, game-over panels, the mute and fullscreen buttons, the notice, the debug overlay (per pane), text with stroke, shadow and the pixel-ratio `resolution`.
- Reduced-motion, safe-area insets, touch layout, portrait text scale.
- **Done when:** all of `PLAN.md`'s modes and settings work on the Phaser renderer (the checklist in section 10), parity scenarios inside tolerance, `hud/banana/hearts/split/stageViews/debugOverlay` tests pass in their new form.

### M7. Parity, performance and polish (M–L)

- Run the whole parity set; fix every diff above tolerance or record a reviewed exception.
- Port the long-run harness (`scripts/longrun.mjs`) and the measurement scripts to Phaser and re-run the benchmarks from the performance work: frame time, heap over 30 game-minutes in the four scenarios, draw calls, the leak check, 90/120/144 Hz motion, first-appearance hitches. The **budgets** are those of section 6, on the iPhone 13 mini.
- Bundle: custom Phaser build or lazy features if the size is a problem.
- Real-device pass: desktop browsers, the iPhone 13 mini, an iPad, an Android phone; portrait and landscape; split and shared; both versions side by side.
- **Replacement drill**: in a test build, swap one piece of each kind (plain, flipbook, joint, stretch, rope, tinted) for placeholder art, check the game, gallery and validator handle them, then revert.
- Make Phaser the default version; Pixi stays reachable with `?engine=pixi`.
- **Done when:** parity and budgets are met or each exception is accepted in writing here.

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

None: every question from the first two drafts is answered in section 1. New questions that come up during a milestone are added here and asked before that milestone's PR is merged into `phaser`.

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
