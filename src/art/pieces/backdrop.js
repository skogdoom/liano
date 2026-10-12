import { WORLD_HEIGHT } from '../../config.js';
import {
  CANOPY_BOTTOM,
  EXTEND_DOWN,
  EXTEND_UP,
  FLOOR_Y,
  SKY_BANDS,
  SKY_MARGIN,
  TILE,
  drawCanopyLayer,
  drawFarLayer,
  drawFloorLayer,
  drawMidLayer,
  drawNearLayer,
  skyBand,
} from '../../render/background.js';

// The backdrop: the sky, stretched to the view, and the layers, tiles that repeat sideways,
// scrolled at their own speed. All tinted with the stage.
export const SKY_BAND_HEIGHT = 4;
const tile = { kind: 'tile', set: 'boot', tint: true };
// The floor tile: from the tallest undergrowth above the floor line to below the lowest.
export const FLOOR_TOP = 34;
export const FLOOR_DEPTH = 40;

export const BACKDROP_PIECES = [
  {
    key: 'backdrop.sky',
    set: 'boot',
    tint: true,
    purpose: `The sky: ${SKY_BANDS} bands of colour from the top of the view (dark) to the floor (light), ${SKY_BAND_HEIGHT} px each and 1 px wide; stretched to the view (the last band carries on below the floor).`,
    box: { x: 0, y: 0, w: 1, h: SKY_BANDS * SKY_BAND_HEIGHT },
    frames: [
      (g) => {
        for (let i = 0; i < SKY_BANDS; i++) g.rect(0, i * SKY_BAND_HEIGHT, 1, SKY_BAND_HEIGHT).fill(skyBand(i));
        return g;
      },
    ],
  },
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
  {
    ...tile,
    key: 'backdrop.mid',
    purpose: 'The middle layer: darker trunks with a few branch stubs. One tile, repeating sideways.',
    box: { x: 0, y: -EXTEND_UP, w: TILE, h: FLOOR_Y + 10 + EXTEND_UP },
    frames: [(g) => drawMidLayer(g)],
  },
  {
    ...tile,
    key: 'backdrop.near',
    purpose: 'The near layer: ferns along the floor and leaf clumps under the canopy. One tile, repeating sideways.',
    // From the clumps under the canopy to the ferns' feet, a little below the floor line.
    box: { x: 0, y: 0, w: TILE, h: FLOOR_Y + 24 },
    frames: [(g) => drawNearLayer(g)],
  },
  {
    ...tile,
    key: 'backdrop.canopy',
    purpose: 'The canopy strip the lianas hang from, in front of the world, with a leafy top edge for taller views. One tile, repeating sideways.',
    // From the bumps of the leafy top edge to the leaves hanging under the strip.
    box: { x: 0, y: -SKY_MARGIN - 30, w: TILE, h: CANOPY_BOTTOM + 24 + SKY_MARGIN + 30 },
    frames: [(g) => drawCanopyLayer(g)],
  },
  {
    ...tile,
    key: 'backdrop.floor',
    purpose: `The top of the dark jungle floor, in front of the world: undergrowth along the floor line. One tile, repeating sideways; below it the floor is backdrop.floorFill, stretched down ${EXTEND_DOWN} px below the band for taller views.`,
    box: { x: 0, y: FLOOR_Y - FLOOR_TOP, w: TILE, h: FLOOR_TOP + FLOOR_DEPTH },
    frames: [(g) => drawFloorLayer(g)],
  },
  {
    key: 'backdrop.floorFill',
    set: 'boot',
    tint: true,
    purpose: "The floor's colour below the undergrowth, a small square stretched to fill the rest of the floor.",
    box: { x: 0, y: WORLD_HEIGHT, w: 4, h: 4 },
    frames: [(g) => drawFloorLayer(g)],
  },
];
