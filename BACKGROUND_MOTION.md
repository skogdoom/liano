# Background motion investigation

Investigated on `phaser-m7-codex`, starting at `phaser-m7` commit `c9a4c31`, on 2026-10-13.

## Findings

There is a reproducible camera jerk at a catch, independent of frame timing or rendering cost. The background's fractional scrolling itself works in Chromium. The remaining perception of stutter during a swing is not established as a Phaser rendering bug by these checks; the reporting device's browser/GPU frame presentation still needs to be measured.

The relevant chain is:

1. `src/sim/world.js` detects a catch within the monkey's reach of a liana.
2. `Monkey.grab()` in `src/sim/monkey.js` immediately moves the monkey onto the rope, starts its swing, and replaces its airborne velocity with the hanging velocity. This is a deliberate gameplay discontinuity. It also resets the monkey's previous position so the visual catch is immediate.
3. `Camera.update()` in `src/render/camera.js` follows that position through one exponential lag (`CAMERA_LERP = 8`). This eases camera position but does not preserve camera speed when the target jumps.
4. `WorldPane.update()` in `src/phaser/world/pane.js` interpolates the camera between fixed simulation steps. This removes repeated simulation poses at other refresh rates; it does not remove the change in camera speed.
5. `BackdropRig.update()` in `src/phaser/world/backdrop.js` uses that same interpolated camera for every layer. The dark green trunks in the mid layer scroll at 40% of camera speed, compared with 15% for the hazier far layer. The near foliage scrolls at 70%. The darker, faster edges make changes in motion easier to see.

On an obstacle-free run with slipping off (the default), at 60 Hz, the first catch changed camera speed from **534 to 617 to 697 world units/second**. The mid-layer trees on a 2× screen consequently changed from about **7.1 to 8.2 to 9.3 device pixels/frame**. This happens with perfectly regular input frame times, without GPU drawing, score text, audio, or obstacle construction.

## Controlled comparison

`scripts/dev/background-motion.mjs` runs the real game, driver, camera and Phaser pane with a deterministic, obstacle-free world. It advances each frame by exactly 1/60, 1/90 or 1/144 second for 20 seconds, with slipping both off and on. It compares the default camera with the existing `?camera=smooth` option. The bot's input is sampled once per frame, so runs at different refresh rates can release at different simulation steps; camera profiles at the same rate follow identical gameplay.

Maximum catch-window acceleration (world units/second², rounded; catch frame and the next two frames):

| Slipping | Refresh rate | Default camera | `camera=smooth` | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Off | 60 Hz | 9,875 | 2,413 | 76% |
| Off | 90 Hz | 11,079 | 2,472 | 78% |
| Off | 144 Hz | 23,903 | 3,356 | 86% |
| On | 60 Hz | 9,180 | 2,558 | 72% |
| On | 90 Hz | 13,837 | 2,876 | 79% |
| On | 144 Hz | 21,270 | 2,987 | 86% |

All twelve runs had **zero repeated camera frames** (23,520 frames total). The script also verifies that each background layer's scroll uses the interpolated camera each frame. These are synthetic refresh intervals, not measurements from physical 90/144 Hz displays.

The second lag in `camera=smooth` spreads the catch's speed change over more frames. It adds tracking delay: roughly 42 ms more than the default for steady motion (two 1/12-second lags versus one 1/8-second lag). It does not freeze the camera through a swing.

An uninterrupted 2.6-second swing with a fixed grip changed the default camera's direction twice and reached **9.22 device pixels/frame** in the mid layer at 60 Hz and 2×. The smooth option reached **9.24**. Thus it helps the catches substantially while leaving the fast, reversing motion of the background during a swing. High-contrast edges moving that far between refreshes can look stepped; these measurements alone cannot identify that as the user's remaining symptom.

## Renderer check

A separate WebGL check hides the world, UI and other background layers, then renders the dark green mid-layer trunks over the static sky. Ten successive camera moves of 0.1 world units each (0.08 device pixels in the mid layer at this screen size) **all change the rendered pixels**.

The camera has `roundPixels = false`, the source texture uses linear filtering, and Phaser 4.2.1's TileSprite WebGL texturer retains fractional texture coordinates. The tile does not hold until the next whole texture or device pixel. The mid-layer source image is 1× even on a 2× screen, which affects edge softness, but does not prevent fractional scrolling.

The branch already contains fixes for score-text redraws, rounded Safari frame times, and shader compilation during play. The isolated catch jerk survives removal of all those workloads. This does not rule out a separate performance hitch on real hardware.

## Reproduce

```sh
npm ci
npm run dev -- --port 5174
# In another terminal, from the repository root:
CHROMIUM=/usr/bin/chromium URL=http://localhost:5174/ \
  node scripts/dev/background-motion.mjs > background-motion.json
```

`CHROMIUM` is optional if Playwright's Chromium is installed. The script outputs one JSON array with both camera profiles, frame counts, catch samples, acceleration measurements, the uninterrupted swing and pixel checks. It fails if the bot dies, a layer diverges from the camera, a subpixel move leaves the sampled tree row unchanged, or the browser reports an uncaught error. It uses Chromium's software WebGL renderer; its timings must not be treated as GPU performance results.

## Recommended next step

Use the existing `?camera=smooth` comparison on the reporting device, also with `&frames=1`. If the catch effect improves while the swing still looks uneven, they need separate treatment: retain a camera-speed smoothing solution for catches, and inspect presentation/frame pacing during the uninterrupted swing on that browser. The frame readout measures callback timing and CPU work; it cannot prove that the GPU/display presented each frame on time. A Safari recording on the affected Mac would resolve that remaining uncertainty.

No production camera or rendering behavior was changed as part of this investigation. Changing the catch snap would change gameplay, and making the smooth option the default should follow a visual check of its added camera lag.

## Validation

- Investigation script: all 12 motion runs and both subpixel rendering checks passed.
- `npm test`: 60 files, 665 tests passed.
- `npm run build`: passed.
- Focused browser checks: all five passed (the four backdrop edge cases at 1×/2× and the single-shader batching check).
