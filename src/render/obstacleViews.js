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
// with a leaf tuft near the tip.
function drawBranch(g, o, rand, hangs) {
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

const DRAW = { branch: drawBranch, thornBush: drawThornBush, rock: drawRock };

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

const BUILD_MOVING = { spider: buildSpider, snake: buildSnake, bird: buildBird };

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
  const g = new Graphics();
  DRAW[o.type](g, o, mulberry32(mixSeed(0x0b57, o.gap)), o.y < HANGS_ABOVE_Y);
  g.position.set(o.x, o.y);
  // The art is drawn at scale 1 (supports reaching the canopy or floor are divided by
  // the scale), then scaled with the hitbox.
  g.scale.set(o.scale);
  return { view: g, update: null };
}

export class ObstacleViews {
  constructor() {
    this.view = new Container();
    this.views = new Map();
  }

  update(obstacles) {
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
      entry.update?.();
    }
    for (const [o, entry] of this.views) {
      if (seen.has(o)) continue;
      entry.view.destroy({ children: true });
      this.views.delete(o);
    }
  }
}
