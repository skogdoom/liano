import { Container, Graphics } from 'pixi.js';
import { SCREEN_WIDTH, TIP_WARNING } from '../config.js';
import { LianaState, SWING_OMEGA } from '../sim/liana.js';
import { mixSeed, mulberry32 } from '../sim/rng.js';
import { leafPoints } from './shapes.js';

const ROPE_DARK = 0x2c5219;
const ROPE = 0x6da539;
const LEAF = 0x4e8c2c;
const LEAF_DARK = 0x3a6d20;
const TIP_FLASH = 0xffd23f;
// Where along the rope (fraction of its length) the tip warning starts.
const TIP_FLASH_FROM = 0.55;
const SEGMENTS = 14;
// How far (radians) the lower end lags behind while settling, per unit of angular speed.
const SETTLE_BEND = 0.35;
// Sideways bow of an idle liana, in px.
const IDLE_CURVE = 5;

// Per-liana leaf layout, derived from the index so it is stable across culling.
function leafLayout(index) {
  const rand = mulberry32(mixSeed(0x11a4a, index));
  const leaves = [];
  let side = rand() < 0.5 ? -1 : 1;
  for (let s = 0.16 + rand() * 0.08; s < 0.95; s += 0.16 + rand() * 0.08) {
    leaves.push({ s, side, length: 11 + rand() * 6, spread: 0.7 + rand() * 0.5, dark: rand() < 0.4 });
    side = -side;
  }
  return { leaves, bow: (rand() < 0.5 ? -1 : 1) * IDLE_CURVE * (0.5 + rand() * 0.5) };
}

// Points along the rope. It is straight while swinging (the monkey hangs on it), and
// bows gently at rest and lags at the lower end while settling. Cosmetic only: the
// gameplay hitbox is always the vertical segment.
function ropePoints(liana, bow) {
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

// What a liana looks like right now; it is only redrawn when this changes. Resting
// lianas never change, so only the held one and any settling ones redraw each frame.
function drawnState(liana, flash) {
  return liana.state === LianaState.IDLE ? 'idle' : `${liana.state}:${liana.angle}:${liana.angularVelocity}:${flash}`;
}

// Whether the end of a liana held `tipDistance` px above its tip is lit: it blinks
// within TIP_WARNING, faster as the grip slips closer (every 8 px, then every 4).
export function tipFlashOn(tipDistance) {
  if (!(tipDistance <= TIP_WARNING)) return false;
  const blink = tipDistance > TIP_WARNING / 2 ? 8 : 4;
  return Math.floor(tipDistance / blink) % 2 === 0;
}

function drawLiana(g, liana, layout, flash) {
  const points = ropePoints(liana, layout.bow);
  const path = (width, color) => {
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.stroke({ width, color, cap: 'round', join: 'round' });
  };
  path(7, ROPE_DARK);
  path(4, ROPE);
  for (const leaf of layout.leaves) {
    const p = points[Math.round(leaf.s * SEGMENTS)];
    // Rope direction as a screen angle (0 = +x), rotated out to the leaf's side.
    const down = Math.PI / 2 - p.angle;
    const a = down - leaf.side * leaf.spread;
    g.poly(leafPoints(p.x, p.y, a, leaf.length, leaf.length * 0.5)).fill(leaf.dark ? LEAF_DARK : LEAF);
  }
  if (flash) {
    // The lower end lights up: the grip is about to slip off. It starts well above the
    // grip, since the monkey covers the last stretch of rope.
    const end = points.slice(Math.floor(SEGMENTS * TIP_FLASH_FROM));
    g.moveTo(end[0].x, end[0].y);
    for (const p of end.slice(1)) g.lineTo(p.x, p.y);
    g.stroke({ width: 5, color: TIP_FLASH, cap: 'round', join: 'round' });
  }
}

// One Graphics per liana, kept while the liana exists and hidden when off-screen.
export class LianaView {
  constructor() {
    this.view = new Container();
    this.entries = new Map(); // liana -> { g, layout, drawn }
    this.redraws = 0; // for tests and profiling
  }

  // `monkeys` light up the end of the liana they are slipping towards.
  update(lianas, cameraX, viewWidth = SCREEN_WIDTH, monkeys = []) {
    const margin = 500;
    const seen = new Set();
    const flashing = new Set(monkeys.filter((m) => tipFlashOn(m.tipDistance)).map((m) => m.liana));
    for (const liana of lianas) {
      seen.add(liana);
      let entry = this.entries.get(liana);
      if (!entry) {
        entry = { g: new Graphics(), layout: leafLayout(liana.index), drawn: null };
        this.entries.set(liana, entry);
        this.view.addChild(entry.g);
      }
      const visible = liana.x >= cameraX - margin && liana.x <= cameraX + viewWidth + margin;
      entry.g.visible = visible;
      if (!visible) continue;
      const flash = flashing.has(liana);
      const state = drawnState(liana, flash);
      if (state === entry.drawn) continue;
      drawLiana(entry.g.clear(), liana, entry.layout, flash);
      entry.drawn = state;
      this.redraws++;
    }
    for (const [liana, entry] of this.entries) {
      if (seen.has(liana)) continue;
      entry.g.destroy();
      this.entries.delete(liana);
    }
  }
}
