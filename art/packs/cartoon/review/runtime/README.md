# Runtime review candidates

The temple-mist follow-up removes the faint horizontal seam by giving atlas
sprites independent one-pixel extrusion margins. Previously the stone sprite
above the mist painted into its transparent top gutter. All temple variants and
the montage are refreshed; the mist effect remains visible. Atlas positions and
texture memory are unchanged. Forty-one focused tests and 11 browser checks
pass, including transparent mist gutters at every scale and classic references.

The neck-edge follow-up puts the climbing snake's connector behind both coil
layers, removing the small wedge beside the upper cheek. Both snake fixtures
and both review motion clips are refreshed. Five snake-pose tests, the build
and native wrap/position checks pass; turn timing and classic drawing are unchanged.

The drawing-defect follow-up registers player/ghost tail sockets inside the rear
hip, keeps climbing-vine leaves behind both coil layers, shortens the upper snake
neck into the cheek, and removes the sandstone doorway motif. The 18-pose monkey
sheet, player/ghost fixtures, both climbing-snake fixtures, day/night scenes and
sandstone temple are refreshed. The final review also refreshes all five lighting
stages, affected scene images and both motion clips. Sixteen focused unit checks,
three gallery/rig/classic-reference browser checks, source checks and the build
pass. The same eight comparison flags remain; these images are still candidates.

These images show the first complete cartoon pack through the real Phaser rigs.
They are **review candidates**, not owner-approved regression baselines. The
classic references under `browser-tests/references/` are unchanged.

The files cover both monkey palettes and poses at 2×, high/low branches at two
stage scales, day/night scenes, temple fire at dusk, the title, and Config in
portrait/landscape. Scene/rig fixtures use fixed states and seeds; title and Config
captures show the real game. `rigs.html?art=cartoon` can regenerate the fixed
fixtures for inspection. The capture renderer is Chromium/SwiftShader, not Safari.

Day/night/temple and menu captures include the readability follow-up: muted
distant scenery, outlined green vines with a consistent highlight, and varied
background tree shapes and colors. The rebuilt pack retains its texture sizes;
source/contract checks, nine focused unit tests and nine pack browser checks pass.

Approve the artwork before promoting selected fixed fixtures to automated cartoon
references. Eight raw source/atlas edge comparisons remain recorded in
`PHASER_PLAN.md`; no comparison threshold has been changed to hide them.

The snake, shadow and button fixtures show the transparency/legibility repairs at
native 2×: clean snake silhouettes, the more visible ghost monkey, and separate
speaker/waves in both sound states.

The obstacle/flying day/night scenes and the spider, rock, bird and bat fixtures
show the visibility pass against both the real jungle and a flat inspection
background. Larger native sprites use 2× fixtures; whole scenes stay at game size.

The latest branch fixtures show single-strand snake wraps fitted to the painted
wood and raised coconut attachments. Bananas (including HUD/results), beehives
and blue birds show the outline/color/support corrections. Whole scenes now
include the sparser waterfall pair and higher-contrast hanging support vines.
Validation for this pass: 14 focused unit checks and ten browser checks including
the unchanged classic reference fixtures.

The latest monkey poses register the painted shoulders, palms and hips directly
to the player's rig. The hanging monkey now uses joined russet painted arms,
torso and curled tail, with its hands at the branch and articulated painted
legs/feet. The two
climbing-snake fixtures show rounded coils, a tapered tail and an upright head
that leads continuously through changes of climbing direction. These are still
review candidates; 22 focused unit checks cover the registration, snake pose and
existing pack/decoration contracts. Ten browser checks pass, including the
unchanged classic reference fixtures; the production build and source checks pass.

The player and shadow monkey pose captures also show the cartoon face/eyes drawn
in front of the gripping arm. Classic keeps its existing layer order.

The temple day/dusk/night and variant captures show holders aligned to their
flames and painted foliage with complete roof silhouettes. Bat poses show the
painted scalloped membrane rotating at the shoulder through down/up strokes;
`bats-flap-cycle.png` shows nine samples for each palette through the native
Phaser image renderer at 2.5×. The climbing snake now retracts and briefly conceals its head/neck at reversals,
then emerges at the opposite end with its face upright. It no longer draws the
face moving across the front of the coils.

The attachment/light follow-up places bat wings over the near shoulder, hangs
the monkey from behind the wood with fingers over its top, and roots the legs
at the actual painted hip sockets. Temple lighting close-ups compare day, dusk
and night: the light is applied once, with a faint daylight warmth and stronger
night light. The phase and classic reference behavior remain unchanged.

The joint-layer follow-up places both cartoon arms and legs behind the torso,
with the face/eyes foremost. Fur replaces exposed cut joint caps on the torso,
arms and legs for both players, the shadow and the hanging decoration. The native
`monkey-joints.png` candidate covers 18 hanging/swinging/flying/catching/fallen
poses across both player palettes and the ghost. Classic layering and physics
are unchanged.

`hanging-monkey-eyes.png` shows open/shut eyes in both facing directions through
the native Phaser rig using 4× atlas art. The eye overlay shares the head
transform and its painted eye landmarks; pupils sit in the original whites,
and the blink covers those whites. The 2× hanging branch fixture is refreshed.
This correction passes 18 focused unit checks and three browser checks (pack
gallery, monkey poses, unchanged classic references). The existing eight gallery
flags remain unchanged.

The concealed snake-turn follow-up uses the interpolated drawing phase, with
the same 240 ms retreat/return across climbing periods. The level switch occurs
inside a fully hidden 60 ms interval. Focused unit checks cover hidden
repositioning, period/phase-independent timing, neck attachment and existing
contracts; two browser checks pass, including unchanged classic references.

`rocks-platforms.png` inspects all 24 standing rock outlines seated on their
platforms through the native rig. Their small vertical offsets come from the
painted outlines and ledge curve; already-seated and hanging stones stay put. Upper vines now reach into the
painted top edge of every suspended rock instead of stopping at the collision
outline. All 24 endpoints are checked through the native rig.
The standard high/low rock fixture is refreshed. Classic references and
collision shapes are unchanged.

The hanging monkey uses a brighter copper-red palette across its arms, torso,
tail, legs and blink skin. Player palettes are unchanged; the brighter color
keeps the decoration distinct while making it easier to see.

The current menu defaults are Shadow Off and Classic graphics Off (cartoon),
as requested by the owner. Saved graphics choices and explicit URL overrides
still apply. Twenty-seven focused unit checks pass; all 17 art/menu/reference
browser checks pass across the full run and the mobile title-art assertion
update. Three gallery/pose/classic-reference checks also pass after brightening
the hanging monkey. No comparison threshold was relaxed.

The day/night scenes and `floor-blend-day.png` show the frond roots fading into
a matching dark floor fill, replacing the hard teal boundary. The final review
artifact contains fresh fixed rigs, all five lighting stages, current menus,
motion clips and the eight flagged built/source comparisons. These remain review
candidates. The pause/floor follow-up passes 71 unit files / 760 tests and three
browser checks, including unchanged classic references.

The climbing-snake wrap follow-up refreshes both moving-snake fixtures. The
upper arc and middle return now pass behind the green stalk, with both belly
bands and tail in front. Crops share exact atlas-pixel boundaries, and the rear
layer follows the same interpolated position and scale as the front. Both motion
clips in `/art-review.html` also include the wrap. These remain review candidates.

The day/night flying scenes use the same single-texture batching as gameplay.
The gallery now sets this before renderer boot; multi-texture sampling could
drop rectangular fragments of the gray bat at 1×. Both scenes are refreshed and
inspected at 1×/2×; gameplay already uses single-texture batches.

Branch-decoration/contrast follow-up on `18c2fd7`: coconuts, perched snakes and
hanging bats are refreshed here. All six changed decoration fixtures and the
new day/night inspection sheets are in `../final/media/` and the Decorations tab
of `/art-review.html`. Nests have visible empty/egg/hatched states; panthers sit
closer to the branch and bat feet meet its painted underside. Darker edges and
highlights separate coconuts, flowers and branch snakes from foliage.

The six-stone/copper-snake follow-up on `d46c813` replaces the 24 similar
cartoon outlines with six painted designs. Inspect the Obstacles tab's standing
and hanging sheets and the refreshed jungle rock scenes. The Decorations tab
now shows copper perched snakes against green leaves by day/night. There are
34 current source/atlas flags (1.40% aggregate), including the new head's
sampling difference. The full 767-test run, 47 focused checks after the palette
change, production/source/inventory checks and 11 browser checks pass.

Painted-support follow-up on `21f94a1`: stone/thorn-bush shelves and the hive
crossbar now use painted wood; all three pillar types use a plain bark shaft.
Horizontal branches have 2× raster density. All 13 affected branch/obstacle
review fixtures use 2× captures for close inspection; ahead/night world views
and standing/hanging stone sheets are refreshed. Source/inventory checks,
production build, 47 focused tests and four browser checks pass. The current
gallery has 36 flags (1.43% aggregate), including two shelf sampling
comparisons; these remain review candidates with unchanged thresholds.

Branch-join/hive-tie follow-up on `c4d8c33`: low cartoon branches emerge
from behind the pole without a sawn end; hanging and classic branches retain
their existing ends. Hive ties now emerge below their crossbars. The affected
branch, decoration and hive fixtures use refreshed 2× captures; final review
world views are refreshed too. These remain review candidates.

Perched-snake follow-up on `5d82498`: replaced the broad leaf-like tail with a
slender curved painted tail; foliage stays green. The coils and neck share its
orange/cream palette, and the neck joins inside the rear of the head with its
root behind the final coil. The snake fixture, day/night decoration context and
a six-pose limb/pole sheet are refreshed in the final review. The same 36 source
comparisons remain flagged (1.44% aggregate); acceptance is pending.

Branch-pole detail follow-up on `a3e97f2`: standing branch poles have sparse,
seeded leaf sprigs, short vines and cut branch ends, reusing painted pieces.
Platform/hive supports remain plain. Branch/decorations fixtures and world views
are refreshed; the final World tab includes eight variations at two obstacle
scales. Atlas frames and source-comparison flags are unchanged.

Natural-pole/snake follow-up on `017b24a`: longer 45° stubs, finer leafy
creepers at the pole edge, shared painted skin for snake coils/neck, a tucked
tail and mouth-registered tongue. Snake-bearing poles reserve clear space around
the full snake envelope. Refreshed fixtures and context sheets accompany an
eight-pole snake-clearance sheet. Native checks cover 768 poses across 64 seeds
and two obstacle scales; 19 focused tests and three browser checks pass. The
same 36 source-comparison flags remain visible (1.45% aggregate).

Snake-continuity/seating follow-up on `0ac207d`: reversed painted head with a
continuous cubic neck underside, fuller tangent-aligned hook tail, tapered stub
bases and shorter visible left-side stubs. All six standing rocks sit two world
pixels deeper into the shelf. Updated snake, pole, rock and world previews cover
the new placement; hanging rocks stay put. Validation includes 19 focused tests,
four browser checks, 160 support checks and 768 snake-clearance poses. The same
36 source-comparison flags remain visible (1.46% aggregate).

Tapered-wrap/neck-emergence follow-up on `f8bfa51`: The final coil tapers from body width into a short painted tail that stays visible and follows the wood closely. Pole wraps fit the painted shaft. The neck crosses behind the wood and emerges just beyond the headward coil (slightly higher on poles). The pole neck/head sit lower for a compact rise; horizontal heads have a gentler angle, and tongues follow the mouth.
Snake front/rear bounds stay clear of pole details across 768 checked poses.
Review fixtures, pose sheets, decoration context and world views are refreshed.

Branch-fit/green-palette follow-up on `f46adeb`: Branch neck roots extend into the painted bark, front branch wraps sit two world units lower, and pole heads sit 1.5 units lower over the neck end. Tail tips have a slightly longer, more open curve. A green palette shares all copper geometry and animation, preserving pale details, gold eyes, tongue color and alpha; colors alternate by branch gap independently of pose/gameplay randomness.
Copper placement and the green palette were accepted by the owner. Validation: 19
focused tests, four browser checks and 768 native clearance poses. The updated
2× gallery has 37 flags (1.46% aggregate); thresholds remain unchanged.

Accepted eye/pole-stub follow-up on `dc446a0`: Hanging-bat eyes are smaller in all four palettes. Panther eyes follow the painted sockets with perspective sizing, and the legacy ear overlay is hidden to remove the gray forehead oval. Cut branch stubs point 45° upward on both sides; later seeded pole decoration choices retain their positions.
Source/inventory checks and the production build pass, along with unchanged classic references, 80 native support/angle checks and 768 snake-clearance poses. The updated review page and affected fixture/context/world images cover the accepted changes. The same 37 gallery flags remain (1.46% aggregate), with unchanged thresholds.

Accepted panther-tail/bat-ear follow-up on `eae56af`: The panther has a painted fur-and-spots tail matched to its body, attached behind the rear haunch with a fixed root and shared breathing transform. Its sixteen-frame sway retains a covered join and clear atlas edges. The legacy hanging-bat ear overlay is hidden in all four palettes, removing the triangular artifact.
Source/inventory checks and the production build pass, plus unchanged classic references. All 16 tail frames retain an opaque attachment point inside the haunch and clear frame edges; native previews cover both panther directions and all four bat palettes. The review gallery has 37 flags (1.52% aggregate), with unchanged thresholds. Owner accepted both changes.

Accepted spider follow-up on `10c9b68`: The spider has brighter lavender fur and two larger, separated yellow eyes with small pupils. Its eight legs use 24 complete antialiased poses, replacing separately rotated narrow strips that appeared jagged at game size. Classic rendering, movement and collision shapes are unchanged.
Source/inventory checks, production build, 16 focused tests and unchanged classic browser references pass. All 24 poses retain eight distinct, unclipped legs. Native review covers both spider fixtures at 1×/2×, day/night gameplay scenes and an animated game-size/close-up board. Cartoon coverage is 182 pieces/608 frames including the title; texture memory is 115 MB at 2× and 293 MB at 4×, within unchanged limits. The gallery retains 37 flags (1.53% aggregate), with unchanged thresholds. Owner accepted the final animated day/night preview. The Motion tab includes the accepted spider animation and still, with refreshed gameplay/fixture captures.
