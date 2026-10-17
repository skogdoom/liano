# Artwork and the asset pipeline

Part of the [Liano plan](../../PLAN.md). How every picture is made: pieces and rigs, the generated classic pack, the painted cartoon pack, how a pack is chosen, and how to replace art. The step-by-step guides for artists are generated or kept with the art: [art/README.md](../../art/README.md) (pieces, contracts, overrides) and [art/packs/cartoon/README.md](../../art/packs/cartoon/README.md) (painted masters, recipes, exports).

## Decisions

| Question | Decision |
|---|---|
| How to port the graphics? | **Pre-rendered, replaceable art** ([below](#pre-rendered-replaceable-art)): at build time today's drawing code generates an SVG for every piece of art; in the game each object is a rig of named pieces from texture atlases. Today's look stays pixel-identical. |
| Custom art later? | Any piece can be replaced by a **custom PNG or SVG** with the same name. |
| Variety per object? | **Kept exactly**: the code still picks colours, counts, flips, positions, lengths and patterns per object; only the pictures are files. |
| When is art swapped? | Custom source files are compiled **at build time**. M8a builds complete classic and cartoon packs; the player selects a pack in Config and the game reloads to load it. |
| Cartoon graphics? | **Planned in M8a, before M9.** Replace all visual asset families using `docs/cover_day.png` and `docs/cover_night.png` as the art-direction references. |
| Classic graphics toggle? | Config shows **Classic graphics: On/Off**. On loads classic, Off loads cartoon. Fresh installs default to Off; deliberate selections persist. Changing the value reloads the game. |

## Pre-rendered, replaceable art

Every picture in the Phaser version comes from an image with a stable name. The defaults are generated from today's drawing code, so the game looks exactly as it does now; later an artist can replace any of them with a custom PNG or SVG, and rebuild, without touching code. (The Pixi version is not affected: it keeps drawing live until M8.)

**Pieces and rigs.** Each object (the monkey, a liana, each obstacle kind and decoration, the temple, the backdrop layers, the HUD icons, buttons and panels) is a *rig*: named *pieces* that the code places, rotates, flips, stretches, tints and animates. The code keeps choosing everything that varies per object today, exactly as now; only the pictures of the pieces are files.

| Variety today | In a rig |
|---|---|
| Position, flip, rotation, scale (a bird on a branch, the way a snake faces, the stage's obstacle scale 1.0–1.3) | Transforms of a piece. |
| A choice from a list (bird colours, nest contents, bat looks, temple looks, coil counts, the player and shadow palettes) | One piece per choice: `bird.blue`, `nest.eggs`, `monkey.p2.arm`, ... |
| A length that follows the obstacle or the swing (trunks, vines, the spider's thread, the liana's rope) | Stretchable pieces: a 3-slice (top, repeating middle, bottom), or a textured rope along the curve the code computes. |
| A pattern per object (each liana's leaves) | The rope plus leaf pieces the code places as today. |
| Motion redrawn every frame (wings, legs, tails, eyes, flames, bees) | A flipbook (frames of one piece) or a joint (a piece turning about a pivot). |
| The stage tint | Applied at runtime; pieces are drawn in daylight colours, as the code draws them today. |

M4 lists every object kind with its pieces and how each kind of variety maps. Where exact parity is impossible (a continuous change of shape that neither a transform nor a few frames can match), the case is listed with its measured diff for approval.

**Generated defaults.** A generator (`npm run art`) runs the existing drawing functions in Node, through a recorder of the Pixi `Graphics` calls the code uses, and writes each piece, frame and variant as an **SVG** into `art/generated/`, plus `art/manifest.json`. SVG has everything the drawing code uses (curves, round caps and joins, alpha), so the vectors are exact, and an artist can open them in Inkscape, Illustrator or Figma. As with the window table, the generated files are committed and CI checks they are up to date.

**Contracts.** Each piece has a manifest entry: its key, what it is for, its logical size, its anchor or pivot, the largest scale it is shown at, its frames and frame rate (flipbooks), whether the stage tint applies, its attachment points (such as the monkey's shoulders), and for obstacles the hitbox outline. The generator writes these guides into each SVG as a hidden layer, so an artist sees where the hitbox is and where the pieces join.

**Overrides.** A custom piece goes in `art/custom/<key>.svg` or `<key>.png` (a PNG at least twice the logical size). An optional `<key>.json` beside it may change the frame count, frame rate or pivot within the limits the contract allows. A validator (`npm run art:check`, also run in CI) checks size, aspect, frames and padding, and warns where the art strays far from the hitbox. The hitboxes don't change with the art: they are gameplay.

**Atlases.** The build rasterizes every piece (the custom one if present, else the generated one) and packs them into texture atlases at 1×, 2× and 4× (picked by device pixels per world unit; 4× for large windows on desktops), sized for the iPhone 13 mini's texture limit. The game loads the set that matches the screen: a small boot set (title, monkey, first stage) first, the rest during the title. Atlases are build output, not committed. Pieces from one atlas are drawn in one batch, so there should be fewer draw calls than today.

**Tools.** An art gallery page (dev only) shows every piece with its contract: the default and any custom version side by side, flipbooks playing, hitbox and pivot overlays, and the piece in a game scene. `art/README.md`, generated from the manifest, is the guide for an artist.

**Still drawn live:** text (Phaser Text, the same fonts) and the debug view (Phaser Graphics, dev only).

**Scope update for M8a:** producing the built-in cartoon artwork and selecting classic/cartoon through a Config-triggered reload are now planned before the v3.0.0 release. Arbitrary third-party pack selection, swapping loaded textures during play, and changing hitboxes to fit art remain outside this milestone.

Since M8 there is no Pixi version: the generator's recorder still takes the drawing code's Pixi-style `Graphics` calls (`src/art/recorder.js`), without Pixi. The build writes one directory per pack, `public/art/classic/` and `public/art/cartoon/`, each with its catalog, boot and main atlases and tiles at 1×, 2× and 4×.

## Art packs and the Classic graphics setting

Two complete packs share every key, frame order, logical size, pivot, attachment point and hitbox; gameplay, motion and sounds are the same with either. The milestone that made the cartoon pack, with its contracts and reports, is [M8a](history/phaser-migration.md#m8a-cartoon-sprite-sheets-and-the-classic-graphics-toggle-l).

- **Classic** wraps the generated pipeline above (`art/generated/`, `art/custom/` overrides) and is the migration reference.
- **Cartoon**, the default, is painted after the [day](../cover_day.png) and [night](../cover_night.png) concepts: 182 pieces / 608 frames including the wordmark. It must cover every required frame; the build fails on a missing, duplicate or incompatible entry instead of mixing in classic art. Its sources and workflow are in [art/packs/cartoon/README.md](../../art/packs/cartoon/README.md).
- **Choosing a pack:** Config's **Classic graphics: On/Off** (`X` inside Config, or a click or tap). On is classic, Off is cartoon. `?art=classic|cartoon` overrides for testing and does not rewrite the saved choice; otherwise a valid saved choice, then cartoon. Invalid values resolve to cartoon. Changing the value saves it and reloads once at the title, keeping the mode, lives, slipping, shadow, mute, quality, other URL parameters and the hash; choosing the current value does not reload. Quality and graphics are separate settings, and each keeps the other.
- **Loading:** the choice is resolved before the first catalog request; only the selected pack and scale are fetched, decoded and prepared. The frame trace names the loaded `artPack`.
- **Budgets:** each pack fits **120 MB at 2×** and **300 MB at 4×** of texture memory (the build fails otherwise). Final sizes are in the [M8a final report](history/phaser-migration.md#m8a-cartoon-sprite-sheets-and-the-classic-graphics-toggle-l): classic 105.64 MB at 2×, cartoon 114.98 MB at 2×.
- **Accepted artwork:** the owner accepted the cartoon appearance through `7abe519`; later changes need the owner's review. The source/atlas gallery keeps its visible flags (38, 1.57 % aggregate at M8a) without relaxed thresholds.

## Build-time softening and layer speeds

The canopy and floor tiles move with the world, so the build softens them sideways (0.4 units for the canopy, 0.8 for the floor's shrubs), wrapped around the repeat, in sRGB; vertical edges soften, horizontal ones stay sharp. The parallax layers scroll at 0.06, 0.12 and 0.3 of the camera's speed. New art adapts its detail to these rather than adding runtime blur or changing motion ([M7](history/phaser-migration.md#m7-parity-performance-and-polish-ml), [background-motion.md](background-motion.md)).

## Classic visual style

What the classic pack shows; the cartoon pack keeps the same objects, variants and readability rules in its own style. Hitboxes must match the drawings in both packs (check with the debug view, D).

Simple stylized vector art. The drawing code (`src/art/pieces/`) generates the classic pieces at build time; nothing is drawn live but text and the debug view.

- **Monkeys.**
  - Look: round body and head, lighter face and belly, curled tail, one arm reaching up to the grip point.
  - Player colors: P1 brown, P2 ginger.
  - Poses: hanging, airborne spread, dead tumble. A respawned monkey blinks while invulnerable.
- **Lianas.** A green polyline with leaves (P2's in shared screen golden), which bends slightly while settling. The grip slide is visible, and the lower vine blinks yellow near the forced release.
- **Static obstacles.**
  - Branch: brown limb with a leaf tuft, and sometimes a decoration (see Branch decorations):
    - Perched bird: a small bird in the colours of one of the flying birds (red, blue or purple, at random; not the owl; none at night), on top of the limb, facing left or right at random; every couple of seconds it dips its head to peck, and its tail flicks.
    - Snake: a green snake wrapped around the limb in three or four coils (on a standing branch, in about half the cases, vertically around the trunk it stands on instead), its tail hanging off one end and its head rising from the other, facing left or right at random; the neck sways and now and then the tongue flicks.
    - Bird's nest (a decoration, not an animal): a woven bowl of twigs on top of the limb, facing either way. What it holds is picked at random, in equal shares: nothing (a dry leaf), a speckled blue egg that rocks now and then, or a hatched egg: a yellow chick peeping from its cracked shell, bobbing, with the cap of the shell beside it.
    - Panther: a black panther lying along the top of the limb with its head up, watching, with yellow slit eyes. Its flanks rise and fall as it breathes, its tail hangs down off the end of the limb and swishes, an ear flicks now and then and it blinks. Faces either way.
    - Hanging bat (night only): a small bat (one of the BAT_LOOKS) roosting upside down from the underside of the limb, wrapped in its wings like a cloak with scalloped edges. It sways a little, an ear twitches now and then, and it opens its red eyes for a moment every few seconds.
    - Owl (night only): a round brown owl perched on top of the limb, with ear tufts, big yellow eyes in a pale face and a chevroned belly. Its face slides slowly from side to side as if the head were turning, the pupils lead the turn, its eyes close for a moment now and then, and it puffs a little as it breathes.
    - Flowers: a small cluster of three to five on stems with a leaf or two, growing from the top of the limb, each in a colour of its own (red, pink, yellow, purple, white, orange or blue), swaying in the breeze, each out of step with the others.
    - Coconuts: a bunch of two or three brown, hairy coconuts, each with its three dark "eyes", hanging from the underside of the limb on short stems under a small green frond, swaying a little, each out of step with the others.
    - Hanging monkey: a small grey monkey hanging from the underside of the limb by its hands, swaying like a pendulum, with its legs swinging, its tail curling out to one side and an occasional blink. It hangs below the limb, clear of the vines it hangs from.
  - Thorn bush: dark blob with thorns.
  - Rock: grey polygon on a small ledge.
  - Temple: a stepped pyramid with a shrine on top and a staircase up the middle of its front, on a platform of mouldings and recessed panels, drawn big (a door taller than the monkey) and buried: only the top shows, the lower part lost in a soft dark-green mist that thickens toward the ground (nested ellipses, so there is no edge to see) and a thick fringe of ferns and leaves wider than the temple, with moss, vines and ferns on every tier. The temple takes the stage tint like the background (it stands between the layers it is tinted on), and its fern fringe is in deep greens, so neither stands out in the dark stages. Four looks, one of which each temple has: limestone with a stepped-fret frieze round the shrine; sandstone with a roof comb over the shrine; mossy grey-green stone with serpent heads on the stairs, moss and ferns; and dark basalt with gold inlay and two braziers whose flames flicker. The flames are not tinted with the stone: they stay bright in the dark stages and there light up the stone round each brazier with a warm glow (sixteen thin additive circles, so no rings; strength from the stage's tint: none by day, a little in the late afternoon and at dawn, about half at dusk, full at night; it flickers with the flame).
  - Beehive: a teardrop paper nest in gold bands with a dark entrance, hanging from a vine, or from an arm off a trunk when it is low (its hitbox is three stacked circles, widest in the middle). A handful of bees buzz around it; they are scenery, and the animation takes the world time, so they stop while the game is paused.
  - High ones hang from the canopy on vines; low ones stand on a trunk or pole (the beehive hangs from an arm off the trunk).
- **Moving obstacles.**
  - Spider: dark body with a red mark and wriggling legs, on a thin thread.
  - Snake: green coils on a leafy stalk, its head pointing the way it climbs.
  - Bird: red body with a yellow belly and flapping wings, facing the way it flies.
  - Purple bird: a purple body with a pale belly, a crest and a tail feather, flapping, facing the way it is flying and pitched along the circle.
  - Blue bird: a blue body with a pale belly and a small crest, flapping and pitched along its climb or dive, facing left or right by gap.
  - Bat: a purple furry body with pointed ears and red eyes, and a scalloped membrane wing that flutters fast, facing the way it flies.
- **Banana.** A single tilted banana, tapering to both ends, with a lighter ridge, a stem and a dark tip, a gentle bob, and a glint near the stem that fades in and out while it waits to be taken. The same drawing is the icon in the HUD and on the results.
- **Background.** Three parallax layers, a canopy strip at the top, and a dark jungle floor band at the bottom. Taller views extend the forest upward and the undergrowth downward. The tint shifts per stage, through a five-step day (day, late afternoon, dusk, night, dawn) that repeats.
- **HUD and buttons.** Readable text with a subtle shadow, plus the speaker and fullscreen icons.
- **Readability.** Hitboxes visually match the drawings. Check this with the debug overlay.
