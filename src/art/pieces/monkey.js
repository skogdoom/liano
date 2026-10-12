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
} from '../../render/monkeyView.js';
import { SHADOW_FUR } from '../../render/shadowView.js';

// The monkey, per palette: player 1 (brown), player 2 (ginger) and the shadow (grey,
// drawn see-through). The body turns and faces either way; the limbs turn about their
// pivots (the torso's attachment points); the eyes show open or, after a fall, crossed.
const FURS = [
  ['p1', PALETTES[0], 'boot'],
  ['p2', PALETTES[1], 'main'],
  ['shadow', SHADOW_FUR, 'main'],
];

const who = { p1: 'player 1', p2: 'player 2', shadow: 'the shadow monkey' };

export const MONKEY_PIECES = [
  ...FURS.flatMap(([name, palette, set]) => [
    {
      key: `monkey.${name}.tail`,
      set,
      purpose: `The tail of ${who[name]}, behind everything else.`,
      frames: [(g) => drawMonkeyTail(g, palette)],
    },
    {
      key: `monkey.${name}.leg`,
      set,
      purpose: `A leg of ${who[name]}, ${LEG.length} px down from its hip (the origin); it turns about the hip.`,
      frames: [(g) => drawLeg(g, palette)],
    },
    {
      key: `monkey.${name}.arm`,
      set,
      purpose: `An arm of ${who[name]}, ${ARM.length} px down from its shoulder (the origin); it turns about the shoulder.`,
      frames: [(g) => drawArm(g, palette)],
    },
    {
      key: `monkey.${name}.torso`,
      set,
      purpose: `The body of ${who[name]}; its origin is the centre of the monkey's hitbox. The limbs join it at the attachment points.`,
      attach: Object.fromEntries(Object.entries(LIMBS).map(([limb, { x, y }]) => [limb, [x, y]])),
      frames: [(g) => drawTorso(g, palette)],
    },
    {
      key: `monkey.${name}.head`,
      set,
      purpose: `The head of ${who[name]} (ears, face, muzzle), over the body.`,
      frames: [(g) => drawMonkeyHead(g, palette)],
    },
  ]),
  {
    key: 'monkey.eyes',
    set: 'boot',
    purpose: "The monkey's eyes: open (frame 0), and crossed after a fall (frame 1).",
    frames: [(g) => drawMonkeyEyes(g), (g) => drawDeadEyes(g)],
  },
];
