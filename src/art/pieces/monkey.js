import {
  ARM,
  LEG,
  LIMBS,
  PALETTES,
  drawArm,
  drawDeadEyes,
  drawLeg,
  drawMonkeyEyes,
  drawMonkeyHead,
  drawMonkeyTail,
  drawTorso,
} from '../../views/monkey.js';
import { SHADOW_ALPHA, SHADOW_FUR } from '../../views/shadow.js';

// The monkey, per palette: player 1 (brown), player 2 (ginger) and the shadow (grey,
// drawn see-through). The body turns and faces either way; the limbs turn about their
// pivots (the torso's attachment points); the eyes show open or, after a fall, crossed.
// The shadow is see-through (SHADOW_ALPHA), shape by shape as the Pixi version draws it,
// so its pieces are drawn so: they then show at full opacity.
const FURS = [
  ['p1', PALETTES[0], 'boot', {}],
  ['p2', PALETTES[1], 'main', {}],
  ['shadow', SHADOW_FUR, 'main', { alpha: SHADOW_ALPHA }],
];

const who = { p1: 'player 1', p2: 'player 2', shadow: 'the shadow monkey' };
// Rasterized at twice the density: its parts turn all the time, and a picture turned at an
// angle is sampled more smoothly when it is scaled down than when it is drawn 1:1.
const turning = { scale: 2 };

export const MONKEY_PIECES = [
  ...FURS.flatMap(([name, palette, set, seeThrough]) => [
    {
      ...turning,
      ...seeThrough,
      key: `monkey.${name}.tail`,
      set,
      purpose: `The tail of ${who[name]}, behind everything else.`,
      frames: [(g) => drawMonkeyTail(g, palette)],
    },
    {
      ...turning,
      ...seeThrough,
      key: `monkey.${name}.leg`,
      set,
      purpose: `A leg of ${who[name]}, ${LEG.length} px down from its hip (the origin); it turns about the hip.`,
      frames: [(g) => drawLeg(g, palette)],
    },
    {
      ...turning,
      ...seeThrough,
      key: `monkey.${name}.arm`,
      set,
      purpose: `An arm of ${who[name]}, ${ARM.length} px down from its shoulder (the origin); it turns about the shoulder.`,
      frames: [(g) => drawArm(g, palette)],
    },
    {
      ...turning,
      ...seeThrough,
      key: `monkey.${name}.torso`,
      set,
      purpose: `The body of ${who[name]}; its origin is the centre of the monkey's hitbox. The limbs join it at the attachment points.`,
      attach: Object.fromEntries(Object.entries(LIMBS).map(([limb, { x, y }]) => [limb, [x, y]])),
      frames: [(g) => drawTorso(g, palette)],
    },
    {
      ...turning,
      ...seeThrough,
      key: `monkey.${name}.head`,
      set,
      purpose: `The head of ${who[name]} (ears, face, muzzle), over the body.`,
      frames: [(g) => drawMonkeyHead(g, palette)],
    },
  ]),
  {
    ...turning,
    key: 'monkey.eyes',
    set: 'boot',
    purpose: "The monkey's eyes: open (frame 0), and crossed after a fall (frame 1).",
    frames: [(g) => drawMonkeyEyes(g), (g) => drawDeadEyes(g)],
  },
  {
    ...turning,
    alpha: SHADOW_ALPHA,
    key: 'monkey.shadow.eyes',
    purpose: "The shadow monkey's eyes, see-through: open (frame 0), and crossed after a fall (frame 1).",
    frames: [(g) => drawMonkeyEyes(g), (g) => drawDeadEyes(g)],
  },
];
