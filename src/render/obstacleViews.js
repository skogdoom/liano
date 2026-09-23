import { Container, Graphics } from 'pixi.js';
import { OBSTACLE_HITBOXES } from '../config.js';
import { mixSeed, mulberry32 } from '../sim/rng.js';
import { FLOOR_Y } from './background.js';
import { leafPoints } from './shapes.js';

// Obstacle art, built once per obstacle from its hitbox shapes so the two match.
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
  const bottom = FLOOR_Y + 20 - o.y;
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
    vine(g, left + 30, CANOPY_Y - o.y, top + 2, 8);
    vine(g, right - 45, CANOPY_Y - o.y, top + 4, -8);
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
  if (hangs) vine(g, 0, CANOPY_Y - o.y, -40, 10);
  else {
    g.poly([-5, 20, 5, 20, 8, FLOOR_Y + 20 - o.y, -8, FLOOR_Y + 20 - o.y]).fill(SUPPORT_TRUNK);
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
    vine(g, 0, CANOPY_Y - o.y, -r + 4, 9);
    g.moveTo(-r + 3, -8).quadraticCurveTo(0, 2, r - 3, -8).stroke({ width: 3, color: VINE });
  } else {
    g.poly([-5, r - 4, 5, r - 4, 8, FLOOR_Y + 20 - o.y, -8, FLOOR_Y + 20 - o.y]).fill(SUPPORT_TRUNK);
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

function buildObstacle(o) {
  const g = new Graphics();
  DRAW[o.type](g, o, mulberry32(mixSeed(0x0b57, o.gap)), o.y < HANGS_ABOVE_Y);
  g.position.set(o.x, o.y);
  return g;
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
      if (!this.views.has(o)) {
        const view = buildObstacle(o);
        this.views.set(o, view);
        this.view.addChild(view);
      }
    }
    for (const [o, view] of this.views) {
      if (seen.has(o)) continue;
      view.destroy();
      this.views.delete(o);
    }
  }
}
