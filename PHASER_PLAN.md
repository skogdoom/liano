# Migrating Liano from PixiJS to Phaser (v3.0.0)

Status: **agreed plan (third draft: every question answered). Nothing in it is implemented yet.** The `phaser` branch carries only the version bump (3.0.0-dev.0) and this document.

**Nothing is merged into master until every milestone (M0 to M9) is finished and the owner explicitly says to merge.** Milestone PRs go into `phaser` only.

The goal is to replace PixiJS 8 with Phaser, and to keep every bit of the game as it is: the gameplay, all three modes, every feature and setting, the graphics, and the sounds. The player should not be able to tell the versions apart, except that the title screen says v3.

## 1. Decisions

Made with the owner (answers to the planning questions):

| Question | Decision |
|---|---|
| How far into Phaser? | **Adopt Phaser throughout**: Scenes, the Scale Manager, Cameras, Input and the Sound manager, not only the renderer. |
| How to port the graphics? | **Identical look via Canvas2D baking**: the existing drawing code runs through a small Pixi-Graphics-compatible shim onto Canvas2D, and the results become Phaser textures. |
| How to test the views? | **Pure view-models tested in Node, plus a few browser smoke tests** in CI. |
| Branching? | **Long-lived `phaser` branch**: each milestone is a PR into `phaser`, master is merged into `phaser` regularly, and `phaser` is merged into master once, as 3.0.0, only after all milestones are finished and the owner explicitly says so. |
| Which Phaser? | **Phaser 4.2.1** (the current `latest`), not 3.90. |
| Sounds? | **Keep the synthesized recipes**: they play through Phaser's audio context and master nodes, so Phaser handles unlock, mute and pause, and every sound stays the same. |
| Both versions? | **Both stay playable side by side** until the Pixi removal milestone (M8), which comes after parity and performance (M7), so they can be compared at any point. |
| Weakest device? | **iPhone 13 mini**: the budgets are set for it (section 5). |
| What counts as identical? | A pixel diff under about 1 % of pixels differing by more than 8/255 per channel on the parity scenarios; sub-pixel antialiasing differences are accepted. |
| Visual checks after M8? | M8 keeps a small set of reference screenshots of the parity scenarios (a few MB at most) for later visual checks. |
| Budgets? | Those of section 5. |
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
| Drawing code (Pixi `Graphics`, `Container`, `Text`) | `render/*View*.js`, `background.js`, `overlays.js`, `hud.js`, `pane.js`, `debugOverlay.js`, buttons | about 3,000 | Drawing code is kept and run through the shim; scene graphs, tints, clips and text are rewritten. |
| Input | `input.js` | 114 | New adapter on Phaser's Input; same semantics. |
| Fullscreen, pause | `fullscreen.js`, `pause.js` | 125 | Move onto Phaser's Scale Manager and game events; same rules. |
| Audio player | `audio/player.js` | 237 | Moves onto Phaser's sound manager and its `AudioContext`; same recipes. |

How Pixi is used today (counted in `src/`): 241 `fill`, 76 `poly`, 71 `circle`, 70 `moveTo`, 69 `stroke`, 58 `ellipse`, 55 `lineTo`, 42 `rect`, 30 `clear`, 17 `quadraticCurveTo`, 10 `bezierCurveTo`; 36 round line caps and 11 round joins; 6 `Text` objects; 5 container tints; 1 additive blend; 1 mask (the split-screen clip); 2 render groups. There are no sprites, textures, gradients (the sky is drawn in 32 bands) or filters.

## 3. Target architecture

New code goes in `src/phaser/`, next to the untouched `src/render/`, until Pixi is removed (M8).

**Two playable versions until M8.** `?renderer=pixi` and `?renderer=phaser` pick the version. Each is a complete game: the Pixi version keeps today's renderer, input, fullscreen, pause and sound player unchanged; the Phaser version uses Phaser for all of them. Both share the simulation, the layout, the loop and the sound recipes. Each version is loaded with a dynamic import, so a page downloads only its own library. Pixi is the default until the end of M7, then Phaser, with Pixi one URL parameter away until M8 removes it. Master (and the live game) stays on Pixi throughout, since `phaser` is merged into it only at the end.

```
Phaser.Game (WebGL, our canvas, audio on, delta smoothing off)
 ├─ BootScene     bakes the art into textures, shows nothing the player sees
 ├─ PlayScene     the worlds: one Phaser Camera per pane (viewport, zoom, scroll)
 └─ UIScene       HUD, overlays, buttons, debug text, notices (own camera, on top)
```

| Pixi today | Phaser |
|---|---|
| `Application`, `ticker` | `Phaser.Game`; `Scene.update(time, delta)` feeds our accumulator (`fps.smoothStep: false`). |
| `renderer.resize(w, h, resolution)` with `autoDensity` | Scale Manager plus a manual pixel-ratio step (Phaser 4 has no `resolution` or `autoDensity`): canvas backing size = CSS size × ratio, camera zoom × ratio, text `resolution` = ratio. |
| `Container` trees | Containers or Layers in a Scene, shown by cameras. |
| `Graphics` drawing code | The shim records the same calls and runs them on Canvas2D; the result is a texture shown by `Image` or `Sprite`. |
| Redrawn `Graphics` (wings, legs, flames) | Rotated or scaled baked parts, flipbook frame sets, or a small live canvas texture (decided per piece, section 6). |
| `container.tint` | `Image.setTint` (multiply) on baked images; a colour-matrix filter on a container where one tint covers a group. |
| `blendMode = 'add'` (temple glow) | `setBlendMode(ADD)` on the glow image. |
| Stencil mask (split-screen clip) | Camera viewports clip for free. |
| Render groups (parallax layers) | Baked tiles on a `TileSprite` or images with a scroll factor. |
| `Text` | `Phaser.GameObjects.Text` (stroke, shadow and `resolution` exist). |
| DOM key and pointer handlers | Phaser Input (`KeyboardPlugin`, pointers), behind the same press/consume semantics. |
| Our `SoundPlayer` and its context fixes | Phaser `WebAudioSoundManager` (its `context`, `masterMuteNode` and `destination`); our recipes connect to it. |
| Our fullscreen module | `scale.startFullscreen` and its events, keeping the iPhone and home-screen exceptions. |

## 4. What Phaser 4.2.1 does and doesn't offer

Checked by installing `phaser@4.2.1` and reading its source and bundled docs:

- **Graphics** has `moveTo`, `lineTo`, `arc`, rectangles, circles, ellipses, triangles and point lists, but **no quadratic or bezier curves** (the `Curves` classes sample them into points), and **no line cap or join options** (no `lineCap` anywhere in its Graphics renderers). Its own docs say the command buffer is **replayed and re-tessellated every frame**, that it is "expensive to render", and advise `generateTexture` for static art. This is why the art is baked.
- **No `resolution` or `autoDensity` in the game config**, and `devicePixelRatio` is only read for an `OS.pixelRatio` value. HiDPI crispness must be built by hand (section 6, R3).
- **Containers and Graphics have no tint.** Images and Sprites do (multiply by default; fill, add, screen and others exist). v4 filters can be enabled on any object, including a container.
- **Cameras**: viewport, zoom, scroll and `ignore(...)` per camera, which fits split screen, shared zoom and the pane clip.
- **Sound**: `WebAudioSoundManager` exposes its `context`, `masterMuteNode`, `masterVolumeNode` and `destination`, and handles the browser unlock (`locked`, an unlock on first input).
- **Cannot be imported under Node** (`window is not defined`). Pixi 8 can, which is why a dozen of our test files build real Pixi views headlessly today.
- **Size**: `phaser.esm.min.js` is 1.38 MB, **356 KB gzipped**. Today's whole game (Pixi included) is 207 KB gzipped, so the download grows by roughly 150–170 KB gzipped unless a custom build (`phaser-core`, `phaser-no-physics`) trims it.

## 5. Target device and budgets

The weakest device is an **iPhone 13 mini**: A15 chip, 4 GB of memory, a 60 Hz screen, 375 × 812 CSS pixels at a pixel ratio of 3 (the game caps it at 2, as today, so the canvas is 750 × 1624 in portrait), and Safari's WebKit engine (every browser on iOS uses WebKit). Proposed budgets, measured on that phone:

- **Frame rate:** a steady 60 fps in every mode, split screen included: no frames over 34 ms in a normal run (the debug view's `slow` counter), and the JS part of a frame no more than about twice today's.
- **Start:** a playable title within about 1.5 s of the page loading (once cached), art baking included.
- **Texture memory:** a budget set in the M1 spike, aimed well under 150 MB at a pixel ratio of 2. iOS reloads a page whose memory grows too large, and WebGL textures count towards it. The texture size limit is read on the phone in M1; until then the plan assumes 4096 pixels.
- **Memory over time:** no growth of the post-GC heap over 30 game-minutes (measured in Chrome, which reports the heap; Safari doesn't).

Measuring on the phone: the debug view's frame line (`fps`, `worst`, `slow`) works in Safari; Safari's Web Inspector (from a Mac) gives timelines and memory. CI runs the browser tests in Chromium only, so anything WebKit-specific is caught on the phone.

## 6. Risks and how the plan deals with them

| # | Risk | Mitigation | Where |
|---|---|---|---|
| R1 | The Graphics API gap (curves, caps, joins) breaks "identical". | The shim: a **recorder** of the Pixi calls we use (pure, testable in Node) and a **Canvas2D executor** (browser). Canvas2D has curves, caps and joins. The drawing code moves over almost unchanged. | M1, M4 |
| R2 | Baked textures cost memory, the tightest limit on the iPhone 13 mini. A full-screen layer at 2× is ~15 MB, and there are five layers. | Per-layer bake scale (soft scenery can be baked below device scale); tiles instead of full strips; a measured texture budget with a go/no-go gate (section 5). | M1, M4, M7 |
| R3 | **HiDPI.** No `resolution` in Phaser. | Canvas size = CSS size × ratio (capped at 2 as today), camera zoom × ratio, text `resolution`, and baking at the effective scale. Prototyped in the spike. | M1, M2 |
| R4 | **Animated art** (wings, legs, tails, eyes, flames, bees, spider threads, settling lianas) is redrawn every frame today. | Classified per piece: (a) parts rotated or scaled from baked textures (monkey limbs, swinging lianas, already rotation-based); (b) flipbooks of N baked frames for periodic motion (wings, bees, flames); (c) a small live canvas texture for the few that depend on state. Measured against the budget. | M4–M5 |
| R5 | **Tinting** whole layers and the temple. | Baked layers are Images (tint multiplies as today). Temple children tint the same way, with the fires excluded. | M5 |
| R6 | **Tests**: Phaser can't load in Node. | Split each view into a plain view-model (what to draw, where, how: tested in Node as now) and a thin Phaser adapter (smoke-tested in a real browser). | M0, throughout |
| R7 | **Audio parity and unlock**: the earlier sound bugs (suspended contexts after tab switches) were subtle. | Our recipes connect to Phaser's context and master nodes. The existing debug state (`sound running`, `locked`, `rebuilt`) and the player tests are carried over, plus an offline render of each recipe compared old against new. | M3 |
| R8 | **Input semantics** (key repeat ignored, `consumePress`, touch rules, buttons intercepting taps). | Keep our semantic layer and feed it from Phaser Input; `input.test.js` adapted to drive the adapter with synthetic events. | M3 |
| R9 | **Fullscreen, safe areas, iOS** quirks, portrait follow. | `layout.js` stays authoritative; the Scale Manager only provides the size; fullscreen via `scale.startFullscreen` on `pointerup`, keeping the exceptions. | M2 |
| R10 | **WebGL context loss** (phones backgrounding the page). | Keep our pause-and-notice handling. Baked textures come from Canvas sources, so Phaser re-uploads them; live textures are redrawn on `restorewebgl`. Tested with the `WEBGL_lose_context` extension. | M2 |
| R11 | **Startup time**: hundreds of baked textures. | Bake lazily by kind on first need (as views are built on first appearance today), the shared backdrop at boot; budget in section 5. | M1, M7 |
| R12 | **Performance**: Phaser replays Graphics every frame. | Only small shapes stay live; everything large is baked. Measured with the existing long-run harness, ported. | M1, M7 |
| R13 | Phaser 4 is young (4.0.0 came out in April 2026, 4.2.1 in July). | Pin 4.2.1; the spike exercises exactly the features we need; a short list of known-bad areas kept in this document. | M1 |
| R14 | Master keeps changing `src/render/*` during the migration. | Merge master into `phaser` regularly; a visual change on master needs a matching change in `src/phaser/` (a checklist item on each such PR). | workflow |
| R15 | Two versions to keep working until M8. | The shared code (sim, layout, loop, recipes) is untouched; each version's own code lives in its own folder; CI runs both versions' tests and smoke tests. | M0–M8 |

## 7. Milestones

Sizes are relative: S (about a day of focused work), M (a few days), L (a week or more).

### M0. Groundwork and the parity tool (M)

- Add `phaser@4.2.1` next to `pixi.js`; Vite config; report the bundle, try the custom entries and record what each saves.
- Create `src/phaser/` and the `?renderer=pixi|phaser` switch, each version behind a dynamic import; the game still defaults to Pixi.
- **Parity tool**: a dev-only page that renders the same scenario with Pixi and with Phaser and reports a pixel diff, so "identical" is measured, not judged by eye. Scenarios come from deterministic states (fixed seed, stopped ticker, fixed time): title in each mode and settings combination, each stage and time of day, a gallery of every obstacle kind, decoration and temple variant, every liana state, monkey poses, HUD with hearts and bananas, split and shared panes, pause, results, the debug view. The tool goes with Pixi in M8.
- CI: a Playwright job (Chromium only) for the smoke tests of both versions, kept separate from the fast `npm test`.
- Define the test split for views: for each of the ~11 Pixi-touching test files (hud/banana, branchDecorations, debugOverlay, hearts, interpolate, lianaView, shadow, swing, stageViews, templeFire, split) list which assertions the Phaser version's view-models must also cover. The Pixi tests themselves stay as they are until M8.
- **Done when:** `?renderer=phaser` boots a blank scene, `?renderer=pixi` (and no parameter) plays the game as today, the parity page runs one scenario both ways, and CI runs a smoke test of each.

### M1. Spike: prove the approach and set the budgets (M, a decision gate)

Build the minimum of M4 and M2 for three representative pieces and measure:

1. one **backdrop layer** (large, soft, tinted, scrolling);
2. the **panther** on a branch (many parts, animated eyes and tail);
3. a **liana** that swings, with its leaf pattern (rotation of a baked texture).

Measure on desktop, with CPU/GPU throttling, and **on the iPhone 13 mini**: pixel diff against Pixi, texture memory, bake time, per-frame JS time, draw calls, the phone's texture size limit, and crispness at 1×, 1.5× and 2× pixel ratios. Also try Phaser's native Graphics for the same three pieces, to confirm the baking decision with numbers.
- **Done when:** a short report in this document records the numbers and the choices: bake scale per layer class, the animated-art classification, the HiDPI method, startup time, the texture budget. **Go/no-go**: if the section 5 budgets can't be met on the phone, stop and revise the plan before M2.

### M2. Platform: Game, Scenes, Scale, lifecycle (M)

- `Phaser.Game` config (WebGL, antialias, our canvas, audio on, `fps.smoothStep: false`, no auto-pause surprises); Boot, Play and UI scenes.
- Scale Manager and the pixel-ratio method from M1; `layout.js` feeds the letterbox, safe areas, the portrait and landscape frames, and the shared zoom; resize, rotate and pixel-ratio changes.
- The letterbox, the loading/bake step, the fatal overlay (DOM, unchanged), `window.__liano` dev hooks.
- Pause on blur or hidden, `P`, `Esc`, context loss and restore (pause, notice, re-bake or redraw).
- Fullscreen on Phaser's Scale Manager with the existing exceptions and the `pointerup` rule.
- **Done when:** every layout shape (the cases `layout.test.js` covers, plus a phone, an iPad, portrait) draws a correct letterboxed empty frame; fullscreen and context-loss smoke tests pass; `layout`, `pause` and `fullscreen` tests pass, adapted.

### M3. Input and audio on Phaser (M)

- **Input** adapter on Phaser's keyboard and pointers: `KEYS`, key repeat ignored, shift avoided, the toggle keys (`D G H S M F P Esc 1 2 3`), `consumePress`/`consumeModePick`, touch taps, the buttons' tap interception, `accepts` (no input while paused or just resumed). `input.test.js` adapted.
- **Audio** on Phaser's `WebAudioSoundManager`: our recipes (`audio/recipes.js`, unchanged) connect to its `destination`; mute, pause, volume, unlock and resume handled by Phaser, plus the extra recovery we had to add (rebuilding a context that stays suspended, the clock check) if Phaser's own handling doesn't cover the cases we hit; the debug `sound` line kept.
- **Done when:** the player, sounds and recipes tests pass adapted; an offline render of every sound matches the current one sample for sample (the same recipes, so it should); a manual pass on desktop Chrome, Firefox, Safari and the iPhone 13 mini confirms sound survives tab switches and reloads.

### M4. The art pipeline (L)

- **The shim**: a `CanvasGraphics` with the Pixi `Graphics` methods the code uses (`moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo`, `arc`, `circle`, `ellipse`, `rect`, `roundRect`, `poly`, `closePath`, `fill`, `stroke` with width, colour, alpha, cap and join, `clear`). A pure recorder, tested in Node (the command stream for known shapes); a Canvas2D executor, checked in the browser against Pixi output.
- **Bake manager**: texture keys, bake scale (device × layout scale, per class), caching, lazy baking by kind, re-bake on pixel-ratio or layout-scale change, a per-liana texture cache (each liana's leaf pattern is unique) with eviction, a memory counter.
- **Part, flipbook and live-texture helpers** for the animated classes from M1.
- Tint support, additive glow, texture atlas packing if the spike shows it pays (fewer draw calls).
- **Done when:** the shim reproduces the gallery shapes within the parity tolerance (section 1); the recorder and bake-manager tests pass in Node; bake time and memory are inside the M1 budgets.

### M5. World rendering (L, in four parts)

For each part: a view-model (tested in Node) plus a Phaser adapter.

- **M5a, the monkey and the lianas.** Monkey (poses, body rotation easing, facing, blink, the death spin, the two-player palettes), lianas (rest, swinging, settling, tip flash, the shared-screen pair that bows apart, golden and green sets), interpolation between steps, the shadow monkey and its fading grey lianas.
- **M5b, static obstacles and decorations.** Branch (with the nine decorations), thorn bush, rock, beehive, the vines and trunks, the day and night decoration sets, the hanging bats and owls.
- **M5c, moving obstacles and bananas.** Spider with its thread, snake, bird, blue bird, purple bird, bat, circling bat (their wing, leg and eye animation per the M1 classification), bees, bananas with the glint, "+1" and "+1 ♥" pops, the heart on the field.
- **M5d, the temple and the world around it.** The four temple looks, the stage tint, haze, moss, the fires (flicker, additive glow, fire kept untinted), then the backdrop: sky bands, the three parallax layers, canopy, floor, the stage and time-of-day tint transitions, dawn.
- **Done when:** each part's parity-tool scenarios are inside the tolerance, its view-model tests pass, and the frame-time and memory budgets still hold with everything on screen.

### M6. Panes, HUD, overlays and the three modes (L)

- Phaser cameras per pane: viewport (clip), zoom, scroll from our camera, shake from our `Shake` maths; single pane, shared screen (zoom 0.75, leader camera, portrait follow-the-anchor), split screen (two panes, each its own world).
- HUD (scores, banana count, hearts rows, "OUT"), the title (mode picker, controls, version, settings line for slipping, lives and shadow), stage banners, the pause and results panels, the off-screen monkey indicator, game-over panels, the mute and fullscreen buttons, the notice, the debug overlay (per pane), text with stroke, shadow and the pixel-ratio `resolution`.
- Reduced-motion, safe-area insets, touch layout, portrait text scale.
- **Done when:** all of `PLAN.md`'s modes and settings work on the Phaser renderer (the checklist in section 8), parity scenarios inside tolerance, `hud/banana/hearts/split/stageViews/debugOverlay` tests pass in their new form.

### M7. Parity, performance and polish (M–L)

- Run the whole parity set; fix every diff above tolerance or record a reviewed exception.
- Port the long-run harness (`scripts/longrun.mjs`) and the measurement scripts to Phaser and re-run the benchmarks from the performance work: frame time, heap over 30 game-minutes in the four scenarios, draw calls, the leak check, 90/120/144 Hz motion, first-appearance hitches. The **budgets** are those of section 5, on the iPhone 13 mini.
- Bundle: custom Phaser build or lazy features if the size is a problem.
- Real-device pass: desktop browsers, the iPhone 13 mini, an iPad, an Android phone; portrait and landscape; split and shared; both versions side by side.
- Make Phaser the default version; Pixi stays reachable with `?renderer=pixi`.
- **Done when:** parity and budgets are met or each exception is accepted in writing here.

### M8. Remove Pixi (S–M)

Only once M7 is accepted: until then the Pixi version is the reference.
- Remove the `pixi.js` dependency, the Pixi version's renderer (the `src/render/` views and `main.js` wiring) and the modules only it uses (its DOM input, fullscreen, pause and sound player, which Phaser has replaced), the parity tool and the `?renderer` switch.
- Remove the tests of the Pixi views and modules; their view-model and adapter counterparts stay. Move `src/phaser/` to its final place.
- Keep a small set of reference screenshots of the parity scenarios from the last two-version build (a few MB at most), for later visual checks.
- **Done when:** the build contains no Pixi code, all tests and smoke tests pass, and the bundle size is recorded.

### M9. Cleanup and release (S)

- Rewrite `PLAN.md` (tech stack, performance and hardening, structure, tunables), the README's technology section, and the `package.json` description; set the version to 3.0.0.
- Merge master into `phaser` one last time, run CI and open the PR into master. It is merged only when the owner explicitly says so, after every milestone is finished. The owner tags `v3.0.0` and writes the release notes.

## 8. Tests

| Kind | Now | After |
|---|---|---|
| Sim, generator, solver, layout, loop, scoring, physics, windows, passive-player, etc. (about 400 tests) | Node | Unchanged. |
| View logic (lianas, monkeys, hearts, hud, banana pops, shadow, temple, branch decorations, stage views, debug text; about 100 tests across 11 files, part of them touch Pixi objects) | Node, with real Pixi objects | Until M8 they stay as they are, for the Pixi version. The Phaser version gets **view-models** (plain data and functions: positions, rotations, alphas, which pieces show, text content, texture keys) tested in Node; its adapters are exercised by smoke and parity tests. M8 removes the Pixi tests. |
| Input, pause, fullscreen, audio player | Node with fakes | Unchanged for the Pixi version until M8; the Phaser adapters get synthetic-event tests of the same semantics. |
| Drawing shim | none | Recorder tests in Node; pixel checks in the browser. |
| New: smoke tests (Playwright, Chromium, in CI) | none | For both versions until M8: the page boots without errors; each mode starts and a key press lets go; resize and rotate; fullscreen request; context loss and restore; sound context state; no console errors over a short bot-driven run. |
| New: parity (dev tool; a few scenarios as CI checks once stable) | none | Pixel diff Pixi against Phaser until M8; afterwards the small set of reference screenshots kept in M8. |

CI gets a second job for the browser tests. `npm test` stays fast and Node-only.

## 9. Definition of done: parity checklist

Everything below must work on the Phaser renderer as on v2.3:

- Modes: 1P, 2P shared screen, 2P split screen; the title mode picker; results; play again; `Esc`.
- Rules the renderer shows: slipping and held grips with the tip blink; hearts and lives (`H`); the shadow monkey and its lianas (`S`); bananas and the tally; stages, the banner and the time-of-day tints (day, late afternoon, dusk, night, dawn, and past stage 4).
- All obstacles and decorations, the temple (four looks), bats at night; the high/low mix is sim-side.
- Settings and keys: `G H S D M F P Esc 1 2 3`, debug view in every pane, fullscreen button and exceptions.
- Layouts: landscape (16:9, wider, narrower), portrait, iPad, notches and safe areas, shared zoom, split panes.
- Motion: interpolation between steps at 60/90/144 Hz, death shake, reduced motion, high-refresh behaviour.
- Robustness: pause on blur, context loss notice and restore, fatal overlay, sound recovery after tab switches.
- Sounds: every recipe identical; mute; pause.
- Version on the title screen; Pages deploy at `/liano/`; the window-table check in CI.
- Performance within the section 5 budgets on the iPhone 13 mini.

## 10. Open questions

None: every question from the first two drafts is answered in section 1. New questions that come up during a milestone are added here and asked before that milestone's PR is merged into `phaser`.

## 11. Appendix: Pixi use by file

| File | Lines | Pixi features | Approach |
|---|---|---|---|
| `render/obstacleViews.js` | 1,238 | Graphics (all kinds), containers, clear/redraw animation, additive glow, container tint on the temple | Shim + parts, flipbooks and live pieces; the largest item (M5b–M5d). |
| `render/overlays.js` | 367 | Text, Graphics, containers, drop shadows | UIScene with Phaser Text and baked panels (M6). |
| `render/background.js` | 258 | Render groups, container tint, Graphics, 32-band sky | Baked layer tiles with tint (M5d). |
| `render/lianaView.js` | 166 | Graphics, rotation of a pre-drawn liana, redraw on state change | Per-liana baked texture, rotation (M5a). |
| `render/monkeyView.js` | 156 | Containers of Graphics parts, rotations | Baked parts as Images, rotation (M5a). |
| `render/bananaView.js` | 147 | Graphics, Text pop-ups | Baked banana, Phaser Text (M5c). |
| `render/debugOverlay.js` | 196 | Graphics (live), Text | Native Phaser Graphics is fine here (dev only) (M6). |
| `render/pane.js` | 141 | Containers, mask clip | Cameras (M6). |
| `render/hud.js`, `heartView.js`, buttons, `shadowView.js` | about 440 | Text, Graphics, containers | UIScene and baked pieces (M5a, M6). |
| `main.js` | 353 | `Application`, ticker, stage, canvas | Scenes and Game config (M2). |
