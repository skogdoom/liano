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
