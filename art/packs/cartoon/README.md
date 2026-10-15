# Cartoon pack · M8a

The owner approved continuing from the corrected style sample. The direction is a
cohesive painted cartoon jungle, based on `docs/cover_day.png` and
`docs/cover_night.png`. Those covers are references, not cropped runtime sprites.

## Play and review

Run `npm run dev` and open `/?art=cartoon`, or use **Classic graphics: Off** in
the title Config menu. On desktop, C opens Config and X switches art. Click/tap
works too. On means classic; Off means cartoon. Classic is the default when there
is no valid saved choice. Art changes reload to the title and preserve mode,
lives, slipping, shadow, mute, quality, other URL options and the hash. Mobile
remains 1P only. Explicit `?art=classic|cartoon` overrides storage without rewriting
it; invalid explicit/saved values resolve to classic. Blocked storage uses the URL.

- `/cartoon.html`: original style samples, anatomy close-ups and coverage.
- `/art.html?art=cartoon`: production frames, source/atlas differences, origin,
  attachments, hitboxes, slices, animation sliders and repeat seams. Choose 1×/2×/4×.
- `/rigs.html?art=cartoon`: fixed assembled poses, all obstacle families, day/night
  scenes, temples and UI, rendered by the real game rigs. Add `only=world.monkeys`
  or another fixture ID to inspect one; `zoom=2` renders at 2× rather than enlarging
  a low-resolution screenshot.

The full sheet remains an art-direction illustration, not a production atlas.
Its missing arm, unnatural grip and truncated ring finger were corrected during
style review. The production monkey uses separate components and the existing
continuous pose/joint calculations. Source/atlas comparisons expose browser/resvg
sampling differences in painted edges; keep the flags visible for art review.

## Sources and exports

`masters/` contains ten painted PNG component masters: monkey,
creatures, foliage/wood, the distant jungle, a level branch aligned with its
collision guide, cleaned snake components without the original faint matte,
a lighter plum spider body with clearer contour highlights, and highlighted
birds/bats with clean transparency, a separate large/small waterfall pair, and
refined climbing-snake coils with a short tapered tail.
They were generated for this pack
in the approved style. `source-layout.json` names each component's crop in source
pixels. `components/` contains deterministic, tightly trimmed PNG exports from
those crops, preserving their alpha. No manual changes to generated exports are
needed. Keep source cell bounds inside each master's actual PNG dimensions.

Monkey torso/arm/leg `landmarks` are normalized coordinates in the **trimmed
component**, not in the whole master. They register shoulders, palms and hips to
the unchanged rig anchors and limb lengths (`src/art/registration.js`). Recheck
them when replacing a master; fitting a limb's whole bounding box does not align
its visible shoulder or gripping palm with its pivot.
The hanging decoration reuses those landmarks to connect its painted shoulders
to its raised arms and place both palms at the branch.

`scripts/cartoon-sources.mjs` produces all **594 required frames** plus the new
`ui.wordmark`: **176 pieces / 595 frames**. It combines painted components with
editable vector recipes for bent strips, repeatable stone courses, feather/membrane
animation, small props and UI. Variants share the same pivots and scale; bird/bat
wings and fire use the original frame ordering. Player 2 has a distinct ginger
palette; the shadow monkey is grey at 56% opacity for readability, while its vines
retain 36%. This explicit cartoon-only alpha policy is shared by source exports,
inventory and validation (`src/art/packs.js`); classic remains at 36%.
No classic drawing is read or
used as a fallback. The classic manifest supplies only rendering/hitbox contracts.

Branch snakes use single-strand band recipes with separate animated neck/head and
tail; the climbing snake's full coil image is not a repeatable branch band. The
pack's `presentation.snakeLimbThickness` fits wraps to the painted wood, and
`presentation.coconutRootY` sets where coconuts meet it. Packs without those values
retain classic placement. The far-jungle master has no waterfalls: the generator
places one large and one small fall outside the mirrored forest group per full
2048-unit tile. Keep their soft edges inside the tile so the repeat stays seamless.

`presentation.climbingSnake: articulated` selects the smaller upright face and
connected neck; its pose follows the obstacle's drawing phase continuously rather
than flipping the face on descent. `presentation.monkeyRootY` attaches the hanging
monkey's painted hands to the branch. Classic keeps its original poses/placement.

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
ignored by Git. Each cartoon atlas cell has isolated rasterization and a two-pixel
extruded gutter. The original tile edge rows and softening are retained. The build
rejects missing/incompatible frames, empty sprite exports, incorrect shadow alpha
and texture budgets above 120 MB at 2× or 300 MB at 4×.

Normal gameplay requests and warms only the selected pack. A failed cartoon load
offers an explicit reload into classic. Art style and resolution are independent;
the trace identifies `artPack` as well as resolution. Variable wording, scores,
settings and the version remain live text.

## Inventory and completion

`inventory.json` tracks all 175 baseline contracts and 594 stable frame keys:
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
