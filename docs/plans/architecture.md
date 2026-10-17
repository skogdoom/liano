# Architecture and performance

Part of the [Liano plan](../../PLAN.md). How the game is built: the stack, the runtime structure, the simulation model, the source tree, the tunables, the device budgets, performance requirements and the risks. The art pipeline is in [art-pipeline.md](art-pipeline.md), the tests in [testing.md](testing.md).

## Tech stack

- JavaScript (ES modules, no TypeScript); Vite for dev and build. `vite.config.js` builds Phaser from its source without physics and for WebGL only (M7).
- [Phaser](https://phaser.io/) 4.2.1, the only runtime dependency: rendering (WebGL only), scenes, the Scale Manager, cameras, keyboard and pointer input, and the sound manager.
- A Web Worker generates obstacles and bananas ahead of the world (the moving-obstacle solver runs there).
- Sound is synthesized: Web Audio recipes played through Phaser's audio context (no audio files).
- Pre-rendered art: texture atlases built at 1×, 2× and 4× with resvg from the classic pack's generated SVG and the cartoon pack's painted masters and vector recipes ([art-pipeline.md](art-pipeline.md)).
- Vitest for unit tests in Node, Playwright with Chromium for browser checks ([testing.md](testing.md)).
- GitHub Actions: tests, browser checks and the build on every PR; deploy to GitHub Pages from `master` ([release.md](release.md)).
- No backend. The browser keeps only the graphics pack and the rendering quality (local storage); the best score, mute and the match settings live in memory for the page session.

## Decisions

Made with the owner for the Phaser version (the planning answers of the migration). The two-version rows held until M8 removed Pixi. The art, testing and release decisions are in [art-pipeline.md](art-pipeline.md#decisions), [testing.md](testing.md#decisions) and [release.md](release.md#decisions).

| Question | Decision |
|---|---|
| How far into Phaser? | **Adopt Phaser throughout**: Scenes, the Scale Manager, Cameras, Input and the Sound manager, not only the renderer. |
| Which Phaser? | **Phaser 4.2.1** (the current `latest`), not 3.90. |
| Sounds? | **Keep the synthesized recipes**: they play through Phaser's audio context and master nodes, so Phaser handles unlock, mute and pause, and every sound stays the same. |
| Both versions? | **Both stay playable side by side** until the Pixi removal milestone (M8), which comes after parity and performance (M7), so they can be compared at any point. |
| Weakest device? | **iPhone 13 mini**: the budgets are set for it ([budgets](#target-device-and-budgets)). |
| Budgets? | Those [below](#target-device-and-budgets), with a texture budget of **120 MB at a pixel ratio of 2** (set after M1). |
| Download size? | The roughly +150–170 KB gzipped for Phaser is accepted; a custom build is tried in M0 and M7 but not required. |
| Screen shake? | Our own shake maths drives Phaser's camera, so the death shake stays as it is. |

Also agreed:

- The simulation (`src/sim/`), the generator, the worker and the pure modules stay exactly as they are. Phaser only replaces what draws, listens and plays.
- The fixed-step loop stays: `Scene.update` feeds our accumulator, with Phaser's delta smoothing turned off.
- Our own screen-shake maths and camera interpolation stay, driving Phaser cameras, so the shake looks the same.

## Runtime structure

```
Phaser.Game (WebGL, our canvas, audio on, delta smoothing off; src/main.js)
 ├─ BootScene   loads the selected art pack's catalog and atlases (boot set, then main set)
 ├─ PlayScene   the worlds: one pane per world, each with its own Phaser camera
 └─ UiScene     HUD, overlays, Config, buttons, debug view, notices (own camera, on top)
```

- **Platform** (`src/platform/`): the scenes, the HiDPI view (canvas = CSS size × pixel ratio, capped at 2; camera zoom × ratio), keyboard and pointer input fed to the shared input rules, full screen through the Scale Manager, the art-pack and quality choices and the reload that applies them, the frame clock and the frame trace.
- **Driver** (`src/driver.js`): the fixed-step simulation (120 Hz) fed by `Scene.update`, presses applied at step boundaries, the toggle keys, pause, the obstacle prefetch and each frame's sounds. `src/platform/frameClock.js` evens browser frame times out to the refresh interval (M7).
- **Views** (`src/views/`): pure view-models (what to draw, where, with which piece), tested in Node.
- **Render** (`src/render/`, `src/render/world/`): Phaser adapters and the rigs built from atlas pieces; `render/camera.js` eases each pane's camera through two lags (`CAMERA_EASE`) and follows part of the swing (`SwingTarget`, `CAMERA_SWAY`). Images draw one texture per batch (`render/shaders.js`). `render/warmup.js` prepares each rig path before input is accepted.
- **Startup** (`src/boot.js`, `src/startup.js`): the HTML/CSS loading shell and one readiness promise shared by the boot entry, the scenes and the input gate (M9b.2).
- **Audio** (`src/audio/`): the recipes, rendered once at loading (`cache.js`), played through Phaser's sound manager (`manager.js`) with the pause, mute and recovery rules of `player.js`.

The detailed design history (the Pixi-to-Phaser mapping, M1's spike and each milestone's decisions) is in [history/phaser-migration.md](history/phaser-migration.md).

## What Phaser 4.2.1 does and doesn't offer

As found before the migration (the sizes compare with the Pixi game of the time).

Checked by installing `phaser@4.2.1` and reading its source and bundled docs:

- **Graphics** has `moveTo`, `lineTo`, `arc`, rectangles, circles, ellipses, triangles and point lists, but **no quadratic or bezier curves** (the `Curves` classes sample them into points), and **no line cap or join options** (no `lineCap` anywhere in its Graphics renderers). Its own docs say the command buffer is **replayed and re-tessellated every frame**, that it is "expensive to render", and advise `generateTexture` for static art. This is why the art is baked.
- **No `resolution` or `autoDensity` in the game config**, and `devicePixelRatio` is only read for an `OS.pixelRatio` value. HiDPI crispness must be built by hand ([R3](#risks-and-how-the-plan-deals-with-them)).
- **Containers and Graphics have no tint.** Images and Sprites do (multiply by default; fill, add, screen and others exist). v4 filters can be enabled on any object, including a container.
- **Cameras**: viewport, zoom, scroll and `ignore(...)` per camera, which fits split screen, shared zoom and the pane clip.
- **Sound**: `WebAudioSoundManager` exposes its `context`, `masterMuteNode`, `masterVolumeNode` and `destination`, and handles the browser unlock (`locked`, an unlock on first input).
- **Cannot be imported under Node** (`window is not defined`). Pixi 8 can, which is why a dozen of our test files build real Pixi views headlessly today.
- **Size**: `phaser.esm.min.js` is 1.38 MB, **356 KB gzipped**. Today's whole game (Pixi included) is 207 KB gzipped, so the download grows by roughly 150–170 KB gzipped unless a custom build (`phaser-core`, `phaser-no-physics`) trims it.

More notes found while building on it are in the [M1](history/phaser-migration.md#m1-spike-prove-the-approach-and-set-the-budgets-m-a-decision-gate) and [M5](history/phaser-migration.md#m5-world-rendering-l-in-four-parts) reports.

## Simulation model

- All simulation is pure logic with no Phaser imports. Rendering reads simulation state each frame.
- `Game` owns the match: one world with every monkey (1P, shared screen), or one world per player (split screen). Its events carry the world (`pane`) and the match-wide `player`.
- **Loop:** a fixed timestep (1/120 s) with an accumulator. The frame delta is clamped to 100 ms.
- **Pause:** the game pauses on window blur, on a hidden page, while the graphics context is lost, and on `P` during a run.
- **Liana:** anchor at (x, ANCHOR_Y) above the top of the world band, length L. States: `idle | swinging | settling`. Released lianas settle back to vertical with a damped cosmetic sway. A world has one set of lianas, or with `ownLianas` (shared screen) one per monkey.
- **Grab detection:** circle (monkey) against the liana's vertical segment, while airborne, among the monkey's own lianas, excluding the just-released one.
- **Collisions:** checked every step in both hanging and airborne states, except while invulnerable. If an obstacle hit and a grab happen in the same step, the hit wins.
- **Generation:** a seeded RNG (mulberry32), with a random seed per match and fixed seeds in tests. Liana i sits at x = i · LIANA_SPACING. Entities are generated lazily around the monkeys (and a monkey's respawn liana) and culled 2 screens behind the rearmost, with hysteresis.
- **Events:** grab, release (forced or not), score, banana, stage, death, respawn. `Game` passes them on each frame to sound and effects.

## Project structure

```
liano/
  index.html                  # loading shell, notice and error overlays
  vite.config.js              # base /liano/; Phaser from source, WebGL only, no physics; dev pages
  playwright.config.js        # browser checks (Chromium)
  .github/workflows/ci.yml    # unit tests, art and table checks, build, browser checks; Pages on master
  art.html, rigs.html         # dev only: the art gallery, rigs and scenes of the real game
  art-review.html, cartoon.html, reference.html, cartoon-reference.html  # dev only: review and references
  art/
    manifest.json, README.md  # classic contracts and the generated art guide
    generated/                # classic SVG sources (generated by npm run art)
    custom/                   # optional classic overrides
    packs/cartoon/            # cartoon masters, components, generated sources, inventory, guide
  public/                     # favicon, web app manifest, icons; build output art/<pack>/ (not committed)
  scripts/
    art.mjs, art-check.mjs, build-art.mjs              # generate, validate and build the art
    cartoon-sources.mjs, cartoon-inventory.mjs         # cartoon exports and coverage
    build-windows.mjs                                  # the release-window table
    make-icons.mjs, longrun.mjs                        # icons; the long-run check
    dev/                      # motion probes, replacement drill, reference captures
  src/
    boot.js, startup.js       # error boundary, loading shell and readiness
    main.js                   # the game: platform, scenes, driver, settings
    config.js                 # gameplay tunables
    layout.js, screen.js, controls.js  # screen shapes, pixel ratio and insets, button targets
    driver.js, loop.js        # fixed-step simulation, presses, toggles, pause, sounds
    input.js, pause.js, fullscreen.js, fatal.js
    frameClock.js, frameStats.js  # frame-time evening and the ?frames=1 readout
    obstacleWorker.js, obstaclePrefetch.js
    visualDiff.js             # image comparison for the gallery and references
    sim/                      # the simulation (pure, Node-tested)
    views/                    # view-models (pure, Node-tested)
    platform/                 # Phaser scenes, view, input, fullscreen, art/quality choice, frame trace
    render/                   # Phaser adapters: art loading, text, HUD, overlays, Config, camera, shaders
      world/                  # rigs: panes, backdrop, lianas, monkeys, obstacles, temple, bananas
    art/                      # piece definitions, generator, recorder, SVG writer, packs, gallery
      pieces/                 # every classic piece, from the drawing code
    audio/                    # recipes, sound events, player, Phaser manager, cache
    reference/                # dev-only reference scenarios
  tests/                      # unit tests (Vitest)
  browser-tests/              # browser checks (Playwright) and reference PNGs
  docs/                       # cover art, the plans by area, the test-suite audit
```

## Tunables (`src/config.js`)

| Constant | Value | Notes |
|---|---|---|
| SCREEN_WIDTH × SCREEN_HEIGHT | 1280 × 720 | Landscape design frame; other screen shapes derive from it (see Screen layout) |
| WORLD_HEIGHT | 720 | The world band; falling below it is a death |
| ANCHOR_Y | −20 | |
| LIANA_LENGTH (L) | 420 | |
| LIANA_SPACING | 700 | Wide enough that the swings (reach ≈ 322) leave the middle of each gap free |
| SWING_AMPLITUDE | 50° | |
| SWING_PERIOD | 2.6 s | |
| GRAVITY | 600 px/s² | 400 felt too floaty |
| MAX_SLIP_SPEED | 40 px/s | At most (L − 310) / P ≈ 42 px/s, so every grip passes a forward swing low enough on the rope before it is forced off |
| FLOW_GRIP, QUICK_SLIP_SPEED | 0.7 × L, 1000 px/s | Catches above FLOW_GRIP slide quickly down to it |
| HOLD_GRIP | 350 px (about 0.83 × L) | With slipping off (G) the grip holds where it catches but no higher; the shallowest grip that keeps every sampled gap's window |
| HOLD_SLIDE_TIME | 0.25 s | Longest slide down to HOLD_GRIP; it starts at the catch speed along the rope and brakes evenly |
| TEMPLE_MIN_GAP, TEMPLE_VARIANTS | 6, 4 | The temple (one a day/night cycle, see Obstacles) is never among the first 6 obstacles, and has 4 looks |
| SLIP_OFF_PHASE, HOLD_OFF_PHASE | 0.08 and 0.11 × P after the bottom, swinging right | The forced release comes near the start of the forward window (about 0.04–0.165 × P) when slipping, and in the middle of it when held |
| ENTRY_RADII | [0.35, 0.5, 0.65, 0.8, 0.95] × L | The entry radii the solver checks |
| MAX_ENTRY_RADIUS | 0.95 × L | Lower catches grip here |
| START_GRIP | 0.7 × L | The grip at the start of a run |
| TIP_WARNING_TIME | 1 s | The vine end blinks this long before the forced release, faster in the last half |
| MONKEY_RADIUS | 22 | |
| OBSTACLE_Y_RANGE | [140, 375] | Heights ~[195, 315] are rejected by swing clearance |
| LIANA_CLEARANCE | 6 | Extra gap between an obstacle and a swept area, beyond MONKEY_RADIUS |
| MIN_RELEASE_WINDOW_MS | 90 | Stage 1; later stages per STAGES |
| STAGES | see Difficulty stages | First obstacle, shortest window, moving share and obstacle scale per stage |
| HIGH_BELOW_Y, STAGES[].high | 255; 0.5 in Stages 1–3, null after | Obstacles above the line hang from the canopy (high); the share of a stage's gaps that aim for a high obstacle |
| GRADE_BOUNDS | 0.15, 0.23, 0.28 | Blocked shares where grades 2, 3 and 4 start |
| STAGES[].grades, LATER_GRADE_ODDS, LATER_GRADE_STAGES | see Obstacle grades | Odds of aiming for each grade per stage, and where they head after the last stage over 6 stages |
| MOVING_GRADED_TRIES, STATIC_TRIES | 3, 40 | Moving candidates graded, and static draws, per gap |
| GRADE_ARRIVAL_STEP, GRADE_RADIUS_STEP | 4, 2 | A moving obstacle's grade samples every 4th arrival and every 2nd entry radius |
| STAGE_LENGTH_AFTER | 20 obstacles | After the last stage, the stage number (the time of day) counts on this often |
| LATER_WINDOW_STEP_MS, LATER_MIN_WINDOW_MS | 3 ms per stage, down to 40 ms | The shortest release window of the stages after the last: 54 ms at Stage 4, 40 ms from Stage 9 (about 5 steps) |
| LATER_MOVING_STEP, LATER_MOVING_MAX | +5 points per stage, up to 80 % | The moving share of those stages: 60 % at Stage 4, 80 % from Stage 8 |
| MOVING_FROM | 6 | Obstacles 1–5 are always static |
| MOVING_PERIOD_RANGE | 1.5–3.0 s | |
| SPIDER_LOW_RANGE, SPIDER_TRAVEL_RANGE | 175–212, 80–150 px | Lowest point and climb |
| SNAKE_HIGH_RANGE, SNAKE_TRAVEL_RANGE | 290–320, 90–160 px | Highest point and slide |
| BIRD_Y_RANGE, BIRD_BOB | 330–390, 8 px | Patrol bounds are derived from the swings |
| BANANA_CHANCE | 0.25 per gap, as a candidate | About 14 % of gaps get a banana, at least 3 apart |
| BANANA_RADIUS | 14 | Drawn at 1.4× |
| LIVES_2P | 3 | Lives each player starts with in the 2P modes, and in 1P with lives on |
| KEYS.shadow | S | The shadow monkey toggle (see Shadow monkey) |
| BANANAS_PER_HEART, MAX_LIVES | 5, 99 | Bananas taken per heart; the most lives a player can have |
| RESPAWN_GRIP | 0.7 × L | |
| RESPAWN_DELAY_MS | 1000 | The dead monkey tumbles this long before respawning |
| RESPAWN_INVULN_MS | 1500 | |
| SHARED_ZOOM, SHARED_LEADER_X | 0.75, 0.5 × width | Shared screen's scale (a view of 1280 / 0.75 ≈ 1707 px of world) and leader position: the next liana is in view ahead, and over a liana behind |
| CAMERA_TARGET_X | 0.35 × width | Landscape 1P; split panes keep the same fraction |
| CAMERA_LERP | 8 /s | The shared screen's rules camera, one lag (it decides who falls behind) |
| GAMEOVER_INPUT_LOCK_MS | 400 | |
| DEATH_BOUNCE, DEATH_POP | 0.4, 260 px/s | Death feedback |
| DEATH_SHAKE_PX, DEATH_SHAKE_TIME | 9, 0.35 s | |
| MAX_RESOLUTION | 2 | Canvas pixels per CSS pixel |
| MIN_VISIBLE_WORLD_HEIGHT, MAX_VIEW_WIDTH | 570, 1600 | Flexible landscape frame |
| PORTRAIT_VIEW_WIDTH, PORTRAIT_ANCHOR_X | 1100, 0.3 | Portrait |
| SIM_DT, MAX_FRAME_DT | 1/120 s, 0.1 s | The fixed step, and the longest frame fed to it |
| CAMERA_EASE | 12 /s | A pane's camera eases through two lags of this rate (M7) |
| CAMERA_SWAY | 0.75 | Share of the swing a landscape pane's camera follows about the liana's anchor (`SwingTarget`, M7) |
| PORTRAIT_SPARE_ABOVE | 0.2 | Share of portrait's spare height above the band; half of it in full screen and the home-screen app (M9a) |
| MIN_UI_CSS_SCALE, MAX_UI_SCALE | 0.6, 1.8 | Portrait text and buttons are enlarged to at least this many CSS pixels per logical pixel, at most 1.8× |
| WORLD_MARGIN | 2 × width | Entities are generated this far beyond the view, discarded past it plus one spacing |
| KEYS | Space (1P); Enter (start); A, L (P1, P2); 1, 2, 3 (mode); Esc (menu); P (pause); M (mute); D (debug); G (slipping) | F (full screen) is bound in `fullscreen.js` |
| C, X | | Config (title screen) and the graphics choice inside it, bound in `render/configMenu.js` |

Outside `config.js`: the parallax factors of the far, mid and near layers are **0.06, 0.12 and 0.3** (`src/views/backdrop.js`, M7), and the build softens the canopy tile sideways by **0.4** units and the floor tile by **0.8** (`soften` in their contracts, `src/art/pieces/backdrop.js`).

## Target device and budgets

The weakest device is an **iPhone 13 mini**: A15 chip, 4 GB of memory, a 60 Hz screen, 375 × 812 CSS pixels at a pixel ratio of 3 (the game caps it at 2, as today, so the canvas is 750 × 1624 in portrait), and Safari's WebKit engine (every browser on iOS uses WebKit). Proposed budgets, measured on that phone:

- **Frame rate:** a steady 60 fps in every mode, split screen included: no frames over 34 ms in a normal run (the debug view's `slow` counter), and the JS part of a frame no more than about twice today's.
- **Start:** a playable title within about 1.5 s of the page loading (once cached), loading and decoding the boot atlas included.
- **Texture memory:** at most **120 MB at a pixel ratio of 2** (set after the M1 spike; well under the 150 MB the plan aimed for). iOS reloads a page whose memory grows too large, and WebGL textures count towards it. The phone's texture size limit, read in M1, is 16384 pixels.
- **Memory over time:** no growth of the post-GC heap over 30 game-minutes (measured in Chrome, which reports the heap; Safari doesn't).

Measuring on the phone: `?frames=1` shows a frame-time readout in either version (frames that came late, once or more than once, and the worst; tap it to start counting again). It draws nothing on the canvas, unlike the debug view (D), whose own drawing makes frames slow (M7). Safari's Web Inspector (from a Mac) gives timelines and memory. CI runs the browser tests in Chromium only, so anything WebKit-specific is caught on the phone.

## Performance and hardening

Requirements that hold for the game; the measurements behind them are in the [M7 report](history/phaser-migration.md#m7-parity-performance-and-polish-ml) and, for the v2 (Pixi) game, in [history/v1-v2.md](history/v1-v2.md#performance-and-hardening-v2).

- **Renderer:** WebGL only. One texture per batch, so every shader is compiled before the title (M7).
- **Graphics context loss:** pauses the game with a notice; Phaser uploads the atlases again on restore. Without a restore in 5 s, a "tap to reload" screen.
- **Errors:** any error of the game's own, a failed script, catalog or atlas load, or a failed setup shows the reload screen and stops the loop. A failed cartoon load offers to reload with classic graphics.
- **Startup:** the loading shell shows after 250 ms without downloading anything; the game takes input only after the first prepared frame (M9b.2). Before the title the game renders the sound recipes, exercises each obstacle builder path (37 warmup rigs, then destroyed), compiles the shaders and rasterizes the HUD's glyph atlases, so first use costs no code warm-up, shader compile or HUD text upload in play. Obstacle instances are still constructed as the world generates them, and stage, result and debug text is ordinary Phaser Text ([background-motion.md](background-motion.md#startup-preparation-and-obstacle-motion)).
- **Frame pacing:** frame times are evened out to the refresh interval (`frameClock.js`); the camera and the monkeys are drawn between sim steps (`render/interpolate.js`), so no frame repeats a picture at 60, 90, 120 or 144 Hz.
- **Bounded over time:** entity counts, scene nodes, textures and the post-GC heap stay flat over 30 game-minutes in every mode and over 45 restarts (`scripts/longrun.mjs`).
- **Reduced motion:** with `prefers-reduced-motion`, no death shake, and the loading indicator pulses instead of turning.
- **Input edge cases** are unit-tested: keys held across a restart, taps during the results lock, multi-touch, input held while focus is lost, input during loading.
- **Measuring:** `?frames=1` shows the frame-time readout and offers a frame trace ([testing.md](testing.md#device-verification-pending)). The debug view (D) costs frames of its own and is no way to judge smoothness.
- **Background motion:** the investigation of the background stutter, its measurements and tools are in [background-motion.md](background-motion.md).

## Risks and how the plan deals with them

The migration's risks, as planned. R1–R18 were dealt with in the milestones named (R14 and R15 ended with M8 and M9); R19 and R20 still apply to any art change.

| # | Risk | Mitigation | Where |
|---|---|---|---|
| R1 | The Graphics API gap (curves, caps, joins) breaks "identical". | The drawing code never runs in Phaser: at build time it generates SVG, which has curves, caps and joins. The recorder and SVG writer are pure and tested in Node. | M1, M4 |
| R2 | Textures cost memory, the tightest limit on the iPhone 13 mini. A full-screen backdrop layer at 2× is ~15 MB, and there are five layers. | Backdrop tiles instead of full strips; soft scenery packed at a lower scale; 1× atlases on 1× screens; a measured texture budget with a go/no-go gate ([budgets](#target-device-and-budgets)). | M1, M4, M7 |
| R3 | **HiDPI.** No `resolution` in Phaser. | Canvas size = CSS size × ratio (capped at 2 as today), camera zoom × ratio, text `resolution`, and atlases at 1× and 2×. Prototyped in the spike. | M1, M2 |
| R4 | **Animated art** (wings, legs, tails, eyes, flames, bees, spider threads, settling lianas) is redrawn every frame today. | Joints for what turns (monkey limbs, swinging lianas, tails), flipbooks for what changes shape (wings, bees, flames), ropes and stretch pieces for what changes length; each flipbook's frame count is chosen so the diff stays within tolerance. | M4–M5 |
| R5 | **Tinting** whole layers and the temple. | Backdrop and temple pieces are sprites, and tint multiplies as today; the fires are not tinted. | M5 |
| R6 | **Tests**: Phaser can't load in Node. | Split each view into a plain view-model (what to draw, where, how: tested in Node as now) and a thin Phaser adapter (smoke-tested in a real browser). | M0, throughout |
| R7 | **Audio parity and unlock**: the earlier sound bugs (suspended contexts after tab switches) were subtle. | Our recipes connect to Phaser's context and master nodes. The existing debug state (`sound running`, `locked`, `rebuilt`) and the player tests are carried over, plus an offline render of each recipe compared old against new. | M3 |
| R8 | **Input semantics** (key repeat ignored, `consumePress`, touch rules, buttons intercepting taps). | Keep our semantic layer and feed it from Phaser Input; `input.test.js` adapted to drive the adapter with synthetic events. | M3 |
| R9 | **Fullscreen, safe areas, iOS** quirks, portrait follow. | `layout.js` stays authoritative; the Scale Manager only provides the size; fullscreen via `scale.startFullscreen` on `pointerup`, keeping the exceptions. | M2 |
| R10 | **WebGL context loss** (phones backgrounding the page). | Keep our pause-and-notice handling. Atlases are images, so Phaser uploads them again after a context loss; nothing has to be redrawn. Tested with the `WEBGL_lose_context` extension. | M2 |
| R11 | **Startup time**: loading and decoding the atlases. | A small boot atlas first, the rest during the title; [budget](#target-device-and-budgets). | M1, M7 |
| R12 | **Performance**: Phaser replays Graphics every frame. | Nothing in the game is Graphics at runtime (only the debug view). Pieces are batched sprites. Measured with the existing long-run harness, ported. | M1, M7 |
| R13 | Phaser 4 is young (4.0.0 came out in April 2026, 4.2.1 in July). | Pin 4.2.1; the spike exercises exactly the features we need; a short list of known-bad areas kept in this document. | M1 |
| R14 | Master keeps changing `src/render/*` during the migration. | Merge master into `phaser` regularly; a visual change on master needs a matching change in `src/phaser/` (a checklist item on each such PR). | workflow |
| R15 | Two versions to keep working until M8. | The shared code (sim, layout, loop, recipes) is untouched; each version's own code lives in its own folder; CI runs both versions' tests and smoke tests. | M0–M8 |
| R16 | **Rig fidelity**: rebuilding each object from pieces must match today's drawing. | The parity tool on every kind and variant; the M4 inventory lists any case that can't match exactly, with its diff, for approval. | M4–M5, M7 |
| R17 | **Rasterizers differ**: the same SVG renders slightly differently in different tools. | The spike compares a browser rasterizer (Chromium through Playwright, already in CI) with a pure-npm one (resvg) against Pixi's output, and the closest is used for every piece. | M1 |
| R18 | **Custom art breaks things later** (wrong size, frames or pivot). | The contracts, the validator in CI and the gallery; a replacement drill in M7 proves the path. | M4, M7 |
| R19 | **Detailed cartoon art obscures hazards or reintroduces visible stutter.** | Approve art at actual game sizes; keep readable silhouettes, established motion/softening and texture budgets; check fast pans and catches in Safari with both packs. | M8a |
| R20 | **Pack selection mixes assets, downloads both packs, or loses settings on reload.** | Separate complete catalogs; resolve selection before loading; fetch only the selected pack; reuse and test the Config reload/settings behavior. | M8a |
