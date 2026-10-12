import { TIP_WARNING_TIME } from '../config.js';
import { LianaState, SWING_OMEGA } from '../sim/liana.js';
import { mixSeed, mulberry32 } from '../sim/rng.js';
import { leafPoints } from '../render/shapes.js';
import { MAX_STEP_TURN, blend } from '../render/interpolate.js';

// Lianas: what both versions draw from (no Pixi here). Colours, sizes, the drawing
// functions (the Pixi view draws with them, and the art pieces are generated from them),
// and where things go and how they move. The Pixi view is render/lianaView.js.

// Vine colours: green, and in shared screen golden for player 2's own lianas.
export const LIANA_PALETTES = [
  { ropeDark: 0x2c5219, rope: 0x6da539, leaf: 0x4e8c2c, leafDark: 0x3a6d20 },
  { ropeDark: 0x7a5516, rope: 0xd9a53a, leaf: 0xb8902c, leafDark: 0x8c6b1e },
];
// In shared screen the two players' lianas hang from the same anchors; at rest they
// bow this far to opposite sides (px), so both show.
export const PAIR_CURVE = 8;
export const TIP_FLASH = 0xffd23f;
// Where along the rope (fraction of its length) the tip warning starts.
export const TIP_FLASH_FROM = 0.55;
export const SEGMENTS = 14;
// How far (radians) the lower end lags behind while settling, per unit of angular speed.
export const SETTLE_BEND = 0.35;
// Sideways bow of an idle liana, in px.
export const IDLE_CURVE = 5;

// Per-liana leaf layout, derived from the index so it is stable across culling.
// `bowSide` (−1 or 1) fixes the bow's side and size, for a pair of lianas.
export function leafLayout(index, bowSide = 0) {
  const rand = mulberry32(mixSeed(0x11a4a, index));
  const leaves = [];
  let side = rand() < 0.5 ? -1 : 1;
  for (let s = 0.16 + rand() * 0.08; s < 0.95; s += 0.16 + rand() * 0.08) {
    leaves.push({ s, side, length: 11 + rand() * 6, spread: 0.7 + rand() * 0.5, dark: rand() < 0.4 });
    side = -side;
  }
  const bow = bowSide ? bowSide * PAIR_CURVE : (rand() < 0.5 ? -1 : 1) * IDLE_CURVE * (0.5 + rand() * 0.5);
  return { leaves, bow };
}

// Points along the rope. It is straight while swinging (the monkey hangs on it), and
// bows gently at rest and lags at the lower end while settling. Cosmetic only: the
// gameplay hitbox is always the vertical segment.
export function ropePoints(liana, bow) {
  const bend = liana.state === LianaState.SETTLING ? (-SETTLE_BEND * liana.angularVelocity) / SWING_OMEGA : 0;
  const straight = liana.state === LianaState.SWINGING;
  const step = liana.length / SEGMENTS;
  const points = [{ x: liana.x, y: liana.anchorY, angle: liana.angle }];
  let x = liana.x;
  let y = liana.anchorY;
  for (let i = 1; i <= SEGMENTS; i++) {
    const s = i / SEGMENTS;
    const angle = liana.angle + bend * s * s;
    x += step * Math.sin(angle);
    y += step * Math.cos(angle);
    const offset = straight ? 0 : bow * Math.sin(Math.PI * s);
    points.push({ x: x + offset * Math.cos(angle), y: y - offset * Math.sin(angle), angle });
  }
  return points;
}

// A swinging liana as drawn at rest in its own frame: straight down from (0, 0).
export const upright = (liana) => ({
  x: 0,
  anchorY: 0,
  length: liana.length,
  state: LianaState.SWINGING,
  angle: 0,
  angularVelocity: 0,
});

// Whether the end of a liana is lit `tipTime` s before the grip reaches its tip: it
// blinks within TIP_WARNING_TIME, twice as fast in the second half.
export function tipFlashOn(tipTime) {
  if (!(tipTime <= TIP_WARNING_TIME)) return false;
  const blink = tipTime > TIP_WARNING_TIME / 2 ? 0.2 : 0.1;
  return Math.floor(tipTime / blink + 1e-6) % 2 === 0;
}

// Where a liana's rope runs and where its leaves sit, for drawing it (here, and as
// pieces in the Phaser version): the rope's points, and for each leaf its base, its
// direction (a screen angle, 0 = +x), its length and whether it is a dark one.
export function lianaShape(liana, layout) {
  const points = ropePoints(liana, layout.bow);
  const leaves = layout.leaves.map((leaf) => {
    const p = points[Math.round(leaf.s * SEGMENTS)];
    // Rope direction as a screen angle (0 = +x), rotated out to the leaf's side.
    const down = Math.PI / 2 - p.angle;
    return { x: p.x, y: p.y, angle: down - leaf.side * leaf.spread, length: leaf.length, dark: leaf.dark };
  });
  // The lower end lights up when the grip is about to slip off. It starts well above the
  // grip, since the monkey covers the last stretch of rope.
  const flash = points.slice(Math.floor(SEGMENTS * TIP_FLASH_FROM));
  return { points, leaves, flash };
}

export function drawLiana(g, liana, layout, flash, palette) {
  const { points, leaves, flash: end } = lianaShape(liana, layout);
  const path = (width, color) => {
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.stroke({ width, color, cap: 'round', join: 'round' });
  };
  path(7, palette.ropeDark);
  path(4, palette.rope);
  for (const leaf of leaves) {
    g.poly(leafPoints(leaf.x, leaf.y, leaf.angle, leaf.length, leaf.length * 0.5)).fill(leaf.dark ? palette.leafDark : palette.leaf);
  }
  if (flash) {
    g.moveTo(end[0].x, end[0].y);
    for (const p of end.slice(1)) g.lineTo(p.x, p.y);
    g.stroke({ width: 5, color: TIP_FLASH, cap: 'round', join: 'round' });
  }
}

// Lianas this far off either side of the view are not drawn.
export const LIANA_MARGIN = 500;
export const lianaVisible = (liana, cameraX, viewWidth) => liana.x >= cameraX - LIANA_MARGIN && liana.x <= cameraX + viewWidth + LIANA_MARGIN;

// The lianas whose end is lit: those `monkeys` are slipping towards the tip of.
export const flashingLianas = (monkeys) => new Set(monkeys.filter((m) => tipFlashOn(m.tipTime)).map((m) => m.liana));

// Where a liana's drawing goes and the liana to draw it from. A swinging liana is
// straight: drawn upright from the origin and turned about its anchor, its turn `alpha`
// of the way between the previous sim step and the current one (see interpolate.js).
// Others are drawn where they are.
export function lianaPlacement(liana, alpha = 1) {
  if (liana.state !== LianaState.SWINGING) return { x: 0, y: 0, rotation: 0, drawn: liana };
  return { x: liana.x, y: liana.anchorY, rotation: -blend(liana.prevAngle, liana.angle, alpha, MAX_STEP_TURN), drawn: upright(liana) };
}

// What a liana looks like right now; it is only redrawn when this changes. Resting
// lianas never change, and a swinging one is straight, so it is drawn once hanging
// straight down from the origin and turned about its anchor (see lianaPlacement):
// only the lianas settling after a release redraw each frame.
export function drawnState(liana, flash) {
  if (liana.state === LianaState.IDLE) return 'idle';
  if (liana.state === LianaState.SWINGING) return `swinging:${flash}`;
  return `${liana.state}:${liana.angle}:${liana.angularVelocity}:${flash}`;
}

// One Graphics per liana, kept while the liana exists and hidden when off-screen.
