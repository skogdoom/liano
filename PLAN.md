# Liano — Implementation Plan (v2)

A one-button browser game. A monkey swings on lianas through a jungle. It grabs a liana anywhere along its length, slowly slips toward the tip, and the player presses a key (or taps) to let go. The monkey flies ballistically and auto-grabs the next liana it touches. Obstacles sit in the gaps between lianas: static ones first, moving ones later. Bananas speed up the next few swings and give bonus points. Difficulty ramps in stages. Modes: single player, two-player shared screen, two-player split screen.

v1 (milestones 1–14) is built and released as v1.x. It has touch and phone support, sound, full screen, portrait and a flexible frame, hardening, and a GitHub Pages pipeline. v2 extends it and removes nothing: every v1 feature stays. Where the v2 draft conflicted with something already built, this plan keeps the built behaviour; see **Conflicts with v1** at the end.

## Tech stack

- JavaScript (ES modules, no TypeScript), PixiJS (current major, v8), Vite for dev/build.
- Vitest for unit tests of simulation logic.
- A Web Worker for the feasibility solver, where the build-time table can't cover it (moving obstacles).
- Web Audio API for synthesized sound (no audio files).
- GitHub Actions: tests and build on every PR, deploy to GitHub Pages on `master`.
- No other runtime dependencies. No backend. No persistence (the best score and the mute setting live in memory for the page session).

## Modes and controls

| Mode | Keys | Lives | Result |
|---|---|---|---|
| 1 Player | Space, or a tap/click on the game | 1 | Score; session best shown |
| 2P Shared screen | P1 `A`, P2 `L` | 3 each | Higher total score after both are out of lives; equal = draw |
| 2P Split screen | P1 `A`, P2 `L` | 3 each | Same as shared |

- **Mode picker.** The title screen has a mode picker: keys `1` / `2` / `3` select a mode, and Space or Enter starts it. On a touch device, a tap starts 1P. The 2P modes are keyboard-only (decision 23).
- **Other keys:**
  - `M` or the on-screen speaker mutes the sound.
  - `F` or the on-screen button toggles full screen.
  - `D` toggles the debug overlay.
  - None of these ever counts as a game press.
- **Key rules.** Keys are defined in `config.js`. Avoid Shift: on Windows, pressing it five times opens the Sticky Keys dialog. For every action key, ignore key auto-repeat (`event.repeat`).
- **Presses and pause.** Presses while paused, or within 250 ms of resuming, are ignored.
- **Taps.** Each new finger or primary mouse button is one press.

## Core rules

| Area | Rule |
|---|---|
| Progress | Camera follows horizontally. No auto-scroll. Distance comes only from release momentum. |
| Action key | While hanging: release. While airborne: ignored. |
| Swing | Idle lianas hang still. When grabbed, a liana swings with a fixed angular amplitude and period, independent of how the monkey arrived. The period is shorter while the monkey is boosted by a banana. |
| Grip | The monkey grabs at the contact point, anywhere along the liana. The grip then slips toward the tip at a constant speed. At the tip the monkey is **forced off** with its current velocity. This is a forced release, not a death. |
| Release power | Linear speed scales with grip radius. A high grip gives a weak jump; waiting (slipping lower) gives a stronger one. |
| Regrab | The liana just released cannot be regrabbed until a different liana has been grabbed. |
| Backward | Releasing on the backswing is allowed. The monkey may fly backward and grab the previous liana. |
| Layout | Lianas have identical length and identical horizontal spacing. |
| Obstacles | One per gap (none in the first gap, nor in the gap behind the start liana). Static types: branch, thorn bush, rock, at a random height in the gap. Moving types (spider, snake, bird) start after 15 obstacles. A liana never sweeps over an obstacle: static and moving obstacles alike stay clear of the area either neighbouring liana can swing through, with the rope and a hanging monkey at any grip radius. |
| Bananas | Collected on touch. Give +BANANA_POINTS and a boost: the next BOOST_GRABS lianas swing faster. |
| Difficulty | Stages keyed on obstacle index. Levers: tighter release windows, larger share of moving obstacles, bigger obstacles. Swing speed and slip speed do not ramp. |
| Death | Collision with an obstacle, falling below the world band (world y WORLD_HEIGHT; the visible bottom edge can be higher when the flexible frame crops), or (shared screen only) being pushed off the left edge. Going above the top edge is not a death. |
| Scoring | +1 per obstacle gap crossed: the gap scores when the monkey, moving forward, grabs the liana on its far side. Swinging or flying past without reaching that liana does not score. Each gap scores once per monkey (flying back and forth does not re-score). Plus banana points. |
| HUD | Top-right. 1P shows score and session best. 2P shows each player's score and remaining lives. The speaker and fullscreen buttons sit top-left. All of these stay inside the safe area (notch). |

## Grip and slip

- On grab the liana is vertical (θ = 0). The swing starts in the direction of the monkey's horizontal velocity: θ(t) = dir · A · sin(ω·t), where ω = 2π / period.
- The grip radius starts at the contact radius r₀ and grows at SLIP_SPEED: r(t) = min(r₀ + SLIP_SPEED·t, L).
- Hanging position = anchor + r·(sin θ, cos θ).
- Release velocity combines the tangential and radial components: v = r·θ'·(cos θ, −sin θ) + r'·(sin θ, cos θ).
- A forced release at r = L uses the same formula.
- Time on a liana is bounded: at most (L − r₀) / SLIP_SPEED. This bound is what keeps moving obstacles fair (see Feasibility).
- This replaces v1's grip slide to a fixed 90 % radius.
- Visual: the monkey's hand visibly slides down the vine. Near the tip, the vine end flashes as a warning.

## Obstacles

**Static** (from obstacle #1): branch, thorn bush, rock. Random height in the gap, horizontally centered, rerolled until clear of both neighbouring lianas' swept areas.

**Moving** (from obstacle #16, share set by the stage). Each moving obstacle has a deterministic `position(t)` and `hitbox(t)` with period P, driven by world time since it spawned. It stays confined to its own gap and never enters a liana's swing arc, so a hanging monkey can never be hit with no way out:
- **Spider:** descends and ascends on a thread from the canopy. Vertical oscillation between two heights.
- **Snake:** climbs up and down a vine standing in the gap, moving vertically along it.
- **Bird:** patrols horizontally between two x bounds inside the gap, with a slight bob. The patrol bounds must stay outside every liana's swing arc.

## Bananas

- Placed in some gaps (BANANA_CHANCE), on a trajectory riskier than the easiest safe one. The generator picks a point along a valid but non-minimal-risk flight.
- Collected on touch, in the air or while hanging.
- Effect: +BANANA_POINTS, and the boost counter is set to BOOST_GRABS. Picking up another banana while boosted resets the counter to BOOST_GRABS; boosts do not stack in strength.
- While the counter is above zero, each new grab swings with period SWING_PERIOD / BOOST_FACTOR, and the counter decreases by 1 per grab.
- The boost is cleared on death.
- HUD: a banana icon near the monkey showing the remaining boosted grabs.

## Difficulty stages

Stages are keyed on **obstacle index**, not score. This way banana points don't accelerate difficulty, and in shared-screen mode both players meet the same level. On entering a new stage, a banner ("Stage 2") appears and the background tint shifts (day → late afternoon → dusk → night).

| Stage | Obstacles | Min release window | Moving share | Obstacle scale |
|---|---|---|---|---|
| 1 | 1–15 | 90 ms | 0% | 1.00 |
| 2 | 16–30 | 80 ms | 25% | 1.10 |
| 3 | 31–50 | 70 ms | 50% | 1.20 |
| 4 | 51+ | 60 ms | 70% | 1.30 |

All of these values are starting points for tuning. Scaled obstacles must still pass the swing-clearance rule; heights that fail are rerolled.

## Two-player rules

**Common to both 2P modes.**
- Both modes use the same seed, so both players face the same level.
- Scores accumulate across all lives.
- After a death, the player respawns hanging on a liana at RESPAWN_GRIP, already swinging, and is invulnerable for RESPAWN_INVULN_MS (blinking; passes through obstacles; can still score).
- A player with no lives left is removed; the other player continues alone until they are also out of lives. A results screen then shows both totals and the winner.
- 2P modes draw in the 16:9 frame, letterboxed as needed (decision 24).

**Split screen.**
- Two independent worlds with the same seed: top pane for P1, bottom pane for P2.
- Each pane is 1280×360 and renders its world at 0.5 scale, which gives a wider horizontal view than single player.
- Respawn on the last liana that player grabbed.
- There is no interaction between the players.

**Shared screen.**
- One world containing both monkeys.
- The camera follows the leader: the alive, non-invulnerable monkey with the largest x. If the leader dies, the camera switches smoothly to the other monkey.
- The trailing monkey loses a life when it goes fully off the left edge.
- Respawn on the leftmost liana that is fully on screen.
- Monkeys do not collide with each other.
- A liana can hold both monkeys at once. A monkey grabbing a liana that is already swinging joins the current swing phase, at its own grip radius.

## Feasibility (fairness guarantee)

The generator only emits gaps the solver accepts. For a gap, the solver must find a valid release window, lasting at least the stage's minimum, **before the forced release**. It checks this for every combination of:
- entry radius r₀ ∈ ENTRY_RADII (sampled fractions of L),
- obstacle phase at arrival, sampled at 12 points over P (moving obstacles only),
- swing variant: normal, plus boosted for any gap within BOOST_GRABS gaps after a banana. The solver can't know whether the player took the banana, so both variants must pass.

"Valid" means the flight reaches the next liana without touching the obstacle or falling out. The obstacle must also be clear of both neighbouring lianas' swept areas by MONKEY_RADIUS + LIANA_CLEARANCE. If a candidate fails, the generator rerolls the obstacle height, type and motion parameters (max 20 tries), then falls back to a safe static obstacle at the lowest passable height.

A useful design constraint: if the time on a liana from the lowest sampled entry radius is at least P, every arrival phase gets to see the obstacle's full cycle before the forced release.

Implementation notes:
- **Step size.** The solver simulates releases at the sim step (1/120 s), so it agrees exactly with the real world. v1 tests this for every release step; keep that test.
- **Static gaps** keep the build-time window table (`src/sim/windowTable.json`, fingerprinted by its inputs, rebuilt with `npm run windows` and checked in CI). It now also covers entry radii, the boosted variant and the stage's obstacle scale. Generation stays a table lookup, with no solver work during play.
- **Moving gaps** are checked by the solver in a Web Worker, generating a buffer of at least 5 gaps ahead of the furthest monkey. Budget: at most 20 ms per gap. No frame may go over 16 ms because of generation.
- **Known gaps in the guarantee.** It is sampled, not a proof. It doesn't cover a monkey joining an already-swinging liana in shared mode, or respawn edge cases. This is acceptable for versus play.

## Simulation model

- All simulation is pure logic with no Pixi imports. Rendering reads simulation state each frame.
- The world holds **N monkeys** from the start; single player uses N = 1.
- **Loop:** a fixed timestep (1/120 s) with an accumulator. The frame delta is clamped to 100 ms.
- **Pause:** the game pauses on window blur, on a hidden page, and while the graphics context is lost.
- **Liana:** anchor at (x, ANCHOR_Y) above the top of the world band, length L. States: `idle | swinging | settling`. Released lianas settle back to vertical with a damped cosmetic sway.
- **Grab detection:** circle (monkey) against segment (liana), while airborne, excluding the just-released liana.
- **Collisions:** checked every step in both hanging and airborne states. If an obstacle hit and a grab happen in the same step, the obstacle hit wins.
- **Generation:** a seeded RNG (mulberry32), with a random seed per match and a fixed seed in tests. Liana i sits at x = i · LIANA_SPACING. Entities are generated lazily ahead of the furthest monkey and culled 2 screens behind the rearmost monkey or camera, with hysteresis. Generation stops once every monkey is dead.
- **Events:** the world emits events (grab, release, score, banana, death). `Game` passes them on each frame to sound and effects.

## Sound (from v1)

All sounds are synthesized with the Web Audio API at runtime; no audio files.

| Event | Sim trigger | Synthesis |
|---|---|---|
| "Bong" | `death` with cause `obstacle` | Bell-like decaying sines at inharmonic ratios (1, 2.76, 5.4) with a fast attack and about 1 s decay. Base pitch by obstacle type: rock low, branch mid, bush higher. |
| "Crash" | `death` with cause `fall` | A low-passed noise burst plus a falling low sine thud, about 0.8 s. |

- **Recipes and player:** each sound is a pure recipe function (data, unit-tested in Node). A thin player is the only code that touches `AudioContext`.
- **When sound plays:** on by default from the first press. Mute is toggled with `M` or the speaker button, and kept in memory only. The `AudioContext` is suspended while paused.
- **Sound set:** only the two deaths have sounds. A "swish" and several versions of a "wheee" on release were built and dropped at the owner's request.
- **New v2 events** (banana, stage, respawn, results) get sounds only if the owner asks for them (decision 25). New obstacle types get a "bong" pitch.

## Touch, phones and tablets (from v1)

- **Input:** `pointerdown` on the canvas feeds the same press queue as Space. The page sets `touch-action: none` and blocks double-tap zoom, pinch, the long-press menu and text selection. The viewport uses `viewport-fit=cover`.
- **Prompts:** say "Tap" or "Press Space" depending on the last input type used, starting from `(pointer: coarse)`.
- **Resolution and layout:** the canvas resolution is capped at 2× device pixels. The layout follows resizes, rotation, the iOS address bar (`visualViewport`) and pixel-ratio changes.
- **Home screen app:** a web app manifest (`display: fullscreen`, any orientation) and an `apple-touch-icon`. On iPhone this is the way to play without browser bars; its Safari has no Fullscreen API for pages.

## Screen layout (from v1)

- **Layout module.** `layoutFor(width, height, insets)` is a pure, unit-tested function. It decides the logical view, the scale, where the 720 px world band sits, and where the HUD, buttons and panels go.
- **16:9** keeps the designed 1280 × 720 frame.
- **Wider landscape** (a phone showing its browser bars) first crops the empty bottom of the world band, down to MIN_VISIBLE_WORLD_HEIGHT. Then it shows more world to the side, up to MAX_VIEW_WIDTH, and only then adds bars. The floor is lifted to the bottom edge.
- **4:3** shows extra canopy above the band and undergrowth below it.
- **Portrait** shows PORTRAIT_VIEW_WIDTH of world, with the spare height split around the band. The title and results panels go below the band, with text and buttons enlarged. While the monkey hangs, the camera holds its liana's anchor at PORTRAIT_ANCHOR_X, so the whole swing and the next liana stay on screen. Rotating mid-run changes the layout without pausing.
- **v2 elements** (stage banner, banana indicator, mode picker) are placed by the layout in every shape. The 2P modes use the 16:9 frame (decision 24).

## Full screen (from v1)

- **Controls:** a button next to the speaker, and `F`. The whole page goes full screen, using the Fullscreen API or its `webkit` fallback.
- **Touch:** a tap on the button toggles on `pointerup`, because touch browsers don't grant full screen from a touch `pointerdown`.
- **Button state:** the icon follows `fullscreenchange`, so it stays right after Esc.
- **Where it's hidden:** where the API is missing (iPhone Safari), and in the home-screen app.
- **No orientation lock.** Leaving full screen doesn't pause.

## Performance and hardening (from v1)

- **Renderer:** WebGL is forced.
- **Graphics context loss:** a lost context pauses the game with a notice. If it isn't restored within 5 s, a "tap to reload" screen appears.
- **Errors:** a global handler for the game's own errors shows the reload screen instead of a frozen canvas.
- **Drawing cost:**
  - Lianas are redrawn only when their angle changes.
  - The parallax layers are render groups.
  - The frame is clipped with black bars instead of a mask.
- **Budget:** at 4× CPU throttling, per-frame work stays under 6 ms at p95. No frame goes over 16 ms during generation, restarts or deaths.
- **Soak test:** 5,000 gaps, with entity counts and the event queue staying bounded. The heap stays flat across restarts. Rendering stays precise at large world x.
- **Input edge cases** are unit-tested: keys held across a restart, taps during the game-over lock, multi-touch, and input held while focus is lost.
- **Reduced motion:** with `prefers-reduced-motion`, the death shake is off.

## Release and deploy (from v1)

- Vite `base: '/liano/'` for build and preview; the game is served at `https://skogdoom.github.io/liano/`.
- CI runs `npm ci`, `npm test`, `npm run build` and the window-table check on every PR and on `master`. Every push to `master` deploys to Pages.
- The README covers how to play, the controls, local development and the disclaimer. The page has an SVG favicon and a description. The version from `package.json` is shown on the title screen.
- Releases are tagged `vX.Y.Z`, each with a GitHub release. The owner creates the tag and release, because this environment can't push tags.

## Tunables (`src/config.js`)

Values from v1 are the tuned, current ones. New v2 values are starting points.

| Constant | Value | Notes |
|---|---|---|
| SCREEN_WIDTH × SCREEN_HEIGHT | 1280 × 720 | Landscape design frame; other screen shapes derive from it (see Screen layout) |
| WORLD_HEIGHT | 720 | The world band; falling below it ends the run |
| ANCHOR_Y | −20 | |
| LIANA_LENGTH (L) | 420 | |
| LIANA_SPACING | 700 | Wide enough that the swings (reach ≈ 322) leave the middle of each gap free (v2 draft: 380) |
| SWING_AMPLITUDE | 50° | |
| SWING_PERIOD | 2.6 s | Slower swing, tuned in v1 (v2 draft: 1.8 s) |
| GRAVITY | 600 px/s² | Tuned in v1; 400 felt too floaty (v2 draft: 1800) |
| SLIP_SPEED | 60 px/s | New; retune against the v1 swing |
| ENTRY_RADII | [0.35, 0.5, 0.65, 0.8, 0.95] × L | New |
| MONKEY_RADIUS | 22 | |
| OBSTACLE_Y_RANGE | [140, 375] | Heights ~[195, 315] are rejected by swing clearance (v2 draft: [140, 620]) |
| LIANA_CLEARANCE | 6 | Extra gap between an obstacle and a swept area, beyond MONKEY_RADIUS |
| MIN_RELEASE_WINDOW_MS | 90 | Stage 1; later stages per the stage table |
| MOVING_PERIOD_RANGE | 1.5–3.0 s | New |
| BANANA_CHANCE | 0.15 per gap | New; not within 2 gaps of the previous banana |
| BANANA_POINTS | 3 | New |
| BOOST_GRABS | 3 | New |
| BOOST_FACTOR | 1.35 | New |
| LIVES_2P | 3 | New |
| RESPAWN_GRIP | 0.7 × L | New |
| RESPAWN_INVULN_MS | 1500 | New |
| CAMERA_TARGET_X | 0.35 × width | Landscape |
| CAMERA_LERP | 8 /s | |
| GAMEOVER_INPUT_LOCK_MS | 400 | |
| DEATH_BOUNCE, DEATH_POP | 0.4, 260 px/s | Death feedback |
| DEATH_SHAKE_PX, DEATH_SHAKE_TIME | 9, 0.35 s | |
| MAX_RESOLUTION | 2 | Canvas pixels per CSS pixel |
| MIN_VISIBLE_WORLD_HEIGHT, MAX_VIEW_WIDTH | 570, 1600 | Flexible landscape frame |
| PORTRAIT_VIEW_WIDTH, PORTRAIT_ANCHOR_X | 1100, 0.3 | Portrait |
| KEYS | 1P: Space (or tap); P1: KeyA; P2: KeyL; mute: KeyM; full screen: KeyF; debug: KeyD | |

## Project structure

Existing files, plus the new ones v2 needs (marked *new*).

```
liano/
  index.html                # viewport, notice and error overlays
  package.json
  vite.config.js            # base /liano/ for build and preview
  .github/workflows/ci.yml  # test, build, table check; Pages deploy on master
  public/                   # favicon.svg, manifest.webmanifest, icons/
  scripts/
    build-windows.mjs       # regenerates the window table (runs before build)
    make-icons.mjs          # favicon and app icons from one set of shapes
  src/
    main.js
    config.js
    layout.js               # every screen shape: frame, scale, band, HUD and panels
    loop.js                 # fixed-step loop
    input.js                # keys and taps; per-player key mapping (new), repeat filtering
    pause.js                # blur, hidden page, held reasons, resume grace
    fullscreen.js
    fatal.js                # error and notice overlays
    audio/
      recipes.js
      sounds.js             # sim events → recipes
      player.js
    sim/
      rng.js
      physics.js            # pendulum with slip, ballistic step, hit tests
      liana.js
      monkey.js             # hanging/airborne, grip/slip, boost (new), invulnerability (new)
      obstacle.js           # static obstacles and hitboxes
      obstacles/            # new: spider.js, snake.js, bird.js
      banana.js             # new
      difficulty.js         # new: stage table lookup by obstacle index
      generator.js          # layout, obstacle/banana placement, reroll loop
      feasibility.js        # pure solver (also used in tests and by the table build)
      windowTable.js/.json  # build-time windows for static gaps
      world.js              # N monkeys, step(dt), events: grab, score, banana, death
      match.js              # new: mode rules: 1P, shared, split; lives, respawn, results
      game.js               # TITLE, PLAYING, RESULTS
    workers/
      solverWorker.js       # new
    render/
      background.js         # parallax layers, taller views, stage tint (new)
      lianaView.js
      monkeyView.js         # per-player color variant (new)
      obstacleViews.js
      bananaView.js         # new
      camera.js             # single-target, portrait anchor, leader (new) modes
      viewports.js          # new: full screen / split panes
      hud.js                # 1P and 2P variants
      overlays.js           # title + mode picker, stage banner, results, off-screen indicator
      debugOverlay.js
      muteButton.js
      fullscreenButton.js
      shake.js
      shapes.js
  tests/                    # existing suites, plus slip, solver, banana, match (new)
```

## Visual style

Simple stylized vector art drawn in code with Pixi `Graphics`. No image assets.

- **Monkeys.**
  - Look: round body and head, lighter face and belly, curled tail, one arm reaching up to the grip point.
  - Player colors: P1 brown, P2 a distinct color (e.g. golden).
  - Poses: hanging, airborne tumble, dead fall.
- **Lianas.** A green polyline with leaves, which bends slightly while settling. The grip slide is visible, and the tip flashes when the monkey is near it.
- **Static obstacles.**
  - Branch: brown limb with a leaf tuft.
  - Thorn bush: dark blob with thorns.
  - Rock: grey polygon on a small ledge.
- **Moving obstacles.**
  - Spider: black body with 8 legs, on a thin thread.
  - Snake: green segmented body wrapped on a vine.
  - Bird: bright body with flapping wings.
- **Banana.** A yellow crescent with a gentle bob and sparkle.
- **Background.** Three parallax layers, a canopy strip at the top, and a dark jungle floor band at the bottom. Taller views extend the forest upward and the undergrowth downward. The tint shifts per stage.
- **HUD and buttons.** Readable text with a subtle shadow, plus the speaker and fullscreen icons.
- **Readability.** Hitboxes must visually match the drawings. Check this with the debug overlay.

## Milestones

### Done: v1 (milestones 1–14)

**1. Scaffold.** Vite + Pixi setup, letterboxed scaling, fixed-step loop, state machine with placeholder overlays, input module.
- [x] `npm run dev` shows a 1280×720 scaled canvas
- [x] Space transitions READY → PLAYING; held Space does not repeat
- [x] `npm test` runs

**2. Swing, release, grab.** Liana and monkey sim with placeholder rendering (lines and circles). Grip slide. Excluded-liana rule.
- [x] Monkey swings with fixed amplitude/period regardless of arrival speed
- [x] Release produces the correct tangential velocity (unit tested)
- [x] Monkey auto-grabs the next liana on contact; cannot regrab the one just released
- [x] Backward release can land on the previous liana

**3. World, camera, fall.** Lazy generation/culling of lianas, horizontal camera follow, fall detection, game over and restart.
- [x] Endless lianas in both directions as needed; entity count stays bounded
- [x] Falling below the screen ends the run; restart works after the input lock

**4. Obstacles and scoring.** Obstacle types with hitboxes, collision, per-obstacle scoring, HUD with session best.
- [x] Obstacle hit ends the run (including while hanging)
- [x] Each obstacle scores once; backward/forward re-crossing does not re-score (unit tested)
- [x] Best score survives restarts, resets on page reload

**5. Feasibility and tuning.** Release-window solver, generator rerolls, fairness tests. Tune constants.
- [x] Test: for 1,000 seeded gaps, every generated gap has a valid window ≥ MIN_RELEASE_WINDOW_MS
- [x] Debug overlay (toggle with `D`) draws hitboxes, the predicted trajectory, and the valid release window for the current gap

**6. Art.** Replace placeholders with vector art, parallax background, monkey poses, liana settle sway, off-screen indicator.
- [x] Hitboxes still match visuals (check with debug overlay)
- [ ] Stable 60 fps on a mid-range laptop (not yet checked on hardware; per-frame update + render submission measured at 1.0 ms median, 2.0 ms p95 in headless Chromium)

**7. Polish.** Title and game-over overlays with score, small death feedback (monkey tumble, brief screen shake), pause simulation on window blur.
- [x] Full loop: title → play → die → restart with no reload

**9. Touch and mobile.** Pointer input, viewport and gesture handling, landscape-only overlay (later removed by 14), input-dependent prompts, resolution cap, manifest and icon.
- [ ] Tap starts, releases and restarts on phone and iPad (Playwright touch emulation, then real devices via `npm run dev:host`) — emulation passes; real devices still to check
- [ ] No zoom, scroll or text selection from taps; the portrait overlay pauses the game — emulation passes; real devices still to check
- [x] The press that resumes from pause is not also used as a press (unit tested)

**10. Sound.** Recipes, player, mute toggle and button.
- [x] Each sound fires on its event and at most once per event (unit tested against sim events)
- [x] No audio before the first press; audio suspends while paused
- [x] Mute toggles with `M` and the on-screen button (top-left speaker)

**11. Performance and hardening.** Precomputed window table, liana redraw on change, renderer and GPU-context handling, error overlay, soak test, input edge cases.
- [x] No sim step spends time in the solver during play (table lookup only; unit tested)
- [x] No frame over 16 ms during generation: a sim step that generates new gaps now takes at most 0.6 ms (1 ms at 4× throttling), down from 12.4 ms
- [ ] At 4× CPU throttling: p95 frame work under 6 ms — our update is 1.3 ms median and 4 ms at p95; rendering in headless Chromium (software WebGL, fill-bound) is 3.1 ms median and 6.6 ms at p95 with rare frames over 16 ms. Still to check on a real device
- [x] Soak test: 5,000 gaps with bounded entities and events (unit tested)
- [ ] No heap growth across 20 restarts — heap after garbage collection is 14.33 MB after 5 restarts, 14.72 MB after 25, 14.90 MB after 45: small and slowing (warm-up rather than a leak), but not flat
- [x] Losing the GPU context pauses and recovers (simulated with `WEBGL_lose_context`); if it is not restored within 5 s, the reload message appears

**8. Deploy pipeline.** CI on PRs and pushes, Pages deploy on `master`, `base` path.
- [x] PRs show a passing test and build check (first run on skogdoom/liano#3)
- [x] The game loads and plays at `https://skogdoom.github.io/liano/` (first deploy from the master run for skogdoom/liano#4; checked by the owner)

**12. Release v1.0.0.** README, favicon and meta, version on the title screen, tag and GitHub release.
- [x] v1.0.0 is live on Pages and tagged, with release notes (https://github.com/skogdoom/liano/releases/tag/v1.0.0)

**13. Fullscreen.** Button, `F` key, state sync, hidden where unsupported.
- [ ] The button and `F` enter and leave full screen in desktop Chrome, Firefox and Safari, in Android Chrome and on iPad. The icon follows the state, including after Esc — passes in Chromium (mouse, `F`, and a touch tap in Android emulation; the icon follows an exit made outside the game); the other browsers and real devices still to check
- [x] Neither the button nor `F` releases the monkey or starts a run (unit tested; also checked in Chromium)
- [ ] The button is hidden on iPhone Safari and in the home-screen app — passes with the API removed and with `display-mode: standalone` faked in Chromium; real devices still to check
- [ ] The game fills the screen after entering and leaving full screen, and after rotating while in full screen
- [x] v1.1.0 is live on Pages and tagged, with release notes (tag `v1.1.0` on the #7 merge commit; release at https://github.com/skogdoom/liano/releases/tag/v1.1.0)

**14. Portrait mode and a flexible frame.** World/screen split, layout module (portrait and flexible landscape), anchor-following portrait camera, extended background, HUD and panel layouts, rotate overlay removed. (skogdoom/liano#8.)
- [ ] Held upright, a phone and an iPad play a full run: start, release, die, restart (Playwright emulation, then real devices) — passes in iPhone 13 and iPad emulation; real devices still to check
- [x] The whole swing and the next liana are on screen while the monkey hangs, in portrait on the narrowest supported phone (unit tested against the layout and camera, 320 × 568 up to iPads)
- [x] Rotating mid-run switches layout without pausing, losing the run or dropping a press (checked in iPhone emulation by resizing the viewport mid-run; the first tap after it releases the monkey)
- [x] Landscape at exactly 16:9 looks and plays as before (screenshots compared at 1280 × 720 and 1920 × 1080; the layout gives the old frame, camera and panel spots, unit tested)
- [ ] A landscape phone with the browser bars showing fills the screen with no black bars, with the game drawn larger than a 16:9 letterbox would allow (unit tested against the layout, then on a real phone) — unit tested and checked at 844 × 340 in emulation (drawn at 0.60× instead of 0.47×); a real phone still to check
- [ ] The monkey is readable on a real phone in portrait (see decision 11)
- [x] v1.2.0 is live on Pages and tagged, with release notes (tag `v1.2.0` on master after #8 and #9; release at https://github.com/skogdoom/liano/releases/tag/v1.2.0)

### v2 (milestones 15–22)

Implement in order. Each milestone must end in a runnable, tested state, with every v1 feature still working: touch, sound, full screen, portrait, the flexible frame and hardening. The v2 draft's milestones 1 (scaffold), 3 (world, camera, scoring), 4 (static obstacles) and 6 (base art) are already built in v1. The parts they add (modes, N monkeys, RESULTS) are folded into milestone 15.

**15. Modes and N monkeys.** TITLE/PLAYING/RESULTS states, title mode picker (only 1P enabled for now), per-player keys in the input module, a world holding N monkeys (N = 1 for now), `match.js` for mode rules.
- [ ] Held keys don't repeat for any action key; the mode picker works with keys and, for 1P, with a tap
- [ ] 1P plays exactly as in v1 (existing tests pass unchanged)

**16. Slip and forced release.** Grip slip and forced release replace the fixed grip slide. Release velocity gains the radial part. The feasibility solver and the window table cover entry radii. The debug overlay shows the slip and the forced-release point.
- [ ] Grab at the contact radius; slip reaches the tip and forces a release
- [ ] Release velocity includes the radial component (unit tested)
- [ ] The just-released liana cannot be regrabbed; backward flight can land on the previous liana
- [ ] 1,000 seeded gaps: all feasible for every entry radius

**17. Moving obstacles.** Spider, snake, bird with periodic motion; the solver gains the phase dimension and runs in a worker; art for all three; a "bong" pitch for each.
- [ ] 1,000 seeded gaps from stage 2+: all feasible for every entry radius × phase
- [ ] No moving obstacle's path intersects a swing arc; bird patrol bounds are asserted in the generator
- [ ] No frame over 16 ms from generation

**18. Difficulty stages.** Stage table, stage banner, background tint, obstacle scaling.
- [ ] Stage is derived from obstacle index; banana points don't affect it (unit tested)

**19. Bananas.** Placement, pickup, boost counter, bonus points, HUD indicator; the solver gains the boosted variant.
- [ ] Gaps within BOOST_GRABS after a banana pass both normal and boosted checks
- [ ] Boost resets to BOOST_GRABS on repeat pickup and clears on death

**20. 2P split screen.** Two worlds with one seed, two viewports, lives, respawn with invulnerability, per-pane HUD, results screen.
- [ ] A player with no lives left stops; the other continues; the winner is decided by totals

**21. 2P shared screen.** Leader camera, left-edge elimination, respawn on the leftmost fully visible liana, shared lianas.
- [ ] Two monkeys can hang on the same liana, each at its own grip radius, in the same swing phase
- [ ] The camera handles a leader death without snapping

**22. Polish.** Key-binding hints on the title screen; death feedback and pause for 2P (both already exist for 1P).
- [ ] Full loop in every mode: title → play → results → title, with no reload

## Decisions (confirm or change)

**Carried over from v1**
1. **Swing starts at vertical, in the direction of travel.** Released lianas settle back to vertical with a damped cosmetic sway.
2. **Empty start gaps.** The first gap has no obstacle, and neither does the gap behind the start liana, since the title-screen swing passes over it.
3. **Every generated gap is guaranteed passable** with a minimum human-reasonable release window.
4. **The camera is horizontal-only,** with an arrow above the top edge when the monkey is out of view.
5. **Game flow:** the title screen shows the monkey swinging on the first liana. On game over, input is locked for 400 ms.
6. **Taps are presses.** Any pointer press counts as Space: one `pointerdown` is one press, extra fingers are extra presses, and `pointercancel` is ignored.
7. **Sound** is on by default from the first press, and only the two deaths have sounds.
8. **Reduced motion** is respected (no death shake).
9. **Full screen:** a button and `F`, hidden where unsupported, with no orientation lock. Leaving full screen doesn't pause.
10. **Portrait and the flexible frame** follow the aspect ratio, not the device. Same game in every shape, so scores are comparable. Rotating mid-run doesn't pause.
11. **Size trade-off in portrait:** the monkey is about 16 CSS px across on a phone. If that's too small on real phones, reconsider; don't scale the art away from the hitbox.

**New in v2**

12. **Forced release at the tip, not death.** A slipped-off monkey can still reach the next liana.
13. **Scoring per gap crossed.** A bird's x isn't fixed, so "passing an obstacle" is measured at the gap boundary. The gap scores on a forward grab of its far liana (see Conflicts).
14. **Difficulty keyed on obstacle index**, not score (see Difficulty stages for the reasons).
15. **Stages rather than a smooth ramp.** Stages line up with the "moving from 15" rule and are easier to tune. The thresholds in the table are guesses.
16. **Shared screen: monkeys can share a liana** and don't collide with each other.
17. **Single player keeps 1 life.** Lives exist only in 2P.
18. **Respawn locations:** the last grabbed liana (split) or the leftmost fully visible liana (shared), with 1.5 s invulnerability.
19. **2P keys A and L**, avoiding Shift because of Windows Sticky Keys. They don't clash with `M`, `F` or `D`.
20. **Boost resets rather than stacks**, and is lost on death.
21. **The fairness guarantee is sampled, not proven**, and doesn't cover joining a liana mid-swing.
22. **Split-screen panes render at 0.5 scale** with a wider horizontal view.

**Filled in while merging with v1** (not specified; confirm or change)

23. **2P modes are keyboard-only.** On a touch device the mode picker offers 1P only.
24. **2P modes use the 16:9 frame**, letterboxed as needed. Split panes are 1280×360, and the leader camera assumes the landscape width. Portrait and the flexible frame apply to 1P.
25. **No new sounds** for v2 events unless asked for, given how the "wheee" went. New obstacle types get a "bong" pitch.

## Conflicts with v1

The v2 draft differed from what's built in these places. This plan keeps the built behaviour; say if you want the v2 version instead.

| Area | v2 draft | Kept (v1) | Why |
|---|---|---|---|
| Liana spacing, swing, gravity, obstacle range | 380 px, 1.8 s, 1800 px/s², y 140–620 | 700 px, 2.6 s, 600 px/s², y 140–375 | Tuned at the owner's request: a slower swing, more air time, and no liana ever sweeping over an obstacle. At 380 px the swings (≈ 322 px each way) overlap, so no obstacle could stay clear of them. |
| Scoring | Also when the monkey passes the far liana's x in mid-air | Only on a forward grab of the far liana | Owner's request in v1: "only score on reaching the next liana". |
| Fall | Below the bottom edge of the screen | Below the world band (y 720) | The flexible frame and portrait change where the screen edge is; the fall line must not. |
| Solver step | 1/240 s | The sim step, 1/120 s | So the solver agrees exactly with the real world (tested). |
| Solver location | Web Worker | Build-time table for static gaps, worker for moving ones | Keeps generation a lookup for static gaps; the worker only where the table can't cover it. |
| Pause | On window blur | On blur, a hidden page, or a lost graphics context, with a 250 ms resume grace | Built in v1 (milestones 9 and 11). |
| Screen | 1280 × 720, letterboxed | Flexible frame and portrait (1P); 16:9 for 2P | Built in milestone 14. |
| Out of scope | Mobile/touch input, sound | Both stay in scope | Built in v1 (milestones 9 and 10). |

v2 changes these v1 rules on purpose: a fixed grip slide becomes slip with forced release; constant difficulty becomes stages; moving obstacles, power-ups (bananas) and modes are now in scope.

## Out of scope

Persistent high scores, online multiplayer, more than 2 players, touch controls for 2P, swing-speed or slip-speed ramps, a separate per-liana countdown timer, menus beyond title/results, music.
