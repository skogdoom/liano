<!-- Written by `npm run art` from the pieces in src/art/pieces/: do not edit by hand. -->

# The game's art

Every picture in the game is a **piece**: a part of an object (a monkey's arm, a bird's
wing, a temple's base) drawn by the game's own code. `npm run art` writes each piece's
pictures into `generated/` as SVG, and the build turns them into the textures the game
loads. There are 175 pieces, 594 pictures in all.

These are the **classic** sources. The separate [cartoon authoring guide](packs/cartoon/README.md)
describes the painted masters, vector recipes and complete alternative pack. Classic
graphics default to Off (cartoon); change the title Config row (X on desktop) to reload with the
other pack. Explicit test URLs use `?art=classic` or `?art=cartoon`.
`npm run art:build` builds both into `public/art/classic/` and
`public/art/cartoon/`, but the game downloads only its selected pack. The gallery
at `/art.html` selects either pack; `/rigs.html` shows assembled gameplay fixtures.

## Replacing a piece

Put your picture in `custom/`, named after the piece: `custom/<key>.svg` or
`custom/<key>.png`. A piece with several frames (a flipbook: a wing beating, a flame
flickering) needs one file per frame, `custom/<key>.<frame>.svg`, numbered from 0. The
build then uses yours instead of the generated one; nothing else changes.

- **Start from the generated SVG.** Open `generated/<key>.svg` (or `<key>.<frame>.svg`) in
  your editor. Its size is the piece's **box**, in the game's units; draw inside it. A
  hidden layer, *Guides*, shows the box, the **origin** (the magenta cross: the point the
  game places, turns and scales the piece about), the obstacle's **hitbox** (green: what
  actually hits a player), the **joins** where other pieces attach (orange) and, for a
  panel, the **slices**. Show it while you draw; it is never rendered.
- **Keep the box's proportions.** Your picture is stretched over the box, so its aspect
  must be the box's (within 2 %).
- **A PNG must be at least 2× the box** in pixels (a 40 × 20 box needs 80 × 40 or more):
  the game draws pieces larger than their units on sharp screens. SVG has no such limit.
- **Keep the origin where it is**, or say where yours is: a file `custom/<key>.json`
  beside it may set `"pivot": [x, y]` (in the box's units) and, for a flipbook that plays
  at a rate, `"fps"`.
- **Tinted** pieces (the backdrop, the temple) are multiplied by the time of day's colour:
  draw them as they look by day.
- **See-through** pieces (the shadow monkey and its lianas) are drawn as they show: each
  shape at the given share of its opacity, so the shapes behind show through.
- **Strips** (ropes, vines, necks) are bent along a curve: draw them straight along +x.
  **Tiles** (the backdrop layers) repeat sideways: their left and right edges must meet.
  **Slices** (panels) keep their corners and stretch their edges and middle.
- A **hitbox** is the game's: art that strays far from it misleads players about what
  hits them. `npm run art:check` warns about that.

Check your work with `npm run art:check` (it says what is wrong with a file), then
`npm run dev` and the gallery at `/art.html`, which shows every piece next to the
game's drawing of it.

## The pieces

Sizes are the box in game units; *scale* is the largest the game draws the piece at
(before the screen's own density).

### backdrop

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `backdrop.sky` | 4 × 128 | 1 | tinted | The sky: 32 bands of colour from the top of the view (dark) to the floor (light), 4 px each and 4 px wide; stretched to the view (the first band carries on above, the last below the floor). |
| `backdrop.far` | 2048 × 1790 | 1 | tile, tinted | The far layer of the jungle: hazy tree trunks and canopy masses. One tile, repeating sideways. |
| `backdrop.mid` | 2048 × 1670 | 1 | tile, tinted | The middle layer: darker trunks with a few branch stubs. One tile, repeating sideways. |
| `backdrop.nearTop` | 2048 × 100 | 2 | tile, tinted | The near layer under the canopy: clumps of leaves hanging down. One tile, repeating sideways. |
| `backdrop.near` | 2048 × 124 | 2 | tile, tinted | The near layer along the floor: ferns. One tile, repeating sideways. |
| `backdrop.canopy` | 2048 × 112 | 2 | tile, tinted, softened sideways by the build (0.4 units) | The canopy strip the lianas hang from, in front of the world, with a leafy top edge for taller views. One tile, repeating sideways. |
| `backdrop.floor` | 2048 × 74 | 2 | tile, tinted, softened sideways by the build (0.8 units) | The top of the dark jungle floor, in front of the world: undergrowth along the floor line. One tile, repeating sideways; below it the floor is backdrop.floorFill, stretched down 1600 px below the band for taller views. |
| `backdrop.floorFill` | 4 × 4 | 1 | tinted | The floor's colour below the undergrowth, a small square stretched to fill the rest of the floor. |

### monkey

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `monkey.p1.tail` | 40 × 50 | 2 |  | The tail of player 1, behind everything else. |
| `monkey.p1.leg` | 20 × 32 | 2 |  | A leg of player 1, 12 px down from its hip (the origin); it turns about the hip. |
| `monkey.p1.arm` | 18 × 39 | 2 |  | An arm of player 1, 21 px down from its shoulder (the origin); it turns about the shoulder. |
| `monkey.p1.torso` | 28 × 30 | 2 | joins: armBack, armFront, legBack, legFront | The body of player 1; its origin is the centre of the monkey's hitbox. The limbs join it at the attachment points. |
| `monkey.p1.head` | 34 × 24 | 2 |  | The head of player 1 (ears, face, muzzle), over the body. |
| `monkey.p2.tail` | 40 × 50 | 2 |  | The tail of player 2, behind everything else. |
| `monkey.p2.leg` | 20 × 32 | 2 |  | A leg of player 2, 12 px down from its hip (the origin); it turns about the hip. |
| `monkey.p2.arm` | 18 × 39 | 2 |  | An arm of player 2, 21 px down from its shoulder (the origin); it turns about the shoulder. |
| `monkey.p2.torso` | 28 × 30 | 2 | joins: armBack, armFront, legBack, legFront | The body of player 2; its origin is the centre of the monkey's hitbox. The limbs join it at the attachment points. |
| `monkey.p2.head` | 34 × 24 | 2 |  | The head of player 2 (ears, face, muzzle), over the body. |
| `monkey.shadow.tail` | 40 × 50 | 2 | see-through (36 %) | The tail of the shadow monkey, behind everything else. |
| `monkey.shadow.leg` | 20 × 32 | 2 | see-through (36 %) | A leg of the shadow monkey, 12 px down from its hip (the origin); it turns about the hip. |
| `monkey.shadow.arm` | 18 × 39 | 2 | see-through (36 %) | An arm of the shadow monkey, 21 px down from its shoulder (the origin); it turns about the shoulder. |
| `monkey.shadow.torso` | 28 × 30 | 2 | see-through (36 %), joins: armBack, armFront, legBack, legFront | The body of the shadow monkey; its origin is the centre of the monkey's hitbox. The limbs join it at the attachment points. |
| `monkey.shadow.head` | 34 × 24 | 2 | see-through (36 %) | The head of the shadow monkey (ears, face, muzzle), over the body. |
| `monkey.eyes.0` … `.1` | 18 × 12 | 2 |  | The monkey's eyes: open (frame 0), and crossed after a fall (frame 1). |
| `monkey.shadow.eyes.0` … `.1` | 18 × 12 | 2 | see-through (36 %) | The shadow monkey's eyes, see-through: open (frame 0), and crossed after a fall (frame 1). |

### liana

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `liana.green.rope` | 430 × 10 | 2 | strip | The rope of the lianas: a straight strip 420 px along +x from the anchor (the origin), bent along the swinging rope. |
| `liana.green.leaf.0` … `.1` | 19 × 12 | 2 |  | A leaf on the lianas, 17 px from its base (the origin) along +x: light (frame 0) and dark (frame 1). Placed, turned and scaled per leaf. |
| `liana.gold.rope` | 430 × 10 | 2 | strip | The rope of player 2's own lianas in shared screen: a straight strip 420 px along +x from the anchor (the origin), bent along the swinging rope. |
| `liana.gold.leaf.0` … `.1` | 19 × 12 | 2 |  | A leaf on player 2's own lianas in shared screen, 17 px from its base (the origin) along +x: light (frame 0) and dark (frame 1). Placed, turned and scaled per leaf. |
| `liana.shadow.rope` | 430 × 10 | 2 | strip, see-through (36 %) | The rope of the shadow monkey's lianas (see-through): a straight strip 420 px along +x from the anchor (the origin), bent along the swinging rope. |
| `liana.shadow.leaf.0` … `.1` | 19 × 12 | 2 | see-through (36 %) | A leaf on the shadow monkey's lianas (see-through), 17 px from its base (the origin) along +x: light (frame 0) and dark (frame 1). Placed, turned and scaled per leaf. |
| `liana.flash` | 218 × 8 | 2 | strip | The lit lower half of a liana, when the grip is about to slip off the end; bent like the rope. |

### banana

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `banana.body` | 44 × 34 | 2 | joins: glint | A banana to take, about its centre (the origin): curved, with a ridge, a stem and a dark tip. It bobs and rocks. |
| `banana.glint` | 18 × 18 | 2 |  | A four-pointed glint on a banana (or a heart), about its centre; it fades in and out. |
| `banana.hud` | 27 × 21 | 2 |  | The banana by each player's banana count in the HUD (11 px), about its centre. |
| `banana.results` | 31 × 24 | 2 |  | The banana by the bananas taken on the results (13 px), about its centre. |

### heart

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `heart.field` | 40 × 32 | 2 | joins: glint | A heart to take (a banana turned into a life), 17 px across about its centre. |
| `heart.hud.0` … `.1` | 28 × 23 | 2 |  | A heart in the HUD, 11 px across about its centre: a life left (frame 0), a life lost (frame 1, an outline). |

### ui

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `ui.panel` | 66 × 66 | 2 | slice | A panel: a see-through dark rounded rectangle (radius 18) with a faint edge, from its top left (the origin), 64 px square; 9-sliced to each panel's size. |
| `ui.arrow` | 26 × 30 | 2 |  | The arrow at the top edge pointing up at a monkey above the view; its tip at the origin. |
| `ui.speaker` | 26 × 40 | 2 |  | The mute button: a speaker, from its top left (the origin). |
| `ui.speakerWaves` | 42 × 42 | 2 |  | The speaker's sound waves, while the sound is on (in the speaker's coordinates). |
| `ui.speakerCross` | 28 × 30 | 2 |  | The cross by the speaker, while muted (in its coordinates). |
| `ui.fullscreen.0` … `.1` | 48 × 48 | 2 |  | The full-screen button, from its top left (the origin): corner brackets pointing out to enter full screen (frame 0), pulled in to leave it (frame 1). |

### support

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `support.vine` | 20 × 3 | 1.3 | strip | The vine a high obstacle hangs from, from the canopy down to it. A straight strip 20 px along +x from the origin, 3 px across; bent along the curve. |
| `support.vineEnd` | 6 × 6 | 1.3 |  | A round end or joint of support.vine: a disc 3 px across about the origin. |
| `support.stem` | 18 × 102 | 1.3 |  | The stem a low thorn bush or rock stands on, from its top (the origin) 100 px down; stretched to reach below the floor. |
| `support.hiveTrunk` | 22 × 482 | 1.3 |  | The trunk beside a low beehive, from its top (the origin) 480 px down; shrunk to reach below the floor. |

### branch

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `branch.body` | 164 × 38 | 1.3 | hitbox | The branch: a limb from a cut stub, with a leaf tuft near the tip. Its origin is the hitbox centre. |
| `branch.barkLine` | 22 × 8 | 1.3 |  | A dark line in the bark, 14 px along +x; four per branch, placed, turned and stretched. |
| `branch.trunk` | 38 × 102 | 1.3 |  | The trunk a low branch stands on, from its top (the origin) 100 px down; stretched to reach below the floor. |

### panther

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `panther.body` | 88 × 31 | 2.6 | joins: ear | A black panther lying on the branch, head up: the body and head. It breathes (scaled up and down). |
| `panther.ear` | 6 × 6 | 2.6 |  | The inside of the ear that flicks, about its own centre (folded by scaling). |
| `panther.eyes.0` … `.1` | 16 × 7 | 2.6 |  | The eyes: open (frame 0) and shut (frame 1). |
| `panther.tail.0` … `.15` | 39 × 46 | 2.6 |  | The tail hanging off the end of the branch, in 16 frames from its tip swung 6 px one way to as far the other. |

### perchedBird

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `perchedBird.red.body` | 22 × 22 | 2.6 | joins: tail, head | A small red bird perched on the branch: the body, its feet at the origin. |
| `perchedBird.red.tail` | 13 × 8 | 2.6 |  | The red perched bird's tail, from its root (the origin); it flicks about the root. |
| `perchedBird.red.head` | 19 × 14 | 2.6 |  | The red perched bird's head about its centre (the origin); it dips to peck. |
| `perchedBird.blue.body` | 22 × 22 | 2.6 | joins: tail, head | A small blue bird perched on the branch: the body, its feet at the origin. |
| `perchedBird.blue.tail` | 13 × 8 | 2.6 |  | The blue perched bird's tail, from its root (the origin); it flicks about the root. |
| `perchedBird.blue.head` | 19 × 14 | 2.6 |  | The blue perched bird's head about its centre (the origin); it dips to peck. |
| `perchedBird.purple.body` | 22 × 22 | 2.6 | joins: tail, head | A small purple bird perched on the branch: the body, its feet at the origin. |
| `perchedBird.purple.tail` | 13 × 8 | 2.6 |  | The purple perched bird's tail, from its root (the origin); it flicks about the root. |
| `perchedBird.purple.head` | 19 × 14 | 2.6 |  | The purple perched bird's head about its centre (the origin); it dips to peck. |

### perchedSnake

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `perchedSnake.tail.0` … `.1` | 30 × 32 | 2.6 |  | The tail of a snake coiled round the branch, tapering from its root (the origin) past the last coil: round the trunk (frame 0) or the limb (frame 1). |
| `perchedSnake.band.0` … `.1` | 54 × 48 | 2.6 |  | The front of a coil, slanting across the wood from its top (the origin): round the trunk (frame 0, 26 px thick), or round the limb (frame 1, for a limb 20 px thick, stretched across to the limb's thickness). |
| `perchedSnake.mark` | 6 × 6 | 2.6 |  | A dark scale mark on a coil, 2 px in radius about the origin; scaled. |
| `perchedSnake.neck` | 20 × 7 | 2.6 | strip | The neck of the coiled snake, rising from the last coil to the head. A straight strip 20 px along +x from the origin, 7 px across; bent along the curve. |
| `perchedSnake.neckEnd` | 10 × 10 | 2.6 |  | A round end or joint of perchedSnake.neck: a disc 7 px across about the origin. |
| `perchedSnake.head` | 16 × 12 | 2.6 |  | The coiled snake's head, about the end of its neck (the origin), facing +x; it sways and turns. |
| `perchedSnake.tongue` | 15 × 12 | 2.6 |  | Its tongue, flicking now and then (in the head's coordinates). |

### hangingMonkey

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `hangingMonkey.arms` | 30 × 33 | 2.6 |  | A grey monkey hanging under the branch: the arms, its hands at the origin (it swings about them). |
| `hangingMonkey.body` | 26 × 39 | 2.6 |  | The hanging monkey's body and head (in the hands' coordinates). |
| `hangingMonkey.leg` | 20 × 4.2 | 2.6 |  | A leg of the hanging monkey, from its hip, kicking. A straight segment 20 px along +x from the origin, 4.2 px across; stretched to each length and turned. |
| `hangingMonkey.legEnd` | 8 × 8 | 2.6 |  | A round end or joint of hangingMonkey.leg: a disc 4.2 px across about the origin. |
| `hangingMonkey.tail.0` … `.12` | 33 × 30 | 2.6 |  | The hanging monkey's tail curling out and up, in 13 frames from the least curled to the most (in the hands' coordinates). |
| `hangingMonkey.eyes.0` … `.1` | 16 × 5 | 2.6 |  | Its eyes: open (frame 0) and shut (frame 1). |

### hangingBat

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `hangingBat.purple.body` | 24 × 43 | 2.6 |  | A purple bat hanging upside down under the branch, wrapped in its wings; its feet at the origin (it sways about them). |
| `hangingBat.purple.eyes.0` … `.1` | 14 × 5 | 2.6 |  | The purple hanging bat's eyes: shut (frame 0) and open (frame 1). |
| `hangingBat.purple.ear.0` … `.8` | 11 × 11 | 2.6 |  | The purple hanging bat's ear that twitches, in 9 frames from still to the full twitch. |
| `hangingBat.brown.body` | 24 × 44 | 2.6 |  | A brown bat hanging upside down under the branch, wrapped in its wings; its feet at the origin (it sways about them). |
| `hangingBat.brown.eyes.0` … `.1` | 14 × 5 | 2.6 |  | The brown hanging bat's eyes: shut (frame 0) and open (frame 1). |
| `hangingBat.brown.ear.0` … `.8` | 11 × 13 | 2.6 |  | The brown hanging bat's ear that twitches, in 9 frames from still to the full twitch. |
| `hangingBat.grey.body` | 24 × 43 | 2.6 |  | A grey bat hanging upside down under the branch, wrapped in its wings; its feet at the origin (it sways about them). |
| `hangingBat.grey.eyes.0` … `.1` | 14 × 5 | 2.6 |  | The grey hanging bat's eyes: shut (frame 0) and open (frame 1). |
| `hangingBat.grey.ear.0` … `.8` | 11 × 10 | 2.6 |  | The grey hanging bat's ear that twitches, in 9 frames from still to the full twitch. |
| `hangingBat.black.body` | 24 × 43 | 2.6 |  | A black bat hanging upside down under the branch, wrapped in its wings; its feet at the origin (it sways about them). |
| `hangingBat.black.eyes.0` … `.1` | 14 × 5 | 2.6 |  | The black hanging bat's eyes: shut (frame 0) and open (frame 1). |
| `hangingBat.black.ear.0` … `.8` | 11 × 12 | 2.6 |  | The black hanging bat's ear that twitches, in 9 frames from still to the full twitch. |

### owl

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `owl.body` | 30 × 34 | 2.6 |  | An owl perched on the branch: the body, its feet at the origin; it puffs as it breathes. |
| `owl.skull` | 24 × 28 | 2.6 |  | The owl's head with its ear tufts, about its centre (the origin); it tilts as it turns. |
| `owl.disc` | 24 × 15 | 2.6 |  | The pale face round the eyes (in the head's coordinates); it slides as the head turns. |
| `owl.beak` | 6 × 7 | 2.6 |  | The beak (in the face's coordinates). |
| `owl.eyeball` | 10 × 11 | 2.6 |  | An eye, about its centre. |
| `owl.pupil` | 6 × 7 | 2.6 |  | A pupil, about the eye's centre; it leads the turn. |
| `owl.shutEye` | 12 × 7 | 2.6 |  | An eye shut, about its centre. |

### nest

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `nest.back` | 40 × 18 | 2.6 |  | A nest on the branch: the back of the bowl and its dark inside, its foot at the origin. |
| `nest.front` | 44 × 15 | 2.6 |  | The front wall of the nest, over its contents (in the nest's coordinates). |
| `nest.rim` | 46 × 14 | 2.6 |  | The rim of the nest, over the front wall and its twigs. |
| `nest.twig` | 20 × 1.2 | 2.6 |  | A dark twig woven across the front of the nest. A straight segment 20 px along +x from the origin, 1.2 px across; stretched to each length and turned. |
| `nest.twigEnd` | 4 × 4 | 2.6 |  | A round end or joint of nest.twig: a disc 1.2 px across about the origin. |
| `nest.lightTwig` | 20 × 1.2 | 2.6 |  | A light twig woven across the front of the nest. A straight segment 20 px along +x from the origin, 1.2 px across; stretched to each length and turned. |
| `nest.lightTwigEnd` | 4 × 4 | 2.6 |  | A round end or joint of nest.lightTwig: a disc 1.2 px across about the origin. |
| `nest.rimTwig` | 20 × 1.4 | 2.6 |  | A twig stuck out of the rim. A straight segment 20 px along +x from the origin, 1.4 px across; stretched to each length and turned. |
| `nest.rimTwigEnd` | 4 × 4 | 2.6 |  | A round end or joint of nest.rimTwig: a disc 1.4 px across about the origin. |
| `nest.egg` | 14 × 18 | 2.6 |  | An egg in the nest, about its centre (placed at 0, -11); it rocks now and then. |
| `nest.shell` | 14 × 12 | 2.6 |  | The cracked shell a chick hatched from, about its centre. |
| `nest.chick` | 16 × 19 | 2.6 |  | The chick, about its centre; it bobs and tilts. |
| `nest.chickBeak.0` … `.8` | 8 × 11 | 2.6 |  | The chick's beak, in 9 frames from shut to wide open (in the chick's coordinates). |
| `nest.cap` | 14 × 10 | 2.6 |  | The top of the shell, tipped on the rim. |
| `nest.leaf` | 12 × 8 | 2.6 |  | A dry leaf curled in the bottom of an empty nest (in the nest's coordinates). |

### flower

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `flower.stem` | 9 × 28 | 2.6 |  | A flower's stem, 20 px up from its foot (the origin), curving a little; stretched to each flower's height. |
| `flower.leaf.0` … `.1` | 9 × 6 | 2.6 |  | A leaf on a stem, 7 px from its base (the origin) along +x: green (frame 0) and dark (frame 1). Placed, turned and scaled per leaf. |
| `flower.petal` | 10 × 10 | 2.6 |  | A petal, 4 px in radius about its centre: white, tinted with the flower's colour, and scaled. |
| `flower.heart` | 10 × 10 | 2.6 |  | A flower's heart, 4 px in radius about its centre: white, tinted, and scaled. |

### coconut

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `coconut.frond` | 34 × 16 | 2.6 |  | The frond a bunch of coconuts hangs from, under the branch; the stems spring from the origin. |
| `coconut.stem` | 20 × 1.8 | 2.6 |  | The stem from the frond to a nut. A straight segment 20 px along +x from the origin, 1.8 px across; stretched to each length and turned. |
| `coconut.stemEnd` | 4 × 4 | 2.6 |  | A round end or joint of coconut.stem: a disc 1.8 px across about the origin. |
| `coconut.nut` | 16 × 16 | 2.6 |  | A coconut 7 px in radius, its top at the origin: brown, a highlight and three dark eyes; scaled to each nut. |
| `coconut.hair` | 7 × 6 | 2.6 |  | A hair on a nut's outline, at its right (about the nut's centre, which is the origin); turned round the nut. |

### thornBush

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `thornBush.body` | 114 × 86 | 1.3 | hitbox | The thorn bush: three dark circles with a highlight each. Its origin is the hitbox centre. |
| `thornBush.thorn` | 9 × 10 | 1.3 |  | A thorn, its base at the origin, pointing along +x; placed round the outline and turned. |
| `thornBush.mound` | 62 × 14 | 1.3 |  | The mound a low thorn bush grows from (in the bush's coordinates). |

### rock

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `rock.body.0` … `.23` | 76 × 76 | 1.3 | hitbox | The rock, in 24 outlines (one frame each, picked by gap): grey, with a lit and a shaded facet. Its origin is the hitbox centre. |
| `rock.sling` | 78 × 22 | 1.3 |  | The vine's loop round a hanging rock (in the rock's coordinates). |
| `rock.ledge` | 82 × 12 | 1.3 |  | The ledge a low rock sits on (in the rock's coordinates). |

### beehive

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `beehive.nest` | 52 × 79 | 1.3 | hitbox | The beehive: a teardrop in gold paper bands with a dark entrance at the bottom. Its origin is the hitbox centre. |
| `beehive.arm` | 62 × 40 | 1.3 |  | The arm over a low beehive from the trunk beside it, and the rope the nest hangs on (in the hive's coordinates). |

### bee

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `bee.body` | 10 × 8 | 2.6 |  | A bee: a round yellow body with a dark stripe, about the origin. |
| `bee.wing` | 8 × 8 | 2.6 |  | A bee's wing at its widest (2.6 px half height), about its centre; squeezed as it beats. |

### temple

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `temple.limestone.top` | 376 × 206 | 1.3 | tinted, softened sideways by the build (0.2 units), hitbox | The limestone temple down to the top of its base: the shrine, the three tiers and the stairs on them, a stepped fret on the shrine. Its origin is the top centre of the shrine (the hitbox's). |
| `temple.limestone.baseTop` | 476 × 92 | 1.3 | tinted, softened sideways by the build (0.2 units) | The first 92 px of the limestone temple's base, from its lit top edge (at y 202): courses of blocks and a row of panels. |
| `temple.limestone.base` | 476 × 92 | 1.3 | tinted, softened sideways by the build (0.2 units) | The limestone temple's base below that: 92 px, from its top (the origin's y), that repeat down to the floor. |
| `temple.limestone.stairs` | 80 × 96 | 1.3 | tinted, softened sideways by the build (0.2 units) | The limestone temple's stairs below the tiers, with their low walls: 8 steps (96 px, from the top of a step at the origin's y) that repeat down to the floor. |
| `temple.sandstone.top` | 376 × 206 | 1.3 | tinted, softened sideways by the build (0.2 units), hitbox | The sandstone temple down to the top of its base: the shrine, the three tiers and the stairs on them, a roof comb over the shrine. Its origin is the top centre of the shrine (the hitbox's). |
| `temple.sandstone.baseTop` | 476 × 92 | 1.3 | tinted, softened sideways by the build (0.2 units) | The first 92 px of the sandstone temple's base, from its lit top edge (at y 202): courses of blocks and a row of panels. |
| `temple.sandstone.base` | 476 × 92 | 1.3 | tinted, softened sideways by the build (0.2 units) | The sandstone temple's base below that: 92 px, from its top (the origin's y), that repeat down to the floor. |
| `temple.sandstone.stairs` | 80 × 96 | 1.3 | tinted, softened sideways by the build (0.2 units) | The sandstone temple's stairs below the tiers, with their low walls: 8 steps (96 px, from the top of a step at the origin's y) that repeat down to the floor. |
| `temple.mossy.top` | 376 × 206 | 1.3 | tinted, softened sideways by the build (0.2 units), hitbox | The mossy temple down to the top of its base: the shrine, the three tiers and the stairs on them, serpent heads on the stairs and moss. Its origin is the top centre of the shrine (the hitbox's). |
| `temple.mossy.baseTop` | 476 × 92 | 1.3 | tinted, softened sideways by the build (0.2 units) | The first 92 px of the mossy temple's base, from its lit top edge (at y 202): courses of blocks and a row of panels. |
| `temple.mossy.base` | 476 × 92 | 1.3 | tinted, softened sideways by the build (0.2 units) | The mossy temple's base below that: 92 px, from its top (the origin's y), that repeat down to the floor. |
| `temple.mossy.stairs` | 80 × 96 | 1.3 | tinted, softened sideways by the build (0.2 units) | The mossy temple's stairs below the tiers, with their low walls: 8 steps (96 px, from the top of a step at the origin's y) that repeat down to the floor. |
| `temple.basalt.top` | 376 × 206 | 1.3 | tinted, softened sideways by the build (0.2 units), hitbox | The basalt temple down to the top of its base: the shrine, the three tiers and the stairs on them, gold inlay and two braziers. Its origin is the top centre of the shrine (the hitbox's). |
| `temple.basalt.baseTop` | 476 × 92 | 1.3 | tinted, softened sideways by the build (0.2 units) | The first 92 px of the basalt temple's base, from its lit top edge (at y 202): courses of blocks and a row of panels. |
| `temple.basalt.base` | 476 × 92 | 1.3 | tinted, softened sideways by the build (0.2 units) | The basalt temple's base below that: 92 px, from its top (the origin's y), that repeat down to the floor. |
| `temple.basalt.stairs` | 80 × 96 | 1.3 | tinted, softened sideways by the build (0.2 units) | The basalt temple's stairs below the tiers, with their low walls: 8 steps (96 px, from the top of a step at the origin's y) that repeat down to the floor. |
| `temple.leaf.0` … `.7` | 88 × 46 | 1.3 | tinted | A leaf on a temple (the fringe of ferns at its foot, and on the corners of the tiers), 86 px from its base (the origin) along +x, in the greens FRINGE_DEEP, BUSH, FRINGE, BUSH_LIGHT, LEAF_DARK, LEAF, MOSS, MOSS_LIGHT (one frame each); placed, turned and scaled per leaf. |
| `temple.moss.0` … `.1` | 46 × 12 | 1.3 | tinted | A patch of moss on a tier, 22 by 4.5 px (half) about its centre: dark (frame 0) and light (frame 1); stretched sideways. |
| `temple.vine` | 20 × 2 | 1.3 | strip, tinted | A vine hanging from a patch of moss. A straight strip 20 px along +x from the origin, 2 px across; bent along the curve. |
| `temple.haze` | 662 × 241 | 0.65 | tinted | The green haze over the foot of the temple: the top half of nested soft ellipses, about their centre (the origin, 30 px below the temple's floor), down to 40 px above it, where the jungle floor covers it. |
| `temple.flame.0` … `.48` | 18 × 31 | 1.3 |  | A brazier's flame (in the temple's coordinates, its brazier at x 0), in 7 × 7 frames: swayed from 3 px left to 3 px right, each from the lowest to the highest. |
| `temple.glow` | 148 × 148 | 1.3 |  | A layer of the warm light round a brazier in the dark stages: a disc about its centre, at its largest. The glow is sixteen of them, each scaled and faded, added to what is behind it. |

### spider

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `spider.body` | 28 × 37 | 1.3 | hitbox | The spider: abdomen, head, a red mark and four eyes. Its origin is the hitbox centre. |
| `spider.leg` | 20 × 2.5 | 1.3 |  | A spider's leg, from the body out to the knee or from the knee down to the foot. A straight segment 20 px along +x from the origin, 2.5 px across; stretched to each length and turned. |
| `spider.legEnd` | 6 × 6 | 1.3 |  | A round end or joint of spider.leg: a disc 2.5 px across about the origin. |
| `spider.thread` | 20 × 1.5 | 1.3 |  | The thread from the canopy down to the spider. A straight segment 20 px along +x from the origin, 1.5 px across; stretched to each length and turned. |

### snake

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `snake.stalk` | 20 × 7 | 1.3 | strip | The stalk a snake climbs, from the floor up to the top of its climb. A straight strip 20 px along +x from the origin, 7 px across; bent along the curve. |
| `snake.stalkEnd` | 10 × 10 | 1.3 |  | A round end or joint of snake.stalk: a disc 7 px across about the origin. |
| `snake.stalkLeaf.0` … `.1` | 32 × 13 | 1.3 |  | A leaf on the stalk, from its base on the stalk (the origin): pointing up and right (frame 0) and up and left (frame 1). |
| `snake.coil` | 60 × 55 | 1.3 | hitbox | The climbing snake's coils round the stalk. Its origin is the hitbox centre. |
| `snake.head` | 52 × 36 | 1.3 |  | Its neck and head, pointing up (in the coil's coordinates); flipped to point down. |

### bird

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `bird.red.body` | 46 × 24 | 1.3 | hitbox | The red bird, facing +x: tail, body, belly, head, beak and eye. Its origin is the hitbox centre. |
| `bird.red.wing.0` … `.32` | 14 × 30 | 1.3 |  | The red bird's wing (in the body's coordinates), in 33 frames from all the way down to all the way up. |
| `bird.blue.body` | 47 × 30 | 1.3 | hitbox | The blue bird, facing +x: tail, body, belly, crest, head, beak and eye. Its origin is the hitbox centre. |
| `bird.blue.wing.0` … `.32` | 16 × 34 | 1.3 |  | The blue bird's wing (in the body's coordinates), in 33 frames from all the way down to all the way up. |
| `bird.purple.body` | 48 × 29 | 1.3 | hitbox | The purple bird, facing +x: tail, body, belly, crest, head, beak and eye. Its origin is the hitbox centre. |
| `bird.purple.wing.0` … `.32` | 16 × 32 | 1.3 |  | The purple bird's wing (in the body's coordinates), in 33 frames from all the way down to all the way up. |

### bat

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
| `bat.purple.body` | 39 × 25 | 1.3 | hitbox | A purple bat flying, facing +x: body, ears, eye and feet. Its origin is the hitbox centre. |
| `bat.purple.wing.0` … `.40` | 32 × 52 | 1.3 |  | The purple bat's wing (in the body's coordinates, behind it), in 41 frames from all the way down to all the way up. |
| `bat.brown.body` | 39 × 27 | 1.3 | hitbox | A brown bat flying, facing +x: body, ears, eye and feet. Its origin is the hitbox centre. |
| `bat.brown.wing.0` … `.40` | 30 × 49 | 1.3 |  | The brown bat's wing (in the body's coordinates, behind it), in 41 frames from all the way down to all the way up. |
| `bat.grey.body` | 39 × 24 | 1.3 | hitbox | A grey bat flying, facing +x: body, ears, eye and feet. Its origin is the hitbox centre. |
| `bat.grey.wing.0` … `.40` | 35 × 56 | 1.3 |  | The grey bat's wing (in the body's coordinates, behind it), in 41 frames from all the way down to all the way up. |
| `bat.black.body` | 39 × 26 | 1.3 | hitbox | A black bat flying, facing +x: body, ears, eye and feet. Its origin is the hitbox centre. |
| `bat.black.wing.0` … `.40` | 29 × 48 | 1.3 |  | The black bat's wing (in the body's coordinates, behind it), in 41 frames from all the way down to all the way up. |
