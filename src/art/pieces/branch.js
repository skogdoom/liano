import { OBSTACLE_HITBOXES } from '../../config.js';
import {
  BRANCH_TRUNK_WIDTH,
  drawBarkLine,
  drawBranchBody,
  drawPantherBody,
  drawPantherEar,
  drawPantherEyes,
  drawPantherTail,
  drawTrunk,
} from '../../views/obstacles.js';

// The branch and the panther on it. Obstacles grow to 1.3 by stage 4: their pieces are
// rasterized for that scale.
export const OBSTACLE_SCALE = 1.3;

// The panther's tail is a flipbook of TAIL_FRAMES pictures over its swish (±6 px).
export const TAIL_FRAMES = 16;
export const TAIL_SWISH = 6;
export const tailSwishOf = (frame) => -TAIL_SWISH + (2 * TAIL_SWISH * frame) / (TAIL_FRAMES - 1);
export const tailFrameFor = (swish) =>
  Math.min(TAIL_FRAMES - 1, Math.max(0, Math.round(((swish + TAIL_SWISH) / (2 * TAIL_SWISH)) * (TAIL_FRAMES - 1))));

// Stretched pieces are drawn at a reference size and scaled by the rig.
export const TRUNK_REFERENCE = 100; // px from the top of the trunk to its bottom (straight sides: stretched; its top is under the branch)
export const BARK_LINE_LENGTH = 14;

// Obstacles are not tinted with the stage (only the temple and the backdrop are).
const obstacle = { scale: OBSTACLE_SCALE };

export const BRANCH_PIECES = [
  {
    ...obstacle,
    key: 'branch.body',
    purpose: 'The branch: a limb from a cut stub, with a leaf tuft near the tip. Its origin is the hitbox centre.',
    hitbox: OBSTACLE_HITBOXES.branch,
    frames: [(g) => drawBranchBody(g)],
  },
  {
    ...obstacle,
    key: 'branch.barkLine',
    purpose: `A dark line in the bark, ${BARK_LINE_LENGTH} px along +x; four per branch, placed, turned and stretched.`,
    frames: [(g) => drawBarkLine(g, { x0: 0, y0: 0, x1: BARK_LINE_LENGTH, y1: 0 })],
  },
  {
    ...obstacle,
    key: 'branch.trunk',
    purpose: `The trunk a low branch stands on, from its top (the origin) ${TRUNK_REFERENCE} px down; stretched to reach below the floor.`,
    frames: [(g) => drawTrunk(g, 0, 0, TRUNK_REFERENCE, BRANCH_TRUNK_WIDTH)],
  },
];

// A decoration: rasterized at twice the density, as the others (decorations.js).
const decoration = { scale: 2 * OBSTACLE_SCALE };

export const PANTHER_PIECES = [
  {
    ...decoration,
    key: 'panther.body',
    purpose: 'A black panther lying on the branch, head up: the body and head. It breathes (scaled up and down).',
    attach: { ear: [35.5, -22] },
    frames: [(g) => drawPantherBody(g)],
  },
  {
    ...decoration,
    key: 'panther.ear',
    purpose: 'The inside of the ear that flicks, about its own centre (folded by scaling).',
    frames: [(g) => drawPantherEar(g)],
  },
  {
    ...decoration,
    key: 'panther.eyes',
    purpose: 'The eyes: open (frame 0) and shut (frame 1).',
    frames: [(g) => drawPantherEyes(g, false), (g) => drawPantherEyes(g, true)],
  },
  {
    ...decoration,
    key: 'panther.tail',
    purpose: `The tail hanging off the end of the branch, in ${TAIL_FRAMES} frames from its tip swung ${TAIL_SWISH} px one way to as far the other.`,
    frames: Array.from({ length: TAIL_FRAMES }, (_, i) => (g) => drawPantherTail(g, tailSwishOf(i))),
  },
];
