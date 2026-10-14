import { BANANA_RADIUS } from '../config.js';

// Bananas: plain drawing and placement data. Colours, sizes, the drawing
// functions (the art pieces are generated from them),
// and where things go and how they move.

export const PEEL = 0xffd23f;
export const RIDGE = 0xfff3a0;
export const STEM = 0x6b5a2a;
export const TIP = 0x5a3d1c;
export const GLINT = 0xffffff;
export const POP_TIME = 0.8; // s

// A banana `r` in size (about 2r long), centred on (0, 0): a curved body tapering to
// both ends, tilted, with a lighter ridge, a stem at one end and a dark tip at the other.
// Bananas are drawn a little larger than their hitbox, which with the monkey's makes
// pickups generous anyway. Returns where a glint goes: on the body, near the stem.
export function drawBanana(g, r = BANANA_RADIUS * 1.4) {
  const { stem, body, ridge, tip, glint } = bananaShape(r);
  g.poly(stem).fill(STEM);
  g.poly(body).fill(PEEL);
  g.moveTo(ridge[0], ridge[1]);
  for (let i = 2; i < ridge.length; i += 2) g.lineTo(ridge[i], ridge[i + 1]);
  g.stroke({ width: Math.max(0.06 * r, 1), color: RIDGE, alpha: 0.7, cap: 'round' });
  g.circle(tip.x, tip.y, 0.06 * r).fill(TIP);
  return glint;
}

// The banana's outlines (flat point lists: the stem, the body and the ridge line), its tip
// and where its glint goes.
export function bananaShape(r = BANANA_RADIUS * 1.4) {
  const radius = 1.25 * r; // of the arc along the middle of the banana
  const centreY = -0.95 * r;
  const tilt = -0.45;
  const [cos, sin] = [Math.cos(tilt), Math.sin(tilt)];
  // A point at angle `a` on the arc, `d` out from it, tilted.
  const at = (a, d, along = 0) => {
    const x = (radius + d) * Math.cos(a) + along * Math.sin(a);
    const y = centreY + (radius + d) * Math.sin(a) - along * Math.cos(a);
    return [x * cos - y * sin, x * sin + y * cos];
  };
  const from = Math.PI * 0.18;
  const to = Math.PI * 0.82;
  const n = 16;
  const outer = [];
  const inner = [];
  const ridge = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = from + (to - from) * t;
    const w = 0.42 * r * Math.sin(Math.PI * t) ** 0.6 + 0.03 * r;
    outer.push(at(a, w / 2));
    inner.unshift(at(a, -w / 2));
    ridge.push(at(a, w * 0.1));
  }
  // Centre the body's bounding box on (0, 0).
  const body = [...outer, ...inner];
  const xs = body.map(([x]) => x);
  const ys = body.map(([, y]) => y);
  const dx = -(Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = -(Math.min(...ys) + Math.max(...ys)) / 2;
  const flat = (points) => points.flatMap(([x, y]) => [x + dx, y + dy]);
  const stemWidth = 0.07 * r;
  const stemLength = 0.28 * r;
  const stem = [at(from, stemWidth), at(from, stemWidth, stemLength), at(from, -stemWidth, stemLength), at(from, -stemWidth)];
  const [tipX, tipY] = at(to, 0);
  const [glintX, glintY] = at(from + (to - from) * 0.28, 0.04 * r);
  return { stem: flat(stem), body: flat(body), ridge: flat(ridge), tip: { x: tipX + dx, y: tipY + dy }, glint: { x: glintX + dx, y: glintY + dy } };
}

// Where the glint goes on a heart that took a banana's place.
export const HEART_GLINT = { x: -5, y: -5 };

// A four-pointed glint.
export function drawGlint(g, size) {
  const s = size * 0.25;
  return g.poly([0, -size, s, -s, size, 0, s, s, 0, size, -s, s, -size, 0, -s, -s]).fill(GLINT);
}

export const HEART_POP = 0xff7a90;
export const HEART_POP_EDGE = 0x7a1426;

// How a banana (or a heart) still to take shows at world time `t`: bobbing gently and
// rocking, its glint fading in and out over half of every 1.6 s.
export function bananaPose(banana, t) {
  const phase = banana.gap * 1.7;
  return { x: banana.x, y: banana.y + 3 * Math.sin(t * 3 + phase), rotation: 0.15 * Math.sin(t * 2 + phase), glint: Math.max(0, Math.sin(t * 4 + phase)) };
}

// The "+1" (or "+1 ♥") that rises from a banana (or heart) taken: its text, colours and
// size; it starts 10 px above it, rises POP_RISE px/s and fades out over POP_TIME.
export const POP_RISE = 40;
export const POP_FONT = { family: 'sans-serif', size: 26, weight: 'bold', stroke: 4 };
export const popLook = (heart) => (heart ? { text: '+1 ♥', fill: HEART_POP, stroke: HEART_POP_EDGE } : { text: '+1', fill: PEEL, stroke: TIP });
export const popAlpha = (age) => Math.max(0, 1 - age / POP_TIME);
