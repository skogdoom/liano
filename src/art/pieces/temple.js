import { OBSTACLE_HITBOXES } from '../../config.js';
import {
  TEMPLE_BRAZIERS,
  TEMPLE_GREENS,
  TEMPLE_HAZE,
  TEMPLE_MOSS_RY,
  TEMPLE_PANEL_ROW,
  TEMPLE_STAIRS,
  TEMPLE_STEP,
  TEMPLE_STYLES,
  TEMPLE_VINE_WIDTH,
  drawTempleBrazier,
  drawTempleComb,
  drawTempleFlame,
  drawTempleFret,
  drawTempleGlow,
  drawTempleGold,
  drawTempleHaze,
  drawTempleLeaf,
  drawTempleMoss,
  drawTemplePanels,
  drawTempleSerpent,
  drawTempleShrine,
  drawTempleStairs,
  drawTempleTier,
  drawTempleTierFerns,
} from '../../views/obstacles.js';
import { OBSTACLE_SCALE } from './branch.js';
import { flipbook } from './decorations.js';
import { linePieces } from './lines.js';

// The temple, in four looks. What stays the same height is one picture per look (the
// three tiers, the stairs on them, the shrine and the look's details); the base and the
// stairs below the tiers reach down to the floor, which depends on how high the temple
// stands, so they are pictures that repeat, stacked down to it (the last one cropped). Moss, vines and leaves are placed as the
// code places them; the haze sits on the floor. The stone and greenery take the stage tint
// like the backdrop; the braziers' flames and glow do not.
export const TEMPLE_LOOKS = ['limestone', 'sandstone', 'mossy', 'basalt'];
const [, tierA, tierB, tierC, base] = OBSTACLE_HITBOXES.temple;

// Where the top picture ends and the base starts.
export const TEMPLE_BASE_Y = base.dy;
// The leaves are drawn TEMPLE_LEAF_REFERENCE long and half as wide (the largest), and
// scaled to each; the moss TEMPLE_MOSS_REFERENCE across (half), stretched sideways.
export const TEMPLE_LEAF_REFERENCE = 86;
// The haze's centre is at least this far below the jungle floor's top edge (the floor
// line), which hides everything under it: 30 below the temple's floor, which is 20 world
// px below the line (15 at the largest scale, 1.3); a little less, for a margin.
export const HAZE_FLOOR = 40;
// The stairs repeat every TEMPLE_STAIRS_REPEAT steps.
export const TEMPLE_STAIRS_REPEAT = 8;
export const TEMPLE_MOSS_REFERENCE = 22;
export const TEMPLE_LEAF_COLORS = Object.keys(TEMPLE_GREENS);
// The flame is a flipbook over its sway (±3 px) and its height (k, 0 to 1), frame
// sway × TEMPLE_FLAME_HEIGHTS + height.
export const FLAME_SWAY = flipbook(7, -3, 3);
export const FLAME_HEIGHT = flipbook(7, 0, 1);
export const flameFrameFor = (sway, k) => FLAME_SWAY.frameFor(sway) * FLAME_HEIGHT.frames + FLAME_HEIGHT.frameFor(k);

const temple = { scale: OBSTACLE_SCALE, tint: true };

function drawTop(g, look) {
  const style = TEMPLE_STYLES[look];
  for (const r of [tierC, tierB, tierA]) drawTempleTier(g, style, r);
  drawTempleStairs(g, style, TEMPLE_STAIRS.y, base.dy + TEMPLE_STEP);
  drawTempleShrine(g, style, look);
  if (look === 0) drawTempleFret(g, style);
  else if (look === 1) drawTempleComb(g, style);
  else if (look === 2) {
    for (const side of [-1, 1]) drawTempleSerpent(g, style, side);
    for (const r of [tierA, tierB, tierC]) drawTempleTierFerns(g, r, [TEMPLE_GREENS.MOSS, TEMPLE_GREENS.MOSS_LIGHT], 22, 7, 10, 5, [-1.1, -2.0]);
  } else {
    drawTempleGold(g);
    for (const x of TEMPLE_BRAZIERS) drawTempleBrazier(g, style, x);
  }
  return g;
}

const looks = TEMPLE_LOOKS.flatMap((name, look) => {
  const style = TEMPLE_STYLES[look];
  return [
    {
      ...temple,
      key: `temple.${name}.top`,
      purpose: `The ${name} temple down to the top of its base: the shrine, the three tiers and the stairs on them${['', ', a stepped fret on the shrine', ', a roof comb over the shrine', ', serpent heads on the stairs and moss', ', gold inlay and two braziers'][look + 1]}. Its origin is the top centre of the shrine (the hitbox's).`,
      hitbox: OBSTACLE_HITBOXES.temple,
      box: { x: tierC.dx - 4, y: -4, w: tierC.w + 8, h: base.dy + 4 },
      frames: [(g) => drawTop(g, look)],
    },
    {
      ...temple,
      key: `temple.${name}.baseTop`,
      purpose: `The first ${TEMPLE_PANEL_ROW} px of the ${name} temple's base, from its lit top edge (at y ${base.dy}): courses of blocks and a row of panels.`,
      box: { x: base.dx, y: base.dy, w: base.w, h: TEMPLE_PANEL_ROW },
      frames: [(g) => drawTemplePanels(drawTempleTier(g, style, base, base.dy + 2 * TEMPLE_PANEL_ROW), style, base.dy + 40)],
    },
    {
      ...temple,
      key: `temple.${name}.base`,
      purpose: `The ${name} temple's base below that: ${TEMPLE_PANEL_ROW} px, from its top (the origin's y), that repeat down to the floor.`,
      box: { x: base.dx, y: 0, w: base.w, h: TEMPLE_PANEL_ROW },
      frames: [
        (g) => {
          drawTempleTier(g, style, { ...base, dy: -TEMPLE_PANEL_ROW }, 2 * TEMPLE_PANEL_ROW);
          for (const y of [40 - TEMPLE_PANEL_ROW, 40]) drawTemplePanels(g, style, y);
          return g;
        },
      ],
    },
    {
      ...temple,
      key: `temple.${name}.stairs`,
      purpose: `The ${name} temple's stairs below the tiers, with their low walls: ${TEMPLE_STAIRS_REPEAT} steps (${TEMPLE_STAIRS_REPEAT * TEMPLE_STEP} px, from the top of a step at the origin's y) that repeat down to the floor.`,
      box: { x: TEMPLE_STAIRS.x - TEMPLE_STAIRS.wall, y: 0, w: TEMPLE_STAIRS.w + 2 * TEMPLE_STAIRS.wall, h: TEMPLE_STAIRS_REPEAT * TEMPLE_STEP },
      frames: [(g) => drawTempleStairs(g, style, 0, (TEMPLE_STAIRS_REPEAT + 1) * TEMPLE_STEP)],
    },
  ];
});

export const TEMPLE_PIECES = [
  ...looks,
  {
    ...temple,
    key: 'temple.leaf',
    purpose: `A leaf on a temple (the fringe of ferns at its foot, and on the corners of the tiers), ${TEMPLE_LEAF_REFERENCE} px from its base (the origin) along +x, in the greens ${TEMPLE_LEAF_COLORS.join(', ')} (one frame each); placed, turned and scaled per leaf.`,
    frames: Object.values(TEMPLE_GREENS).map((color) => (g) => drawTempleLeaf(g, { x: 0, y: 0, a: 0, length: TEMPLE_LEAF_REFERENCE, width: TEMPLE_LEAF_REFERENCE / 2, color })),
  },
  {
    ...temple,
    key: 'temple.moss',
    purpose: `A patch of moss on a tier, ${TEMPLE_MOSS_REFERENCE} by ${TEMPLE_MOSS_RY} px (half) about its centre: dark (frame 0) and light (frame 1); stretched sideways.`,
    frames: [TEMPLE_GREENS.MOSS, TEMPLE_GREENS.MOSS_LIGHT].map((color) => (g) => drawTempleMoss(g, { x: 0, y: 0, rx: TEMPLE_MOSS_REFERENCE, color }, 1)),
  },
  ...linePieces({ ...temple, key: 'temple.vine', curve: true, joints: false, width: TEMPLE_VINE_WIDTH, color: TEMPLE_GREENS.MOSS, purpose: 'A vine hanging from a patch of moss.' }),
  {
    ...temple,
    key: 'temple.haze',
    // Soft, so rasterized at half the scale (PHASER_PLAN.md, R2); only its top half shows,
    // the rest is behind the floor.
    scale: OBSTACLE_SCALE / 2,
    purpose: `The green haze over the foot of the temple: the top half of nested soft ellipses, about their centre (the origin, 30 px below the temple's floor), down to ${HAZE_FLOOR} px above it, where the jungle floor covers it.`,
    box: { x: -TEMPLE_HAZE.rx - 1, y: -TEMPLE_HAZE.ry - 1, w: 2 * TEMPLE_HAZE.rx + 2, h: TEMPLE_HAZE.ry + 1 - HAZE_FLOOR },
    frames: [(g) => drawTempleHaze(g, -30)],
  },
  {
    ...temple,
    tint: false,
    key: 'temple.flame',
    purpose: `A brazier's flame (in the temple's coordinates, its brazier at x 0), in ${FLAME_SWAY.frames} × ${FLAME_HEIGHT.frames} frames: swayed from 3 px left to 3 px right, each from the lowest to the highest.`,
    frames: Array.from({ length: FLAME_SWAY.frames * FLAME_HEIGHT.frames }, (_, i) => (g) => {
      const sway = FLAME_SWAY.valueOf(Math.floor(i / FLAME_HEIGHT.frames));
      const k = FLAME_HEIGHT.valueOf(i % FLAME_HEIGHT.frames);
      return drawTempleFlame(g, 0, { sway, top: tierA.dy - 16 - 20 - 9 * k });
    }),
  },
  {
    ...temple,
    tint: false,
    key: 'temple.glow',
    purpose: "The warm light round a brazier in the dark stages (in the temple's coordinates, its brazier at x 0); added to what is behind it, faded with the dark and scaled with the flame about its centre.",
    frames: [(g) => drawTempleGlow(g, 0, 1, 1)],
  },
];
