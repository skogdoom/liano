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
