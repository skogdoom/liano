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
} from '../../views/backdrop.js';

// The backdrop: the sky, stretched to the view, and the layers, tiles that repeat sideways,
// scrolled at their own speed. All tinted with the stage.
export const SKY_BAND_HEIGHT = 4;
export const SKY_WIDTH = 4;
const tile = { kind: 'tile', set: 'boot', tint: true };
// The layers in front (the near layer, the canopy and the floor) are dark against light:
// a 1× image stretched on a 2× screen blurs their edges, so they are made up to 2× (the far
// and middle layers are soft, and stay at 1×).
const sharp = { scale: 2 };
// The canopy and the floor move with the world, as fast as the camera: in a fast flight
// their hard edges moved 10–12 points a frame and looked stepped at 60 Hz
// (docs/plans/history/phaser-migration.md, M7), so the build softens them sideways. The
// canopy's 0.4 units is a little under one pixel at 2×. The floor's thin, high-contrast
// shrubs need a little more softening (Safari follow-up, docs/plans/background-motion.md);
// their 0.8 units is 1.6 pixels at 2×.
const CANOPY_SOFTEN = 0.4;
const FLOOR_SOFTEN = 0.8;
// The near layer: its leaf clumps reach this far down from the top of the band, and its
// ferns this far up from the floor line.
export const NEAR_TOP_HEIGHT = 100;
export const NEAR_FERNS = 100;
// The floor tile: from the tallest undergrowth above the floor line to below the lowest.
export const FLOOR_TOP = 34;
export const FLOOR_DEPTH = 40;

export const BACKDROP_PIECES = [
  {
    key: 'backdrop.sky',
    set: 'boot',
    tint: true,
    purpose: `The sky: ${SKY_BANDS} bands of colour from the top of the view (dark) to the floor (light), ${SKY_BAND_HEIGHT} px each and ${SKY_WIDTH} px wide; stretched to the view (the first band carries on above, the last below the floor).`,
    box: { x: 0, y: 0, w: SKY_WIDTH, h: SKY_BANDS * SKY_BAND_HEIGHT },
    frames: [
      (g) => {
        for (let i = 0; i < SKY_BANDS; i++) g.rect(0, i * SKY_BAND_HEIGHT, SKY_WIDTH, SKY_BAND_HEIGHT).fill(skyBand(i));
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
  // The near layer's two strips (between them it is empty): sharp, in front of the others.
  {
    ...tile,
    ...sharp,
    key: 'backdrop.nearTop',
    purpose: 'The near layer under the canopy: clumps of leaves hanging down. One tile, repeating sideways.',
    box: { x: 0, y: 0, w: TILE, h: NEAR_TOP_HEIGHT },
    frames: [(g) => drawNearLayer(g)],
  },
  {
    ...tile,
    ...sharp,
    key: 'backdrop.near',
    purpose: 'The near layer along the floor: ferns. One tile, repeating sideways.',
    // From the tallest fern's tip to its foot, a little below the floor line.
    box: { x: 0, y: FLOOR_Y - NEAR_FERNS, w: TILE, h: NEAR_FERNS + 24 },
    frames: [(g) => drawNearLayer(g)],
  },
  {
    ...tile,
    ...sharp,
    key: 'backdrop.canopy',
    soften: CANOPY_SOFTEN,
    purpose: 'The canopy strip the lianas hang from, in front of the world, with a leafy top edge for taller views. One tile, repeating sideways.',
    // From the bumps of the leafy top edge to the leaves hanging under the strip.
    box: { x: 0, y: -SKY_MARGIN - 30, w: TILE, h: CANOPY_BOTTOM + 24 + SKY_MARGIN + 30 },
    frames: [(g) => drawCanopyLayer(g)],
  },
  {
    ...tile,
    ...sharp,
    key: 'backdrop.floor',
    soften: FLOOR_SOFTEN,
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
