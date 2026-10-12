import { LIANA_LENGTH } from '../../config.js';
import { LIANA_PALETTES } from '../../render/lianaView.js';
import { leafPoints } from '../../render/shapes.js';

// A liana: the rope and the tip flash are straight strips along +x, bent along the rope's
// points by the rig; a round cap reaches half the width past each end. Each liana's
// leaves are placed on it as the code places them today.
export const ROPE_WIDTH = 7;
export const FLASH_WIDTH = 5;
export const FLASH_LENGTH = LIANA_LENGTH / 2; // the lower 7 of the 14 segments
export const LEAF_REFERENCE = 17; // the longest leaf on a liana

const palette = LIANA_PALETTES[0];
const strip = (g, length, layers) => {
  for (const [width, color] of layers) g.moveTo(0, 0).lineTo(length, 0).stroke({ width, color, cap: 'round', join: 'round' });
  return g;
};

export const LIANA_PIECES = [
  {
    key: 'liana.rope',
    purpose: `A liana's rope: a straight strip ${LIANA_LENGTH} px along +x from the anchor, bent along the swinging rope.`,
    kind: 'strip',
    set: 'boot',
    length: LIANA_LENGTH,
    // Rasterized at twice the density: a thin strip turned at an angle is sampled more
    // smoothly when it is scaled down than when it is drawn 1:1.
    scale: 2,
    frames: [(g) => strip(g, LIANA_LENGTH, [[ROPE_WIDTH, palette.ropeDark], [4, palette.rope]])],
  },
  {
    key: 'liana.flash',
    purpose: 'The lit lower half of a liana, when the grip is about to slip off the end; bent like the rope.',
    kind: 'strip',
    set: 'boot',
    length: FLASH_LENGTH,
    scale: 2,
    frames: [(g) => strip(g, FLASH_LENGTH, [[FLASH_WIDTH, 0xffd23f]])],
  },
  {
    key: 'liana.leaf',
    purpose: `A leaf on a liana, ${LEAF_REFERENCE} px from its base (the origin) along +x: light (frame 0) and dark (frame 1). Placed, turned and scaled per leaf.`,
    set: 'boot',
    frames: [
      (g) => g.poly(leafPoints(0, 0, 0, LEAF_REFERENCE, LEAF_REFERENCE * 0.5)).fill(palette.leaf),
      (g) => g.poly(leafPoints(0, 0, 0, LEAF_REFERENCE, LEAF_REFERENCE * 0.5)).fill(palette.leafDark),
    ],
  },
];
