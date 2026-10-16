# Cartoon pack · M8a

The owner approved continuing from the corrected style sample. The direction is a
cohesive painted cartoon jungle, based on `docs/cover_day.png` and
`docs/cover_night.png`. Those covers are references, not cropped runtime sprites.

## Play and review

Run `npm run dev` and open `/?art=cartoon`, or use **Classic graphics: Off** in
the title Config menu. On desktop, C opens Config and X switches art. Click/tap
works too. On means classic; Off means cartoon. Cartoon is the default when there
is no valid saved choice. Art changes reload to the title and preserve mode,
lives, slipping, shadow, mute, quality, other URL options and the hash. Mobile
remains 1P only. Explicit `?art=classic|cartoon` overrides storage without rewriting
it; invalid explicit/saved values resolve to cartoon. Blocked storage uses the URL.

- `/cartoon.html`: original style samples, anatomy close-ups and coverage.
- `/art.html?art=cartoon`: production frames, source/atlas differences, origin,
  attachments, hitboxes, slices, animation sliders and repeat seams. Choose 1×/2×/4×.
- `/rigs.html?art=cartoon`: fixed assembled poses, all obstacle families, day/night
  scenes, temples and UI, rendered by the real game rigs. Add `only=world.monkeys`
  or another fixture ID to inspect one; `zoom=2` renders at 2× rather than enlarging
  a low-resolution screenshot. The gallery uses gameplay’s single-texture batching
  from renderer boot, avoiding missing fragments in small rotated sprites.

The full sheet remains an art-direction illustration, not a production atlas.
Its missing arm, unnatural grip and truncated ring finger were corrected during
style review. The production monkey uses separate components and the existing
continuous pose/joint calculations. Source/atlas comparisons expose browser/resvg
sampling differences in painted edges; keep the flags visible for art review.

## Sources and exports

`masters/` contains painted PNG component masters: the original monkey sheet,
separate fur-covered torso/arm/leg masters, a slim curled tail and a dedicated
smiling hanging-monkey head,
creatures, foliage/wood, the distant jungle, a level branch aligned with its
collision guide, cleaned snake components without the original faint matte,
a lighter plum spider body with clearer contour highlights, highlighted
birds/bats with clean transparency, a separate large/small waterfall pair,
refined climbing-snake coils with a short tapered tail, a scalloped bat wing,
a feathered flight wing and a wingless flying-parrot body.
They were generated for this pack
in the approved style. `source-layout.json` names each component's crop in source
pixels. `components/` contains deterministic, tightly trimmed PNG exports from
those crops, preserving their alpha. No manual changes to generated exports are
needed. Optional `maxWidth` limits a trimmed component export before embedding it
in flipbooks; the wing uses 400 pixels, above its largest runtime size, to avoid
embedding the full master in all 164 frames. The floor tile fades the foreground
frond roots into the same dark shadow color as `backdrop.floorFill`, keeping the
join continuous in tall views without runtime filters. Keep source cell bounds inside each
master's actual PNG dimensions.

Monkey torso/arm/leg `landmarks` are normalized coordinates in the **trimmed
component**, not in the whole master. They register shoulders, palms and hips to
the unchanged rig anchors and limb lengths (`src/art/registration.js`). Recheck
them when replacing a master; fitting a limb's whole bounding box does not align
its visible shoulder or gripping palm with its pivot.
The player and ghost tails register their painted `root` to the torso's
`tailRoot` landmark in the rear hip. The curl retains its size, while the fur
covers the cut socket through mirrored swings, flight and falls.
The hanging decoration reuses those landmarks to connect its painted shoulders
to its raised arms and place both palms at the branch. The head's `eyeBack`/`eyeFront`
landmarks locate the hanging monkey's pupils in the existing painted whites.
The head and open/shut eye frames share one transform; the blink covers the
painted whites with eyelids rather than leaving white eyes under a loose line.
`presentation.monkeyLimbsBehindBody` draws both arms and legs behind the torso,
with the head and eyes foremost. The torso covers the turning limb roots in both
player palettes and the shadow; fur replaces exposed skin-colored joint caps in
the painted torso/arm/leg masters. The hanging decoration shares those repaired
components and already draws its torso/face over the limb roots. Classic retains
its original layer order. The replacement component exports retain their previous
pixel widths; do not embed the full-resolution masters in production frames.

`scripts/cartoon-sources.mjs` produces all **607 required frames** plus the new
`ui.wordmark`: **182 pieces / 608 frames**. It combines painted components with
editable vector recipes for bent strips, repeatable stone courses, feather/membrane
animation, small props and UI. Variants share the same pivots and scale; bird/bat
wings and fire use the original frame ordering. Player 2 has a distinct ginger
palette; the shadow monkey is grey at 56% opacity for readability, while its vines
retain 36%. This explicit cartoon-only alpha policy is shared by source exports,
inventory and validation (`src/art/packs.js`); classic remains at 36%.
No classic drawing is read or
used as a fallback. The classic manifest supplies only rendering/hitbox contracts.

`presentation.standingBranchJoin.details` adds sparse, static pole decorations
only to standing branches. `branchPole.js` reuses existing painted leaves, vine
strips and cropped branch ends, with a separate per-gap random stream. Longer
stubs tilt exactly 45° upward on both sides, have a slightly wider base, and tuck 2.5 world
pixels farther behind the pole on the left. A static trapezoid samples the
painted frame from its actual atlas page. Fine creepers trail along the pole edge, with
leaves attached along the stem and roots hidden behind the shaft. Snake rigs
provide `poleClearance`; details leave room above it for their own upward reach.
Platform and hive shafts remain plain. No new atlas frames or gameplay shapes
are added.

Hanging-bat eye overlays retain their 70% scale and register to `eyeLeft` and
`eyeRight` landmarks in the trimmed painted body. Each palette maps those
landmarks through its own body box: brown's box is one unit taller, so reusing the
other variants' eye placement left dark crescents below the whites.
`hangingBatEyeOffsets` keeps the registered, tilted whites inside the unchanged
eye-frame box and places them over the painted sockets in the rig.

Panther eyes follow `eyeNear` and
`eyeFar` landmarks on the trimmed painted body, with a narrower far eye and a
sloped near socket. `presentation.pantherEyeOffset` places the exported eyes
without changing the classic frame contract. `pantherPaintedEars` hides the
legacy animated ear patch because the painted body already includes both ears.
`hangingBatPaintedEars` similarly hides the legacy triangular ear overlay on all
four hanging-bat palettes; their painted ears are already part of the body.

The panther has a separate painted charcoal-fur tail master with matching spots
and soft highlights. Its `root`/`rootTop`/`rootBottom` landmarks set a uniform
export scale with a root diameter capped at 4.5 world units. The body's `tailRoot`
registers it at the rear haunch (−29, −6), hidden beneath the body in all sixteen
frames. A gentle ±4.2° sway pivots around that fixed root. With
`pantherPaintedTail`, tail and body share the breathing transform while the body
covers the join; classic keeps its original tail and layer/animation behavior.
The component export is capped at 320 pixels wide; the full master stays out of
production atlas cells.


The owl uses painted body, head and facial-disc components with layered warm
brown feathers, a cream patterned belly, folded wings and feet resting on the
branch. A separate painted amber beak has a rounded upper bill, shaded lower
mandible and short hooked tip. Component exports are capped at 300/288/240
pixels for body/head/disc and 96 for the beak. Existing pupil, blink, head-turn
and breathing animation stays articulated; `owlFaceTravel` limits the facial
disc's sideways motion to 35% so it remains within the feathered head. Classic
retains its original artwork and face travel; placement and collision contracts
are unchanged.

The spider's brighter lavender body has two widely separated, enlarged yellow
eyes with small pupils. `spiderLegPoses` selects a cartoon-only `spider.legs`
flipbook of 24 complete eight-leg poses behind that body. Rasterizing the whole
outline at each atlas density preserves native 1× antialiasing, replacing the
undersampled borders of separately rotated, thin strips. `src/art/spiderPose.js`
shares the cyclic pose definition and time-to-frame selection with the source
exporter. Eight separate legs remain inside the frame throughout the cycle.
Classic keeps its original continuous leg rig; movement and collision shapes are
unchanged. The spider component export is capped at 384 pixels wide.

Branch snakes use single-strand band recipes with separate animated neck/head and
tail; the climbing snake's full coil image is not a repeatable branch band. The
last coil narrows from seven to 2.8 world units and continues into a short,
tapered end sampled from the same painted skin. `perchedSnakeTaperedEnd`
selects this assembly; the older hook master remains a style reference. A rear
decoration part puts the animated neck behind the actual wood; the short tail,
coils and head remain visible in front. The neck emerges just beyond the headward
coil, only slightly higher on poles and farther along horizontal branches. The
pole neck and head sit lower to keep that rise compact. The horizontal
head has a shorter rise and a head-aligned neck tangent.
The rear neck extends into the painted bark; branch wraps sit two world units
lower, and the pole head sits 1.5 units lower over its neck join. Short tails
have an open curve and stay visible. The copper geometry was accepted in review.

`presentation.perchedSnakeGreen` adds a green palette with the exact same
silhouette, geometry and animation. Five extra pieces/seven frames share the
copper recipes, with a baked scale-color filter that preserves alpha, pale
undersides and gold eyes. Tongues share the original frame. `packPieces` supplies
those explicit contracts to generation, inventory and validation. Color alternates
by branch gap without consuming pose or gameplay randomness; classic stays copper.
The added palette remains within the texture budgets (112 MB at 2×, 284 MB at 4×).

`presentation.perchedSnakeContinuous` turns the head back over the coils and
traces the cubic neck head-to-body, preserving belly orientation at the join. `perched-snake-skin` supplies the same painted
scales and cream belly to neck and coils; coil curves are rasterized at build
time. `presentation.perchedSnakePaintedSkin` omits classic diamond overlays.
The head’s normalized `mouth` landmark registers the tongue to its painted
mouth opening in the same head coordinates. Branch foliage stays green. `presentation.perchedSnakeNeckSocket`
registers the animated neck inside the rear of the head, without visible joint caps. The
pack's `presentation.snakeLimbThickness` and `snakePoleThickness` fit wraps
to the painted wood (10 and 19 world units), and
`presentation.coconutRootY` sets where coconuts meet it. Packs without those values
retain classic placement. `presentation.standingRockY` seats each standing stone
two world pixels into the painted ledge, using offsets derived from the same
outline vertices and ledge curve. Shapes already touching the platform stay put; hanging stones,
classic placement and collision geometry are unchanged.
`presentation.hangingRockVineY` extends each upper vine into the actual painted
top edge of its rock, where the stone covers the rope tip, avoiding a gap at
the collision outline. The far-jungle master has no waterfalls: the generator
places one large and one small fall outside the mirrored forest group per full
2048-unit tile. Keep their soft edges inside the tile so the repeat stays seamless.

`presentation.climbingSnake: articulated` selects the smaller upright face and
connected neck. The coil is split into non-overlapping atlas-row sections: the
upper arc and middle return pass behind the green stalk, while the two belly
bands and tail cross in front. Both layers use the same interpolated position
and obstacle scale. Stalk leaves stay behind both coil layers. The short neck
joins a root inside the band to the rotated/scaled cheek, avoiding an exposed
sideways loop above the upper coil. The connector renders behind both coil
layers, so its flat strip edge cannot show beside the cheek. At a reversal the head tucks inward and briefly fades out, changes
ends while fully concealed, then emerges with its face upright. Both neck and
head fade together, avoiding a face sliding across the front of the coils. The
retreat uses seconds rather than frame history (fully concealed within 30 ms of
the turn, fully emerged by 120 ms), so timing is consistent across snake periods
and interpolated drawing frames. `presentation.monkeyRootY` attaches the hanging
monkey's painted hands to the branch. `presentation.hangingMonkeyLegTint` selects
painted articulated player-leg components for that decoration, with a brighter copper-red tint
matching its baked arms, torso and tail; its face renders ahead of its arms.
`hangingMonkeyHips` is exported from the painted hip landmarks using the same
transform as the torso. Legs animate from those landmarks, rather than the classic
hip coordinates. The decoration draws behind the branch, with its palms at the
painted wood center and only the gripping fingertips visible over the top.
Classic keeps its original poses/placement.

The shared painted leg master has a broader sole and larger rounded toes for both
players, the ghost and the hanging decoration. The furry arm shafts are slightly
slimmer and the thighs/calves wider; hand and foot sizes are retained. The tail
uses a separate thinner painted master while retaining its curl size and buried
root. `presentation.monkeyMirrorFrontLeg` pairs the painted legs as left/right
feet, so both opposing big toes face inward for players, the ghost and the hanging
decoration. Reflection keeps the hip and foot endpoints fixed; the landmarks
retain the rig's original joint and endpoint distances. The decoration has its own brighter
smiling head (`masters/hanging-monkey-head.png`), rather than a flattened player
face. Both head components define normalized `eyeSockets` radii/angles alongside
their eye-center landmarks in `source-layout.json`. Open pupils, closed lids and
fallen crosses use the same transform as their head; the small far-eye cross is
scaled to its socket. A raster check verifies player/ghost pupils and crosses
against the painted eye whites.

Temple braziers use the same `TEMPLE_BRAZIERS` centers as the flames; rims and
flame bases share the first tier's offset. The glow source is opaque: the
renderer supplies its falloff through the same translucent layers as classic,
avoiding double attenuation. `presentation.templeFireDaylight` retains a faint
warm light by day, with the stage darkness strengthening it at dusk/night.
Temple corner/roof/fringe leaves use
painted foliage rooted at the placement point, with the roof leaves kept inside
the sprite box. Flying bat wings register the painted shoulder and tip
landmarks through the 41 original flap frames, retaining their finger bones and
scalloped membranes. The membrane turns with its shoulder instead of being
sheared against a fixed lower root; recoloring uses an explicit filter region
to keep transformed edges inside the frame visible. `presentation.batWingOffset`
retains the older near-flank placement for packs without paired flight wings.
`presentation.flyingWings` places a smaller, shaded far wing behind each torso
and a larger near wing over its flank. Both use the same frame and flap timing;
the far wing opens at a different perspective angle during the stroke. Each
image turns about the painted shoulder, with the face kept clear. The birds use
separate painted feather fans and a body without a baked folded wing; the flying
variants use separately painted palettes: azure with mint/indigo wing accents,
and violet with coral/teal accents. Feather components export at 160 pixels
wide, sufficient for the largest on-screen wing and less prone to noisy
resampling than the detailed full master. All three retain the red bird's eye, mouth,
beak and foot colours; feather recolouring does not tint those features.

`paintedFlightWing` rotates a constant-length wing instead of shrinking it at
mid-stroke. Boundary samples from the painted silhouette fit the entire cycle
with one scale, leaving an atlas margin in every frame. A raster check covers all
263 bird/bat wing frames for retained area and unclipped edges. The three bird
wing cells use `presentation.rasterScale` at 2.5× their baseline density to support
the larger presentation. The build cancels this density through each catalog
zoom, preserving logical boxes and pivots; it validates multipliers and still
enforces the existing 2×/4× texture budgets. Classic artwork and flight behaviour
remain unchanged.

Each generated SVG keeps the logical box and hidden guide layer. Gradient/filter
names are local to a frame; vector gradients use fixed coordinates to avoid
browser/resvg differences in curved-path bounds. Painted distant scenery uses
reflected halves; foliage/tree repeats wrap their edge objects. Stage tint,
horizontal softening, animation timing and all layer speeds are preserved.

Run these from the repository root after editing a master or a vector recipe:

```sh
npm run art:cartoon:sources
npm run art:build
npm run art:check
npm run art:cartoon:check
```

Commit masters, layout, components, generated SVGs, manifest and inventory together.
The build writes both complete packs into `public/art/classic/` and
`public/art/cartoon/`: catalog, boot/main sheets, standalone tiles, metadata and
`metrics.json` with texture bytes and compressed downloads per scale. Outputs are
ignored by Git. Each cartoon atlas cell has isolated rasterization and one-pixel
extrusion on each side, with two pixels between neighboring cells. Transparent
margins remain clear instead of sharing opaque pixels from an adjacent sprite.
The original tile edge rows and softening are retained. The build
rejects missing/incompatible frames, empty sprite exports, incorrect shadow alpha
and texture budgets above 120 MB at 2× or 300 MB at 4×.

Normal gameplay requests and warms only the selected pack. A failed cartoon load
offers an explicit reload into classic. Art style and resolution are independent;
the trace identifies `artPack` as well as resolution. Variable wording, scores,
settings and the version remain live text.

## Inventory and completion

`inventory.json` tracks all 175 baseline contracts and 576 current frame keys:
logical boxes, pivots, joins, hitbox guides, tint/alpha, strip/slice/softening rules,
1×/2×/4× export sizes and source/sheet/cell/status fields. The build records the
actual 2× atlas placement; tiles reference their separate image. `ui.wordmark` is
the explicit presentation addition in the pack manifest.

`npm run art:cartoon:inventory` refreshes baseline contracts while preserving
artist progress. Re-exporting retains notes and keeps reviewed status only for
unchanged sources. Duplicate/stale keys are errors. `art:cartoon:check` checks
synchronization; `art:check` also requires complete cartoon sources. Production
frames are **painted**, rather than claiming the owner has reviewed every family.
Final artwork approval and the Safari M1/iPhone 13 mini gameplay/startup pass remain
milestone acceptance steps. Classic references are kept unchanged.

The cartoon stone set has six painted variants: sandstone, blue slate, red ochre,
violet granite, mossy grey and banded limestone. Each has its own silhouette and
surface features. These are static choices, so the cartoon pack intentionally
contains six `rock.body` frames while classic keeps 24. All animated flipbooks
retain their original counts. The gap seed selects against the loaded pack's
count. Platform seating and hanging-vine endpoints come from each painted
silhouette; collision geometry is unchanged. The source exporter removes the
retired cartoon rock frames and preserves inventory progress on retained keys.

The perched branch snake uses a dedicated copper/orange head master and matching
copper/gold strips. The hue difference separates it from the green leaves on
the branch; the climbing snake keeps its green head and coils.

Cartoon hanging stones use only the top support vine; their side sling is hidden
through `presentation.hangingRockSling: false`. Classic keeps its side sling.

Stone and thorn-bush platforms and the beehive crossbar share the painted
`wood-platform` component. A separate `wood-pillar` shaft supplies `branch.trunk`,
`support.stem` and `support.hiveTrunk` without the old stretched branch stub or
root flare. The stone shelf’s opaque top edge determines each stone’s seating.
`branch.body` uses 2× raster density while retaining its logical box and pivot.
