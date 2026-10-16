# M8a final artwork review candidates

The temple-mist follow-up refreshes all nine temple scenes and the montage.
Independent atlas borders remove the gray horizontal edge without hiding the
mist or increasing texture memory. The neck-edge correction below is included.

The minor neck-edge follow-up refreshes both climbing-snake fixtures and both
motion clips: the connector is now concealed behind the rear arc as well as the
front band, removing the flat wedge beside the cheek.

The drawing-defect pass refreshes the player/ghost tail attachments, climbing
snake leaf/neck overlap and sandstone doorway. Inspect the Characters, Motion,
World and Temples tabs. Both motion clips and the affected runtime captures are
updated. Later monkey, flying-creature and branch-decoration passes below address the
remaining review-note groups. These captures remain review candidates.

These are captures of `phaser-sprites` at `3f72b69`, not approved baselines.
Open `/art-review.html` through `npm run dev` (or `npm run dev:host` on a phone).
The page also links to the live rigs and atlas comparison for subsequent edits.

The HTML, stylesheet and script are in the repository root and `src/art/`;
review-only media stays here and is excluded from the production game build.
Images are lossless WebP exports of native Phaser captures. Existing concept and
runtime reference PNGs are reused directly. Motion clips show the actual rigs.
`captures.json` records the fixture inventory and eight flagged comparisons.

Use the tabs, image zoom, video controls and per-section notes. Notes stay in the
browser; use **Download review notes** to export them. No acceptance is recorded
automatically. Safari device/performance acceptance remains a separate task.

The climbing-snake wrap follow-up refreshes both snake fixtures and both motion
clips. Other captures remain from the original snapshot; none are approved.

The day/night flying scenes are refreshed after matching the rig gallery to
gameplay single-texture batching. The gray bat stays intact at both 1× and 2×.

The branch-decoration/contrast pass on `18c2fd7` refreshes six branch fixtures.
The Decorations tab adds enlarged day/night native sheets with all three nest
states, panther and hanging-bat branch contact, and coconut/flower/snake contrast.
The snake is deliberately placed over the branch-tip leaves for inspection.
The existing 33 atlas comparison flags remain; none involve these decorations.
Source/inventory validation, 21 focused tests, production build and nine browser
checks pass. The attached capture metadata records the current metrics.

The six-stone/copper-snake follow-up on `d46c813` replaces the 24 similar
cartoon outlines with six painted designs. Inspect the Obstacles tab's standing
and hanging sheets and the refreshed jungle rock scenes. The Decorations tab
now shows copper perched snakes against green leaves by day/night. There are
34 current source/atlas flags (1.40% aggregate), including the new head's
sampling difference. The full 767-test run, 47 focused checks after the palette
change, production/source/inventory checks and 11 browser checks pass.

The hanging-stone follow-up on `21f94a1` hides the green side sling in the
cartoon pack. The hanging stone sheet and jungle rock fixtures are refreshed;
all six top-vine endpoints remain attached. Seventeen focused tests, source/
inventory validation, production build and three browser checks pass.

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
