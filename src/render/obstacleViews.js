import { Container, Graphics } from 'pixi.js';
import { OBSTACLE_HITBOXES } from '../config.js';
import { mixSeed, mulberry32 } from '../sim/rng.js';
import { FLOOR_Y } from './background.js';
import { leafPoints } from './shapes.js';

// Obstacle art, built once per obstacle from its (unscaled) hitbox shapes so the two
// match, then scaled like the hitbox.
// Obstacles above this height hang from the canopy on vines; lower ones stand on a
// trunk or pole from the floor. Supports are scenery: the gameplay hitbox is only
// the obstacle itself. (Generated heights avoid the band around this line.)
const HANGS_ABOVE_Y = 255;
const CANOPY_Y = 26;

const BARK = 0x6b4423;
const BARK_DARK = 0x4a2d16;
const BARK_LIGHT = 0x8a5a31;
const LEAF = 0x4e8c2c;
const LEAF_DARK = 0x356b1f;
const VINE = 0x3b6a28;
const SUPPORT_TRUNK = 0x33251a;
const BUSH = 0x1f4a2a;
const BUSH_LIGHT = 0x2f6b3b;
const THORN = 0xd8cf9a;
const ROCK = 0x858b90;
const ROCK_LIGHT = 0xa6acb1;
const ROCK_DARK = 0x62676c;
const ROCK_EDGE = 0x464a4e;
const HIVE = 0xe2a93c;
const HIVE_LIGHT = 0xf3cd6e;
const HIVE_DARK = 0xb57a1f;
const HIVE_EDGE = 0x7d5114;
const BEE = 0xffd23f;
const BEE_STRIPE = 0x2a1f12;
const BEE_WING = 0xf4fbff;

function vine(g, x, fromY, toY, sway) {
  g.moveTo(x, fromY)
    .bezierCurveTo(x + sway, fromY + (toY - fromY) * 0.35, x - sway, fromY + (toY - fromY) * 0.7, x, toY)
    .stroke({ width: 3, color: VINE, cap: 'round' });
}

// From topY down past the floor line; y in the obstacle's local coordinates.
function trunk(g, o, x, topY, width) {
  const bottom = (FLOOR_Y + 20 - o.y) / o.scale;
  g.poly([x - width / 2, topY, x + width / 2, topY, x + width / 2 + 5, bottom, x - width / 2 - 5, bottom]).fill(SUPPORT_TRUNK);
}

// Hitbox: rect 160 × 24 centred. A limb tapering from a cut trunk stub on the left,
// with a leaf tuft near the tip, and the decoration it carries, if any (see addDecoration).
// Returns the decoration's animation.
function drawBranch(g, o, rand, hangs, view) {
  const [box] = OBSTACLE_HITBOXES.branch;
  const left = box.dx;
  const right = box.dx + box.w;
  const top = box.dy;
  const bottom = box.dy + box.h;
  if (hangs) {
    vine(g, left + 30, (CANOPY_Y - o.y) / o.scale, top + 2, 8);
    vine(g, right - 45, (CANOPY_Y - o.y) / o.scale, top + 4, -8);
  } else {
    trunk(g, o, left + 14, 0, 26);
  }
  g.poly([left, top, right - 18, top + 5, right, -1, right - 18, bottom - 5, left, bottom]).fill(BARK);
  g.poly([left, top, right - 18, top + 5, right - 14, top + 9, left, top + 7]).fill(BARK_LIGHT);
  for (let i = 0; i < 4; i++) {
    const x = left + 30 + i * 28 + rand() * 10;
    g.moveTo(x, -3 + rand() * 4).lineTo(x + 14, -2 + rand() * 4).stroke({ width: 1.5, color: BARK_DARK });
  }
  // Cut stub end.
  g.ellipse(left + 3, 0, 5, box.h / 2).fill(BARK_LIGHT).ellipse(left + 3, 0, 2.5, box.h / 4).fill(BARK_DARK);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.45;
    g.poly(leafPoints(right - 30 + i * 4, top + 4, a, 16, 8)).fill(i % 2 ? LEAF_DARK : LEAF);
  }
  return o.decoration ? addDecoration(view, o) : null;
}

// The decorations on a branch (animals) are scenery: not part of the hitbox. Each is placed (and, where
// it matters, turned) at random for its gap, away from the cut stub and the leaf tuft.
const SPARROW = 0x9a6b3c;
const SPARROW_DARK = 0x6e4623;
const SPARROW_BELLY = 0xf1dfb4;
const SPARROW_BEAK = 0x3a2a1c;

// Where along the branch's top edge x lies: the limb tapers from y = top at the stub to
// 5 px lower at its end.
function branchTop(x) {
  const [box] = OBSTACLE_HITBOXES.branch;
  return box.dy + (5 * (x - box.dx)) / (box.w - 18);
}

// A small sparrow perched on top of the branch: now and then it pecks at the bark, and its
// tail flicks. Faces left or right at random.
function drawPerchedBird(rand) {
  const bird = new Container();
  const dir = rand() < 0.5 ? 1 : -1;
  bird.scale.x = dir;
  bird.position.set(-52 + rand() * 56, branchTop(0));
  const phase = rand() * 6.3;
  const body = new Graphics();
  body.ellipse(0, -9, 10, 8).fill(SPARROW);
  body.ellipse(1.5, -6.5, 6, 5).fill(SPARROW_BELLY);
  body.ellipse(-2, -10, 7, 4.5).fill(SPARROW_DARK);
  body.moveTo(-1, -1).lineTo(-1, 0).moveTo(3, -1).lineTo(3, 0).stroke({ width: 1.5, color: SPARROW_BEAK });
  const tail = new Graphics();
  tail.poly([0, 0, -11, -3, -10, 3]).fill(SPARROW_DARK);
  tail.position.set(-7, -10);
  const head = new Graphics();
  head.circle(0, 0, 6).fill(SPARROW);
  head.poly([5, -1.5, 11, 0.5, 5, 2.5]).fill(SPARROW_BEAK);
  head.circle(2, -1.5, 1.5).fill(EYE).circle(2.5, -1.5, 0.8).fill(PUPIL);
  head.position.set(6, -16);
  bird.addChild(tail, body, head);
  const animate = (t) => {
    // A peck every couple of seconds: the head dips forward and comes back up.
    const peck = Math.max(0, Math.sin(t * 2.1 + phase)) ** 10;
    head.rotation = peck * 0.9;
    head.y = -16 + peck * 3;
    tail.rotation = 0.14 * Math.sin(t * 3.3 + phase);
  };
  return { part: bird, animate };
}

const SMOOTH = (a, b, x) => {
  const u = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return u * u * (3 - 2 * u);
};

// A snake lying along the top of the branch in lazy S-curves, its head reared up: the
// neck sways, and now and then the tongue flicks. Faces left or right at random.
function drawPerchedSnake(rand) {
  const snake = new Container();
  const dir = rand() < 0.5 ? 1 : -1;
  snake.scale.x = dir;
  const cx = -40 + rand() * 40;
  snake.position.set(cx, branchTop(cx));
  const phase = rand() * 6.3;
  const g = new Graphics();
  snake.addChild(g);
  const SEGMENTS = 26;
  const animate = (t) => {
    const sway = Math.sin(t * 1.5 + phase);
    const points = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      const rise = 25 * SMOOTH(0.55, 1, u) ** 1.3;
      const x = -28 + 50 * u + 5 * sway * SMOOTH(0.6, 1, u) ** 2;
      const y = -4 - 4.5 * Math.sin(u * 11) * (1 - u) * (1 - SMOOTH(0.6, 0.9, u)) - rise;
      points.push([x, y]);
    }
    g.clear();
    for (let i = 0; i < SEGMENTS; i++) {
      const u = i / SEGMENTS;
      const width = 3 + 5 * Math.min(1, u * 2.2) - 1.5 * SMOOTH(0.8, 1, u);
      const [a, b] = [points[i], points[i + 1]];
      g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width, color: Math.floor(i / 3) % 2 ? SNAKE_DARK : SNAKE, cap: 'round' });
    }
    const [hx, hy] = points[SEGMENTS];
    const [px, py] = points[SEGMENTS - 3];
    const angle = Math.atan2(hy - py, hx - px);
    g.ellipse(hx, hy, 7, 4.8).fill(SNAKE);
    // Eye and, flicking, the tongue, in the head's own frame.
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const at = (x, y) => [hx + x * cos - y * sin, hy + x * sin + y * cos];
    const [ex, ey] = at(2, -1.8);
    g.circle(ex, ey, 1.4).fill(PUPIL);
    if ((t * 0.9 + phase) % 1 < 0.14) {
      const [x0, y0] = at(7, 0);
      const [x1, y1] = at(13, 0);
      const [x2, y2] = at(16, -2.5);
      const [x3, y3] = at(16, 2.5);
      g.moveTo(x0, y0).lineTo(x1, y1).lineTo(x2, y2).moveTo(x1, y1).lineTo(x3, y3).stroke({ width: 1.2, color: TONGUE });
    }
  };
  return { part: snake, animate };
}

const FUR = 0x7d7468;
const FUR_DARK = 0x574f45;
const FACE = 0xe6d0b2;

// A grey monkey hanging from the underside of the branch by its hands, swaying like a
// pendulum, its legs swinging and its tail curling; now and then it blinks. Mirrored at
// random, so its tail curls out to the left or right.
function drawHangingMonkey(rand) {
  const monkey = new Container();
  const [box] = OBSTACLE_HITBOXES.branch;
  const cx = -32 + rand() * 36;
  monkey.position.set(cx, box.dy + box.h - 1);
  monkey.scale.x = rand() < 0.5 ? 1 : -1;
  const phase = rand() * 6.3;
  // Everything hangs from the hands at (0, 0): the pendulum swings about that point.
  const swing = new Container();
  monkey.addChild(swing);
  const arms = new Graphics();
  for (const side of [-1, 1]) arms.moveTo(side * 4, 1).lineTo(side * 7.5, 18).stroke({ width: 4.2, color: FUR, cap: 'round' });
  for (const side of [-1, 1]) arms.circle(side * 4, 1, 2.6).fill(FUR_DARK);
  const tail = new Graphics();
  const legs = new Graphics();
  const body = new Graphics();
  body.ellipse(0, 36, 9.5, 12.5).fill(FUR);
  body.ellipse(0, 38, 5.8, 8).fill(FACE);
  body.circle(-8.2, 19, 3).fill(FUR_DARK).circle(8.2, 19, 3).fill(FUR_DARK);
  body.circle(0, 21, 8.4).fill(FUR);
  body.ellipse(0, 22.5, 5.4, 4.8).fill(FACE);
  const eyes = new Graphics();
  swing.addChild(tail, legs, body, arms, eyes);
  const animate = (t) => {
    swing.rotation = 0.13 * Math.sin(t * 1.7 + phase);
    // Legs kick out and back, out of step.
    legs.clear();
    for (const side of [-1, 1]) {
      const k = 0.35 * Math.sin(t * 2.6 + phase + (side > 0 ? 1.6 : 0));
      const x = side * 5;
      legs.moveTo(x, 44).lineTo(x + side * 2 + 9 * Math.sin(k), 44 + 11 * Math.cos(k)).stroke({ width: 4.2, color: FUR, cap: 'round' });
    }
    // A tail that curls out and up, uncurling a little as it swings.
    const curl = 3 * Math.sin(t * 2.2 + phase);
    tail.clear();
    tail
      .moveTo(5, 45)
      .bezierCurveTo(16 + curl, 47, 21 + curl, 36, 14 - curl, 31)
      .stroke({ width: 3.4, color: FUR_DARK, cap: 'round' });
    // Eyes, shut for a moment every few seconds.
    const blink = (t * 0.33 + phase) % 1 < 0.04;
    eyes.clear();
    for (const side of [-1, 1]) {
      if (blink) eyes.moveTo(side * 3.6 - 1.4, 20.5).lineTo(side * 3.6 + 1.4, 20.5).stroke({ width: 1, color: PUPIL });
      else eyes.circle(side * 3.6, 20.5, 1.5).fill(PUPIL);
    }
  };
  return { part: monkey, animate };
}

const TWIG = 0x8b6a3d;
const TWIG_DARK = 0x5e4524;
const TWIG_LIGHT = 0xb48a52;
const NEST_INSIDE = 0x34261a;
const EGG = 0xc4e6ee;
const EGG_SPECK = 0x7a6a4a;
const SHELL = 0xf6f2e8;
const CHICK = 0xffd84a;
const CHICK_DARK = 0xe8b52c;

// What a nest holds: nothing, an egg, or a hatched egg (a chick in its cracked shell).
export const NEST_STATES = ['empty', 'egg', 'hatched'];

// A woven nest of twigs on top of the branch, empty, with an egg in it, or with a hatched
// egg: a chick peeping from its cracked shell. Which, and which way it faces, is random.
// Returns the state too.
function drawNest(rand) {
  const nest = new Container();
  nest.scale.x = rand() < 0.5 ? 1 : -1;
  const cx = -46 + rand() * 50;
  nest.position.set(cx, branchTop(cx));
  const state = NEST_STATES[Math.floor(rand() * NEST_STATES.length)];
  const phase = rand() * 6.3;

  // The back of the bowl and its dark inside, the contents, then the front wall, so the
  // contents sit in the nest.
  const back = new Graphics();
  back.ellipse(0, -9, 19, 7.5).fill(TWIG_DARK).ellipse(0, -9.5, 15, 5.5).fill(NEST_INSIDE);
  const contents = new Container();
  const front = new Graphics();
  front
    .moveTo(-19, -9)
    .quadraticCurveTo(-21, 3, 0, 4)
    .quadraticCurveTo(21, 3, 19, -9)
    .quadraticCurveTo(0, -3, -19, -9)
    .fill(TWIG);
  // Twigs woven across the front, and a few stuck out of the rim.
  for (let i = 0; i < 7; i++) {
    const x = -14 + rand() * 28;
    const y = -4 + rand() * 6;
    const len = 8 + rand() * 7;
    const tilt = (rand() - 0.5) * 0.5;
    front
      .moveTo(x - len / 2, y - tilt * len)
      .lineTo(x + len / 2, y + tilt * len)
      .stroke({ width: 1.2, color: i % 3 ? TWIG_DARK : TWIG_LIGHT, cap: 'round' });
  }
  // (The ones that stick out of the rim go behind the contents.)
  for (let i = 0; i < 4; i++) {
    const x = -17 + rand() * 34;
    const lean = (rand() - 0.5) * 7;
    back.moveTo(x, -8).lineTo(x + lean, -13 - rand() * 3).stroke({ width: 1.4, color: TWIG_DARK, cap: 'round' });
  }
  front.moveTo(-19, -9).quadraticCurveTo(0, -3, 19, -9).stroke({ width: 2, color: TWIG_DARK, cap: 'round' });
  nest.addChild(back, contents, front);

  let animate = () => {};
  if (state === 'egg') {
    const egg = new Graphics();
    egg.ellipse(0, 0, 5.8, 7.4).fill(EGG);
    egg.ellipse(-1.8, -2.4, 1.8, 2.8).fill({ color: 0xffffff, alpha: 0.65 });
    for (const [x, y] of [[2, 1.5], [-2, 3], [3, -2.5], [0, -4.5]]) egg.circle(x, y, 0.8).fill(EGG_SPECK);
    egg.position.set(0, -11);
    contents.addChild(egg);
    // It rocks a little now and then.
    animate = (t) => {
      const rock = Math.max(0, Math.sin(t * 0.8 + phase)) ** 14;
      egg.rotation = rock * 0.12 * Math.sin(t * 24);
    };
  } else if (state === 'hatched') {
    const shell = new Graphics();
    shell.poly([-6, -2, -6, 3, 0, 6, 6, 3, 6, -2, 4, -4, 2, -1, 0, -4, -2, -1, -4, -4]).fill(SHELL);
    shell.position.set(0, -9);
    const chick = new Container();
    const body = new Graphics();
    body.circle(0, 0, 6.6).fill(CHICK);
    body.ellipse(-4.5, 1.5, 2.4, 3.2).fill(CHICK_DARK);
    body.poly([-1.5, -6, 0, -10, 1.5, -6.2]).fill(CHICK);
    body.circle(2.4, -1.6, 1.3).fill(PUPIL);
    const beak = new Graphics();
    chick.addChild(body, beak);
    chick.position.set(0, -15);
    const cap = new Graphics();
    cap.poly([-6, 0, -4, -4, -2, -1, 0, -5, 2, -1, 4, -4, 6, 0, 5, 3, -5, 3]).fill(SHELL);
    cap.position.set(10.5, -9.5);
    cap.rotation = 0.5;
    contents.addChild(shell, chick, cap);
    animate = (t) => {
      // Bobbing up and down, and peeping: the beak opens and closes in bursts.
      chick.y = -15 + 1.2 * Math.sin(t * 3.4 + phase);
      chick.rotation = 0.1 * Math.sin(t * 2.3 + phase);
      const open = (t * 0.6 + phase) % 1 < 0.35 ? 0.5 + 0.5 * Math.sin(t * 16) : 0;
      beak.clear();
      beak.poly([5.5, -2.5 - open * 2, 11, -1 - open * 2.5, 5.5, -0.8]).fill(BEAK);
      beak.poly([5.5, -0.4, 10, 1 + open * 2.5, 5.5, 1.6]).fill(BEAK);
    };
  } else {
    // Empty: a dry leaf curled in the bottom.
    const leaf = new Graphics();
    leaf.poly(leafPoints(-3, -8, -0.3, 10, 4)).fill(LEAF_DARK);
    contents.addChild(leaf);
  }
  return { part: nest, animate, state };
}

const PANTHER = 0x1d1d27;
const PANTHER_SHEEN = 0x3a3a4d;
const PANTHER_EYE = 0xd9e34a;
const PANTHER_NOSE = 0x5a4a52;

// A black panther lying along the top of the branch with its head up, watching: its
// flanks rise and fall as it breathes, its tail hangs down off the end and swishes, its
// ears twitch now and then and it blinks. Faces left or right at random.
function drawPanther(rand) {
  const panther = new Container();
  panther.scale.x = rand() < 0.5 ? 1 : -1;
  const cx = -28 + rand() * 24;
  panther.position.set(cx, branchTop(cx));
  const phase = rand() * 6.3;

  const tail = new Graphics();
  const body = new Container();
  const g = new Graphics();
  // Haunch, a long heavy body and the front legs stretched out ahead, a paw on each.
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
  const eye = new Graphics();
  const ear = new Graphics();
  ear.circle(0, 0, 2).fill(PANTHER_SHEEN);
  ear.position.set(35.5, -22);
  body.addChild(g, ear, eye);
  panther.addChild(tail, body);

  const animate = (t) => {
    // Breathing: the body swells and settles.
    body.scale.y = 1 + 0.03 * Math.sin(t * 1.7 + phase);
    // The tail hangs from the rump over the end of the limb and swishes at its tip.
    const swish = 6 * Math.sin(t * 1.9 + phase);
    tail.clear();
    tail
      .moveTo(-32, -9)
      .bezierCurveTo(-44, -8, -48 + swish * 0.3, 4, -44 + swish, 14)
      .stroke({ width: 5, color: PANTHER, cap: 'round' });
    tail.moveTo(-44 + swish, 14).quadraticCurveTo(-42 + swish * 1.3, 19.5, -36 + swish * 1.4, 18.5).stroke({ width: 4.4, color: PANTHER, cap: 'round' });
    // Eyes: slit pupils in yellow, shut for a moment every few seconds.
    const blink = (t * 0.28 + phase) % 1 < 0.035;
    eye.clear();
    if (blink) eye.moveTo(26.5, -17.6).lineTo(31, -18).moveTo(33, -17.8).lineTo(37.5, -17.2).stroke({ width: 1, color: PANTHER_SHEEN });
    else {
      eye.ellipse(28.8, -18, 2.4, 1.9).fill(PANTHER_EYE).ellipse(35.4, -17.6, 2.4, 1.9).fill(PANTHER_EYE);
      eye.ellipse(28.8, -18, 0.6, 1.6).fill(PANTHER).ellipse(35.4, -17.6, 0.6, 1.6).fill(PANTHER);
    }
    // One ear flicks now and then.
    ear.scale.y = 1 - 0.55 * Math.max(0, Math.sin(t * 1.3 + phase * 2)) ** 14;
  };
  return { part: panther, animate };
}

// A bat roosting upside down from the underside of the branch, wrapped in its wings like a
// cloak: it sways a little, its ears twitch and it opens a red eye now and then. For the
// night.
function drawHangingBat(rand) {
  const bat = new Container();
  const [box] = OBSTACLE_HITBOXES.branch;
  const cx = -38 + rand() * 46;
  bat.position.set(cx, box.dy + box.h - 1);
  bat.scale.x = rand() < 0.5 ? 1 : -1;
  const phase = rand() * 6.3;
  // Everything hangs from the feet at (0, 0).
  const swing = new Container();
  bat.addChild(swing);
  const g = new Graphics();
  // Feet gripping the limb, a furry body, and the wings folded round it: a cloak with
  // scalloped edges and a ridge down the middle.
  g.moveTo(-3, 1).lineTo(-3.5, 6).moveTo(3, 1).lineTo(3.5, 6).stroke({ width: 2, color: BAT_DARK, cap: 'round' });
  g.ellipse(0, 14, 7.6, 11).fill(BAT);
  g.poly([-9, 7, -11, 20, -6, 28, -2, 24, 0, 29, 2, 24, 6, 28, 11, 20, 9, 7, 0, 3]).fill(BAT_WING);
  g.moveTo(0, 5).lineTo(0, 26).stroke({ width: 1, color: BAT_DARK, alpha: 0.7 });
  g.moveTo(-5, 9).quadraticCurveTo(-8, 18, -5.5, 25).moveTo(5, 9).quadraticCurveTo(8, 18, 5.5, 25).stroke({ width: 1.2, color: BAT_DARK, alpha: 0.6 });
  // The head at the bottom, ears pointing down.
  g.poly([-6.5, 29, -9, 38, -2.5, 33]).fill(BAT_DARK).poly([6.5, 29, 9, 38, 2.5, 33]).fill(BAT_DARK);
  g.circle(0, 31, 6).fill(BAT);
  g.poly([-1.5, 35, 0, 38.5, 1.5, 35]).fill(BAT_DARK);
  const eyes = new Graphics();
  const ears = new Graphics();
  swing.addChild(g, ears, eyes);
  const animate = (t) => {
    swing.rotation = 0.07 * Math.sin(t * 1.3 + phase);
    // Eyes: shut mostly, opening red for a moment every few seconds.
    const open = (t * 0.22 + phase) % 1 < 0.12;
    eyes.clear();
    if (open) eyes.circle(-2.4, 30.5, 1.5).fill(BAT_EYE).circle(2.4, 30.5, 1.5).fill(BAT_EYE);
    else eyes.moveTo(-3.8, 30.5).lineTo(-1.2, 30.5).moveTo(1.2, 30.5).lineTo(3.8, 30.5).stroke({ width: 0.9, color: BAT_DARK });
    // An ear twitches now and then.
    const twitch = Math.max(0, Math.sin(t * 1.7 + phase * 3)) ** 16;
    ears.clear();
    ears.poly([6.5, 29, 9 + 2 * twitch, 38 - 3 * twitch, 2.5, 33]).fill(BAT);
  };
  return { part: bat, animate };
}

// The colours flowers come in; each flower in a cluster picks its own.
export const FLOWER_COLORS = [0xe8505b, 0xff8fb3, 0xffd23f, 0xb06bd6, 0xf6f3ee, 0xff9a3c, 0x6fa8ff];
const FLOWER_STEM = 0x3f7a2c;
const FLOWER_HEART = 0xffe066;
const FLOWER_HEART_DARK = 0xb8691f;

// A small cluster of three to five flowers growing from the top of the branch, each on a
// stem with a leaf or two and each in a colour of its own: red, pink, yellow, purple,
// white, orange or blue. They sway in the breeze, each out of step with the others.
// Returns the colours too.
function drawFlowers(rand) {
  const flowers = new Container();
  flowers.scale.x = rand() < 0.5 ? 1 : -1;
  const cx = -40 + rand() * 40;
  flowers.position.set(cx, branchTop(cx));
  const count = 3 + Math.floor(rand() * 3);
  const colors = [];
  const stems = [];
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * 10 + (rand() - 0.5) * 4;
    const height = 11 + rand() * 9;
    const color = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)];
    colors.push(color);
    const plant = new Container();
    plant.position.set(x, 1);
    const g = new Graphics();
    // A stem, a leaf or two, and the head: five or six petals round a heart.
    g.moveTo(0, 0).quadraticCurveTo(1.5, -height / 2, 0, -height).stroke({ width: 1.6, color: FLOWER_STEM, cap: 'round' });
    const leafAt = height * (0.3 + rand() * 0.2);
    g.poly(leafPoints(0, -leafAt, -0.6 - rand() * 0.5, 7, 3)).fill(FLOWER_STEM);
    if (rand() < 0.5) g.poly(leafPoints(0, -leafAt * 0.55, Math.PI + 0.6 + rand() * 0.5, 6, 2.6)).fill(LEAF_DARK);
    const petals = 5 + Math.floor(rand() * 2);
    const r = 2.5 + rand() * 1.1;
    const turn = rand() * 6.3;
    for (let p = 0; p < petals; p++) {
      const a = turn + (p / petals) * Math.PI * 2;
      g.circle(Math.cos(a) * r * 1.2, -height + Math.sin(a) * r * 1.2, r * 0.82).fill(color);
    }
    g.circle(0, -height, r * 0.62).fill(color === 0xffd23f ? FLOWER_HEART_DARK : FLOWER_HEART);
    plant.addChild(g);
    flowers.addChild(plant);
    stems.push({ plant, phase: rand() * 6.3, speed: 1.3 + rand() * 0.8 });
  }
  const animate = (t) => {
    for (const s of stems) s.plant.rotation = 0.1 * Math.sin(t * s.speed + s.phase);
  };
  return { part: flowers, animate, colors };
}

const COCONUT = 0x6b4a2b;
const COCONUT_DARK = 0x3f2a15;
const COCONUT_LIGHT = 0x9a7448;

// A bunch of two or three coconuts hanging from the underside of the branch on short
// stems, under a small green frond: brown and hairy, each with the three dark "eyes" at
// the top. They sway a little, each out of step with the others.
function drawCoconuts(rand) {
  const bunch = new Container();
  const [box] = OBSTACLE_HITBOXES.branch;
  const cx = -34 + rand() * 40;
  bunch.position.set(cx, box.dy + box.h - 1);
  bunch.scale.x = rand() < 0.5 ? 1 : -1;
  // The frond the stems spring from, tucked against the limb.
  const frond = new Graphics();
  frond.poly(leafPoints(0, 1, Math.PI * 0.5 + 0.9, 20, 5)).fill(LEAF_DARK);
  frond.poly(leafPoints(0, 1, Math.PI * 0.5 - 0.9, 20, 5)).fill(LEAF);
  frond.poly(leafPoints(0, 1, Math.PI * 0.5 + 0.2, 14, 4)).fill(LEAF);
  bunch.addChild(frond);
  const count = 2 + Math.floor(rand() * 2);
  const nuts = [];
  for (let i = 0; i < count; i++) {
    const side = count === 2 ? (i ? 1 : -1) : i - 1;
    const x = side * 12.5 + (rand() - 0.5) * 2;
    const drop = 8 + rand() * 6 + (side === 0 ? 8 : 0);
    const r = 6.4 + rand() * 1.2;
    const nut = new Container();
    nut.position.set(x * 0.4, 1);
    const g = new Graphics();
    // The stem, then the nut with a few hairs on its outline, a highlight and the eyes.
    g.moveTo(0, 0).lineTo((x - x * 0.4) * 0.5, drop * 0.6).lineTo(x - x * 0.4, drop).stroke({ width: 1.8, color: COCONUT_DARK, cap: 'round' });
    const nx = x - x * 0.4;
    for (let a = rand() * 0.3; a < Math.PI * 2; a += 0.28 + rand() * 0.14) {
      g.moveTo(nx + Math.cos(a) * r * 0.95, drop + r + Math.sin(a) * r * 0.95)
        .lineTo(nx + Math.cos(a) * (r + 1.1), drop + r + Math.sin(a) * (r + 1.1)).stroke({ width: 0.7, color: COCONUT_DARK, alpha: 0.8 });
    }
    g.circle(nx, drop + r, r).fill(COCONUT);
    g.ellipse(nx - r * 0.35, drop + r - r * 0.4, r * 0.28, r * 0.42).fill({ color: COCONUT_LIGHT, alpha: 0.85 });
    for (const [ex, ey] of [[-0.28, 0.18], [0.28, 0.18], [0, 0.5]]) g.circle(nx + ex * r, drop + r * 0.35 + ey * r * 0.5, r * 0.13).fill(COCONUT_DARK);
    nut.addChild(g);
    bunch.addChild(nut);
    nuts.push({ nut, phase: rand() * 6.3, speed: 1.1 + rand() * 0.7 });
  }
  const animate = (t) => {
    for (const n of nuts) n.nut.rotation = 0.09 * Math.sin(t * n.speed + n.phase);
  };
  return { part: bunch, animate, count };
}

const OWL = 0x8a6a48;
const OWL_DARK = 0x5a432c;
const OWL_BELLY = 0xe8d7b5;
const OWL_FACE = 0xf0e2c2;
const OWL_EYE = 0xffcf33;
const OWL_BEAK = 0xe0993a;

// An owl perched on top of the branch, round and brown with ear tufts and a pale
// chevroned belly. Its face turns slowly from side to side, its big yellow eyes close for
// a moment now and then, and it puffs a little as it breathes. For the night.
function drawOwl(rand) {
  const owl = new Container();
  owl.scale.x = rand() < 0.5 ? 1 : -1;
  const cx = -46 + rand() * 50;
  owl.position.set(cx, branchTop(cx));
  const phase = rand() * 6.3;

  const body = new Graphics();
  body.moveTo(-4.5, -1).lineTo(-4.5, 1.5).moveTo(-2, -1).lineTo(-2, 1.5).moveTo(2, -1).lineTo(2, 1.5).moveTo(4.5, -1).lineTo(4.5, 1.5);
  body.stroke({ width: 1.6, color: OWL_BEAK, cap: 'round' });
  body.ellipse(0, -14, 11.5, 14).fill(OWL);
  body.ellipse(0, -12.5, 7.6, 10.8).fill(OWL_BELLY);
  for (const [x, y] of [[-3, -19], [3, -19], [0, -14.5], [-4, -10], [4, -10], [0, -6.5]]) {
    body.moveTo(x - 2, y - 1.4).lineTo(x, y + 0.8).lineTo(x + 2, y - 1.4).stroke({ width: 1, color: OWL, cap: 'round' });
  }
  // Folded wings down the sides, with a few pale flecks.
  body.ellipse(-9.2, -13, 4.2, 10.5).fill(OWL_DARK).ellipse(9.2, -13, 4.2, 10.5).fill(OWL_DARK);
  for (const [x, y] of [[-9.5, -17], [-8.5, -11], [9.5, -17], [8.5, -11]]) body.circle(x, y, 0.9).fill(OWL_BELLY);

  const head = new Container();
  head.position.set(0, -27);
  const skull = new Graphics();
  skull.circle(0, 0, 10.6).fill(OWL);
  skull.poly([-9, -5, -9.5, -15, -3.5, -9]).fill(OWL_DARK).poly([9, -5, 9.5, -15, 3.5, -9]).fill(OWL_DARK);
  const face = new Container();
  const disc = new Graphics();
  disc.circle(-4.6, 0.5, 6.3).fill(OWL_FACE).circle(4.6, 0.5, 6.3).fill(OWL_FACE);
  disc.poly([-1.2, -2.5, 1.2, -2.5, 0, 0.2]).fill(OWL_DARK);
  const eyes = new Graphics();
  const beak = new Graphics();
  beak.poly([-1.8, 1.2, 1.8, 1.2, 0, 5.2]).fill(OWL_BEAK);
  face.addChild(disc, eyes, beak);
  head.addChild(skull, face);
  owl.addChild(body, head);

  const animate = (t) => {
    body.scale.y = 1 + 0.025 * Math.sin(t * 1.5 + phase);
    // The face slides to one side and the other, as if the head were turning.
    const turn = Math.sin(t * 0.55 + phase);
    face.x = 3.4 * turn;
    head.rotation = 0.06 * turn;
    // Big yellow eyes with a pupil that leads the turn; a blink every few seconds.
    const blink = (t * 0.27 + phase) % 1 < 0.04;
    eyes.clear();
    for (const side of [-1, 1]) {
      const x = side * 4.6;
      if (blink) eyes.moveTo(x - 3, 0.5).lineTo(x + 3, 0.5).stroke({ width: 1.2, color: OWL_DARK, cap: 'round' });
      else eyes.circle(x, 0.5, 3.8).fill(OWL_EYE).circle(x + turn * 1.4, 0.5, 1.9).fill(PUPIL);
    }
  };
  return { part: owl, animate };
}

export const DECORATIONS = {
  bird: drawPerchedBird,
  snake: drawPerchedSnake,
  monkey: drawHangingMonkey,
  nest: drawNest,
  panther: drawPanther,
  hangingBat: drawHangingBat,
  owl: drawOwl,
  flowers: drawFlowers,
  coconuts: drawCoconuts,
};

// Adds the decoration the branch carries to `view`; returns its animation.
function addDecoration(view, o) {
  const { part, animate } = DECORATIONS[o.decoration](mulberry32(mixSeed(0xa11a, o.gap)));
  view.addChild(part);
  return animate;
}

// Hitbox: three circles. A dark blob with a few highlights and thorns on its outline.
function drawThornBush(g, o, rand, hangs) {
  const circles = OBSTACLE_HITBOXES.thornBush;
  if (hangs) vine(g, 0, (CANOPY_Y - o.y) / o.scale, -40, 10);
  else {
    g.poly([-5, 20, 5, 20, 8, (FLOOR_Y + 20 - o.y) / o.scale, -8, (FLOOR_Y + 20 - o.y) / o.scale]).fill(SUPPORT_TRUNK);
    g.ellipse(0, 36, 30, 6).fill(SUPPORT_TRUNK);
  }
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
  for (const t of thorns) {
    const nx = Math.cos(t.a);
    const ny = Math.sin(t.a);
    g.poly([t.x - ny * 3.5, t.y + nx * 3.5, t.x + nx * 7, t.y + ny * 7, t.x + ny * 3.5, t.y - nx * 3.5]).fill(THORN);
  }
  for (const c of circles) g.circle(c.dx, c.dy, c.r).fill(BUSH);
  for (const c of circles) g.circle(c.dx - c.r * 0.3, c.dy - c.r * 0.3, c.r * 0.45).fill(BUSH_LIGHT);
}

// Hitbox: one circle. An angular grey polygon close to the circle, on a vine or a ledge.
function drawRock(g, o, rand, hangs) {
  const [{ r }] = OBSTACLE_HITBOXES.rock;
  if (hangs) {
    vine(g, 0, (CANOPY_Y - o.y) / o.scale, -r + 4, 9);
    g.moveTo(-r + 3, -8).quadraticCurveTo(0, 2, r - 3, -8).stroke({ width: 3, color: VINE });
  } else {
    g.poly([-5, r - 4, 5, r - 4, 8, (FLOOR_Y + 20 - o.y) / o.scale, -8, (FLOOR_Y + 20 - o.y) / o.scale]).fill(SUPPORT_TRUNK);
    g.roundRect(-r - 4, r - 6, 2 * r + 8, 10, 4).fill(BARK_DARK);
  }
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
}

// Hitbox: three stacked circles. A teardrop paper nest in gold bands with a dark
// entrance at the bottom, hanging from a vine, or from an arm off a trunk when it is low;
// bees buzz around it (scenery: only the nest is the hitbox). Returns the bees'
// animation.
function drawBeehive(g, o, rand, hangs, view) {
  const circles = OBSTACLE_HITBOXES.beehive;
  const top = circles[0].dy - circles[0].r;
  const bottom = circles[2].dy + circles[2].r;
  if (hangs) {
    vine(g, 0, (CANOPY_Y - o.y) / o.scale, top + 2, 7);
  } else {
    // A trunk beside it with an arm over it, and the nest on a rope from the arm.
    const floor = (FLOOR_Y + 20 - o.y) / o.scale;
    const armY = top - 12;
    g.poly([30, armY - 6, 42, armY - 6, 46, floor, 26, floor]).fill(SUPPORT_TRUNK);
    g.moveTo(34, armY).quadraticCurveTo(14, armY - 8, -4, armY - 1).stroke({ width: 7, color: SUPPORT_TRUNK, cap: 'round' });
    g.moveTo(0, armY).lineTo(0, top + 3).stroke({ width: 2.5, color: VINE, cap: 'round' });
  }
  // The nest.
  const outline = (grow = 0) => {
    const k = 1 + grow;
    g.moveTo(0, top * k)
      .bezierCurveTo(12 * k, top * k, 22 * k, -18 * k, 23 * k, 0)
      .bezierCurveTo(24 * k, 16 * k, 14 * k, bottom * k, 0, bottom * k)
      .bezierCurveTo(-14 * k, bottom * k, -24 * k, 16 * k, -23 * k, 0)
      .bezierCurveTo(-22 * k, -18 * k, -12 * k, top * k, 0, top * k);
  };
  outline();
  g.fill(HIVE).stroke({ width: 2, color: HIVE_EDGE, join: 'round' });
  // Paper bands: arcs across the nest, as wide as the hitbox is at that height.
  const half = (y) => Math.max(...circles.map((c) => Math.sqrt(Math.max(0, c.r ** 2 - (y - c.dy) ** 2))));
  for (const y of [-26, -14, -2, 10, 22, 32]) {
    const w = half(y) - 2;
    g.moveTo(-w, y).quadraticCurveTo(0, y + 7, w, y).stroke({ width: 1.6, color: HIVE_EDGE, alpha: 0.65 });
  }
  g.ellipse(-8, -8, 7, 13).fill({ color: HIVE_LIGHT, alpha: 0.8 });
  g.ellipse(8, 14, 6, 11).fill({ color: HIVE_DARK, alpha: 0.5 });
  g.ellipse(0, bottom - 6, 6.5, 4.5).fill(BEE_STRIPE);

  const bees = new Graphics();
  view.addChild(bees);
  const swarm = Array.from({ length: 5 }, () => ({
    speed: 1.6 + rand() * 1.6,
    phase: rand() * Math.PI * 2,
    rx: 30 + rand() * 12,
    ry: 20 + rand() * 20,
    cy: 2 + rand() * 12,
  }));
  return (t) => {
    bees.clear();
    for (const b of swarm) {
      const a = b.speed * t + b.phase;
      const x = b.rx * Math.cos(a);
      const y = b.cy + b.ry * Math.sin(a * 1.7);
      // A round yellow body with a dark stripe and two wings that beat.
      const beat = 0.5 + 0.5 * Math.sin(t * 60 + b.phase);
      bees.ellipse(x - 2.5, y - 3, 2.6, 1.2 + 1.4 * beat).fill({ color: BEE_WING, alpha: 0.8 });
      bees.ellipse(x + 2.5, y - 3, 2.6, 1.2 + 1.4 * beat).fill({ color: BEE_WING, alpha: 0.8 });
      bees.ellipse(x, y, 4, 3).fill(BEE);
      bees.rect(x - 0.8, y - 3, 1.6, 6).fill(BEE_STRIPE);
    }
  };
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
const TEMPLE_STYLES = [
  { stone: 0xd8ceb0, light: 0xefe8d2, dark: 0xa89d7d, deep: 0x4a4332 },
  { stone: 0xc78a55, light: 0xe2ab78, dark: 0x9a6334, deep: 0x4a2c18 },
  { stone: 0x8c9f89, light: 0xaabda6, dark: 0x667a64, deep: 0x2f3a31 },
  { stone: 0x676a77, light: 0x888b99, dark: 0x484a56, deep: 0x1d1e25 },
];
const GOLD = 0xdcab3e;
const MOSS = 0x4f8a3a;
const MOSS_LIGHT = 0x73ad4c;
const FLAME = 0xff9a2e;
const FLAME_CORE = 0xffe27a;
const HAZE = 0x21472f;

function drawTemple(g, o, rand, hangs, view) {
  const style = TEMPLE_STYLES[o.variant ?? 0];
  const [shrine, tierA, tierB, tierC, base] = OBSTACLE_HITBOXES.temple;
  const floor = (FLOOR_Y + 20 - o.y) / o.scale;

  // The tiers, from the base up: stone with a lit top edge, a shadow under it and courses
  // of blocks (joints staggered course by course).
  for (const r of [base, tierC, tierB, tierA]) {
    const bottom = r === base ? floor : r.dy + r.h;
    g.rect(r.dx, r.dy, r.w, bottom - r.dy).fill(style.stone);
    g.rect(r.dx, r.dy, r.w, 6).fill(style.light);
    g.rect(r.dx, r.dy + 6, r.w, 4).fill({ color: style.dark, alpha: 0.5 });
    const course = 23;
    for (let y = r.dy + course, row = 0; y < bottom; y += course, row++) {
      g.moveTo(r.dx, y).lineTo(r.dx + r.w, y).stroke({ width: 1.2, color: style.dark, alpha: 0.45 });
      for (let x = r.dx + (row % 2 ? 17 : 0) + 34; x < r.dx + r.w; x += 34) {
        g.moveTo(x, y - course).lineTo(x, y).stroke({ width: 1.2, color: style.dark, alpha: 0.3 });
      }
    }
  }
  // The base is a platform of mouldings and recessed panels, a row each side of the stairs.
  const half = -base.dx;
  for (let y = base.dy + 40; y < floor - 20; y += 92) {
    g.rect(base.dx, y, base.w, 7).fill(style.light).rect(base.dx, y + 7, base.w, 4).fill({ color: style.dark, alpha: 0.6 });
    for (const side of [-1, 1]) {
      const x = side < 0 ? base.dx + 18 : 44;
      const w = half - 18 - 44;
      g.rect(x, y + 26, w, 52).fill({ color: style.dark, alpha: 0.28 });
      g.rect(x, y + 26, w, 3).fill({ color: style.dark, alpha: 0.5 }).rect(x, y + 75, w, 3).fill({ color: style.light, alpha: 0.35 });
    }
  }
  // The staircase up the middle, with a low wall each side: wide enough for the monkey, its
  // steps about a quarter of its height.
  const stairs = { x: -30, y: tierA.dy, w: 60 };
  g.rect(stairs.x - 8, stairs.y, 8, floor - stairs.y).fill(style.dark);
  g.rect(stairs.x + stairs.w, stairs.y, 8, floor - stairs.y).fill(style.dark);
  g.rect(stairs.x, stairs.y, stairs.w, floor - stairs.y).fill(style.dark);
  for (let y = stairs.y; y < floor; y += 12) g.rect(stairs.x, y, stairs.w, 7).fill(style.light);

  // The shrine: the walls, a corbelled doorway taller than the monkey and a dark roof slab.
  g.rect(shrine.dx, shrine.dy, shrine.w, shrine.h).fill(style.stone);
  g.rect(shrine.dx - 4, shrine.dy, shrine.w + 8, 9).fill(style.dark);
  g.rect(shrine.dx - 4, shrine.dy, shrine.w + 8, 3).fill(style.light);
  const comb = o.variant === 1;
  const doorTop = comb ? 26 : 18;
  g.poly([-22, shrine.h, -22, doorTop + 10, -17, doorTop + 10, -17, doorTop + 5, -11, doorTop + 5, -11, doorTop, 11, doorTop, 11, doorTop + 5, 17, doorTop + 5, 17, doorTop + 10, 22, doorTop + 10, 22, shrine.h]).fill(style.deep);
  g.rect(-26, doorTop - 4, 52, 4).fill(style.light);
  g.rect(shrine.dx, shrine.dy + shrine.h - 5, shrine.w, 5).fill(style.dark);

  let animate = null;
  if (o.variant === 0) {
    // A stepped fret, a row of little squares, across the top of the shrine.
    for (let x = shrine.dx + 7; x < shrine.dx + shrine.w - 9; x += 14) g.rect(x, 12, 8, 6).fill(style.dark).rect(x + 2, 14, 4, 2).fill(style.stone);
  } else if (comb) {
    // A tall roof comb: a wall over the shrine, with three square windows.
    g.rect(-32, shrine.dy, 64, 18).fill(style.dark);
    g.rect(-32, shrine.dy, 64, 4).fill(style.light);
    for (const x of [-22, -6, 10]) g.rect(x, 7, 12, 9).fill(style.deep);
  } else if (o.variant === 2) {
    // Serpent heads on the stair walls, looking out, and moss and ferns on the tiers.
    for (const side of [-1, 1]) {
      const x = side * (stairs.w / 2 + 4);
      g.ellipse(x, tierA.dy - 2, 11, 8.5).fill(style.stone).stroke({ width: 1.5, color: style.dark });
      g.circle(x + side * 3, tierA.dy - 4.5, 2.4).fill(0xffe27a).circle(x + side * 3, tierA.dy - 4.5, 1).fill(style.deep);
      g.poly([x + side * 9, tierA.dy + 1, x + side * 15, tierA.dy + 6, x + side * 7, tierA.dy + 5]).fill(0xf1ead8);
    }
    for (const r of [tierA, tierB, tierC]) {
      g.poly(leafPoints(r.dx + 10, r.dy + 5, -1.1, 22, 7)).fill(MOSS).poly(leafPoints(r.dx + r.w - 10, r.dy + 5, -2.0, 22, 7)).fill(MOSS_LIGHT);
    }
  } else {
    // Gold inlay: a band across the middle tier and a frame round the doorway, and a
    // brazier on each end of the first tier, its flame flickering.
    g.rect(tierB.dx, tierB.dy + 16, tierB.w, 6).fill(GOLD);
    for (let x = tierB.dx + 10; x < tierB.dx + tierB.w - 10; x += 22) g.rect(x, tierB.dy + 26, 10, 5).fill(GOLD);
    g.rect(-26, doorTop - 4, 52, 3).fill(GOLD).rect(-24, doorTop - 1, 3, shrine.h - doorTop - 1).fill(GOLD).rect(21, doorTop - 1, 3, shrine.h - doorTop - 1).fill(GOLD);
    const spots = [-66, 66];
    for (const x of spots) {
      g.poly([x - 11, tierA.dy, x - 7, tierA.dy - 12, x + 7, tierA.dy - 12, x + 11, tierA.dy]).fill(style.deep).rect(x - 13, tierA.dy - 16, 26, 5).fill(GOLD);
    }
    const flames = new Graphics();
    view.addChild(flames);
    const phase = rand() * 6.3;
    animate = (t) => {
      flames.clear();
      spots.forEach((x, i) => {
        const k = 0.5 + 0.5 * Math.sin(t * 9 + phase + i * 2.1);
        const sway = 3 * Math.sin(t * 6 + phase + i);
        const top = tierA.dy - 16 - 20 - 9 * k;
        flames.poly([x - 8, tierA.dy - 16, x - 5 + sway * 0.3, top + 13, x + sway, top, x + 5 + sway * 0.3, top + 13, x + 8, tierA.dy - 16]).fill(FLAME);
        flames.poly([x - 4, tierA.dy - 16, x + sway * 0.5, top + 12, x + 4, tierA.dy - 16]).fill(FLAME_CORE);
      });
    };
  }

  // Overgrowth, on every look: moss along the tiers, vines hanging from their edges, ferns
  // on the corners.
  for (const r of [tierA, tierB, tierC]) {
    for (let i = 0; i < 3; i++) {
      const x = r.dx + 14 + rand() * (r.w - 28);
      if (Math.abs(x) < stairs.w / 2 + 12) continue;
      g.ellipse(x, r.dy + 5, 10 + rand() * 12, 4.5).fill({ color: i % 2 ? MOSS : MOSS_LIGHT, alpha: o.variant === 2 ? 1 : 0.8 });
      if (rand() < 0.7) g.moveTo(x, r.dy + 8).quadraticCurveTo(x + (rand() - 0.5) * 8, r.dy + 22, x + (rand() - 0.5) * 6, r.dy + 28 + rand() * 14).stroke({ width: 2, color: MOSS });
    }
    g.poly(leafPoints(r.dx + 4, r.dy + 6, -0.9, 26, 8)).fill(LEAF_DARK).poly(leafPoints(r.dx + r.w - 4, r.dy + 6, -2.2, 26, 8)).fill(LEAF);
  }

  // The rest is buried: a haze rising from the ground, thickest at the bottom, and a thick
  // fringe of ferns and leaves across the foot of the temple, wider than the temple itself,
  // as if it carried on down into the jungle.
  const hazeTop = floor - 250;
  for (let i = 0; i < 10; i++) {
    const y = hazeTop + (i * (floor + 30 - hazeTop)) / 10;
    g.rect(-330, y, 660, (floor + 30 - hazeTop) / 10 + 1).fill({ color: HAZE, alpha: 0.06 + 0.07 * i });
  }
  for (let x = -300; x <= 300; x += 15 + rand() * 9) {
    const length = 45 + rand() * 40;
    for (const a of [-Math.PI / 2 - 0.45 - rand() * 0.3, -Math.PI / 2 + 0.45 + rand() * 0.3]) {
      g.poly(leafPoints(x, floor + 14, a, length, 11 + rand() * 6)).fill(rand() < 0.5 ? LEAF_DARK : BUSH);
    }
    g.poly(leafPoints(x + 6, floor + 14, -Math.PI / 2 + (rand() - 0.5) * 0.5, length * 0.8, 10)).fill(rand() < 0.5 ? LEAF : BUSH_LIGHT);
  }
  return animate;
}

const DRAW = { branch: drawBranch, thornBush: drawThornBush, rock: drawRock, beehive: drawBeehive, temple: drawTemple };

// Moving obstacles: a body that follows the obstacle, with parts animated from its
// time, plus scenery that stays put (the snake's vine) or stretches (the spider's
// thread). Each body fits its hitbox circle.
const SPIDER = 0x2a1f2e;
const SPIDER_LEG = 0x1a1320;
const SPIDER_MARK = 0xc0392b;
const THREAD = 0xd9e4dc;
const SNAKE = 0x6f9b2e;
const SNAKE_DARK = 0x46701c;
const SNAKE_BELLY = 0xd8c35a;
const TONGUE = 0xd2323c;
const STALK = 0x3f6b24;
const BIRD = 0xd64541;
const BIRD_DARK = 0xa3322f;
const BIRD_BELLY = 0xf2c14e;
const BEAK = 0xf39c12;
const BLUE = 0x3f86d6;
const BLUE_DARK = 0x2a5fa3;
const BLUE_BELLY = 0xd6e9ff;
const PURPLE = 0x8e4fc4;
const PURPLE_DARK = 0x5e2f8f;
const PURPLE_BELLY = 0xe9d8f7;
const BAT = 0x4a3a5c;
const BAT_DARK = 0x2a2036;
const BAT_WING = 0x5d4a75;
const BAT_EYE = 0xff5a4a;
const EYE = 0xffffff;
const PUPIL = 0x111111;

// Hitbox: circle r 18. Abdomen and head; the legs are redrawn as they wriggle.
function buildSpider(o) {
  const thread = new Graphics();
  const body = new Container();
  const legs = new Graphics();
  const g = new Graphics();
  g.circle(0, 5, 13).fill(SPIDER).circle(0, -9, 8).fill(SPIDER);
  g.poly([0, -2, 4, 5, 0, 12, -4, 5]).fill(SPIDER_MARK);
  for (const [x, y] of [[-3, -12], [3, -12], [-5, -8], [5, -8]]) g.circle(x, y, 1.6).fill(EYE);
  body.addChild(legs, g);
  const animate = (t) => {
    thread.clear().moveTo(o.x, CANOPY_Y - 40).lineTo(o.x, o.y - 14 * o.scale).stroke({ width: 1.5, color: THREAD, alpha: 0.8 });
    legs.clear();
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const a = -0.9 + i * 0.55 + 0.12 * Math.sin(t * 9 + i * 1.7 + side);
        const kx = side * (9 + 9 * Math.cos(a));
        const ky = -4 + 12 * Math.sin(a) - 6;
        legs.moveTo(side * 5, -3 + i * 3).lineTo(kx, ky).lineTo(kx + side * 6, ky + 12);
      }
    }
    legs.stroke({ width: 2.5, color: SPIDER_LEG, cap: 'round', join: 'round' });
  };
  return { parts: [thread, body], body, animate };
}

// Hitbox: circle r 18. Coils around a stalk standing from the floor; the head points
// the way it is climbing.
function buildSnake(o) {
  const top = o.baseY - o.motion.ay - 40;
  const stalk = new Graphics();
  const bottom = FLOOR_Y + 20;
  stalk.moveTo(o.baseX, bottom).bezierCurveTo(o.baseX - 6, bottom - 120, o.baseX + 6, top + 80, o.baseX, top).stroke({ width: 7, color: STALK, cap: 'round' });
  for (let y = top + 30; y < bottom - 20; y += 46) {
    const side = Math.round(y / 46) % 2 ? 1 : -1;
    stalk.poly(leafPoints(o.baseX, y, side > 0 ? -0.5 : Math.PI + 0.5, 16, 8)).fill(side > 0 ? LEAF : LEAF_DARK);
  }
  const body = new Container();
  const coil = new Graphics();
  for (let i = 0; i < 3; i++) {
    const y = -8 + i * 9;
    coil.moveTo(-15, y).quadraticCurveTo(0, y + 7, 15, y + 2).stroke({ width: 9, color: i % 2 ? SNAKE_DARK : SNAKE, cap: 'round' });
  }
  coil.moveTo(-13, 17).quadraticCurveTo(0, 22, 12, 16).stroke({ width: 3, color: SNAKE_BELLY, cap: 'round' });
  const head = new Graphics();
  head.moveTo(-15, -8).quadraticCurveTo(-8, -18, 0, -18).stroke({ width: 8, color: SNAKE, cap: 'round' });
  head.ellipse(4, -19, 9, 6.5).fill(SNAKE);
  head.circle(7, -21, 1.8).fill(PUPIL);
  head.moveTo(12, -19).lineTo(18, -19).lineTo(21, -22).moveTo(18, -19).lineTo(21, -16).stroke({ width: 1.2, color: TONGUE });
  body.addChild(coil, head);
  const animate = (t) => {
    const u = (2 * Math.PI * t) / o.motion.period + o.motion.phase;
    // y = baseY + ay·cos u: climbing while sin u > 0.
    head.scale.y = Math.sin(u) >= 0 ? 1 : -1;
  };
  return { parts: [stalk, body], body, animate };
}

// Hitbox: circle r 16. Flaps as it flies and faces the way it patrols.
function buildBird(o) {
  const body = new Container();
  const g = new Graphics();
  g.poly([-12, -2, -22, -8, -21, 2, -12, 4]).fill(BIRD_DARK);
  g.ellipse(-1, 0, 13, 10).fill(BIRD);
  g.ellipse(1, 4, 9, 5).fill(BIRD_BELLY);
  g.circle(9, -5, 7).fill(BIRD);
  g.poly([14, -7, 22, -4, 14, -2]).fill(BEAK);
  g.circle(10, -7, 2.4).fill(EYE).circle(10.8, -7, 1.2).fill(PUPIL);
  const wing = new Graphics();
  body.addChild(g, wing);
  const animate = (t) => {
    body.scale.set(o.vxAt(t) >= 0 ? o.scale : -o.scale, o.scale);
    const lift = Math.sin(t * 16);
    wing.clear().poly([-8, -3, 4, -3, -2 - 6 * lift, -3 - 14 * lift]).fill(BIRD_DARK);
  };
  return { parts: [body], body, animate };
}

// Hitbox: circle r 16. A blue bird with a pale belly and a small crest. It flies up and
// down with its nose pitched along the climb or the dive, and faces left or right by
// gap, flapping as it goes.
function buildBlueBird(o) {
  const facing = o.gap % 2 === 0 ? 1 : -1;
  const body = new Container();
  const g = new Graphics();
  g.poly([-12, -1, -23, -7, -22, 3, -12, 4]).fill(BLUE_DARK);
  g.ellipse(-1, 0, 13, 10).fill(BLUE);
  g.ellipse(1, 4, 9, 5).fill(BLUE_BELLY);
  g.circle(9, -5, 7).fill(BLUE);
  g.poly([5, -11, 4, -18, 9, -12]).fill(BLUE_DARK);
  g.poly([14, -7, 22, -4, 14, -2]).fill(BEAK);
  g.circle(10, -7, 2.4).fill(EYE).circle(10.8, -7, 1.2).fill(PUPIL);
  const wing = new Graphics();
  body.addChild(g, wing);
  const animate = (t) => {
    body.scale.set(facing * o.scale, o.scale);
    // Nose up while climbing (y decreasing), down while diving.
    body.rotation = facing * Math.max(-0.6, Math.min(0.6, o.vyAt(t) / 320));
    const lift = Math.sin(t * 13);
    wing.clear().poly([-8, -3, 5, -3, -2 - 7 * lift, -3 - 16 * lift]).fill(BLUE_DARK);
  };
  return { parts: [body], body, animate };
}

// Hitbox: circle r 16. A purple bird with a pale belly and a tail feather, flying in
// circles. It faces the way it is flying and tilts its nose along the circle.
function buildPurpleBird(o) {
  const body = new Container();
  const g = new Graphics();
  g.poly([-12, -2, -24, -9, -22, 0, -24, 5, -12, 4]).fill(PURPLE_DARK);
  g.ellipse(-1, 0, 13, 10).fill(PURPLE);
  g.ellipse(1, 4, 9, 5).fill(PURPLE_BELLY);
  g.circle(9, -5, 7).fill(PURPLE);
  g.poly([6, -11, 5, -17, 10, -12]).fill(PURPLE_DARK);
  g.poly([14, -7, 22, -4, 14, -2]).fill(BEAK);
  g.circle(10, -7, 2.4).fill(EYE).circle(10.8, -7, 1.2).fill(PUPIL);
  const wing = new Graphics();
  body.addChild(g, wing);
  const animate = (t) => {
    const facing = o.vxAt(t) >= 0 ? 1 : -1;
    body.scale.set(facing * o.scale, o.scale);
    body.rotation = facing * Math.max(-0.5, Math.min(0.5, o.vyAt(t) / 400));
    const lift = Math.sin(t * 14);
    wing.clear().poly([-8, -3, 5, -3, -2 - 7 * lift, -3 - 15 * lift]).fill(PURPLE_DARK);
  };
  return { parts: [body], body, animate };
}

// Hitbox: circle r 16. A bat: a furry body with pointed ears and red eyes, and a
// membrane wing that flutters fast. It faces the way it patrols, like the bird.
function buildBat(o) {
  const body = new Container();
  const g = new Graphics();
  g.ellipse(-2, 1, 10, 7.5).fill(BAT);
  g.circle(9, -2, 6).fill(BAT);
  g.poly([5, -6, 6, -14, 10, -7]).fill(BAT_DARK).poly([9, -6, 12, -13, 14, -4]).fill(BAT_DARK);
  g.poly([14, -1, 19, 1, 14, 3]).fill(BAT_DARK);
  g.circle(11, -3, 1.8).fill(BAT_EYE);
  g.poly([-11, 1, -18, 5, -12, 5]).fill(BAT_DARK);
  const wing = new Graphics();
  body.addChild(wing, g);
  const animate = (t) => {
    body.scale.set(o.vxAt(t) >= 0 ? o.scale : -o.scale, o.scale);
    // One wing seen from the side: an arm out to a tip, and a scalloped membrane from
    // the tip back to the body.
    const lift = Math.sin(t * 22);
    const root = [-3, 4];
    const tip = [-23 - 3 * Math.abs(lift), -5 - 22 * lift];
    const elbow = [-7, -4 - 11 * lift];
    const along = (f, dx, dy) => [tip[0] + (root[0] - tip[0]) * f + dx, tip[1] + (root[1] - tip[1]) * f + dy];
    const edge = [along(0.22, 3, 1), along(0.4, -1, 7), along(0.58, 3, 4), along(0.78, -1, 6)];
    wing
      .clear()
      .poly([0, -3, ...elbow, ...tip, ...edge.flat(), ...root])
      .fill(BAT_WING)
      .poly([0, -3, ...elbow, ...tip])
      .stroke({ width: 2.4, color: BAT_DARK, cap: 'round', join: 'round' });
    for (const e of [edge[1], edge[3]]) wing.moveTo(0, -3).lineTo(e[0], e[1]).stroke({ width: 1, color: BAT_DARK, alpha: 0.7 });
  };
  return { parts: [body], body, animate };
}

const BUILD_MOVING = { spider: buildSpider, snake: buildSnake, bird: buildBird, bat: buildBat, blueBird: buildBlueBird, purpleBird: buildPurpleBird };

// A view: `view` to add to the layer, and `update()` each frame.
function buildObstacle(o) {
  if (o.moving) {
    const { parts, body, animate } = BUILD_MOVING[o.type](o);
    const view = new Container();
    view.addChild(...parts);
    body.scale.set(o.scale);
    const update = () => {
      body.position.set(o.x, o.y);
      animate(o.time);
    };
    update();
    return { view, update };
  }
  // The art is drawn at scale 1 (supports reaching the canopy or floor are divided by
  // the scale), then scaled with the hitbox. A drawing may return an animation: a
  // function of the world time for the parts it added to `view`.
  const view = new Container();
  const g = new Graphics();
  view.addChild(g);
  const animate = DRAW[o.type](g, o, mulberry32(mixSeed(0x0b57, o.gap)), o.y < HANGS_ABOVE_Y, view);
  view.position.set(o.x, o.y);
  view.scale.set(o.scale);
  if (!animate) return { view, update: null };
  animate(0);
  return { view, update: (time) => animate(time) };
}

export class ObstacleViews {
  constructor() {
    this.view = new Container();
    this.views = new Map();
  }

  // `time` is the world time (s), for the scenery that moves on its own (the bees).
  update(obstacles, time = 0) {
    const seen = new Set();
    for (const o of obstacles) {
      if (!o) continue;
      seen.add(o);
      let entry = this.views.get(o);
      if (!entry) {
        entry = buildObstacle(o);
        this.views.set(o, entry);
        this.view.addChild(entry.view);
      }
      entry.update?.(time);
    }
    for (const [o, entry] of this.views) {
      if (seen.has(o)) continue;
      entry.view.destroy({ children: true });
      this.views.delete(o);
    }
  }
}
