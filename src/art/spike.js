import { LIANA_LENGTH } from '../config.js';
import { drawFarLayer, EXTEND_UP, FLOOR_Y, TILE } from '../render/background.js';
import { LIANA_PALETTES } from '../render/lianaView.js';
import {
  BRANCH_TRUNK_WIDTH,
  drawBarkLine,
  drawBranchBody,
  drawPantherBody,
  drawPantherEar,
  drawPantherEyes,
  drawPantherTail,
  drawTrunk,
} from '../render/obstacleViews.js';
import { leafPoints } from '../render/shapes.js';

// The pieces of the M1 spike (PHASER_PLAN.md, M1): the far backdrop layer, a branch on a
// trunk with a panther, and a liana. Each piece is drawn by today's drawing code; `frames`
// are its pictures (one for a still piece), all in the same box. `scale` is the largest
// scale the game draws it at, before the screen's (the obstacles grow to 1.3 by stage 4).
//
// A piece's origin is the point the rig places it at, so pieces of one object share it.

// The panther's tail is a flipbook of TAIL_FRAMES pictures over its swish (±6 px).
export const TAIL_FRAMES = 16;
export const TAIL_SWISH = 6;
export const tailSwishOf = (frame) => -TAIL_SWISH + (2 * TAIL_SWISH * frame) / (TAIL_FRAMES - 1);
export const tailFrameFor = (swish) =>
  Math.min(TAIL_FRAMES - 1, Math.max(0, Math.round(((swish + TAIL_SWISH) / (2 * TAIL_SWISH)) * (TAIL_FRAMES - 1))));

// Stretched pieces are drawn at a reference size and scaled by the rig.
export const TRUNK_REFERENCE = 100; // px from the top of the trunk to its bottom (straight sides: stretched)
export const BARK_LINE_LENGTH = 14;
export const LEAF_REFERENCE = 17; // the longest leaf on a liana
// The rope and the tip flash are straight strips along +x, bent along the rope's points
// by the rig; a round cap reaches half the width past each end.
export const ROPE_WIDTH = 7;
export const FLASH_WIDTH = 5;
export const FLASH_LENGTH = LIANA_LENGTH / 2; // the lower 7 of the 14 segments

const OBSTACLE_SCALE = 1.3;
const palette = LIANA_PALETTES[0];

const strip = (g, length, layers) => {
  for (const [width, color] of layers) g.moveTo(0, 0).lineTo(length, 0).stroke({ width, color, cap: 'round', join: 'round' });
  return g;
};

export const SPIKE_PIECES = [
  {
    key: 'backdrop.far',
    // One tile: it repeats every TILE px. Crowns reach 130 px above the highest trunk top.
    box: { x: 0, y: -EXTEND_UP - 130, w: TILE, h: FLOOR_Y + EXTEND_UP + 130 },
    scale: 1,
    tint: true,
    frames: [(g) => drawFarLayer(g)],
  },
  { key: 'branch.body', scale: OBSTACLE_SCALE, tint: true, frames: [(g) => drawBranchBody(g)] },
  {
    key: 'branch.barkLine',
    scale: OBSTACLE_SCALE,
    tint: true,
    frames: [(g) => drawBarkLine(g, { x0: 0, y0: 0, x1: BARK_LINE_LENGTH, y1: 0 })],
  },
  {
    key: 'branch.trunk',
    scale: OBSTACLE_SCALE,
    tint: true,
    frames: [(g) => drawTrunk(g, 0, 0, TRUNK_REFERENCE, BRANCH_TRUNK_WIDTH)],
  },
  { key: 'panther.body', scale: OBSTACLE_SCALE, tint: true, frames: [(g) => drawPantherBody(g)] },
  { key: 'panther.ear', scale: OBSTACLE_SCALE, tint: true, frames: [(g) => drawPantherEar(g)] },
  {
    key: 'panther.eyes',
    scale: OBSTACLE_SCALE,
    tint: true,
    frames: [(g) => drawPantherEyes(g, false), (g) => drawPantherEyes(g, true)],
  },
  {
    key: 'panther.tail',
    scale: OBSTACLE_SCALE,
    tint: true,
    frames: Array.from({ length: TAIL_FRAMES }, (_, i) => (g) => drawPantherTail(g, tailSwishOf(i))),
  },
  {
    key: 'liana.rope',
    // Rasterized at twice the density: a thin strip turned at an angle is sampled more
    // smoothly when it is scaled down than when it is drawn 1:1.
    scale: 2,
    tint: false,
    frames: [(g) => strip(g, LIANA_LENGTH, [[ROPE_WIDTH, palette.ropeDark], [4, palette.rope]])],
  },
  {
    key: 'liana.flash',
    scale: 2,
    tint: false,
    frames: [(g) => strip(g, FLASH_LENGTH, [[FLASH_WIDTH, 0xffd23f]])],
  },
  {
    key: 'liana.leaf',
    scale: 1,
    tint: false,
    frames: [
      (g) => g.poly(leafPoints(0, 0, 0, LEAF_REFERENCE, LEAF_REFERENCE * 0.5)).fill(palette.leaf),
      (g) => g.poly(leafPoints(0, 0, 0, LEAF_REFERENCE, LEAF_REFERENCE * 0.5)).fill(palette.leafDark),
    ],
  },
];
