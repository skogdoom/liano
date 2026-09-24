# Liano — Implementation Plan

A one-button browser game. A monkey swings on lianas through a jungle; pressing Space lets go. The monkey flies ballistically and auto-grabs the next liana it touches. Static obstacles sit in the gaps between lianas. Each obstacle passed scores a point. Hitting an obstacle or falling off the bottom ends the run.

## Tech stack

- JavaScript (ES modules, no TypeScript), PixiJS (current major, v8), Vite for dev/build.
- Vitest for unit tests of simulation logic.
- No other runtime dependencies. No backend. No persistence (best score lives in memory for the page session).

## Core rules (fixed by design)

| Area | Rule |
|---|---|
| Progress | Camera follows the monkey horizontally. No auto-scroll. Distance comes only from release momentum. |
| Input | Space, or a tap/click on the game (one press per new finger or primary mouse button). Press while hanging = release. Press while airborne = ignored. Ignore key auto-repeat (`event.repeat`). Presses while paused, or within 250 ms of resuming, are ignored. |
| Swing | Idle lianas hang still. When grabbed, the liana swings with a **fixed amplitude and period**, independent of how the monkey arrived. |
| Grab | Automatic on contact anywhere along the liana, while airborne. The liana just released cannot be regrabbed until a different liana has been grabbed. |
| Backward | Releasing on the backswing is allowed; the monkey may fly backward and grab the previous liana. |
| Layout | Lianas have identical length and identical horizontal spacing. |
| Obstacles | Static only: branch, thorn bush, rock. One per gap, horizontally centered in the gap, at a random height. A liana never sweeps over an obstacle: obstacles stay clear of the area either neighbouring liana (rope and hanging monkey) can swing through. |
| Difficulty | Constant. No ramp. |
| Fail | Collision with an obstacle, or monkey falls below the bottom edge of the screen. Going above the top is not a fail. |
| Scoring | +1 for an obstacle when the monkey, moving forward, grabs the liana on the far side of its gap. Swinging or flying past it without reaching that liana does not score. Each obstacle scores at most once (flying backward and forward again does not re-score). |
| HUD | Top-right corner: current score and best score for this session. |

## Decisions filled in (not specified by the user — confirm or change)

1. **Grip slides to a fixed point.** After grabbing at the contact point, the monkey slides along the liana to a fixed grip radius (90% of length) over ~150 ms. This makes every swing identical, so each gap's difficulty depends only on the obstacle height, and feasibility can be precomputed. Alternative: hold where grabbed (more skill variance, harder to guarantee fairness).
2. **Swing starts at vertical, in the direction of travel.** On grab the liana is vertical (θ = 0); the swing begins moving in the direction of the monkey's horizontal velocity: θ(t) = dir · A · sin(ω·t).
3. **Released lianas settle** back to vertical with a damped cosmetic sway (no gameplay effect).
4. **First gap has no obstacle** so the player learns the release timing. The gap behind the start liana is empty too, since the title-screen swing passes over it.
5. **Every generated gap is guaranteed passable** with a minimum human-reasonable release window (see Feasibility).
6. **Camera is horizontal-only.** Vertical view is fixed (canopy at top, jungle floor at bottom). If the monkey goes above the top edge, show a small arrow indicator at its x.
7. **Game flow:** first load shows a title overlay with the monkey swinging on the first liana; Space starts the run. On game over, input is locked for 400 ms, then Space starts a new run immediately.
8. **Fixed logical resolution 1280×720**, scaled to fit the window with letterboxing.

## Simulation model

Keep all simulation in pure functions/classes with no Pixi imports so it can be unit-tested. Rendering reads simulation state each frame.

**Loop.** Fixed timestep (1/120 s) with an accumulator; render interpolation optional. Clamp frame delta to 100 ms (tab switches).

**Liana.** Anchor at (x, ANCHOR_Y) above the top edge, length L. State: `idle | swinging | settling`. When swinging, θ(t) = dir · A · sin(ω·t), ω = 2π / SWING_PERIOD. Angular velocity θ'(t) = dir · A · ω · cos(ω·t).

**Hanging monkey.** Position = anchor + r·(sin θ, cos θ), where r is the grip radius (animated from contact radius to GRIP_RADIUS on grab).

**Release.** Velocity = tangential velocity at release: v = r·θ' · (cos θ, −sin θ). Then ballistic: vy += GRAVITY·dt, position += v·dt. No air control, no drag.

**Grab detection.** Monkey hitbox is a circle. Each liana is a line segment from anchor to tip. Grab when circle intersects segment, monkey is airborne, and the liana is not the excluded (just-released) one. On grab, compute contact radius = distance from anchor to closest point on segment.

**Obstacle collision.** Each obstacle type has a simple hitbox (circle, or a small set of circles/rects). Check every step, in both hanging and airborne states. If a grab and an obstacle hit happen in the same step, the obstacle hit wins.

**Fall.** Monkey center y > SCREEN_HEIGHT + monkey radius → game over.

**Generation.** Seeded RNG (e.g. mulberry32; random seed per run, fixed seed in tests). Generate lianas and obstacles lazily ahead of the camera (≥ 2 screens), and discard those more than 2 screens behind. Liana i sits at x = i · LIANA_SPACING.

**Feasibility.** Because every swing is identical (decision 1), a gap is defined only by its obstacle's type and height. Releases can only happen on sim steps, so the solver sweeps release steps rather than milliseconds, over the first quarter period after a forward grab (while the swing still moves forward). A step is valid when the monkey survives hanging until then, misses the obstacle in flight and grabs the next liana. Because the grip slide makes the first 150 ms depend on where the liana was caught, a step must be valid for every arrival radius (anchor to tip, sampled every 10 px); after the slide the swing is the same for all of them, so it is simulated once. The obstacle must also be clear of both neighbouring lianas' swept sectors by MONKEY_RADIUS + LIANA_CLEARANCE, so the monkey can never hit it while hanging. Accept only if the longest run of valid steps is at least MIN_RELEASE_WINDOW_MS (11 steps). Otherwise reroll the height (20 tries, then fall back to the lowest passable height). Results are memoized per (type, whole-pixel height). Implemented in `src/sim/feasibility.js`.

## Tunables (`src/config.js`)

Starting values, all expected to change during tuning.

| Constant | Start value | Notes |
|---|---|---|
| SCREEN_WIDTH × SCREEN_HEIGHT | 1280 × 720 | Logical resolution |
| ANCHOR_Y | −20 | Liana anchors just above the top edge |
| LIANA_LENGTH | 420 | Tips hang around y = 400 |
| GRIP_RADIUS | 0.9 × LIANA_LENGTH | |
| LIANA_SPACING | 700 | Was 380. Wide enough that the swings (reach ≈ 322) leave the middle of each gap free |
| SWING_AMPLITUDE | 50° | |
| SWING_PERIOD | 2.6 s | Was 1.8 s (slower swing) |
| GRAVITY | 600 px/s² | Was 1800. Low, for ~0.8 s flights across the wide gaps; 400 felt too floaty |
| MONKEY_RADIUS | 22 | Hitbox |
| OBSTACLE_Y_RANGE | [140, 375] | Heights ~[195, 315] are rejected (the swing tips reach there). Above: fly under the obstacle; below: fly over it |
| LIANA_CLEARANCE | 6 | Extra gap between an obstacle and a liana's swept area, beyond MONKEY_RADIUS |
| MIN_RELEASE_WINDOW_MS | 90 | Fairness floor |
| CAMERA_TARGET_X | 0.35 × width | Monkey's screen position |
| CAMERA_LERP | 8 /s | Smoothing |
| GAMEOVER_INPUT_LOCK_MS | 400 | |

## Project structure

```
liano/
  index.html
  package.json
  vite.config.js
  src/
    main.js              # Pixi app bootstrap, scaling/letterbox, fixed-step loop
    config.js            # all tunables
    sim/
      rng.js             # seeded RNG
      physics.js         # pendulum, ballistic step, circle–segment and hitbox tests
      liana.js           # liana state machine
      monkey.js          # hanging/airborne state, grab/release
      generator.js       # liana + obstacle generation, feasibility check
      world.js           # owns entities, step(dt), events (grab, score, death)
      game.js            # READY / PLAYING / GAME_OVER, score + best score
    render/
      background.js      # parallax jungle layers
      lianaView.js
      monkeyView.js
      obstacleViews.js   # branch, thorn bush, rock
      hud.js             # top-right score / best
      overlays.js        # title, game over, off-screen indicator
      camera.js
    input.js             # Space handling, repeat filtering
  tests/
    physics.test.js
    generator.test.js
    feasibility.test.js
    scoring.test.js
    game.test.js
```

## Visual style

Simple stylized vector art drawn in code with Pixi `Graphics`. No image assets.

- **Monkey:** round brown body and head, lighter face and belly, round ears, curled tail, one arm reaching up to the grip point. Pose changes: hanging (arm up, legs dangling, slight lag behind swing), airborne (arms spread, tumble rotation following velocity), dead (falls with spin).
- **Lianas:** green line with a gentle curve and a few leaves; drawn as a polyline so it can bend slightly while settling.
- **Obstacles:** branch (brown horizontal limb with a leaf tuft, drawn from a trunk stub), thorn bush (dark green blob with triangular thorns), rock (grey angular polygon on a small ledge or vine). Hitboxes should visually match.
- **Background:** 3 parallax layers (far canopy silhouettes, mid tree trunks, near foliage) plus a dark jungle floor band at the bottom that reads as "don't fall here". Canopy strip across the top where lianas hang from.
- **HUD:** top-right, readable text with a subtle shadow, e.g. `12  BEST 31`.

## Milestones

Implement in order. Each milestone ends in a runnable, testable state.

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

## Phase 2: sound, touch devices, performance, release

Four additions: synthesized sound effects, phone and iPad support (tap instead of Space), performance tuning and hardening, and a public release on GitHub Pages.

### Decisions (not specified by the user — confirm or change)

9. **Test locally first, deploy after hardening.** Until the Pages pipeline exists, phones and iPads test against the dev server on the local network (`npm run dev:host`, then open the printed network address on the device). The pipeline follows performance and hardening, and the versioned release (v1.0.0) is last.
10. **Any pointer press counts as Space.** A tap, or a mouse click on desktop, is one press, handled by the same code as Space. One `pointerdown` is one press; extra fingers are extra presses, `pointercancel` is ignored.
11. **Landscape only.** The game stays 16:9. On a portrait screen a "rotate your device" overlay pauses the game instead of shrinking it into a letterbox.
12. **Sound is on by default**, starting at the first press (browsers block audio before a user gesture). `M` or an on-screen speaker button toggles mute. The mute setting lives in memory only, consistent with no persistence.
13. **No swing sound.** A "swish" on each pass through the bottom of the swing was built and then removed at the user's request.
14. **Reduced motion is respected:** with `prefers-reduced-motion` the death shake is off.

### Sound design

All sounds are synthesized with the Web Audio API at runtime; no audio files.

| Event | Sim trigger | Synthesis |
|---|---|---|
| "Wheee" | `release` event | Sung vowels from a sawtooth voice: a wide "body" band on the pitch for warmth, soft vowel formants and a 3 kHz low-pass to keep it from sounding bright. Variants: "iiii" as in "hit" (the default), "eeee" as in "teach", or "ooaaooaa" alternating (its "aa" formants tuned onto the 2nd and 3rd harmonics so the change is audible at this pitch). Steady pitch of 800 Hz with a slow vibrato (4 Hz, about ±1.5%), about 0.9 s. Played a little quieter than the other sounds. |
| "Bong" | `death` with cause `obstacle` | Bell-like decaying sines at inharmonic ratios (1, 2.76, 5.4) with a fast attack and about 1 s decay. Base pitch by obstacle type: rock low, branch mid, bush higher. |
| "Crash" | `death` with cause `fall` | A low-passed noise burst plus a falling low sine thud, about 0.8 s. |

- **Structure:** each sound is a pure "recipe" function that returns oscillators, filters and envelopes as data. These are unit-tested in Node. A thin player turns recipes into Web Audio nodes. It is the only code that touches `AudioContext`.
- **Game events for sound:** `Game` keeps the world events it drains each step and passes them on to a per-frame consumer, so sounds are driven by the sim and stay testable.
- **Pause:** the `AudioContext` is suspended with the game (window blur, hidden tab, portrait prompt) and resumed after.
- **iOS:** Web Audio follows the ring/silent switch, so sound is muted when the phone is on silent. This is platform behaviour, noted in the README rather than worked around.

### Touch and mobile

- **Input:** `pointerdown` on the canvas feeds the same press queue as Space. The page sets `touch-action: none`, prevents double-tap zoom and text selection, and the viewport meta tag disables pinch zoom and uses `viewport-fit=cover`.
- **Resume without a press:** the press that brings focus back after a pause resumes the game but is not also used as a press. That avoids an unwanted release when tapping or clicking to resume.
- **Prompts:** say "Tap" or "Press Space" depending on the last input type used. They start from `(pointer: coarse)`.
- **Layout:** handles orientation changes and the iOS address bar showing and hiding (`visualViewport` resize). Canvas resolution is capped at 2× device pixels, since 3× phones cost fill rate for no visible gain.
- **Home screen app:** a web app manifest (`display: fullscreen`, landscape) and an `apple-touch-icon`. "Add to Home Screen" then gives a full-screen game without browser chrome. iPhone Safari has no Fullscreen API for web pages, so this is the only way to get full screen there.

### Performance and hardening

Measured at the start of this phase in headless Chromium:
- **Per-frame work** (updates plus render submission): 1.0 ms median at full speed; 3.7 ms median and 9.5 ms worst at 4× CPU throttling.
- **Generating a gap** whose (type, height) is not yet cached costs up to 12.4 ms of solver time in one sim step, unthrottled. On a phone that would be a visible stutter whenever a new gap appears.

Performance:
- **Precomputed windows:** compute the release-window table (3 types × each whole-pixel height) at build time and ship it as a small JSON module. Generation becomes a table lookup. A unit test checks the shipped table against the live solver, so a changed tunable fails CI until the table is rebuilt.
- **Lianas:** redraw a liana's `Graphics` only when its angle changes. Idle lianas are static.
- **Background:** try `cacheAsTexture` on the static background layers if the GPU is fill-limited on phones. It is kept only if it measurably helps on a device.
- **Budget:** at 4× CPU throttling, per-frame work under 6 ms at p95 and no frame over 16 ms during generation, restarts or deaths. Then check on real devices via the local dev server.

Hardening:
- **Renderer:** force WebGL (`preference: 'webgl'`). WebGPU support is still uneven on mobile browsers.
- **Lost GPU context** (common when a phone backgrounds a tab): pause on `webglcontextlost` and restore on `webglcontextrestored`, or show a "tap to reload" overlay if restoring fails.
- **Errors:** a global error handler shows a friendly "Something went wrong — tap to reload" overlay instead of a frozen canvas.
- **Long sessions:**
  - A soak test plays 5,000 gaps with the fairness bot. Entity counts and the event queue must stay bounded, and the heap must stay flat across restarts.
  - Rendering must stay precise at large world x (millions of pixels): check for jitter and, if it appears, shift the world origin.
- **Input edge cases:** Space held across a restart; taps during the game-over lock; multi-touch; a key or pointer held while the window loses focus.

### Release

- **Vite:** `base: '/liano/'` so the build works at `https://skogdoom.github.io/liano/`.
- **CI** (GitHub Actions): run `npm ci`, `npm test` and `npm run build` on every PR and on pushes to `master`.
- **Deploy:** a second job publishes `dist/` to GitHub Pages on every push to `master` (`actions/upload-pages-artifact` and `actions/deploy-pages`). This needs a one-time repository setting from the owner: Settings → Pages → Source: GitHub Actions.
- **Release:** a README with how to play, controls and local development; a real favicon (small SVG) and page description; the version from `package.json` shown small on the title screen; tag `v1.0.0` and a GitHub release with notes.

### Milestones

Order: 9 → 10 → 11 → 8 → 12 (numbers kept from the original plan).

**9. Touch and mobile.** Pointer input, viewport and gesture handling, landscape-only overlay, input-dependent prompts, resolution cap, manifest and icon.
- [ ] Tap starts, releases and restarts on phone and iPad (Playwright touch emulation, then real devices via `npm run dev:host`) — emulation passes; real devices still to check
- [ ] No zoom, scroll or text selection from taps; the portrait overlay pauses the game — emulation passes; real devices still to check
- [x] The press that resumes from pause is not also used as a press (unit tested)

**10. Sound.** Recipes, player, mute toggle and button.
- [x] Each sound fires on its event and at most once per event (unit tested against sim events)
- [x] No audio before the first press; audio suspends while paused
- [x] Mute toggles with `M` and the on-screen button (top-left speaker)

**11. Performance and hardening.** Precomputed window table, liana redraw on change, renderer and GPU-context handling, error overlay, soak test, input edge cases.
- [ ] No sim step spends time in the solver during play (table lookup only; unit tested)
- [ ] At 4× CPU throttling: p95 frame work under 6 ms, no frame over 16 ms during generation
- [ ] Soak test: 5,000 gaps with bounded entities and no heap growth across 20 restarts
- [ ] Losing the GPU context pauses and recovers (simulated with `WEBGL_lose_context`)

**8. Deploy pipeline.** CI on PRs and pushes, Pages deploy on `master`, `base` path.
- [ ] PRs show a passing test and build check
- [ ] The game loads and plays at `https://skogdoom.github.io/liano/` (after the owner enables Pages)

**12. Release v1.0.0.** README, favicon and meta, version on the title screen, tag and GitHub release.
- [ ] v1.0.0 is live on Pages and tagged, with release notes

## Out of scope

Persistent high scores, difficulty ramp, moving obstacles, power-ups, menus beyond title/game over, music.
