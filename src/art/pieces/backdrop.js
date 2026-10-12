import { drawFarLayer, EXTEND_UP, FLOOR_Y, TILE } from '../../render/background.js';

// The backdrop layers: tiles that repeat sideways, scrolled at their own speed and
// tinted with the stage. M4: the far layer (the others follow with the backdrop, M5d).
export const BACKDROP_PIECES = [
  {
    key: 'backdrop.far',
    purpose: 'The far layer of the jungle: hazy tree trunks and canopy masses. One tile, repeating sideways.',
    kind: 'tile',
    set: 'boot',
    tint: true,
    // Crowns reach 130 px above the highest trunk top.
    box: { x: 0, y: -EXTEND_UP - 130, w: TILE, h: FLOOR_Y + EXTEND_UP + 130 },
    frames: [(g) => drawFarLayer(g)],
  },
];
