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


## Floor shrubbery follow-up

The owner's next 1,800-frame Safari capture shows no late callbacks and no
repeated active poses. Game steps span 16.597–16.716 ms, with 99th-percentile CPU
work of 3 ms. Camera and monkey positions match interpolation exactly. The two
clock-induced double/half steps from the earlier trace are absent. Occasional
perceived stutter still cannot be attributed to GPU/display presentation from
these CPU/pose measurements alone.

The owner finds the overall motion substantially better and asks for gentler
floor shrubbery, like the ceiling. Both tiles already used a 0.4-unit horizontal
build-time Gaussian. The floor's narrower, darker foliage now uses **0.8 units**;
the canopy remains at 0.4. The trace shows foreground travel reaching about
14.37 CSS pixels per frame, so those thin edges remain much more conspicuous
than the slow trees. The softening wraps across the tile repeat, keeps vertical
placement intact, and adds no runtime shaders, textures or uploads. The floor
still moves with the world at factor 1; no movement timing or Pixi drawing changes
are made. The generated art contract and guide record the new floor treatment.


Whole-pane parity fixtures now match the softened floor artwork in their Pixi
reference, so intentional Phaser-only blur is not treated as a placement or
layering regression. The actual Pixi floor stays sharp. The art gallery still
independently validates the softened PNG against the procedural drawing plus
its declared Gaussian; background pixel checks verify repeat/crop/tint and
image/tile equivalence. No global parity tolerance is changed.

Floor-follow-up validation: build passed; all 32 focused art/import unit checks
passed; gallery, three image/tile comparisons (landscape/wide/portrait), and
whole-pane comparisons at 1×/2× passed.

## Startup preparation and obstacle motion

Phaser now renders the 15 finite sound recipes into mono AudioBuffers during
loading, before accepting gameplay presses. Their sample rate is the live output's;
the live master gain/compressor still mixes simultaneous sounds. Playback uses
one source and gain per sound rather than constructing its oscillators, envelopes
and filters at an event. Mute, pause, gesture unlock and context recovery retain
their existing behavior. Buffers can be reused after a context replacement, and
Web Audio resamples them if the replacement's output rate differs. Offline
rendering failure falls back to synthesis; missing Web Audio does not block loading.
The buffers plus the shared noise occupy about 3.4 MB at 48 kHz.

The fixed art was already loaded and uploaded before gameplay. Preparation now
also exercises 37 obstacle builder paths (including supports, decorations and
temple looks), prepares collection-popup text, and rasterizes the finite HUD
digits/words into small glyph atlases. Score, tally and heart-count updates only
change frames and transforms, avoiding Canvas rasterization and texture uploads.
Quarter-pixel raster phases preserve proportional font spacing at low resolutions.
Old glyph resolutions are released on resize; the current layout's mode variants
stay prepared. Heart icons and collection popups are reused. Generated obstacle
instances are still constructed as the world generates them: warming removes
first-use code work, not every future allocation. Stage/result/debug text remains
ordinary Phaser Text.

The motion investigation found genuine interpolation gaps. Moving obstacles used
their current simulation position/time, while the camera and monkey position were
already interpolated. Settling vines likewise used current-step angle and bend
velocity, and monkey tilt used current-step swing/flight velocity. Phaser now
captures adjacent samples after every simulation step and draws all those
quantities at the frame's alpha. Obstacle/decorative animation and banana bobbing
share that drawing time. Spider threads follow the drawn body. Captures hold on
pause, reset with the world, and honor catches that reset the previous angle.
Drawing never changes collision state. Pixi drawing remains unchanged.

Static temples already moved with the interpolated world camera. Their stone's
fine repeated edges now receive mild baked horizontal Gaussian softening (sigma
0.2 world units), with small horizontal margins on repeating pieces. It adds no
runtime filter, extra GPU pass, camera delay or collision displacement. Sprite
softening clips to its own frame, while tile softening retains its wrapping rule.
The existing strict parity limits remain unchanged; the stronger 0.35 trial was
reduced because it changed stone details beyond those limits. Atlas/tiles still
fit the art budgets: 106 MB at 2×, 254 MB at 4×.

Validation: native Phaser update/render/quad submission at 60, 90 and 144 Hz
(150 frames each) produced zero repeated temple, spider or monkey quads, zero
moving-body position error, and zero settling-rope geometry error. Cached audio
matches live synthesis, including overlapping sounds at 44.1/48 kHz, within
1e-6 per sample. The HUD upload check includes score, tally, life and resize changes;
normal updates perform zero text rasterizations or uploads. All HUD and whole-pane
comparisons retain the existing visual limits. These checks measure submitted
geometry and audio, not Safari's physical presentation of frames.

`?frames=1` now also records each nearby obstacle's simulated, drawn and screen
positions, interpolated drawing time, monkey body rotation, and preparation counts.
No recorder runs in ordinary play.

If gameplay still stutters, investigate these in order:

1. **Safari GPU/compositor presentation timing.** Brief freezes affecting the whole
   scene can happen after JavaScript submits a correct frame. The last Safari
   capture had no late callbacks, no repeated active poses and CPU work at most
   6 ms; it did not measure GPU completion or presentation. A Safari graphics
   timeline and a display recording would distinguish this from update stalls.
2. **Temporal aliasing at 60 Hz.** Fast, sharp world geometry is sampled only once
   per refresh. The previous trace showed foreground travel up to 14.37 CSS pixels
   per frame; large temples travel with that same camera. Interpolation does not
   add display frames. The new stone softening reduces edge contrast, but a short
   motion exposure or less overall screen travel would address this more strongly.
3. **Catch/release pose transitions.** A catch deliberately snaps the grip and
   resets the liana's swing; release changes the monkey's pose/facing. Those changes
   can still appear as small jumps even with interpolated continuous motion. The
   expanded trace can correlate a visible jump with a grab and its actor/camera
   positions before changing any gameplay behavior.

## Optional obstacle motion exposure experiment

Use `?obstacleblur=on` on the Phaser game URL. **B**, or the bottom-right
**Obstacle blur: ON/OFF** button, toggles it during the same run without changing
the seed or restarting. For a recording, use `?obstacleblur=on&frames=1`.
Ordinary play creates no exposure nodes or history. This is separate from the
older `motionblur=on` backdrop experiment.

The experiment samples moving obstacle images over a short, centered exposure:
half their travel since the last submitted frame, capped at **3 CSS pixels**
(full width, not radius). Five equally weighted samples cover that interval.
Motion is measured from the native transformed image center, so both camera
travel and an obstacle's own movement contribute, including vertical/diagonal
travel. It does not delay the current pose or change simulation/collision state.
New images, resets, resizes, flips, missed rendering frames, pauses, large jumps
and stalls discard the previous movement sample. A stationary frame uses the
exact native texture sampling path.

This first experiment affects the Image parts of all obstacle kinds: temple
stone, moss/leaves, haze and flames, and the bodies/supports/decorations of other
obstacles. Temple additive glow discs retain their normal sampling: they are
already soft and sampling all 32 again costs work with negligible edge benefit.
Rope strips, monkeys, lianas, backdrops and UI retain their existing rendering.
Exposure currently approximates each image as translating its current shape;
it does not integrate a rotating/deforming shape or its previous flipbook frame.
Alpha compositing between separately blurred parts is likewise an approximation
to exposure of the complete rig.

The shader uses one GPU pass and the existing one-texture quad batching. Motion
and original frame boundaries are extra vertex attributes, so pieces with
different velocities still batch together. Expanded quads preserve blurred
silhouettes; sampling respects cropped frame boundaries, reversed canvas UVs,
tint and premultiplied alpha, without wrapping into neighbouring atlas art.
There are no full-screen buffers, duplicate art textures, pixel reads or GPU
waits in gameplay. The shader is requested during pane preparation, not at an
obstacle's first appearance. The custom quad writer follows Phaser 4.2.1's native
batch protocol and tint packing, with a thirteen-word vertex layout.

Validation compares actual WebGL pixels with five separately translated native
poses at 1×/2×, including rotated, anisotropically scaled and cropped artwork.
Mean channel error is below 0.02/255 and maximum error at most 3/255 (8-bit
rounding/filtering); stationary output is bit-for-bit equal, and an adjacent
magenta atlas frame produces no bleed. Sixty-four distinct image velocities use
one draw call, with no texture uploads or framebuffer creation during motion and
one shader program. Native whole-game rendering at 60/90/144 Hz has no repeated
temple/spider/monkey quads and retains the current image centers within 0.000062
device pixels, with exact obstacle interpolation and settling-rope geometry.

`scripts/dev/obstacle-blur-bench.mjs` compares a moving basalt temple at 1280×720
in Chromium's SwiftShader. A controlled 24-frame sample per mode, run without
other browser workloads, used 15 draw calls in both modes. Median CPU submission
was 0.8 ms native / 0.9 ms exposed; rendering plus full-frame readback was
89.0 / 92.7 ms (about 4% more). These absolute times include software rendering
and readback and are not a Safari frame-time prediction. The script alone reads
pixels to wait for completed drawing; the game does not. Safari's hardware GPU
cost and perceived smoothness still need the on/off comparison.

The optional frame trace records whether exposure is enabled, its maximum
observed CSS width, and the number of moving obstacle images each frame. This
helps distinguish an ineffective experiment from extra submission/display delays.

### Safari on/off result (2026-10-14)

The MacBook Air M1 Safari test felt worse with obstacle exposure enabled. Treat
this experiment as unsuccessful on that device; ordinary play already keeps it
off. Use `?engine=phaser&obstacleblur=off` (or omit `obstacleblur`) for the native
rendering path. Toggling B off within an opt-in run disables exposure but retains
the custom rendering nodes, so that is not the complete native baseline.

Both submitted traces contain 1,800 callbacks, about 30 seconds, at the same
2880×1646 canvas size, DPR 2 and camera zoom 2.25. The blur flag was on throughout
the first capture; the second used the native path. Comparing only live,
unpaused gameplay:

| Measurement | Blur on | Blur off |
| --- | ---: | ---: |
| Active frames | 1,577 | 1,574 |
| Callback interval, 99th percentile | 19 ms | 18 ms |
| Callback intervals above 20 ms | 8 | 3 |
| CPU work, 99th percentile | 3 ms | 3 ms |
| Render submission, 99th percentile | 2 ms | 2 ms |
| Largest callback interval | 28 ms | 78 ms |
| Repeated active camera/monkey poses | 0 | 0 |

These are different runs: the on trace contains nearby temples and 223 paused
frames, while the off trace contains no nearby temples and ends with 226 results
frames. Consequently, the increased callback variation cannot be attributed
solely to the shader. Neither capture measures GPU completion or displayed
frames. The visual regression is sufficient to reject the effect on this device,
but it does not prove a GPU bottleneck. The earlier software-renderer benchmark
does not override the Safari result.

Exposure processes a median of 109 moving obstacle images per active frame,
peaking at 267. Its maximum width reaches the 3 CSS pixel cap, while camera travel
has a 95th percentile of about 14 CSS pixels per active frame in both recordings.
Thus it adds sampling work while covering only a small part of the movement;
increasing its width or sample count is not justified by this result.

The submitted motion also exposes two separate discontinuities:

- Every monkey screen-position jump above 15 CSS pixels occurs on a grab:
  21 in the on trace and 22 in the off trace, with maximum jumps of 28.34 and
  36.31 CSS pixels respectively. These are pose/grip transitions, not repeated
  submitted frames. A future drawing-only catch transition should preserve the
  simulation's collision and grip behavior.
- In the on trace, a 28/10/8 ms callback sequence produces 28.1/10.1/8.1 ms
  drawing-clock advances instead of approximately equal steps. The clock's debt
  guard can fall back to raw timing during this disturbance. At that point camera
  travel is 20.10/7.21/5.77 CSS pixels. Interpolation accurately follows those
  uneven advances; it cannot make them uniform. This warrants investigating the
  cadence-change fallback with the surrounding timing history, rather than
  increasing the exposure or changing gameplay speed.

## Optional Phaser rendering-resolution experiment

Use `?engine=phaser&resolution=1.5&frames=1` to cap rendering at 1.5 device pixels
per CSS pixel. Compare with `?engine=phaser&frames=1` for the ordinary cap of 2.
`resolution=1` provides a stronger reduction if needed. Keep obstacle blur off
for this comparison. Reload to change the cap; this avoids texture regeneration
or resizing during a measured swing. Values from 1 through 2 are accepted;
missing, invalid and out-of-range values retain the ordinary cap. Lower-density
screens are never upscaled to meet the cap. Pixi does not read this option.

The CSS canvas size, world layout, camera's position in world units, simulation,
controls and movement speed use their existing rules. Only canvas pixel density
and its corresponding camera/text rendering scale change. On the tested 1440×823
CSS viewport at DPR 2, the canvas changes from 2880×1646 to 2160×1235: about 44%
fewer pixels. Edges and text may look softer. Density changes and window resizing
continue to respect the selected cap.

The art loader uses its existing atlas-scale selection at the reduced camera
zoom, so this experiment can also reduce texture size/memory when it crosses an
atlas-scale threshold. It therefore tests a reduction in overall rendering load,
not solely pixel fill rate. Frame captures now include `info.resolutionLimit`,
`info.artScale` and each frame's `renderPixelRatio`, alongside the existing canvas
dimensions. These identify the actual resolution used rather than inferring it
from the browser's device pixel ratio. They still do not measure GPU completion
or physical presentation; Safari smoothness needs the device comparison.
