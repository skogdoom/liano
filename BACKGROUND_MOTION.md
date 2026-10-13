# Phaser background movement

Investigated on `phaser-m7-codex`, starting at `phaser-m7` commit `c9a4c31`.
The owner's changes through `phaser-m7` commit `851deab` are now merged.

## Current behavior

The owner found the earlier Codex changes only slightly better in Safari on a
MacBook Air M1. Their later `phaser-m7` tuning reduces per-frame travel much more
and is now the default on this branch:

- The far, middle and near background layers move at **0.06, 0.12 and 0.3** of
  camera speed. The previous Codex factors were 0.12, 0.32 and 0.56.
- Pane cameras use two consecutive exponential lags at **12/s**, solved exactly
  for each simulation step. The shared-screen rules camera retains one lag at
  **8/s**, preserving the rules for falling behind and respawning.
- Landscape cameras follow the liana's anchor plus **75% of the monkey's swing**.
  `SwingTarget` carries the target offset through releases and catches, then
  decays it, so changing between hanging and flight does not jump the target.
  Portrait cameras still follow the anchor.
- The canopy and floor textures receive the owner's **0.4-unit horizontal
  softening at build time**, wrapped across the repeating seam in sRGB. They
  still move with the world at factor 1. The art contract, guide and gallery
  comparison include this treatment.

The Codex-only scenery follower and 0.8 speed multiplier have been removed.
Every layer now uses the same interpolated pane camera with the owner's exact
factors; there is no extra scenery lag or additional speed reduction.

Phaser retains the repeated Images in translating containers introduced on
this branch. Copies share their textures and preserve fractional scrolling,
vertical edge-row cropping, tint, clipping and coverage during resize/shake.
`?engine=phaser&backdrop=tiles` selects the former TileSprite rendering path with
identical camera behavior and speeds.

The earlier nine-sample tree exposure experiment is **off by default** so the
normal picture uses the owner's tuning. `?engine=phaser&motionblur=on` enables
it for comparison: it averages travel across a frame, capped at eight device
pixels, and disables exposure for subpixel travel, stops and gaps over 50 ms.
This is distinct from the small build-time canopy/floor softening above.

The merge includes the owner's shared camera and Pixi pane updates as authored
on `phaser-m7`; no further Pixi behavior changes were added. The temporary
`camera`, `sway`, `parallax` and `shaders` switches removed on that branch remain
removed here. No URL parameters are needed for the integrated motion tuning.

## Earlier investigation

The frame readout supplied by the owner showed only five late frames in 3,482
(about 0.14%) and none in the last ten seconds, while the trees still looked
stepped. Callback timing alone does not measure GPU/display presentation.

With the original one-lag camera, a controlled 60 Hz catch changed its speed
from 534 to 617 to 697 world units/s even with perfectly regular input times
and no GPU drawing, score updates, audio or obstacles. At the old 0.4 mid-layer
factor on a 2× screen, that was 7.1 to 8.2 to 9.3 device pixels per frame.

The Codex 20% speed reduction, separate scenery follower and later moving-edge
exposure each received browser/unit validation but did not resolve the owner's
Safari symptom. They should not be treated as evidence of a completed fix.
The owner subsequently selected the substantially slower factors and reduced
camera sway now integrated here (see `PHASER_PLAN.md`, M7).

## Validation and reproduction

`scripts/dev/background-motion.mjs` exercises the real game, fixed-step driver
and Phaser pane with regular 60/90/144 Hz input, slipping off/on, through both
image and tile paths. It checks layer positions against the interpolated
camera, catch acceleration, uninterrupted swing travel and actual WebGL pixel
changes under fractional scrolling. The obsolete `camera=smooth` comparison
has been removed because two-lag easing is now the default.

```sh
npm run build
npm test
CHROMIUM=/usr/bin/chromium npm run test:browser -- --workers=1
# With the dev server running on port 5174:
CHROMIUM=/usr/bin/chromium URL=http://localhost:5174/ \
  node scripts/dev/background-motion.mjs
```

Browser tests cover the exact integrated parallax factors, shared-camera
interpolation, pause, resize and new-world alignment, plus image/tile pixel
parity across landscape, wide and portrait views, fractional/negative shifts,
wrap boundaries and day/night tint. The default shader test verifies that
normal gameplay uses only the standard image shader for the backdrop; the
optional exposure has separate pixel and shader-cache checks.

Validation of the integrated version:

- Build passed; all **674 unit tests** passed.
- All **46 browser cases** passed (45 in the full run; the new motion case
  passed on rerun after reducing its test camera increment below the existing
  30-unit teleport threshold).
- All **12 motion runs / 23,520 frames** passed, with zero repeated camera
  frames and identical camera trajectories through the image and tile paths.
- At 60 Hz and 2×, the uninterrupted swing's peak mid-tree travel is now
  **2.08 device pixels/frame**, versus 7.26 with the previous Codex tuning.
  The two 60 Hz bot runs peak at 2.34 and 2.54 pixels/frame.
- Both rendering paths change pixels on every tested 0.2-device-pixel tree
  movement. The probe now holds the layer increment constant: the old fixed
  camera increment moved these slower trees only 0.024 device pixels, sometimes
  too little to change the sampled 8-bit row despite fractional geometry.

These use controlled frame times in Chromium, without GPU drawing during the
motion runs. This workspace cannot verify perceived smoothness on Safari's
physical display.


## Remaining whole-scene stutter and device capture

The owner still reports both brief freezes/jumps (including on the title screen)
and continuous uneven movement during gameplay after the merge. Slower scenery
is not a completed fix for this symptom.

`scripts/dev/full-frame-motion.mjs` now exercises Phaser's actual TimeStep and
complete Game.step, including the existing driver listener, scene updates,
native Image render-node vertices and WebGL submission. In the 360-frame 60 Hz
title swing with rounded timestamps, there are no repeated submitted quads for
the mid trees, floor or monkey torso. Monkey interpolation error is zero and
liana-angle error is below 1.3e-15 radians. The stabilized simulation deltas span
16.659–16.684 ms in the latest run. This does not measure presentation on Safari's physical screen.

To capture an actual Safari incident, open the Phaser game with `?frames=1`,
reproduce the stutter, then press **Save frame trace** at the bottom right.
The local JSON file contains the last 1,800 actual Phaser frames (about 30 seconds
at 60 Hz), including:

- Callback gaps and callback delay; normalized simulation delta and interpolation.
- Time spent updating and submitting rendering commands, measured separately.
- Camera positions, unwrapped mid-tree positions, foreground positions and the
  monkey's simulated and drawn positions, plus liana angles and drawn rope tips.
- Gameplay events, pause/state/mode, canvas dimensions, browser and context settings.

The trace has no pixel reads, synchronous GPU queries or additional textures.
It is installed only for Phaser with `frames=1`, including the production build;
normal play and Pixi do not install it. It reports CPU submission and poses,
not completed GPU work or whether Safari presented a frame. The browser test
checks that an actual production frame recording downloads as valid JSON;
unit checks cover retaining late frames, ring-buffer order and excluding
expected paused/game-over/reset poses from the repeated-pose count.

Recorder validation: build passed, 19 focused unit tests passed, four production
browser checks passed, and the 360-frame full render-loop probe passed.


## Safari trace: callback-phase disturbance amplified by the clock

The owner's 1,800-frame Safari trace covers 30 seconds of gameplay and results
at a 2880 × 1646 canvas. It has two late callbacks, no repeated active poses,
and 99th-percentile CPU submission time of 3 ms. Camera and monkey position
interpolation match exactly; swinging-rope rotation matches within 1.3e-15.
This rules out missing position interpolation in the recorded frames, while
GPU completion and display presentation remain unmeasured.

Two temporary disturbances are amplified by the original frame clock:

| Recorded callback gaps (ms) | Original game steps (ms) | Phaser replacement (ms, rounded) |
| --- | --- | --- |
| 27 / 14 / 8 | 33.30 / 16.55 / 8 | 16.75 / 16.74 / 16.64 |
| 30 / 11 / 9 | 33.32 / 16.55 / 9 | 16.76 / 16.75 / 16.65 |

Each set of three callbacks spans about three normal refresh intervals. The
clock classified the longer gap as two refreshes, then passed the shortest
callback's raw delta through, producing double/half movement across the entire
scene. This is a reproducible contribution to the brief jumps, not proof of
the cause of all the owner's continuous uneven movement or title-screen freezes.

Phaser now supplies its own `PhaserFrameClock` to the shared driver. It keeps
one interval through short callback-phase disturbances, carries the actual time
balance, and repays it gradually (at most 0.1 ms per callback). Gaps close to
two or more whole refreshes still advance missed frames. Long stalls preserve
elapsed time; persistent cadence changes trigger relearning without reversing
time or applying the outstanding balance as a sudden jump. The Pixi driver
keeps its existing clock. Simulation still uses the same 120 Hz fixed steps,
and scenery speeds, camera tuning, collision rules and artwork are unchanged.

Replaying all 1,800 raw gaps with a warmed 60 Hz clock gives steps between
**16.64 and 16.77 ms** rather than 8–33.32 ms, and elapsed game time stays within
**3.3 ms** of the 30-second capture. The test fixtures contain only the two short
timing sequences; the owner's full trace and browser metadata are not committed.
The complete-render-loop probe now includes both sequences, and browser checks
exercise the real driver and renderer with them. New recordings identify the
clock and include its interval/time balance for follow-up analysis.


Clock-change validation: the full unit suite passed 682 tests; after the final
immediate-wake and monotonic-time guards, all 27 focused clock/driver/recorder
checks passed, including the added 30→240 Hz stall case. All 49 browser cases
passed (48 in the full run, then the disturbance regression after matching its
warmup to the captured session). The build passed. The vertex-level probe draws
600 warmup frames, then checks 360 frames including both disturbances: no repeated
mid/floor/monkey quads, zero monkey position interpolation error, rope error below
1.2e-15, and steady steps spanning 16.633–16.752 ms. These are submitted poses in
Chromium, not Safari display-presentation measurements.
