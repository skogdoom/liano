# Runtime review candidates

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
