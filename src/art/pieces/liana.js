import { LIANA_LENGTH } from '../../config.js';
import { LIANA_PALETTES, TIP_FLASH } from '../../views/liana.js';
import { leafPoints } from '../../render/shapes.js';
import { SHADOW_ALPHA, SHADOW_LIANA } from '../../views/shadow.js';

// A liana: the rope and the tip flash are straight strips along +x, bent along the rope's
// points by the rig; a round cap reaches half the width past each end. Each liana's
// leaves are placed on it as the code places them today. In three colourings: green (the
// lianas), gold (player 2's own in shared screen) and the shadow's grey (drawn
// see-through).
export const ROPE_WIDTH = 7;
export const FLASH_WIDTH = 5;
export const FLASH_LENGTH = LIANA_LENGTH / 2; // the lower 7 of the 14 segments
export const LEAF_REFERENCE = 17; // the longest leaf on a liana

const strip = (g, length, layers) => {
  for (const [width, color] of layers) g.moveTo(0, 0).lineTo(length, 0).stroke({ width, color, cap: 'round', join: 'round' });
  return g;
};
const leaf = (g, color) => g.poly(leafPoints(0, 0, 0, LEAF_REFERENCE, LEAF_REFERENCE * 0.5)).fill(color);

// The shadow's lianas are see-through (SHADOW_ALPHA), shape by shape as the Pixi version
// draws them, so their pieces are drawn so.
const COLOURINGS = [
  ['green', LIANA_PALETTES[0], 'boot', 'the lianas', {}],
  ['gold', LIANA_PALETTES[1], 'main', "player 2's own lianas in shared screen", {}],
  ['shadow', SHADOW_LIANA, 'main', "the shadow monkey's lianas (see-through)", { alpha: SHADOW_ALPHA }],
];

export const LIANA_PIECES = [
  ...COLOURINGS.flatMap(([name, palette, set, whose, seeThrough]) => [
    {
      ...seeThrough,
      key: `liana.${name}.rope`,
      set,
      purpose: `The rope of ${whose}: a straight strip ${LIANA_LENGTH} px along +x from the anchor (the origin), bent along the swinging rope.`,
      kind: 'strip',
      length: LIANA_LENGTH,
      // Rasterized at twice the density: a thin strip turned at an angle is sampled more
      // smoothly when it is scaled down than when it is drawn 1:1.
      scale: 2,
      frames: [(g) => strip(g, LIANA_LENGTH, [[ROPE_WIDTH, palette.ropeDark], [4, palette.rope]])],
    },
    {
      ...seeThrough,
      key: `liana.${name}.leaf`,
      set,
      // Turned per leaf: rasterized at twice the density, like the rope.
      scale: 2,
      purpose: `A leaf on ${whose}, ${LEAF_REFERENCE} px from its base (the origin) along +x: light (frame 0) and dark (frame 1). Placed, turned and scaled per leaf.`,
      frames: [(g) => leaf(g, palette.leaf), (g) => leaf(g, palette.leafDark)],
    },
  ]),
  {
    key: 'liana.flash',
    set: 'boot',
    purpose: 'The lit lower half of a liana, when the grip is about to slip off the end; bent like the rope.',
    kind: 'strip',
    length: FLASH_LENGTH,
    scale: 2,
    frames: [(g) => strip(g, FLASH_LENGTH, [[FLASH_WIDTH, TIP_FLASH]])],
  },
];
