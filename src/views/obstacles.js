import { HIGH_BELOW_Y, OBSTACLE_HITBOXES } from '../config.js';
import { mixSeed, mulberry32 } from '../sim/rng.js';
import { FLOOR_Y } from './backdrop.js';
import { leafPoints } from '../render/shapes.js';

// Obstacles and their decorations: plain drawing and placement data. Colours, sizes, the drawing
// functions (the art pieces are generated from them),
// and where things go and how they move.

// Obstacle art, built once per obstacle from its (unscaled) hitbox shapes so the two
// match, then scaled like the hitbox.
// Obstacles above HIGH_BELOW_Y hang from the canopy on vines; lower ones stand on a
// trunk or pole from the floor. Supports are scenery: the gameplay hitbox is only
// the obstacle itself. (Generated heights avoid the band around this line.)
export const CANOPY_Y = 26;

export const BARK = 0x6b4423;
export const BARK_DARK = 0x4a2d16;
export const BARK_LIGHT = 0x8a5a31;
export const LEAF = 0x4e8c2c;
export const LEAF_DARK = 0x356b1f;
export const VINE = 0x3b6a28;
export const SUPPORT_TRUNK = 0x33251a;
export const BUSH = 0x1f4a2a;
export const BUSH_LIGHT = 0x2f6b3b;
export const THORN = 0xd8cf9a;
export const ROCK = 0x858b90;
export const ROCK_LIGHT = 0xa6acb1;
export const ROCK_DARK = 0x62676c;
export const ROCK_EDGE = 0x464a4e;
export const HIVE = 0xe2a93c;
export const HIVE_LIGHT = 0xf3cd6e;
export const HIVE_DARK = 0xb57a1f;
export const HIVE_EDGE = 0x7d5114;
export const BEE = 0xffd23f;
export const BEE_STRIPE = 0x2a1f12;
export const BEE_WING = 0xf4fbff;

// A vine an obstacle hangs from: from the canopy (`fromY`) down to `toY`, swaying by
// `sway` either way; the cubic curve, and the line drawn along it.
export const VINE_WIDTH = 3;
export const vineCurve = (x, fromY, toY, sway) => [
  [x, fromY],
  [x + sway, fromY + (toY - fromY) * 0.35],
  [x - sway, fromY + (toY - fromY) * 0.7],
  [x, toY],
];
export function drawVineLine(g, from, to) {
  return g.moveTo(...from).lineTo(...to).stroke({ width: VINE_WIDTH, color: VINE, cap: 'round' });
}
export function vine(g, x, fromY, toY, sway) {
  const [p0, p1, p2, p3] = vineCurve(x, fromY, toY, sway);
  g.moveTo(...p0)
    .bezierCurveTo(...p1, ...p2, ...p3)
    .stroke({ width: VINE_WIDTH, color: VINE, cap: 'round' });
}
// Where a hanging obstacle's vines start: the canopy, in its local coordinates.
export const canopyY = (o) => (CANOPY_Y - o.y) / o.scale;

// From topY down past the floor line; y in the obstacle's local coordinates.
export function trunk(g, o, x, topY, width) {
  drawTrunk(g, x, topY, trunkBottom(o), width);
}

// Where an obstacle's trunk ends, below the floor line, in its local coordinates.
export const trunkBottom = (o) => (FLOOR_Y + 20 - o.y) / o.scale;

// A trunk `width` wide at the top, from `topY` down to `bottom`, flaring by 5 px a side.
export function drawTrunk(g, x, topY, bottom, width) {
  return drawStem(g, x, topY, bottom, width / 2, width / 2 + 5);
}

// A stem or trunk centred on `x` from `topY` down to `bottom`, `halfTop` either side of
// its centre at the top and `halfBottom` at the bottom. (Straight sides: as a piece it is
// drawn to a reference length and stretched.)
export function drawStem(g, x, topY, bottom, halfTop, halfBottom) {
  return g.poly([x - halfTop, topY, x + halfTop, topY, x + halfBottom, bottom, x - halfBottom, bottom]).fill(SUPPORT_TRUNK);
}
// The stems thorn bushes and rocks stand on (5 px wide either side at the top, 8 at the
// bottom), and the trunk beside a low beehive (6 and 10).
export const STEM = { halfTop: 5, halfBottom: 8 };
export const HIVE_TRUNK = { x: 36, halfTop: 6, halfBottom: 10 };

// Where a branch standing on a trunk has it, and how wide.
export const BRANCH_TRUNK_X = OBSTACLE_HITBOXES.branch[0].dx + 14;
export const BRANCH_TRUNK_WIDTH = 26;

// The four dark lines in a branch's bark, at random along it: { x0, y0, x1, y1 } each.
export function branchBarkLines(rand) {
  const [box] = OBSTACLE_HITBOXES.branch;
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const x = box.dx + 30 + i * 28 + rand() * 10;
    const y0 = -3 + rand() * 4;
    lines.push({ x0: x, y0, x1: x + 14, y1: -2 + rand() * 4 });
  }
  return lines;
}

// One of those lines.
export function drawBarkLine(g, { x0, y0, x1, y1 }) {
  return g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 1.5, color: BARK_DARK });
}

// The limb itself (also as pieces for the Phaser version: the limb without `lines`, and
// the lines on top): bark, its lit upper side, the lines, the cut stub end and the leaf
// tuft near the tip.
export function drawBranchBody(g, lines = []) {
  const [box] = OBSTACLE_HITBOXES.branch;
  const left = box.dx;
  const right = box.dx + box.w;
  const top = box.dy;
  const bottom = box.dy + box.h;
  g.poly([left, top, right - 18, top + 5, right, -1, right - 18, bottom - 5, left, bottom]).fill(BARK);
  g.poly([left, top, right - 18, top + 5, right - 14, top + 9, left, top + 7]).fill(BARK_LIGHT);
  for (const line of lines) drawBarkLine(g, line);
  // Cut stub end.
  g.ellipse(left + 3, 0, 5, box.h / 2).fill(BARK_LIGHT).ellipse(left + 3, 0, 2.5, box.h / 4).fill(BARK_DARK);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.45;
    g.poly(leafPoints(right - 30 + i * 4, top + 4, a, 16, 8)).fill(i % 2 ? LEAF_DARK : LEAF);
  }
  return g;
}

// The decorations on a branch (animals) are scenery: not part of the hitbox. Each is placed (and, where
// it matters, turned) at random for its gap, away from the cut stub and the leaf tuft.
export const SPARROW_BEAK = 0x3a2a1c;

// Where along the branch's top edge x lies: the limb tapers from y = top at the stub to
// 5 px lower at its end.
export function branchTop(x) {
  const [box] = OBSTACLE_HITBOXES.branch;
  return box.dy + (5 * (x - box.dx)) / (box.w - 18);
}

// A perched bird's colouring (one of BIRD_COLORS), the way it faces, where along the
// branch it sits and its animation's phase, from the decoration's random stream.
export function perchedBird(rand) {
  const look = Math.floor(rand() * BIRD_COLORS.length);
  const dir = rand() < 0.5 ? 1 : -1;
  const x = -52 + rand() * 56;
  return { look, dir, x, phase: rand() * 6.3 };
}

// Where the tail and the head join the body.
export const PERCHED_BIRD = { tail: { x: -7, y: -10 }, head: { x: 6, y: -16 } };

// A peck every couple of seconds (the head dips forward and comes back up), and the tail
// flicking.
export function perchedBirdPose(t, phase) {
  const peck = Math.max(0, Math.sin(t * 2.1 + phase)) ** 10;
  return { head: peck * 0.9, headY: -16 + peck * 3, tail: 0.14 * Math.sin(t * 3.3 + phase) };
}

export function drawPerchedBirdBody(g, [fur, dark, belly]) {
  g.ellipse(0, -9, 10, 8).fill(fur);
  g.ellipse(1.5, -6.5, 6, 5).fill(belly);
  g.ellipse(-2, -10, 7, 4.5).fill(dark);
  return g.moveTo(-1, -1).lineTo(-1, 0).moveTo(3, -1).lineTo(3, 0).stroke({ width: 1.5, color: SPARROW_BEAK });
}

export function drawPerchedBirdTail(g, [, dark]) {
  return g.poly([0, 0, -11, -3, -10, 3]).fill(dark);
}

export function drawPerchedBirdHead(g, [fur]) {
  g.circle(0, 0, 6).fill(fur);
  g.poly([5, -1.5, 11, 0.5, 5, 2.5]).fill(SPARROW_BEAK);
  return g.circle(2, -1.5, 1.5).fill(EYE).circle(2.5, -1.5, 0.8).fill(PUPIL);
}

export const SMOOTH = (a, b, x) => {
  const u = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return u * u * (3 - 2 * u);
};

// A snake coiled around the branch (about every third) or, on a standing branch, around
// the trunk it stands on (about half of those). The front of each coil shows as a band
// slanting across the wood; the tail hangs off the lower end and the head rises from the
// upper end, swaying, with a flicking tongue. Faces left or right at random.
export const COIL_SPACING = 13;

// A snake coiled round the branch, from the decoration's random stream: which way it faces,
// whether it is round the trunk (`pole`) or the limb, its coils' bands across the wood
// ({ from, to, bulge }), where its tail starts and its neck rises, and its phase. Local
// frame: the head faces +x; on the limb the origin is the top of the wood and the snake
// runs along it; on the pole it is the trunk's axis and the snake runs down it.
export function perchedSnake(rand, hangs) {
  const dir = rand() < 0.5 ? 1 : -1;
  const pole = !hangs && rand() < 0.5;
  const coils = 3 + Math.floor(rand() * 2);
  const phase = rand() * 6.3;
  let reach;
  let thick;
  let at;
  let x;
  let y;
  if (pole) {
    thick = 26;
    [x, y] = [-OBSTACLE_HITBOXES.branch[0].w / 2 + 14, 0];
    const top = 40 + rand() * 40;
    at = (k) => ({ along: top + (coils - 1 - k) * COIL_SPACING, across: 0 });
    reach = (along) => ({ x: 0, y: along });
  } else {
    const centre = -40 + rand() * 50;
    // The limb tapers: 24 px at the stub, 14 at the tip.
    thick = 24 - (10 * (centre + 80)) / 142;
    [x, y] = [centre, branchTop(centre)];
    at = (k) => ({ along: (k - (coils - 1) / 2) * COIL_SPACING, across: 0 });
    reach = (along) => ({ x: along, y: 0 });
  }
  // Where the strand crosses the wood: from one edge to the other, slanting.
  const band = (k) => {
    const { along } = at(k);
    const r = reach(along);
    if (pole) return { from: [-thick / 2 - 1, r.y], to: [thick / 2 + 1, r.y + 6], bulge: [0, r.y + 4.5] };
    return { from: [r.x - 4, -1], to: [r.x + 4, thick + 1], bulge: [r.x + 2.5, thick / 2] };
  };
  const bands = Array.from({ length: coils }, (_, k) => band(k));
  return { dir, pole, coils, phase, thick, x, y, bands, tailRoot: bands[0].to, neckRoot: bands[coils - 1].from };
}

// The neck (from its root to the head, a curve) and the head (where, turned how) at time
// `t`, swaying; and whether the tongue flicks.
export function perchedSnakePose({ pole, neckRoot, phase }, t) {
  const sway = Math.sin(t * 1.5 + phase);
  const [rx, ry] = neckRoot;
  const hx = pole ? 20 + 2 * sway : rx + 12 + 2 * sway;
  const hy = pole ? ry - 12 + sway : ry - 18 + 1.5 * sway;
  return {
    neck: { from: [rx, ry], control: [pole ? rx + 14 : rx - 1, pole ? ry - 2 : ry - 14], to: [hx, hy] },
    head: { x: hx, y: hy, rotation: -0.35 + 0.08 * sway },
    tongue: (t * 0.9 + phase) % 1 < 0.14,
  };
}

// The tail: the lower end tapers away past the last coil on the front, from `root`.
export function drawSnakeTail(g, root, pole) {
  const tailTip = pole ? [root[0] - 4, root[1] + 16] : [root[0] - 15, root[1] + 4];
  const tailSteps = 8;
  for (let i = 0; i < tailSteps; i++) {
    const u0 = i / tailSteps;
    const u1 = (i + 1) / tailSteps;
    const pt = (u) => [root[0] + (tailTip[0] - root[0]) * u, root[1] + (tailTip[1] - root[1]) * u + (pole ? 0 : -3 * Math.sin(u * Math.PI))];
    const [a, b] = [pt(u0), pt(u1)];
    g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 7 - 5 * u1, color: SNAKE, cap: 'round' });
  }
  return g;
}

// A coil's band across the wood.
export const SNAKE_BAND_WIDTH = 8;
export function drawSnakeBand(g, { from, to, bulge }) {
  return g.moveTo(from[0], from[1]).quadraticCurveTo(bulge[0], bulge[1], to[0], to[1]).stroke({ width: SNAKE_BAND_WIDTH, color: SNAKE, cap: 'round' });
}

export function drawSnakeMark(g, [x, y], r) {
  return g.circle(x, y, r).fill(SNAKE_DARK);
}

export const SNAKE_NECK_WIDTH = 7;
export function drawSnakeNeck(g, { from, control, to }) {
  return g.moveTo(...from).quadraticCurveTo(...control, ...to).stroke({ width: SNAKE_NECK_WIDTH, color: SNAKE, cap: 'round' });
}

export function drawSnakeHead(g) {
  return g.ellipse(2, 0, 7, 4.8).fill(SNAKE).circle(4, -1.8, 1.4).fill(PUPIL);
}

export function drawSnakeTongue(g) {
  return g.moveTo(9, 0).lineTo(15, 0).lineTo(18, -2.5).moveTo(15, 0).lineTo(18, 2.5).stroke({ width: 1.2, color: TONGUE });
}

export const FUR = 0x7d7468;
export const FUR_DARK = 0x574f45;
export const FACE = 0xe6d0b2;

// Where along the branch the monkey hangs, the way it faces and its animation's phase.
export function hangingMonkey(rand) {
  const x = -32 + rand() * 36;
  const dir = rand() < 0.5 ? 1 : -1;
  return { x, dir, phase: rand() * 6.3 };
}

// The pose at time `t`: the swing, the legs kicking out and back out of step (each a line
// from its hip), the tail's curl (±3) and whether it blinks.
export function hangingMonkeyPose(t, phase) {
  const legs = [-1, 1].map((side) => {
    const k = 0.35 * Math.sin(t * 2.6 + phase + (side > 0 ? 1.6 : 0));
    const x = side * 5;
    return { from: [x, 44], to: [x + side * 2 + 9 * Math.sin(k), 44 + 11 * Math.cos(k)] };
  });
  return {
    swing: 0.13 * Math.sin(t * 1.7 + phase),
    legs,
    curl: 3 * Math.sin(t * 2.2 + phase),
    blink: (t * 0.33 + phase) % 1 < 0.04,
  };
}
export const HANGING_MONKEY_CURL = 3;

export function drawHangingMonkeyArms(g) {
  for (const side of [-1, 1]) g.moveTo(side * 4, 1).lineTo(side * 7.5, 18).stroke({ width: 4.2, color: FUR, cap: 'round' });
  for (const side of [-1, 1]) g.circle(side * 4, 1, 2.6).fill(FUR_DARK);
  return g;
}

export function drawHangingMonkeyBody(g) {
  g.ellipse(0, 36, 9.5, 12.5).fill(FUR);
  g.ellipse(0, 38, 5.8, 8).fill(FACE);
  g.circle(-8.2, 19, 3).fill(FUR_DARK).circle(8.2, 19, 3).fill(FUR_DARK);
  g.circle(0, 21, 8.4).fill(FUR);
  return g.ellipse(0, 22.5, 5.4, 4.8).fill(FACE);
}

export const HANGING_MONKEY_LEG_WIDTH = 4.2;
export function drawHangingMonkeyLeg(g, from, to) {
  return g.moveTo(...from).lineTo(...to).stroke({ width: HANGING_MONKEY_LEG_WIDTH, color: FUR, cap: 'round' });
}

// A tail that curls out and up, uncurling a little as it swings.
export function drawHangingMonkeyTail(g, curl) {
  return g
    .moveTo(5, 45)
    .bezierCurveTo(16 + curl, 47, 21 + curl, 36, 14 - curl, 31)
    .stroke({ width: 3.4, color: FUR_DARK, cap: 'round' });
}

// Eyes, shut for a moment every few seconds.
export function drawHangingMonkeyEyes(g, blink) {
  for (const side of [-1, 1]) {
    if (blink) g.moveTo(side * 3.6 - 1.4, 20.5).lineTo(side * 3.6 + 1.4, 20.5).stroke({ width: 1, color: PUPIL });
    else g.circle(side * 3.6, 20.5, 1.5).fill(PUPIL);
  }
  return g;
}

export const TWIG = 0x8b6a3d;
export const TWIG_DARK = 0x5e4524;
export const TWIG_LIGHT = 0xb48a52;
export const NEST_INSIDE = 0x34261a;
export const EGG = 0xc4e6ee;
export const EGG_SPECK = 0x7a6a4a;
export const SHELL = 0xf6f2e8;
export const CHICK = 0xffd84a;
export const CHICK_DARK = 0xe8b52c;

// What a nest holds: nothing, an egg, or a hatched egg (a chick in its cracked shell).
export const NEST_STATES = ['empty', 'egg', 'hatched'];

// Which way the nest faces, where it sits, what it holds, its animation's phase, and its
// twigs (across the front: { x, y, len, tilt, light }; out of the rim: { x, lean, rise }),
// from the decoration's random stream.
export function nestPlacement(rand) {
  const dir = rand() < 0.5 ? 1 : -1;
  const x = -46 + rand() * 50;
  const state = NEST_STATES[Math.floor(rand() * NEST_STATES.length)];
  const phase = rand() * 6.3;
  const twigs = [];
  for (let i = 0; i < 7; i++) {
    const tx = -14 + rand() * 28;
    const ty = -4 + rand() * 6;
    const len = 8 + rand() * 7;
    const tilt = (rand() - 0.5) * 0.5;
    twigs.push({ x: tx, y: ty, len, tilt, light: i % 3 === 0 });
  }
  const rimTwigs = [];
  for (let i = 0; i < 4; i++) {
    const rx = -17 + rand() * 34;
    const lean = (rand() - 0.5) * 7;
    rimTwigs.push({ x: rx, lean, rise: -13 - rand() * 3 });
  }
  return { dir, x, state, phase, twigs, rimTwigs };
}

// Where the contents sit in the nest.
export const NEST_PARTS = { egg: { x: 0, y: -11 }, shell: { x: 0, y: -9 }, chick: { x: 0, y: -15 }, cap: { x: 10.5, y: -9.5, rotation: 0.5 } };

export function drawNestBack(g) {
  return g.ellipse(0, -9, 19, 7.5).fill(TWIG_DARK).ellipse(0, -9.5, 15, 5.5).fill(NEST_INSIDE);
}

export function drawNestFront(g) {
  return g.moveTo(-19, -9).quadraticCurveTo(-21, 3, 0, 4).quadraticCurveTo(21, 3, 19, -9).quadraticCurveTo(0, -3, -19, -9).fill(TWIG);
}

// A twig across the front (as a piece: `len` long along +x from the origin, and turned).
export function drawNestTwig(g, { x, y, len, tilt, light }) {
  return g
    .moveTo(x - len / 2, y - tilt * len)
    .lineTo(x + len / 2, y + tilt * len)
    .stroke({ width: 1.2, color: light ? TWIG_LIGHT : TWIG_DARK, cap: 'round' });
}

// A twig stuck out of the rim.
export function drawNestRimTwig(g, { x, lean, rise }) {
  return g.moveTo(x, -8).lineTo(x + lean, rise).stroke({ width: 1.4, color: TWIG_DARK, cap: 'round' });
}

export function drawNestRim(g) {
  return g.moveTo(-19, -9).quadraticCurveTo(0, -3, 19, -9).stroke({ width: 2, color: TWIG_DARK, cap: 'round' });
}

export function drawNestEgg(g) {
  g.ellipse(0, 0, 5.8, 7.4).fill(EGG);
  g.ellipse(-1.8, -2.4, 1.8, 2.8).fill({ color: 0xffffff, alpha: 0.65 });
  for (const [x, y] of [[2, 1.5], [-2, 3], [3, -2.5], [0, -4.5]]) g.circle(x, y, 0.8).fill(EGG_SPECK);
  return g;
}

// The egg rocks a little now and then.
export function eggRock(t, phase) {
  const rock = Math.max(0, Math.sin(t * 0.8 + phase)) ** 14;
  return rock * 0.12 * Math.sin(t * 24);
}

export function drawNestShell(g) {
  return g.poly([-6, -2, -6, 3, 0, 6, 6, 3, 6, -2, 4, -4, 2, -1, 0, -4, -2, -1, -4, -4]).fill(SHELL);
}

export function drawChick(g) {
  g.circle(0, 0, 6.6).fill(CHICK);
  g.ellipse(-4.5, 1.5, 2.4, 3.2).fill(CHICK_DARK);
  g.poly([-1.5, -6, 0, -10, 1.5, -6.2]).fill(CHICK);
  return g.circle(2.4, -1.6, 1.3).fill(PUPIL);
}

// Bobbing up and down, and peeping: the beak opens (0 to 1) and closes in bursts.
export function chickPose(t, phase) {
  return {
    y: -15 + 1.2 * Math.sin(t * 3.4 + phase),
    rotation: 0.1 * Math.sin(t * 2.3 + phase),
    open: (t * 0.6 + phase) % 1 < 0.35 ? 0.5 + 0.5 * Math.sin(t * 16) : 0,
  };
}

export function drawChickBeak(g, open) {
  g.poly([5.5, -2.5 - open * 2, 11, -1 - open * 2.5, 5.5, -0.8]).fill(BEAK);
  return g.poly([5.5, -0.4, 10, 1 + open * 2.5, 5.5, 1.6]).fill(BEAK);
}

export function drawNestCap(g) {
  return g.poly([-6, 0, -4, -4, -2, -1, 0, -5, 2, -1, 4, -4, 6, 0, 5, 3, -5, 3]).fill(SHELL);
}

// An empty nest: a dry leaf curled in the bottom.
export function drawNestLeaf(g) {
  return g.poly(leafPoints(-3, -8, -0.3, 10, 4)).fill(LEAF_DARK);
}

export const PANTHER = 0x1d1d27;
export const PANTHER_SHEEN = 0x3a3a4d;
export const PANTHER_EYE = 0xd9e34a;
export const PANTHER_NOSE = 0x5a4a52;

// Which way the panther faces, where along the branch it lies and its animation's phase,
// drawn from the decoration's random stream.
export function pantherPlacement(rand) {
  const facing = rand() < 0.5 ? 1 : -1;
  const cx = -28 + rand() * 24;
  return { facing, cx, phase: rand() * 6.3 };
}

// The panther's parts, each drawn on its own (also as pieces for the Phaser version).
// The body: haunch, a long heavy body and the front legs stretched out ahead, a paw on
// each, and the head raised at the front.
export function drawPantherBody(g) {
  g.ellipse(-22, -8.5, 14, 10).fill(PANTHER);
  g.ellipse(-3, -10.5, 27, 10.5).fill(PANTHER);
  g.ellipse(23, -3.5, 12, 4).fill(PANTHER).ellipse(21, -6.8, 11, 3.6).fill(PANTHER_SHEEN);
  g.ellipse(-13, -2.6, 9, 3.4).fill(PANTHER);
  g.ellipse(-3, -17.5, 24, 2.2).fill({ color: PANTHER_SHEEN, alpha: 0.9 });
  // The head, raised at the front: small round ears, a broad flat skull and a short muzzle.
  g.circle(24.5, -23, 3.3).fill(PANTHER).circle(35.5, -22, 3.3).fill(PANTHER);
  g.ellipse(31, -16.5, 10.5, 7.4).fill(PANTHER);
  g.ellipse(39.5, -13.5, 5.6, 3.7).fill(PANTHER_SHEEN);
  g.ellipse(43, -14.6, 1.8, 1.3).fill(PANTHER_NOSE);
  for (const dy of [-1.5, 0.8]) g.moveTo(40.5, -12 + dy).lineTo(48, -13 + dy * 2.4).stroke({ width: 0.7, color: 0xc9c4d4, alpha: 0.7 });
  return g;
}

// The inside of the ear that flicks (drawn about its own centre).
export function drawPantherEar(g) {
  return g.circle(0, 0, 2).fill(PANTHER_SHEEN);
}

// How far the tail's tip has swung (px, about ±6) at time `t`.
export const pantherSwish = (t, phase) => 6 * Math.sin(t * 1.9 + phase);
// Whether the eyes are shut at time `t`: for a moment every few seconds.
export const pantherBlinks = (t, phase) => (t * 0.28 + phase) % 1 < 0.035;

// The tail hangs from the rump over the end of the limb and swishes at its tip.
export function drawPantherTail(g, swish) {
  g.moveTo(-32, -9)
    .bezierCurveTo(-44, -8, -48 + swish * 0.3, 4, -44 + swish, 14)
    .stroke({ width: 5, color: PANTHER, cap: 'round' });
  g.moveTo(-44 + swish, 14).quadraticCurveTo(-42 + swish * 1.3, 19.5, -36 + swish * 1.4, 18.5).stroke({ width: 4.4, color: PANTHER, cap: 'round' });
  return g;
}

// The eyes: slit pupils in yellow, or shut.
export function drawPantherEyes(g, shut) {
  if (shut) return g.moveTo(26.5, -17.6).lineTo(31, -18).moveTo(33, -17.8).lineTo(37.5, -17.2).stroke({ width: 1, color: PANTHER_SHEEN });
  g.ellipse(28.8, -18, 2.4, 1.9).fill(PANTHER_EYE).ellipse(35.4, -17.6, 2.4, 1.9).fill(PANTHER_EYE);
  return g.ellipse(28.8, -18, 0.6, 1.6).fill(PANTHER).ellipse(35.4, -17.6, 0.6, 1.6).fill(PANTHER);
}

// Where along the branch the bat hangs, the way it faces, its animation's phase and its
// look (one of BAT_LOOKS).
export function hangingBat(rand) {
  const x = -38 + rand() * 46;
  const dir = rand() < 0.5 ? 1 : -1;
  const phase = rand() * 6.3;
  return { x, dir, phase, look: batLook(rand) };
}

// The pose at time `t`: the sway, the eyes (shut mostly, opening red for a moment every
// few seconds) and an ear's twitch (0 to 1, now and then).
export function hangingBatPose(t, phase) {
  return {
    swing: 0.07 * Math.sin(t * 1.3 + phase),
    open: (t * 0.22 + phase) % 1 < 0.12,
    twitch: Math.max(0, Math.sin(t * 1.7 + phase * 3)) ** 16,
  };
}

// Feet gripping the limb, a furry body, and the wings folded round it: a cloak with
// scalloped edges and a ridge down the middle; the head at the bottom, ears pointing down.
export function drawHangingBatBody(g, look) {
  const earLength = 9 * look.ear;
  g.moveTo(-3, 1).lineTo(-3.5, 6).moveTo(3, 1).lineTo(3.5, 6).stroke({ width: 2, color: look.dark, cap: 'round' });
  g.ellipse(0, 14, 7.6, 11).fill(look.fur);
  g.poly([-9, 7, -11, 20, -6, 28, -2, 24, 0, 29, 2, 24, 6, 28, 11, 20, 9, 7, 0, 3]).fill(look.wing);
  g.moveTo(0, 5).lineTo(0, 26).stroke({ width: 1, color: look.dark, alpha: 0.7 });
  g.moveTo(-5, 9).quadraticCurveTo(-8, 18, -5.5, 25).moveTo(5, 9).quadraticCurveTo(8, 18, 5.5, 25).stroke({ width: 1.2, color: look.dark, alpha: 0.6 });
  if (look.collar !== null) g.ellipse(0, 27, 6.5, 3.5).fill(look.collar);
  g.poly([-6.5, 29, -9, 29 + earLength, -2.5, 33]).fill(look.dark).poly([6.5, 29, 9, 29 + earLength, 2.5, 33]).fill(look.dark);
  g.circle(0, 31, 6).fill(look.fur);
  return g.poly([-1.5, 35, 0, 38.5, 1.5, 35]).fill(look.dark);
}

export function drawHangingBatEyes(g, look, open) {
  if (open) return g.circle(-2.4, 30.5, 1.5).fill(look.eye).circle(2.4, 30.5, 1.5).fill(look.eye);
  return g.moveTo(-3.8, 30.5).lineTo(-1.2, 30.5).moveTo(1.2, 30.5).lineTo(3.8, 30.5).stroke({ width: 0.9, color: look.dark });
}

// The ear that twitches, over the body's: `twitch` 0 (still) to 1.
export function drawHangingBatEar(g, look, twitch) {
  const earLength = 9 * look.ear;
  return g.poly([6.5, 29, 9 + 2 * twitch, 29 + earLength - 3 * twitch, 2.5, 33]).fill(look.fur);
}

// The colours flowers come in; each flower in a cluster picks its own.
export const FLOWER_COLORS = [0xe8505b, 0xff8fb3, 0xffd23f, 0xb06bd6, 0xf6f3ee, 0xff9a3c, 0x6fa8ff];
export const FLOWER_STEM = 0x3f7a2c;
export const FLOWER_HEART = 0xffe066;
export const FLOWER_HEART_DARK = 0xb8691f;

// A cluster of three to five flowers, from the decoration's random stream: which way it
// faces, where it grows, and per flower where it stands, its height and colour, its leaves
// ({ y, angle, length, width, color }), its petals ({ x, y, r, color }), its heart
// ({ y, r, color }) and how it sways.
export function flowerCluster(rand) {
  const dir = rand() < 0.5 ? 1 : -1;
  const x = -40 + rand() * 40;
  const count = 3 + Math.floor(rand() * 3);
  const plants = [];
  for (let i = 0; i < count; i++) {
    const px = (i - (count - 1) / 2) * 10 + (rand() - 0.5) * 4;
    const height = 11 + rand() * 9;
    const color = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)];
    const leafAt = height * (0.3 + rand() * 0.2);
    const leaf = { y: -leafAt, angle: -0.6 - rand() * 0.5, length: 7, width: 3, color: FLOWER_STEM };
    const leaf2 = rand() < 0.5 ? { y: -leafAt * 0.55, angle: Math.PI + 0.6 + rand() * 0.5, length: 6, width: 2.6, color: LEAF_DARK } : null;
    const petalCount = 5 + Math.floor(rand() * 2);
    const r = 2.5 + rand() * 1.1;
    const turn = rand() * 6.3;
    const petals = [];
    for (let p = 0; p < petalCount; p++) {
      const a = turn + (p / petalCount) * Math.PI * 2;
      petals.push({ x: Math.cos(a) * r * 1.2, y: -height + Math.sin(a) * r * 1.2, r: r * 0.82, color });
    }
    const heart = { y: -height, r: r * 0.62, color: color === 0xffd23f ? FLOWER_HEART_DARK : FLOWER_HEART };
    plants.push({ x: px, height, color, leaf, leaf2, petals, heart, phase: rand() * 6.3, speed: 1.3 + rand() * 0.8 });
  }
  return { dir, x, plants };
}

export const flowerSway = (t, { phase, speed }) => 0.1 * Math.sin(t * speed + phase);

// A stem `height` tall from the origin, curving a little.
export function drawFlowerStem(g, height) {
  return g.moveTo(0, 0).quadraticCurveTo(1.5, -height / 2, 0, -height).stroke({ width: 1.6, color: FLOWER_STEM, cap: 'round' });
}

export function drawFlowerLeaf(g, { y, angle, length, width, color }) {
  return g.poly(leafPoints(0, y, angle, length, width)).fill(color);
}

export function drawPetal(g, { x = 0, y = 0, r, color }) {
  return g.circle(x, y, r).fill(color);
}

export function drawFlowerHeart(g, { y = 0, r, color }) {
  return g.circle(0, y, r).fill(color);
}

export const COCONUT = 0x6b4a2b;
export const COCONUT_DARK = 0x3f2a15;
export const COCONUT_LIGHT = 0x9a7448;

// A bunch of two or three coconuts, from the decoration's random stream: where it hangs,
// which way it faces, and per nut how far out it hangs (`x`, its stem from 0.4 x), how far
// down (`drop`), its radius, the angles of the hairs on its outline and how it sways.
export function coconutBunch(rand) {
  const x = -34 + rand() * 40;
  const dir = rand() < 0.5 ? 1 : -1;
  const count = 2 + Math.floor(rand() * 2);
  const nuts = [];
  for (let i = 0; i < count; i++) {
    const side = count === 2 ? (i ? 1 : -1) : i - 1;
    const nx = side * 12.5 + (rand() - 0.5) * 2;
    const drop = 8 + rand() * 6 + (side === 0 ? 8 : 0);
    const r = 6.4 + rand() * 1.2;
    const hairs = [];
    for (let a = rand() * 0.3; a < Math.PI * 2; a += 0.28 + rand() * 0.14) hairs.push(a);
    nuts.push({ x: nx, drop, r, hairs, phase: rand() * 6.3, speed: 1.1 + rand() * 0.7 });
  }
  return { x, dir, nuts };
}

export const coconutSway = (t, { phase, speed }) => 0.09 * Math.sin(t * speed + phase);

export function drawCoconutFrond(g) {
  g.poly(leafPoints(0, 1, Math.PI * 0.5 + 0.9, 20, 5)).fill(LEAF_DARK);
  g.poly(leafPoints(0, 1, Math.PI * 0.5 - 0.9, 20, 5)).fill(LEAF);
  return g.poly(leafPoints(0, 1, Math.PI * 0.5 + 0.2, 14, 4)).fill(LEAF);
}

// The stem from the frond to the top of the nut.
export function drawCoconutStem(g, { x, drop }) {
  return g.moveTo(0, 0).lineTo((x - x * 0.4) * 0.5, drop * 0.6).lineTo(x - x * 0.4, drop).stroke({ width: 1.8, color: COCONUT_DARK, cap: 'round' });
}

// A hair at angle `a` on the nut's outline.
export function drawCoconutHair(g, { x, drop, r }, a) {
  const nx = x - x * 0.4;
  return g
    .moveTo(nx + Math.cos(a) * r * 0.95, drop + r + Math.sin(a) * r * 0.95)
    .lineTo(nx + Math.cos(a) * (r + 1.1), drop + r + Math.sin(a) * (r + 1.1))
    .stroke({ width: 0.7, color: COCONUT_DARK, alpha: 0.8 });
}

// The nut: brown, a highlight and the three dark "eyes" at the top.
export function drawCoconut(g, { x, drop, r }) {
  const nx = x - x * 0.4;
  g.circle(nx, drop + r, r).fill(COCONUT);
  g.ellipse(nx - r * 0.35, drop + r - r * 0.4, r * 0.28, r * 0.42).fill({ color: COCONUT_LIGHT, alpha: 0.85 });
  for (const [ex, ey] of [[-0.28, 0.18], [0.28, 0.18], [0, 0.5]]) g.circle(nx + ex * r, drop + r * 0.35 + ey * r * 0.5, r * 0.13).fill(COCONUT_DARK);
  return g;
}

export const OWL = 0x8a6a48;
export const OWL_DARK = 0x5a432c;
export const OWL_BELLY = 0xe8d7b5;
export const OWL_FACE = 0xf0e2c2;
export const OWL_EYE = 0xffcf33;
export const OWL_BEAK = 0xe0993a;

// The way the owl faces, where along the branch it perches and its animation's phase.
export function owlPlacement(rand) {
  const dir = rand() < 0.5 ? 1 : -1;
  const x = -46 + rand() * 50;
  return { dir, x, phase: rand() * 6.3 };
}

// Where the head sits on the body.
export const OWL_HEAD = { x: 0, y: -27 };

// The pose at time `t`: it puffs a little as it breathes, the face slides to one side and
// the other as if the head were turning (`turn`, -1 to 1), and it blinks now and then.
export function owlPose(t, phase) {
  const turn = Math.sin(t * 0.55 + phase);
  return { breath: 1 + 0.025 * Math.sin(t * 1.5 + phase), turn, faceX: 3.4 * turn, head: 0.06 * turn, blink: (t * 0.27 + phase) % 1 < 0.04 };
}

// Round and brown on its feet, a pale chevroned belly, the wings folded down the sides.
export function drawOwlBody(g) {
  g.moveTo(-4.5, -1).lineTo(-4.5, 1.5).moveTo(-2, -1).lineTo(-2, 1.5).moveTo(2, -1).lineTo(2, 1.5).moveTo(4.5, -1).lineTo(4.5, 1.5);
  g.stroke({ width: 1.6, color: OWL_BEAK, cap: 'round' });
  g.ellipse(0, -14, 11.5, 14).fill(OWL);
  g.ellipse(0, -12.5, 7.6, 10.8).fill(OWL_BELLY);
  for (const [x, y] of [[-3, -19], [3, -19], [0, -14.5], [-4, -10], [4, -10], [0, -6.5]]) {
    g.moveTo(x - 2, y - 1.4).lineTo(x, y + 0.8).lineTo(x + 2, y - 1.4).stroke({ width: 1, color: OWL, cap: 'round' });
  }
  // Folded wings down the sides, with a few pale flecks.
  g.ellipse(-9.2, -13, 4.2, 10.5).fill(OWL_DARK).ellipse(9.2, -13, 4.2, 10.5).fill(OWL_DARK);
  for (const [x, y] of [[-9.5, -17], [-8.5, -11], [9.5, -17], [8.5, -11]]) g.circle(x, y, 0.9).fill(OWL_BELLY);
  return g;
}

// The head with its ear tufts.
export function drawOwlSkull(g) {
  g.circle(0, 0, 10.6).fill(OWL);
  return g.poly([-9, -5, -9.5, -15, -3.5, -9]).fill(OWL_DARK).poly([9, -5, 9.5, -15, 3.5, -9]).fill(OWL_DARK);
}

// The pale face round the eyes.
export function drawOwlDisc(g) {
  g.circle(-4.6, 0.5, 6.3).fill(OWL_FACE).circle(4.6, 0.5, 6.3).fill(OWL_FACE);
  return g.poly([-1.2, -2.5, 1.2, -2.5, 0, 0.2]).fill(OWL_DARK);
}

export function drawOwlBeak(g) {
  return g.poly([-1.8, 1.2, 1.8, 1.2, 0, 5.2]).fill(OWL_BEAK);
}

// One eye at `x`: big and yellow with a pupil that leads the turn, or shut.
export function drawOwlEye(g, x, blink, turn) {
  if (blink) return g.moveTo(x - 3, 0.5).lineTo(x + 3, 0.5).stroke({ width: 1.2, color: OWL_DARK, cap: 'round' });
  return g.circle(x, 0.5, 3.8).fill(OWL_EYE).circle(x + turn * 1.4, 0.5, 1.9).fill(PUPIL);
}
export const drawOwlEyeball = (g) => g.circle(0, 0.5, 3.8).fill(OWL_EYE);
export const drawOwlPupil = (g) => g.circle(0, 0.5, 1.9).fill(PUPIL);
export const drawOwlShutEye = (g) => g.moveTo(-3, 0.5).lineTo(3, 0.5).stroke({ width: 1.2, color: OWL_DARK, cap: 'round' });

// Hitbox: three circles. A dark blob with a few highlights and thorns on its outline.
export function drawThornBush(g, o, rand, hangs) {
  if (hangs) vine(g, 0, canopyY(o), THORN_VINE_END, 10);
  else {
    drawStem(g, 0, 20, trunkBottom(o), STEM.halfTop, STEM.halfBottom);
    drawThornBushMound(g);
  }
  for (const t of thornBushThorns(rand)) drawThorn(g, t);
  drawThornBushBody(g);
}
export const THORN_VINE_END = -40;

// The mound a standing thorn bush grows from.
export function drawThornBushMound(g) {
  return g.ellipse(0, 36, 30, 6).fill(SUPPORT_TRUNK);
}

// Where the thorns stick out of a bush's outline, at random: { x, y, a } each, `a` the
// direction they point.
export function thornBushThorns(rand) {
  const circles = OBSTACLE_HITBOXES.thornBush;
  const inOther = (x, y, self) =>
    circles.some((c) => c !== self && (x - c.dx) ** 2 + (y - c.dy) ** 2 < (c.r - 1) ** 2);
  const thorns = [];
  for (const c of circles) {
    for (let a = rand() * 0.4; a < Math.PI * 2; a += 0.42 + rand() * 0.15) {
      const x = c.dx + c.r * Math.cos(a);
      const y = c.dy + c.r * Math.sin(a);
      if (!inOther(x, y, c)) thorns.push({ x, y, a });
    }
  }
  return thorns;
}

// A thorn at (x, y) pointing along `a` (as a piece: at the origin, pointing along +x).
export function drawThorn(g, { x = 0, y = 0, a = 0 } = {}) {
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  return g.poly([x - ny * 3.5, y + nx * 3.5, x + nx * 7, y + ny * 7, x + ny * 3.5, y - nx * 3.5]).fill(THORN);
}

// The bush itself: three dark circles with a highlight each.
export function drawThornBushBody(g) {
  const circles = OBSTACLE_HITBOXES.thornBush;
  for (const c of circles) g.circle(c.dx, c.dy, c.r).fill(BUSH);
  for (const c of circles) g.circle(c.dx - c.r * 0.3, c.dy - c.r * 0.3, c.r * 0.45).fill(BUSH_LIGHT);
  return g;
}

// Rocks come in ROCK_VARIANTS outlines, one picked per gap (PHASER_PLAN.md, M4: a random
// outline per gap could not be pre-rendered).
export const ROCK_VARIANTS = 24;
export const rockVariant = (gap) => Math.floor(mulberry32(mixSeed(0x70c4, gap))() * ROCK_VARIANTS);

// Hitbox: one circle. An angular grey polygon close to the circle, on a vine or a ledge.
export function drawRock(g, o, rand, hangs) {
  drawRockSupport(g, o, hangs);
  drawRockBody(g, rockVariant(o.gap));
}

// The vine or the ledge on a stem the rock sits on.
export function drawRockSupport(g, o, hangs) {
  const [{ r }] = OBSTACLE_HITBOXES.rock;
  if (hangs) {
    vine(g, 0, canopyY(o), -r + 4, 9);
    drawRockSling(g);
  } else {
    drawStem(g, 0, r - 4, trunkBottom(o), STEM.halfTop, STEM.halfBottom);
    drawRockLedge(g);
  }
}

// The vine's loop round a hanging rock.
export function drawRockSling(g) {
  const [{ r }] = OBSTACLE_HITBOXES.rock;
  return g.moveTo(-r + 3, -8).quadraticCurveTo(0, 2, r - 3, -8).stroke({ width: 3, color: VINE });
}

// The ledge a standing rock sits on.
export function drawRockLedge(g) {
  const [{ r }] = OBSTACLE_HITBOXES.rock;
  return g.roundRect(-r - 4, r - 6, 2 * r + 8, 10, 4).fill(BARK_DARK);
}

// The rock itself, in outline `variant` (0 to ROCK_VARIANTS - 1): grey, with a lit and a
// shaded facet.
export function drawRockBody(g, variant) {
  const [{ r }] = OBSTACLE_HITBOXES.rock;
  const rand = mulberry32(mixSeed(0x70c5, variant));
  const n = 9;
  const outline = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.25;
    const rr = r * (0.9 + rand() * 0.1);
    outline.push(rr * Math.cos(a), rr * Math.sin(a));
  }
  g.poly(outline).fill(ROCK).stroke({ width: 2, color: ROCK_EDGE, join: 'round' });
  // Lit upper-left facet and shaded lower-right facet.
  const facet = (from, to, color) => {
    const pts = [0, 0];
    for (let i = from; i <= to; i++) pts.push(outline[(2 * i) % (2 * n)] * 0.92, outline[(2 * i + 1) % (2 * n)] * 0.92);
    g.poly(pts).fill(color);
  };
  facet(4, 7, ROCK_LIGHT);
  facet(0, 2, ROCK_DARK);
  return g;
}

// The top and bottom of a beehive's nest (its hitbox's three stacked circles).
export const hiveTop = () => OBSTACLE_HITBOXES.beehive[0].dy - OBSTACLE_HITBOXES.beehive[0].r;
export const hiveBottom = () => OBSTACLE_HITBOXES.beehive[2].dy + OBSTACLE_HITBOXES.beehive[2].r;

// The arm over a low beehive, from the trunk beside it, and the rope the nest hangs on.
export function drawHiveArm(g) {
  const top = hiveTop();
  const armY = top - 12;
  g.moveTo(34, armY).quadraticCurveTo(14, armY - 8, -4, armY - 1).stroke({ width: 7, color: SUPPORT_TRUNK, cap: 'round' });
  return g.moveTo(0, armY).lineTo(0, top + 3).stroke({ width: 2.5, color: VINE, cap: 'round' });
}

// The nest: a teardrop in gold paper bands with a dark entrance at the bottom.
export function drawHiveNest(g) {
  const circles = OBSTACLE_HITBOXES.beehive;
  const top = hiveTop();
  const bottom = hiveBottom();
  g.moveTo(0, top)
    .bezierCurveTo(12, top, 22, -18, 23, 0)
    .bezierCurveTo(24, 16, 14, bottom, 0, bottom)
    .bezierCurveTo(-14, bottom, -24, 16, -23, 0)
    .bezierCurveTo(-22, -18, -12, top, 0, top);
  g.fill(HIVE).stroke({ width: 2, color: HIVE_EDGE, join: 'round' });
  // Paper bands: arcs across the nest, as wide as the hitbox is at that height.
  const half = (y) => Math.max(...circles.map((c) => Math.sqrt(Math.max(0, c.r ** 2 - (y - c.dy) ** 2))));
  for (const y of [-26, -14, -2, 10, 22, 32]) {
    const w = half(y) - 2;
    g.moveTo(-w, y).quadraticCurveTo(0, y + 7, w, y).stroke({ width: 1.6, color: HIVE_EDGE, alpha: 0.65 });
  }
  g.ellipse(-8, -8, 7, 13).fill({ color: HIVE_LIGHT, alpha: 0.8 });
  g.ellipse(8, 14, 6, 11).fill({ color: HIVE_DARK, alpha: 0.5 });
  return g.ellipse(0, bottom - 6, 6.5, 4.5).fill(BEE_STRIPE);
}

// The bees round a nest: five, each on its own loop.
export function beeSwarm(rand) {
  return Array.from({ length: 5 }, () => ({
    speed: 1.6 + rand() * 1.6,
    phase: rand() * Math.PI * 2,
    rx: 30 + rand() * 12,
    ry: 20 + rand() * 20,
    cy: 2 + rand() * 12,
  }));
}

// Where a bee is at time `t`, and how open its wings are (their half height).
export function beeAt(b, t) {
  const a = b.speed * t + b.phase;
  const beat = 0.5 + 0.5 * Math.sin(t * 60 + b.phase);
  return { x: b.rx * Math.cos(a), y: b.cy + b.ry * Math.sin(a * 1.7), wing: 1.2 + 1.4 * beat };
}
export const BEE_WING_MAX = 2.6;

// A bee's wing at (x, y), `half` high (as a piece: at its widest, BEE_WING_MAX, about the
// origin, and squeezed).
export function drawBeeWing(g, x = 0, y = 0, half = BEE_WING_MAX) {
  return g.ellipse(x, y, 2.6, half).fill({ color: BEE_WING, alpha: 0.8 });
}

// A bee's body at (x, y): yellow with a dark stripe.
export function drawBee(g, x = 0, y = 0) {
  return g.ellipse(x, y, 4, 3).fill(BEE).rect(x - 0.8, y - 3, 1.6, 6).fill(BEE_STRIPE);
}

// Hitbox: the stepped pyramid in OBSTACLE_HITBOXES.temple (a shrine, three tiers and a base
// down to the floor), big enough for a door taller than the monkey. What shows is only the
// top of a temple far bigger than the gap: its lower part is buried in the jungle, lost
// in a green haze and overgrown with ferns and vines, so it reads as something huge
// rising out of the undergrowth. A Mayan-style temple in one of four looks, `o.variant`;
// the shape and hitbox are the same for all, and the looks differ in stone and detail:
//   0  limestone, a stepped-fret frieze round the shrine
//   1  sandstone, with a roof comb over the shrine
//   2  mossy grey-green stone, serpent heads on the stairs, moss and ferns
//   3  dark basalt, gold inlay and two braziers whose flames flicker
// A staircase climbs the middle of the front, from the jungle to the shrine's door.
export const TEMPLE_STYLES = [
  { stone: 0xd8ceb0, light: 0xefe8d2, dark: 0xa89d7d, deep: 0x4a4332 },
  { stone: 0xc78a55, light: 0xe2ab78, dark: 0x9a6334, deep: 0x4a2c18 },
  { stone: 0x8c9f89, light: 0xaabda6, dark: 0x667a64, deep: 0x2f3a31 },
  { stone: 0x676a77, light: 0x888b99, dark: 0x484a56, deep: 0x1d1e25 },
];
export const GOLD = 0xdcab3e;
// The fringe of ferns at the foot of a temple: deeper greens than the leaves elsewhere, so
// they blend into the undergrowth, which stays dark whatever the time of day.
export const FRINGE = 0x2c5a2e;
export const FRINGE_DEEP = 0x1d4423;
export const MOSS = 0x4f8a3a;
export const MOSS_LIGHT = 0x73ad4c;
export const FLAME = 0xff9a2e;
export const FLAME_CORE = 0xffe27a;
export const GLOW = 0xff8a2a;
export const GLOW_LAYERS = 16;
export const HAZE = 0x183222;
// The greens of the leaves and moss on a temple, as its pieces' frames.
export const TEMPLE_GREENS = { FRINGE_DEEP, BUSH, FRINGE, BUSH_LIGHT, LEAF_DARK, LEAF, MOSS, MOSS_LIGHT };

// A tier (`r`, a rect of the hitbox) down to `bottom`: stone with a lit top edge, a shadow
// under it and courses of blocks (joints staggered course by course).
export const TEMPLE_COURSE = 23;
export const TEMPLE_JOINT = 34;
export function drawTempleTier(g, style, r, bottom = r.dy + r.h) {
  g.rect(r.dx, r.dy, r.w, bottom - r.dy).fill(style.stone);
  g.rect(r.dx, r.dy, r.w, 6).fill(style.light);
  g.rect(r.dx, r.dy + 6, r.w, 4).fill({ color: style.dark, alpha: 0.5 });
  const course = TEMPLE_COURSE;
  for (let y = r.dy + course, row = 0; y < bottom; y += course, row++) {
    g.moveTo(r.dx, y).lineTo(r.dx + r.w, y).stroke({ width: 1.2, color: style.dark, alpha: 0.45 });
    for (let x = r.dx + (row % 2 ? 17 : 0) + TEMPLE_JOINT; x < r.dx + r.w; x += TEMPLE_JOINT) {
      g.moveTo(x, y - course).lineTo(x, y).stroke({ width: 1.2, color: style.dark, alpha: 0.3 });
    }
  }
  return g;
}

// The base is a platform of mouldings and recessed panels, a row each side of the stairs,
// every TEMPLE_PANEL_ROW down to `floor`. A row (`y` its top) is 78 high.
export const TEMPLE_PANEL_ROW = 92;
export function templePanelRows(floor) {
  const base = OBSTACLE_HITBOXES.temple[4];
  const rows = [];
  for (let y = base.dy + 40; y < floor - 20; y += TEMPLE_PANEL_ROW) rows.push(y);
  return rows;
}

export function drawTemplePanels(g, style, y) {
  const base = OBSTACLE_HITBOXES.temple[4];
  const half = -base.dx;
  g.rect(base.dx, y, base.w, 7).fill(style.light).rect(base.dx, y + 7, base.w, 4).fill({ color: style.dark, alpha: 0.6 });
  for (const side of [-1, 1]) {
    const x = side < 0 ? base.dx + 18 : 44;
    const w = half - 18 - 44;
    g.rect(x, y + 26, w, 52).fill({ color: style.dark, alpha: 0.28 });
    g.rect(x, y + 26, w, 3).fill({ color: style.dark, alpha: 0.5 }).rect(x, y + 75, w, 3).fill({ color: style.light, alpha: 0.35 });
  }
  return g;
}

// The staircase up the middle, with a low wall each side: wide enough for the monkey, its
// steps (every TEMPLE_STEP) about a quarter of its height. From the first tier to `bottom`.
export const TEMPLE_STAIRS = { x: -30, y: OBSTACLE_HITBOXES.temple[1].dy, w: 60, wall: 8 };
export const TEMPLE_STEP = 12;
export function drawTempleStairs(g, style, top, bottom) {
  const { x, w, wall } = TEMPLE_STAIRS;
  g.rect(x - wall, top, wall, bottom - top).fill(style.dark);
  g.rect(x + w, top, wall, bottom - top).fill(style.dark);
  g.rect(x, top, w, bottom - top).fill(style.dark);
  for (let y = top; y < bottom; y += TEMPLE_STEP) g.rect(x, y, w, 7).fill(style.light);
  return g;
}

// The shrine: the walls, a corbelled doorway taller than the monkey and a dark roof slab.
// The doorway is lower under a roof comb (look 1).
export const templeDoorTop = (variant) => (variant === 1 ? 26 : 18);
export function drawTempleShrine(g, style, variant) {
  const shrine = OBSTACLE_HITBOXES.temple[0];
  g.rect(shrine.dx, shrine.dy, shrine.w, shrine.h).fill(style.stone);
  g.rect(shrine.dx - 4, shrine.dy, shrine.w + 8, 9).fill(style.dark);
  g.rect(shrine.dx - 4, shrine.dy, shrine.w + 8, 3).fill(style.light);
  const doorTop = templeDoorTop(variant);
  g.poly([-22, shrine.h, -22, doorTop + 10, -17, doorTop + 10, -17, doorTop + 5, -11, doorTop + 5, -11, doorTop, 11, doorTop, 11, doorTop + 5, 17, doorTop + 5, 17, doorTop + 10, 22, doorTop + 10, 22, shrine.h]).fill(style.deep);
  g.rect(-26, doorTop - 4, 52, 4).fill(style.light);
  g.rect(shrine.dx, shrine.dy + shrine.h - 5, shrine.w, 5).fill(style.dark);
  return g;
}

// Look 0: a stepped fret, a row of little squares, across the top of the shrine.
export function drawTempleFret(g, style) {
  const shrine = OBSTACLE_HITBOXES.temple[0];
  for (let x = shrine.dx + 7; x < shrine.dx + shrine.w - 9; x += 14) g.rect(x, 12, 8, 6).fill(style.dark).rect(x + 2, 14, 4, 2).fill(style.stone);
  return g;
}

// Look 1: a tall roof comb, a wall over the shrine, with three square windows.
export function drawTempleComb(g, style) {
  const shrine = OBSTACLE_HITBOXES.temple[0];
  g.rect(-32, shrine.dy, 64, 18).fill(style.dark);
  g.rect(-32, shrine.dy, 64, 4).fill(style.light);
  for (const x of [-22, -6, 10]) g.rect(x, 7, 12, 9).fill(style.deep);
  return g;
}

// Look 2: a serpent head on a stair wall (`side` -1 left, 1 right), looking out.
export function drawTempleSerpent(g, style, side) {
  const tierA = OBSTACLE_HITBOXES.temple[1];
  const x = side * (TEMPLE_STAIRS.w / 2 + 4);
  g.ellipse(x, tierA.dy - 2, 11, 8.5).fill(style.stone).stroke({ width: 1.5, color: style.dark });
  g.circle(x + side * 3, tierA.dy - 4.5, 2.4).fill(0xffe27a).circle(x + side * 3, tierA.dy - 4.5, 1).fill(style.deep);
  g.poly([x + side * 9, tierA.dy + 1, x + side * 15, tierA.dy + 6, x + side * 7, tierA.dy + 5]).fill(0xf1ead8);
  return g;
}

// A leaf on each end of a tier (`r`), `inset` from its corners and `drop` below its top,
// at the two angles, in the two colours.
export function drawTempleTierFerns(g, r, [left, right], length, width, inset, drop, [a, b]) {
  return g.poly(leafPoints(r.dx + inset, r.dy + drop, a, length, width)).fill(left).poly(leafPoints(r.dx + r.w - inset, r.dy + drop, b, length, width)).fill(right);
}

// Look 3: gold inlay, a band across the middle tier and a frame round the doorway.
export function drawTempleGold(g) {
  const [shrine, , tierB] = OBSTACLE_HITBOXES.temple;
  const doorTop = templeDoorTop(3);
  g.rect(tierB.dx, tierB.dy + 16, tierB.w, 6).fill(GOLD);
  for (let x = tierB.dx + 10; x < tierB.dx + tierB.w - 10; x += 22) g.rect(x, tierB.dy + 26, 10, 5).fill(GOLD);
  g.rect(-26, doorTop - 4, 52, 3).fill(GOLD).rect(-24, doorTop - 1, 3, shrine.h - doorTop - 1).fill(GOLD).rect(21, doorTop - 1, 3, shrine.h - doorTop - 1).fill(GOLD);
  return g;
}

// Look 3: a brazier on each end of the first tier (at x), its flame flickering.
export const TEMPLE_BRAZIERS = [-66, 66];
export function drawTempleBrazier(g, style, x) {
  const tierA = OBSTACLE_HITBOXES.temple[1];
  return g.poly([x - 11, tierA.dy, x - 7, tierA.dy - 12, x + 7, tierA.dy - 12, x + 11, tierA.dy]).fill(style.deep).rect(x - 13, tierA.dy - 16, 26, 5).fill(GOLD);
}

// Brazier `i`'s flame at time `t`: how it sways, how high its tip is, and the glow's
// brightness (`flicker`) and size (`reach`, a scale) with it; `k` (0 to 1) is how high it
// leaps, which all of these follow.
export function templeFlame(t, phase, i) {
  const tierA = OBSTACLE_HITBOXES.temple[1];
  const k = 0.5 + 0.5 * Math.sin(t * 9 + phase + i * 2.1);
  return { k, sway: 3 * Math.sin(t * 6 + phase + i), top: tierA.dy - 16 - 20 - 9 * k, flicker: 0.85 + 0.15 * k, reach: 0.95 + 0.05 * k };
}

export function drawTempleFlame(g, x, { sway, top }) {
  const base = OBSTACLE_HITBOXES.temple[1].dy - 16;
  g.poly([x - 8, base, x - 5 + sway * 0.3, top + 13, x + sway, top, x + 5 + sway * 0.3, top + 13, x + 8, base]).fill(FLAME);
  g.poly([x - 4, base, x + sway * 0.5, top + 12, x + 4, base]).fill(FLAME_CORE);
  return g;
}

// The glow round a brazier at x: many thin layers, so there are no rings to see. Its
// alpha is `strength` (darkness by flicker) times the full glow's, and it is `reach` its
// size; added to what is behind it.
export function drawTempleGlow(g, x, strength, reach = 1) {
  for (const { radius, alpha } of templeGlowLayers(strength, reach)) g.circle(x, TEMPLE_GLOW_Y, radius).fill({ color: GLOW, alpha });
  return g;
}

// The glow's layers (as drawTempleGlow draws them): each a disc `radius` across at `alpha`
// for a glow of `strength` (darkness by flicker) and `reach` (a scale), each added to what
// is behind it, smallest first.
export function templeGlowLayers(strength, reach = 1) {
  return Array.from({ length: GLOW_LAYERS }, (_, j) => ({ radius: (10 + 4.2 * j) * reach, alpha: (0.035 * strength * (GLOW_LAYERS - j / 2)) / GLOW_LAYERS }));
}
export const TEMPLE_GLOW_Y = OBSTACLE_HITBOXES.temple[1].dy - 34;
export const TEMPLE_GLOW_RADIUS = 10 + 4.2 * (GLOW_LAYERS - 1);
// A layer of the glow at its largest, opaque (as a piece; scaled and faded per layer).
export function drawTempleGlowDisc(g) {
  return g.circle(0, 0, TEMPLE_GLOW_RADIUS).fill(GLOW);
}

// The moss and vines on the three tiers (from the top), from the decoration's random
// stream: a few patches of moss on each, none over the stairs, most with a vine hanging
// from them ({ from, control, to }).
export function templeOvergrowth(rand) {
  const [, ...tiers] = OBSTACLE_HITBOXES.temple;
  return tiers.slice(0, 3).map((r) => {
    const patches = [];
    for (let i = 0; i < 3; i++) {
      const x = r.dx + 14 + rand() * (r.w - 28);
      if (Math.abs(x) < TEMPLE_STAIRS.w / 2 + 12) continue;
      const moss = { x, y: r.dy + 5, rx: 10 + rand() * 12, color: i % 2 ? MOSS : MOSS_LIGHT };
      if (rand() < 0.7) moss.vine = { from: [x, r.dy + 8], control: [x + (rand() - 0.5) * 8, r.dy + 22], to: [x + (rand() - 0.5) * 6, r.dy + 28 + rand() * 14] };
      patches.push(moss);
    }
    return patches;
  });
}

export const TEMPLE_MOSS_RY = 4.5;
export function drawTempleMoss(g, { x, y, rx, color }, alpha) {
  return g.ellipse(x, y, rx, TEMPLE_MOSS_RY).fill({ color, alpha });
}

export const TEMPLE_VINE_WIDTH = 2;
export function drawTempleVine(g, { from, control, to }) {
  return g.moveTo(...from).quadraticCurveTo(...control, ...to).stroke({ width: TEMPLE_VINE_WIDTH, color: MOSS });
}

// The haze over the foot of the temple, round (0, floor + 30): soft on every side (nested
// ellipses, no edges to see), so it reads as mist and not as a box round the temple.
export const TEMPLE_HAZE = { rx: 330, ry: 280, steps: 16 };
export function drawTempleHaze(g, floor) {
  for (let i = 0; i < TEMPLE_HAZE.steps; i++) {
    const u = 1 - i / TEMPLE_HAZE.steps;
    g.ellipse(0, floor + 30, 90 + 240 * u, 30 + 250 * u).fill({ color: HAZE, alpha: 0.04 });
  }
  return g;
}

// The fringe of ferns and leaves across the foot of the temple, from the decoration's
// random stream: leaves ({ x, a, length, width, color }) rising from the floor, wider than
// the temple.
export function templeFringe(rand) {
  const leaves = [];
  for (let x = -300; x <= 300; x += 15 + rand() * 9) {
    const length = 45 + rand() * 40;
    for (const a of [-Math.PI / 2 - 0.45 - rand() * 0.3, -Math.PI / 2 + 0.45 + rand() * 0.3]) {
      leaves.push({ x, a, length, width: 11 + rand() * 6, color: rand() < 0.5 ? FRINGE_DEEP : BUSH });
    }
    leaves.push({ x: x + 6, a: -Math.PI / 2 + (rand() - 0.5) * 0.5, length: length * 0.8, width: 10, color: rand() < 0.5 ? FRINGE : BUSH_LIGHT });
  }
  return leaves;
}

export function drawTempleLeaf(g, { x, y, a, length, width, color }) {
  return g.poly(leafPoints(x, y, a, length, width)).fill(color);
}

// Moving obstacles: a body that follows the obstacle, with parts animated from its
// time, plus scenery that stays put (the snake's vine) or stretches (the spider's
// thread). Each body fits its hitbox circle.
export const SPIDER = 0x2a1f2e;
export const SPIDER_LEG = 0x1a1320;
export const SPIDER_MARK = 0xc0392b;
export const THREAD = 0xd9e4dc;
export const SNAKE = 0x6f9b2e;
export const SNAKE_DARK = 0x46701c;
export const SNAKE_BELLY = 0xd8c35a;
export const TONGUE = 0xd2323c;
export const STALK = 0x3f6b24;
export const BIRD = 0xd64541;
export const BIRD_DARK = 0xa3322f;
export const BIRD_BELLY = 0xf2c14e;
export const BEAK = 0xf39c12;
export const BLUE = 0x3f86d6;
export const BLUE_DARK = 0x2a5fa3;
export const BLUE_BELLY = 0xd6e9ff;
export const PURPLE = 0x8e4fc4;
export const PURPLE_DARK = 0x5e2f8f;
export const PURPLE_BELLY = 0xe9d8f7;

// The colours of the flying birds (body, wing and tail, belly): red, blue and purple.
export const BIRD_COLORS = [
  [BIRD, BIRD_DARK, BIRD_BELLY],
  [BLUE, BLUE_DARK, BLUE_BELLY],
  [PURPLE, PURPLE_DARK, PURPLE_BELLY],
];
// The looks bats come in: slight differences in colour, ears, wing span and a pale collar,
// one per bat, picked at random for its gap (and for the one hanging on a branch).
export const BAT_LOOKS = [
  { fur: 0x4a3a5c, dark: 0x2a2036, wing: 0x5d4a75, eye: 0xff5a4a, ear: 1, span: 1, collar: null },
  { fur: 0x5a4030, dark: 0x32231a, wing: 0x6e5240, eye: 0xffb347, ear: 1.15, span: 0.95, collar: 0xc9a063 },
  { fur: 0x6b7078, dark: 0x3a3d44, wing: 0x80858f, eye: 0xff5a4a, ear: 0.85, span: 1.12, collar: null },
  { fur: 0x24222b, dark: 0x121118, wing: 0x3a3646, eye: 0xffe14a, ear: 1.05, span: 0.9, collar: null },
];
export const batLook = (rand) => BAT_LOOKS[Math.floor(rand() * BAT_LOOKS.length)];
export const EYE = 0xffffff;
export const PUPIL = 0x111111;

export function drawSpiderBody(g) {
  g.circle(0, 5, 13).fill(SPIDER).circle(0, -9, 8).fill(SPIDER);
  g.poly([0, -2, 4, 5, 0, 12, -4, 5]).fill(SPIDER_MARK);
  for (const [x, y] of [[-3, -12], [3, -12], [-5, -8], [5, -8]]) g.circle(x, y, 1.6).fill(EYE);
  return g;
}

// The thread from the canopy down to the spider, at x from y `top` to `bottom` (world).
export const SPIDER_THREAD_WIDTH = 1.5;
export function drawSpiderThread(g, x, top, bottom) {
  return g.moveTo(x, top).lineTo(x, bottom).stroke({ width: SPIDER_THREAD_WIDTH, color: THREAD, alpha: 0.8 });
}

// The eight legs at time `t`, wriggling: each from its shoulder on the body out to a
// knee and down to a foot.
export function spiderLegs(t) {
  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.55 + 0.12 * Math.sin(t * 9 + i * 1.7 + side);
      const kx = side * (9 + 9 * Math.cos(a));
      const ky = -4 + 12 * Math.sin(a) - 6;
      legs.push({ shoulder: [side * 5, -3 + i * 3], knee: [kx, ky], foot: [kx + side * 6, ky + 12] });
    }
  }
  return legs;
}

export const SPIDER_LEG_WIDTH = 2.5;
export function drawSpiderLegs(g, legs) {
  for (const { shoulder, knee, foot } of legs) g.moveTo(...shoulder).lineTo(...knee).lineTo(...foot);
  return g.stroke({ width: SPIDER_LEG_WIDTH, color: SPIDER_LEG, cap: 'round', join: 'round' });
}

// y = baseY + ay·cos u: climbing while sin u > 0.
export function snakeClimbs(o, t) {
  const u = (2 * Math.PI * t) / o.motion.period + o.motion.phase;
  return Math.sin(u) >= 0;
}

// The stalk the snake climbs, at x from the floor (`bottom`) up to `top` (world), a gentle S.
export const SNAKE_STALK_WIDTH = 7;
export function drawSnakeStalk(g, x, top, bottom) {
  return g.moveTo(x, bottom).bezierCurveTo(x - 6, bottom - 120, x + 6, top + 80, x, top).stroke({ width: SNAKE_STALK_WIDTH, color: STALK, cap: 'round' });
}

// The leaves up the stalk: one every 46 px, on alternate sides ({ y, side }).
export function snakeStalkLeaves(top, bottom) {
  const leaves = [];
  for (let y = top + 30; y < bottom - 20; y += 46) leaves.push({ y, side: Math.round(y / 46) % 2 ? 1 : -1 });
  return leaves;
}

export function drawSnakeStalkLeaf(g, x, { y, side }) {
  return g.poly(leafPoints(x, y, side > 0 ? -0.5 : Math.PI + 0.5, 16, 8)).fill(side > 0 ? LEAF : LEAF_DARK);
}

export function drawSnakeCoil(g) {
  for (let i = 0; i < 3; i++) {
    const y = -8 + i * 9;
    g.moveTo(-15, y).quadraticCurveTo(0, y + 7, 15, y + 2).stroke({ width: 9, color: i % 2 ? SNAKE_DARK : SNAKE, cap: 'round' });
  }
  return g.moveTo(-13, 17).quadraticCurveTo(0, 22, 12, 16).stroke({ width: 3, color: SNAKE_BELLY, cap: 'round' });
}

// The neck and head, pointing up; flipped to point down.
export function drawClimbingSnakeHead(g) {
  g.moveTo(-15, -8).quadraticCurveTo(-8, -18, 0, -18).stroke({ width: 8, color: SNAKE, cap: 'round' });
  g.ellipse(4, -19, 9, 6.5).fill(SNAKE);
  g.circle(7, -21, 1.8).fill(PUPIL);
  return g.moveTo(12, -19).lineTo(18, -19).lineTo(21, -22).moveTo(18, -19).lineTo(21, -16).stroke({ width: 1.2, color: TONGUE });
}

// The flying birds: each one's colours (body, wing and tail, belly), tail, crest (if any),
// how fast it flaps, and its wing (from its root, `front` its front corner, out to a tip
// `reach` across and `rise` up at full lift).
export const FLYING_BIRDS = {
  bird: { colors: BIRD_COLORS[0], tail: [-12, -2, -22, -8, -21, 2, -12, 4], crest: null, flap: 16, wing: { front: 4, reach: 6, rise: 14 } },
  blueBird: { colors: BIRD_COLORS[1], tail: [-12, -1, -23, -7, -22, 3, -12, 4], crest: [5, -11, 4, -18, 9, -12], flap: 13, wing: { front: 5, reach: 7, rise: 16 } },
  purpleBird: { colors: BIRD_COLORS[2], tail: [-12, -2, -24, -9, -22, 0, -24, 5, -12, 4], crest: [6, -11, 5, -17, 10, -12], flap: 14, wing: { front: 5, reach: 7, rise: 15 } },
};

export function drawFlyingBirdBody(g, { colors: [fur, dark, belly], tail, crest }) {
  g.poly(tail).fill(dark);
  g.ellipse(-1, 0, 13, 10).fill(fur);
  g.ellipse(1, 4, 9, 5).fill(belly);
  g.circle(9, -5, 7).fill(fur);
  if (crest) g.poly(crest).fill(dark);
  g.poly([14, -7, 22, -4, 14, -2]).fill(BEAK);
  return g.circle(10, -7, 2.4).fill(EYE).circle(10.8, -7, 1.2).fill(PUPIL);
}

// The wing at `lift` (-1 down to 1 up).
export function drawFlyingBirdWing(g, { colors: [, dark], wing: { front, reach, rise } }, lift) {
  return g.poly([-8, -3, front, -3, -2 - reach * lift, -3 - rise * lift]).fill(dark);
}

// A flying bird's pose at time `t`: which way it faces, its pitch and its wing's lift.
//   bird        faces the way it patrols
//   blueBird    faces left or right by gap; nose up while climbing (y decreasing), down
//               while diving
//   purpleBird  faces the way it flies and tilts its nose along the circle
export function flyingBirdPose(o, t) {
  const { flap } = FLYING_BIRDS[o.type];
  const lift = Math.sin(t * flap);
  if (o.type === 'blueBird') {
    const facing = o.gap % 2 === 0 ? 1 : -1;
    return { facing, rotation: facing * Math.max(-0.6, Math.min(0.6, o.vyAt(t) / 320)), lift };
  }
  const facing = o.vxAt(t) >= 0 ? 1 : -1;
  return { facing, rotation: o.type === 'purpleBird' ? facing * Math.max(-0.5, Math.min(0.5, o.vyAt(t) / 400)) : null, lift };
}

export const flyingBatLook = (gap) => batLook(mulberry32(mixSeed(0xba7, gap)));

export function flyingBatPose(o, t) {
  const facing = o.vxAt(t) >= 0 ? 1 : -1;
  const rotation = o.type === 'circleBat' ? facing * Math.max(-0.5, Math.min(0.5, o.vyAt(t) / 400)) : null;
  return { facing, rotation, lift: Math.sin(t * 22) };
}

export function drawFlyingBatBody(g, look) {
  const ear = look.ear;
  g.ellipse(-2, 1, 10, 7.5).fill(look.fur);
  if (look.collar !== null) g.ellipse(4, 0, 4, 6.5).fill(look.collar);
  g.circle(9, -2, 6).fill(look.fur);
  g.poly([5, -6, 6, -6 - 8 * ear, 10, -7]).fill(look.dark).poly([9, -6, 12, -6 - 7 * ear, 14, -4]).fill(look.dark);
  g.poly([14, -1, 19, 1, 14, 3]).fill(look.dark);
  g.circle(11, -3, 1.8).fill(look.eye);
  return g.poly([-11, 1, -18, 5, -12, 5]).fill(look.dark);
}

// One wing seen from the side at `lift` (-1 down to 1 up): an arm out to a tip, and a
// scalloped membrane from the tip back to the body.
export function drawFlyingBatWing(g, look, lift) {
  const root = [-3, 4];
  const tip = [(-23 - 3 * Math.abs(lift)) * look.span, (-5 - 22 * lift) * look.span];
  const elbow = [-7, (-4 - 11 * lift) * look.span];
  const along = (f, dx, dy) => [tip[0] + (root[0] - tip[0]) * f + dx, tip[1] + (root[1] - tip[1]) * f + dy];
  const edge = [along(0.22, 3, 1), along(0.4, -1, 7), along(0.58, 3, 4), along(0.78, -1, 6)];
  g.poly([0, -3, ...elbow, ...tip, ...edge.flat(), ...root])
    .fill(look.wing)
    .poly([0, -3, ...elbow, ...tip])
    .stroke({ width: 2.4, color: look.dark, cap: 'round', join: 'round' });
  for (const e of [edge[1], edge[3]]) g.moveTo(0, -3).lineTo(e[0], e[1]).stroke({ width: 1, color: look.dark, alpha: 0.7 });
  return g;
}

// The colours of the lines that pieces build from straight segments and round joints
// (PHASER_PLAN.md, M4): legs, twigs, stems, vines and threads.
export const LINE_COLORS = {
  vine: VINE,
  stalk: STALK,
  snake: SNAKE,
  spiderLeg: SPIDER_LEG,
  thread: THREAD,
  monkeyFur: FUR,
  twig: TWIG_DARK,
  twigLight: TWIG_LIGHT,
  coconutStem: COCONUT_DARK,
  flowerStem: FLOWER_STEM,
  leafDark: LEAF_DARK,
  moss: MOSS,
};

// How dark the stage is, 0 (day) to 1 (night), from its tint: the brighter the tint, the less.
export function darknessOf(tint) {
  const brightness = ((tint >> 16) + ((tint >> 8) & 0xff) + (tint & 0xff)) / (3 * 255);
  return Math.min(Math.max((0.85 - brightness) / 0.35, 0), 1);
}
