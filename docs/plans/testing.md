# Testing and device verification

Part of the [Liano plan](../../PLAN.md). How the game is checked: the test layers, the parity checklist every release must meet, the planned test-suite work (M9b.1) and the device checks still pending for M9c.

## Decisions

| Question | Decision |
|---|---|
| How to test the views? | **Pure view-models tested in Node, plus a few browser smoke tests** in CI. |
| What counts as identical? | A pixel diff under about 1 % of pixels differing by more than 8/255 per channel on the parity scenarios, **and no more than 25 pixels per million in solid patches of difference** (over the limit with all eight neighbours too: added after M1, where the share alone let wrong art on a small object through); sub-pixel antialiasing differences are accepted. |
| Visual checks after M8? | M8 keeps a small set of reference screenshots of the parity scenarios (a few MB at most) for later visual checks. |
| Browser tests in CI? | **Chromium only.** WebKit behaviour is checked on the iPhone itself. |

## Test layers

- **Unit tests** (`npm test`, Vitest, Node only, modules imported natively): the simulation, generator, solver and window table; layout, loop and input; the view-models (`src/views/`); the sound recipes, player and cache; the art recorder, SVG writer, manifest, contracts, validator, packs and selection; the generated guide and tables are checked up to date; the Markdown links. Grade and generator tests share their generated obstacles within a file (`tests/corpus.js`).
- **Coverage** (`npm run coverage`): the unit tests again with Node line and branch coverage of every `src/` module, floors for the rules, sound and core modules ([below](#coverage)). Time budgets are skipped there.
- **Browser checks** (`npm run test:browser`, Playwright, Chromium, a CI job of its own, one test at a time): boot and readiness, the production build at `/liano/`, every mode, input, pause, full screen, resize and rotation, context loss and restore, sound routing, the loading indicator and load failures, Config and both art packs, motion probes, and pixel comparisons with the reference PNGs (`browser-tests/references/`: 12 classic images from the last two-engine build and 13 accepted cartoon captures) under the scene tolerance with solid-patch detection and a negative control. Pages a check opens itself are closed after it, whether it passed or failed (`browserPages` in `browser-tests/helpers.js`).
- **Art checks** (`npm run art:check`, the build): sources, coverage and contracts; texture budgets.
- **Dev tools**, not in the suite: the gallery (`art.html`), the rigs page (`rigs.html`), the long-run check (`scripts/longrun.mjs`) and the motion probes in `scripts/dev/`.

**In CI** each run keeps, for 30 days, the unit and browser JSON reports (each test's time, attempts and errors), the coverage report and traces of failed browser attempts, and writes the slowest and retried tests to the job summary and a notice (`scripts/report-timings.mjs`). Started by hand, the workflow takes a filter to rerun chosen browser checks (`browser_tests`), for rerunning failed cases without the whole suite.

The [test-suite audit](../TEST_SUITE_AUDIT.md) measured coverage and run times at `668dd2a`, before M9b.1. How the test layers came to be during the migration is in [history/phaser-migration.md](history/phaser-migration.md#tests-during-the-migration).

## Requirement-to-test map

Which checks guard each requirement, by layer. A requirement with Node and browser rows needs both: they catch different failures.

| Requirement | Node (`tests/`) | Browser (`browser-tests/`) |
|---|---|---|
| Rules and physics | `physics`, `swing`, `world`, `scoring`, `match`, `game`, `banana`, `hearts`, `shadow`, `shared`, `stages`, `passive` | |
| Fairness: every gap passable | `feasibility` (solver against the real world, 1,000-gap samples, moving arrivals), `windowTable` (table = solver, stale table falls back), `settings` (held grips), `grades` | |
| Determinism and resources | `generator` (uncached determinism), `grades` (shared corpus = fresh), `soak` (5,000 gaps, bounded) | `scripts/longrun.mjs` by hand |
| Modes and input | `input`, `driver`, `match` | `art-packs` (every mode, both packs, 16:9 frame), `game` (presses once, taps, mute, split clip, debug, results), `mobile-menu`, `pause-controls` |
| Pause and lifecycle | `pause`, `driver` | `platform` (P, context loss), `pause-controls` |
| Layout, quality and reload | `layout`, `phaserView`, `phaserResolution`, `configMenu`, `artStyle`, `phaserMenuLayout` | `platform` (letterbox, resize, ratio), `canopy`, `resolution`, `config-menu`, `mobile-menu` |
| What is drawn, where | `views`, `hudView`, `overlaysView`, `stageViews`, `split`, `branchDecorations`, `templeFire`, `beehiveRig`, `snakePose`, `rockVariants`, `obstacles`, `phaserGraphics`, `visualDiff` | `reference`, `cartoon-reference`, `platform` (tile edges), `game` (one shader per batch) |
| Art packs | `art`, `artPacks`, `buildArt`, `customArt`, `manifest`, `pack`, `artRegistration`, `cartoonInventory` | `art`, `art-packs`, `atlas-gutters`, `reference`, `cartoon-reference` (with a negative control), `cartoon-review` |
| Context recovery | | `platform` (default pack), `art-packs` (classic and cartoon, drawing after restore) |
| Loading and load failures | `startup`, `fatal` | `loading` (shell, scripts, catalogs, atlases, setup; classic reload), `art-packs` (cartoon falls back to classic), `startup` |
| Production build | | `production` (both packs: own art only, the built worker, a run), `smoke` (old engine URL), `frame-trace`, `resolution` |
| Obstacle worker | `prefetch` (delivery, old seeds, error fallback) | `production` |
| Sound | `recipes`, `sounds`, `player`, `phaserSound`, `phaserSoundCache` | `game` (unlock, routing, mute, recipes rendered the same), `startup` (cache = synthesis) |
| Motion and frame pacing | `frameClock`, `phaserFrameClock`, `interpolate`, `camera`, `phaserMotion`, `frameStats`, `phaserFrameTrace` | `background-motion`, `catch-motion`, `obstacle-motion`, `shared-camera`, `frame-trace`, `obstacle-blur` |
| The plan's links | `docLinks` | |
| Real devices | | none: [pending](#device-verification-pending), M9c |

## Coverage

Node coverage (`npm run coverage`, every module under `src/`, unimported ones counting as uncovered), after M9b.1:

| Area | Lines | Branches | Floor (lines, branches) |
|---|---:|---:|---|
| All of `src/` | 58.2 % | 60.4 % | none: most of the rest is browser-only |
| Simulation, `src/sim/` | 99.4 % | 96.1 % | 98 %, 94 % |
| Audio, `src/audio/` | 96.7 % | 90.0 % | 95 %, 88 % |
| Core modules (driver, input, layout, loop, pause, startup, frame clock, prefetch) | 97.9–100 % | 87.5–100 % | 97 %, 87 % |
| View-models, `src/views/` | 78.9 % | 62.3 % | none: drawn and compared in the browser |
| Art, `src/art/` | 67.7 % | 72.1 % | none: the art checks build and compare every frame |
| Platform, `src/platform/` | 44.0 % | 50.6 % | none: browser checks |
| Rendering, `src/render/` and `world/` | 29.7 %, 16.1 % | 49.0 %, 15.0 % | none: browser checks |

These say what Node tests run, not what the game is checked for: the browser checks run the rendering, platform and entry modules (`main.js`, `boot.js`, the worker), but collect no coverage, and neither stands in for a real device. The floors fail a coverage run that falls below them, so the rules, sound and core modules cannot lose their tests unnoticed.

## Parity checklist

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
- Performance within the [budgets](architecture.md#target-device-and-budgets) on the iPhone 13 mini.

## M9b.1. Test suite coverage and performance (M)

**Status: done on `release-verification` and integrated into `master` (fast-forward to `d50e5d6`, 2026-10-17); M9c verifies it.** The record is at the end of this section.

Work on `release-verification` after M9b and before M9c. Use the
[test-suite audit](../TEST_SUITE_AUDIT.md) as the starting point. Improve test
coverage and speed without changing gameplay or weakening the checks.

- Record reproducible per-test, setup/build and retry timings on the same CI runner. Add source-mapped line/branch coverage for all relevant source files, including unimported files; distinguish Node coverage from browser integration coverage and real-device verification. Define coverage expectations by critical behavior rather than chasing one overall percentage.
- Investigate recurring Chromium context/page/startup timeouts with failure diagnostics and guaranteed cleanup of manually created pages/contexts. Keep isolated tests and individual failed-case retries; do not hide failures with longer timeouts, weaker assertions or a full-suite rerun.
- Reuse immutable, deterministic seed/gap corpora within solver/generator/grade tests and remove redundant full table recomputations across tests/build jobs where the same result is checked repeatedly. Preserve uncached determinism tests, solver-versus-world checks, statistical sample diversity, moving-arrival phases, boundary cases and the full long-run resource-bounds soak.
- Batch per-pixel assertions into equivalent aggregate checks with useful failure coordinates. Remove temporary-array allocation and repeated scans/readbacks in image comparisons while retaining every existing image scenario, tolerance, solid-patch check, reference PNG and negative control.
- Map overlapping browser checks to distinct requirements before consolidating them: modes/input, pause, layout/quality/reload, context recovery and audio routing/cache equivalence. Keep the separate failure modes those layers protect; avoid duplicating the whole browser matrix for both art packs.
- Close important gaps efficiently: exercise ready-to-play production builds and their worker/assets under `/liano/`; explicitly cover classic and cartoon context recovery; test worker-error fallback and initial catalog/texture load failures. Keep Safari/iPhone/iPad/Android acceptance in M9c as real-device work, not Chromium user-agent emulation.
- Benchmark sharing or caching identical art/build outputs between CI jobs, keyed by all relevant inputs/tool versions. Preserve cold-build coverage, freshness checks and both deployment gates; avoid serializing browser startup behind the entire unit suite unless the measured critical path improves. Add durable timing/failure artifacts so later regressions are visible.
- **Done when:** before/after measurements demonstrate faster stable checks, every removed or combined check has a documented replacement, critical gaps are covered, known bad cases still fail, and the complete retained suite passes with unchanged thresholds and references. Record remaining coverage limits and carry them into M9c.

**Implementation record (2026-10-17, on `release-verification`).** Measured on GitHub's runners: before, run [141](https://github.com/skogdoom/liano/actions/runs/39022092330) (`32a7f58`, the last green full run on `master`) and the audit's runs 136–137; after, runs [39031871095](https://github.com/skogdoom/liano/actions/runs/39031871095) (`f00ba1f`) and [39033232994](https://github.com/skogdoom/liano/actions/runs/39033232994) (`eb68c31`).

| | Before | After |
|---|---|---|
| Unit suite (`npm test`) | 113 s (run 141), 109 s (run 137) | 54 s, 53 s |
| Unit job | 3.5 min | 5.1 min: the suite, then a coverage run with floors (2.7 min) |
| Browser job's build | 74 s | 64 s on a cache miss, 4 s on a hit |
| Browser checks | 90–102 checks; 12.6–14.5 min, 2–3 retries a run | 105 checks; 18.1 min with no retries (traces recorded for every attempt), 16.0 min with 2 retries (traces on retries only) |
| Browser job | 14.7 min (run 141) | 16.8 min (run 2) |

What changed:

- **Unit runtime.** Vitest imports the modules natively: Vite's module runner made the solver about three times slower (the window table took 32 s to compute in a test, 9 s in a script). Grade and generator tests share their generated obstacles within a file, frozen (`tests/corpus.js`); a new check compares the shared obstacles with fresh ones, and the uncached determinism checks stay. Locally the suite went from 79 s to 46 s.
- **Coverage and records** (see [Test layers](#test-layers), [Coverage](#coverage)): Node coverage of every `src/` module with floors for the rules, sound and core modules; JSON timing reports, coverage and traces of retries kept by CI; a summary and notice of the slowest and retried tests on each run; Vitest failures as annotations; a filter to rerun chosen browser checks by hand.
- **Browser stability.** Pages a check opens itself are closed after it, passed or failed. The two full-screen canopy checks had failed on `master` since M9a: CI's headless Chromium sizes a full-screen page to its screen and will not resize it, so each shape now gets its own page and screen (rotating a real phone in full screen is listed under [devices](#device-verification-pending)).
- **Pixel checks.** One allocation-free pass with reused buffers (`compareImages` gained `alsoOver` and `into`; unit-checked, a stale reused buffer included); per-pixel assertions in the snake and spider art checks became one assertion per frame naming the failing pixel; the spider's legs are counted with a typed-array flood fill. Locally the 1920 × 800, 2× backdrop case went from 28.3 s to 20.9 s. No scenario, limit, solid-patch check or reference changed.
- **Gaps closed:** the production build at `/liano/` for each pack (only its own art, the built worker answering once a key starts a run); the worker-error fallback (unit); context recovery for classic as well as cartoon, now checking that the restored textures draw; a failed classic catalog or boot atlas, and the reload that follows. The stale-table check now uses a table whose row lies, so it also proves a fresh table is trusted.
- **Build reuse.** The browser job restores the built art from a cache keyed on its inputs (`art/`, `src/art/`, `scripts/build-art.mjs`, the lockfile) and uses the committed window table. The unit job still builds everything cold, checks the art and the table, and builds the site Pages publishes. Sharing a build artifact between the jobs was not adopted: the browser job would wait for the unit job's 5 minutes instead of building in parallel.

Removed or combined, with their replacements:

| Was | Now |
|---|---|
| `game.spec.js`: Space starts a run, Esc goes back, 2 picks a mode and the 16:9 frame | `art-packs.spec.js`: every mode for each pack, now also checking the two-player modes' 16:9 frame |
| `smoke.spec.js`: the production build starts without errors | `production.spec.js`: for each pack, started, one canvas, no errors, its own art, the worker and a run |
| `canopy.spec.js`: rotating one full-screen page through four shapes | A full-screen page for each shape, both packs, then 2P framing and leaving full screen |
| `windowTable.test.js`: the stale table, by mocking the module | `windowLookups` built from a stale table whose row lies: falls back to the solver, warns once; a fresh one is trusted |
| Timing budgets in every unit run | Checked in the plain run (CI's first step); skipped under coverage instrumentation |
| One 30 s limit per unit test | 30 s in the plain run; 120 s under coverage, whose instrumentation made a solver-heavy test overrun it in CI |

Known bad cases still fail: the coverage floors fail a run that misses them; the cartoon reference check still rejects its incorrect image; the link check reported six broken links before they were fixed; the new production check fails if the worker never answers or nothing is asked before a run.

Remaining limits, carried into M9c:

- **Browser context creation still times out now and then.** In the second run, two checks timed out while setting up their context and passed on the retry (2 min lost); the first run had none. Earlier runs on `master` showed the same in other checks. Over the four full runs since, three retried a check after `Failed to find browser context` (Browser.setDownloadBehavior) or a timeout while setting up its context, each time `obstacle-motion.spec.js`'s second (obstacle exposure) variant, right after its first, once with `game.spec.js`'s key-press check too: the next thing to look at in M9c. The cause is not established: CI now keeps a trace of each retry and lists retries with their first error, to compare over runs. Failed cases are retried once; nothing was given a longer timeout.
- **The browser job is not faster overall:** its pixel checks are, but it now runs more checks (the production, recovery, load-failure and per-shape canopy checks), and the canopy checks alone take 70–80 s each. Recording a trace of every attempt cost about 4 minutes (18.1 min without retries, against about 14 min once the second run's 2 min of retries are taken out), so only retries are traced.
- **No browser coverage figure.** Browser checks run the rendering, platform and entry modules but collect no coverage; the [requirement-to-test map](#requirement-to-test-map) says which guard what.
- **Rotation in full screen** can only be checked on a real device.

## Device verification (pending)

Every check below needs real devices and is still open. Nothing here is recorded as passed until it is tested in [M9c](release.md#m9c-test-and-verification-m); the source of each item is linked.

- **Sound** (M3): the pling, and sound surviving tab switches, phone lock and reloads, in desktop Chrome and Firefox and on the iPhone 13 mini ([M3 report](history/phaser-migration.md#m3-input-and-audio-on-phaser-m), the steps listed there). Safari on macOS passed.
- **Performance and the real-device pass** (M7): desktop Chrome, Firefox and Safari, an iPad and an Android phone; portrait and landscape; split and shared. The start within 1.5 s and the frame budgets on the iPhone 13 mini; perceived background and whole-scene smoothness in Safari ([M7 report](history/phaser-migration.md#m7-parity-performance-and-polish-ml), [background-motion.md](background-motion.md)). The owner finds the iPhone 13 mini's performance OK.
- **Art packs** (M8a): in Safari on the MacBook Air M1 and on the iPhone 13 mini, with both packs at the default quality: startup and decode time, texture and frame budgets, fast swings, catches, large temples, moving obstacles, lianas and foreground shrubs, rotation, menus and switching graphics. Add the dated follow-up to the [M8a final report](history/phaser-migration.md#m8a-cartoon-sprite-sheets-and-the-classic-graphics-toggle-l).
- **Canopy framing** (M9a): 1P full screen with both packs, entering and leaving full screen, resize and rotation (rotating while in full screen cannot be emulated in CI's Chromium); the regular Safari portrait view; home-screen mode; 2P shared and the other layouts as regressions ([M9a record](history/phaser-migration.md#m9a-fullscreen-canopy-coverage-s)).
- **Loading indicator** (M9b.2): cold and cached starts, slow downloads and failures, rotation, both packs; the reduced-motion pulse on the iPhone 13 mini ([M9b.2 record](history/phaser-migration.md#m9b2-startup-loading-indicator-s)).
- **From v1 and v2** (the open items in [history/v1-v2.md](history/v1-v2.md)): a stable 60 fps on a mid-range laptop; taps on an iPad; per-frame work under 6 ms at p95 at 4× CPU throttling on a device; full screen by button and `F` in desktop Chrome, Firefox and Safari, Android Chrome and iPad, with the icon following the state; the button hidden on iPhone Safari and in the home-screen app; the game filling the screen after full screen and rotation; a phone and an iPad playing a full run upright; a landscape phone with its browser bars showing filling the screen; the monkey readable on a real phone in portrait (design decision 11). The heap over restarts, open in v1, is now flat after 15 restarts (M7).

**Measuring on a device:** `?frames=1` shows the frame-time readout: frames late once or more than once, the worst, the spread of the browser's frame times and the game's work in a frame, with the last late frames and what happened in them (tap it to count again). It also offers **Save frame trace** for the last 1,800 frames. Safari's Web Inspector (from a Mac) gives timelines and memory. `npm run dev:host` serves the game to a phone on the same network.
