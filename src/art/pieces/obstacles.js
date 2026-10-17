import { OBSTACLE_HITBOXES } from '../../config.js';
import {
  BEE_WING_MAX,
  HIVE_TRUNK,
  LINE_COLORS,
  ROCK_VARIANTS,
  STEM,
  VINE_WIDTH,
  drawBee,
  drawBeeWing,
  drawHiveArm,
  drawHiveNest,
  drawRockBody,
  drawRockLedge,
  drawRockSling,
  drawStem,
  drawThorn,
  drawThornBushBody,
  drawThornBushMound,
} from '../../views/obstacles.js';
import { OBSTACLE_SCALE } from './branch.js';
import { linePieces } from './lines.js';

// The static obstacles other than the branch, and what they hang from or stand on.
const obstacle = { scale: OBSTACLE_SCALE };
// Tiny and placed anywhere (between pixels): rasterized at twice the density, so they are
// sampled smoothly.
const small = { scale: 2 * OBSTACLE_SCALE };

// Stems are drawn STEM_REFERENCE long and stretched (straight sides) to each length; their
// tops are hidden (under the ledge or the bush). The trunk beside a low beehive shows its
// top, so it is drawn as long as the longest (HIVE_TRUNK_REFERENCE, from above the hive
// down past the floor): only ever shrunk, its top edge stays sharp.
export const STEM_REFERENCE = 100;
export const HIVE_TRUNK_REFERENCE = 480;

export const SUPPORT_PIECES = [
  ...linePieces({
    ...obstacle,
    key: 'support.vine',
    curve: true,
    width: VINE_WIDTH,
    color: LINE_COLORS.vine,
    purpose: 'The vine a high obstacle hangs from, from the canopy down to it.',
  }),
  {
    ...obstacle,
    key: 'support.stem',
    purpose: `The stem a low thorn bush or rock stands on, from its top (the origin) ${STEM_REFERENCE} px down; stretched to reach below the floor.`,
    frames: [(g) => drawStem(g, 0, 0, STEM_REFERENCE, STEM.halfTop, STEM.halfBottom)],
  },
  {
    ...obstacle,
    key: 'support.hiveTrunk',
    purpose: `The trunk beside a low beehive, from its top (the origin) ${HIVE_TRUNK_REFERENCE} px down; shrunk to reach below the floor.`,
    frames: [(g) => drawStem(g, 0, 0, HIVE_TRUNK_REFERENCE, HIVE_TRUNK.halfTop, HIVE_TRUNK.halfBottom)],
  },
];

export const THORN_BUSH_PIECES = [
  {
    ...obstacle,
    key: 'thornBush.body',
    purpose: 'The thorn bush: three dark circles with a highlight each. Its origin is the hitbox centre.',
    hitbox: OBSTACLE_HITBOXES.thornBush,
    frames: [(g) => drawThornBushBody(g)],
  },
  {
    ...obstacle,
    key: 'thornBush.thorn',
    purpose: 'A thorn, its base at the origin, pointing along +x; placed round the outline and turned.',
    frames: [(g) => drawThorn(g)],
  },
  {
    ...obstacle,
    key: 'thornBush.mound',
    purpose: 'The mound a low thorn bush grows from (in the bush\'s coordinates).',
    frames: [(g) => drawThornBushMound(g)],
  },
];

export const ROCK_PIECES = [
  {
    ...obstacle,
    key: 'rock.body',
    purpose: `The rock, in ${ROCK_VARIANTS} outlines (one frame each, picked by gap): grey, with a lit and a shaded facet. Its origin is the hitbox centre.`,
    hitbox: OBSTACLE_HITBOXES.rock,
    frames: Array.from({ length: ROCK_VARIANTS }, (_, i) => (g) => drawRockBody(g, i)),
  },
  {
    ...obstacle,
    key: 'rock.sling',
    purpose: "The vine's loop round a hanging rock (in the rock's coordinates).",
    frames: [(g) => drawRockSling(g)],
  },
  {
    ...obstacle,
    key: 'rock.ledge',
    purpose: 'The ledge a low rock sits on (in the rock\'s coordinates).',
    frames: [(g) => drawRockLedge(g)],
  },
];

export const BEEHIVE_PIECES = [
  {
    ...obstacle,
    key: 'beehive.nest',
    purpose: 'The beehive: a teardrop in gold paper bands with a dark entrance at the bottom. Its origin is the hitbox centre.',
    hitbox: OBSTACLE_HITBOXES.beehive,
    frames: [(g) => drawHiveNest(g)],
  },
  {
    ...obstacle,
    key: 'beehive.arm',
    purpose: 'The arm over a low beehive from the trunk beside it, and the rope the nest hangs on (in the hive\'s coordinates).',
    frames: [(g) => drawHiveArm(g)],
  },
  {
    ...obstacle,
    ...small,
    key: 'bee.body',
    purpose: 'A bee: a round yellow body with a dark stripe, about the origin.',
    frames: [(g) => drawBee(g)],
  },
  {
    ...obstacle,
    ...small,
    key: 'bee.wing',
    purpose: `A bee's wing at its widest (${BEE_WING_MAX} px half height), about its centre; squeezed as it beats.`,
    frames: [(g) => drawBeeWing(g)],
  },
];
