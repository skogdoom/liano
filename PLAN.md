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
| Input | Spacebar only, desktop only. Space while hanging = release. Space while airborne = ignored. Ignore key auto-repeat (`event.repeat`). |
| Swing | Idle lianas hang still. When grabbed, the liana swings with a **fixed amplitude and period**, independent of how the monkey arrived. |
| Grab | Automatic on contact anywhere along the liana, while airborne. The liana just released cannot be regrabbed until a different liana has been grabbed. |
| Backward | Releasing on the backswing is allowed; the monkey may fly backward and grab the previous liana. |
| Layout | Lianas have identical length and identical horizontal spacing. |
| Obstacles | Static only: branch, thorn bush, rock. One per gap, horizontally centered in the gap, at a random height. |
| Difficulty | Constant. No ramp. |
| Fail | Collision with an obstacle, or monkey falls below the bottom edge of the screen. Going above the top is not a fail. |
| Scoring | +1 the first time the monkey's x passes an obstacle's right edge. Each obstacle scores at most once (flying backward and forward again does not re-score). |
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

**Feasibility.** Because every swing is identical (decision 1), a gap is defined only by its obstacle's type and height. For a candidate obstacle, sweep release times across one swing period (e.g. 1 ms steps), simulate each flight, and count the release times that reach the next liana without hitting the obstacle or falling out. Accept only if the valid window is contiguous for at least MIN_RELEASE_WINDOW_MS. Otherwise reroll the height (max N tries, then fall back to a known-safe height). Optionally precompute a lookup table of valid heights per obstacle type at startup.

## Tunables (`src/config.js`)

Starting values, all expected to change during tuning.

| Constant | Start value | Notes |
|---|---|---|
| SCREEN_WIDTH × SCREEN_HEIGHT | 1280 × 720 | Logical resolution |
| ANCHOR_Y | −20 | Liana anchors just above the top edge |
| LIANA_LENGTH | 420 | Tips hang around y = 400 |
| GRIP_RADIUS | 0.9 × LIANA_LENGTH | |
| LIANA_SPACING | 380 | |
| SWING_AMPLITUDE | 50° | |
| SWING_PERIOD | 1.8 s | |
| GRAVITY | 1800 px/s² | |
| MONKEY_RADIUS | 22 | Hitbox |
| OBSTACLE_Y_RANGE | [140, 620] | Before feasibility filtering |
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
- [ ] Test: for 1,000 seeded gaps, every generated gap has a valid window ≥ MIN_RELEASE_WINDOW_MS
- [ ] Debug overlay (toggle with `D`) draws hitboxes, the predicted trajectory, and the valid release window for the current gap

**6. Art.** Replace placeholders with vector art, parallax background, monkey poses, liana settle sway, off-screen indicator.
- [ ] Hitboxes still match visuals (check with debug overlay)
- [ ] Stable 60 fps on a mid-range laptop

**7. Polish.** Title and game-over overlays with score, small death feedback (monkey tumble, brief screen shake), pause simulation on window blur.
- [ ] Full loop: title → play → die → restart with no reload

## Out of scope

Mobile/touch input, sound, persistent high scores, difficulty ramp, moving obstacles, power-ups, menus beyond title/game over.
