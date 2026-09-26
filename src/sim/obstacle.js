import { LIANA_SPACING, OBSTACLE_HITBOXES } from '../config.js';
import { circleIntersectsCircle, circleIntersectsRect, pointSectorDistance } from './physics.js';

// Rect edges are sampled this finely when measuring distance to a sector.
const RECT_SAMPLES = 64;

export const ObstacleType = Object.freeze({
  BRANCH: 'branch',
  THORN_BUSH: 'thornBush',
  ROCK: 'rock',
  SPIDER: 'spider',
  SNAKE: 'snake',
  BIRD: 'bird',
});

export const STATIC_TYPES = [ObstacleType.BRANCH, ObstacleType.THORN_BUSH, ObstacleType.ROCK];
export const MOVING_TYPES = [ObstacleType.SPIDER, ObstacleType.SNAKE, ObstacleType.BIRD];

// An obstacle in gap `gap` (between lianas gap and gap + 1), centred at (x, y).
//
// A moving one has a `motion` { period (s), phase (rad), ax, ay, bob }: at world time t,
// with u = 2π·t / period + phase, it is at
//   (x, y) = (baseX + ax·sin u, baseY + ay·cos u + bob·sin 2u).
// Spiders and snakes move vertically (ax = 0), birds patrol horizontally with a bob.
// The world sets the time every step (setTime); the solver asks positionAt(t).
export class Obstacle {
  constructor(gap, type, x, y, motion = null) {
    this.gap = gap;
    this.type = type;
    this.baseX = x;
    this.baseY = y;
    this.x = x;
    this.y = y;
    this.motion = motion;
    this.time = 0;
    this.hitbox = OBSTACLE_HITBOXES[type];
    if (motion) this.setTime(0);
  }

  // Plain data for passing between threads; fromData rebuilds the obstacle.
  toData() {
    return { gap: this.gap, type: this.type, x: this.baseX, y: this.baseY, motion: this.motion };
  }

  static fromData(d) {
    return d && new Obstacle(d.gap, d.type, d.x, d.y, d.motion);
  }

  // The same obstacle moved to gap `gap` (the solver works in gap 0).
  inGap(gap) {
    return new Obstacle(gap, this.type, this.baseX + (gap - this.gap) * LIANA_SPACING, this.baseY, this.motion);
  }

  get moving() {
    return this.motion !== null;
  }

  positionAt(t) {
    const m = this.motion;
    if (!m) return { x: this.baseX, y: this.baseY };
    const u = (2 * Math.PI * t) / m.period + m.phase;
    return { x: this.baseX + m.ax * Math.sin(u), y: this.baseY + m.ay * Math.cos(u) + m.bob * Math.sin(2 * u) };
  }

  // Horizontal velocity at time t (px/s), for facing the way a bird flies.
  vxAt(t) {
    const m = this.motion;
    if (!m) return 0;
    const w = (2 * Math.PI) / m.period;
    return m.ax * w * Math.cos(w * t + m.phase);
  }

  setTime(t) {
    this.time = t;
    const p = this.positionAt(t);
    this.x = p.x;
    this.y = p.y;
  }

  // Positions over one period, `samples` of them evenly spaced in phase (a multiple of 4
  // includes the turning points).
  pathPoints(samples = 180) {
    const points = [];
    const period = this.motion ? this.motion.period : 1;
    for (let i = 0; i < (this.motion ? samples : 1); i++) points.push(this.positionAt((i / samples) * period - this.phaseTime));
    return points;
  }

  // The time at which u = 0.
  get phaseTime() {
    return this.motion ? (this.motion.phase / (2 * Math.PI)) * this.motion.period : 0;
  }

  // The rectangle the hitbox covers over its whole motion.
  get bounds() {
    const m = this.motion ?? { ax: 0, ay: 0, bob: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of this.hitbox) {
      const [w, h] = s.kind === 'rect' ? [s.w, s.h] : [0, 0];
      const r = s.kind === 'rect' ? 0 : s.r;
      minX = Math.min(minX, this.baseX + s.dx - r - m.ax);
      maxX = Math.max(maxX, this.baseX + s.dx + w + r + m.ax);
      minY = Math.min(minY, this.baseY + s.dy - r - m.ay - m.bob);
      maxY = Math.max(maxY, this.baseY + s.dy + h + r + m.ay + m.bob);
    }
    return { minX, minY, maxX, maxY };
  }

  // Distance between the hitbox (where it is now) and a sector hanging from (ox, oy);
  // see pointSectorDistance.
  distanceToSector(ox, oy, radius, halfAngle) {
    let min = Infinity;
    for (const s of this.hitbox) {
      const x = this.x + s.dx;
      const y = this.y + s.dy;
      if (s.kind === 'circle') {
        min = Math.min(min, pointSectorDistance(x, y, ox, oy, radius, halfAngle) - s.r);
        continue;
      }
      for (let i = 0; i <= RECT_SAMPLES; i++) {
        const u = i / RECT_SAMPLES;
        for (const [px, py] of [[x + u * s.w, y], [x + u * s.w, y + s.h], [x, y + u * s.h], [x + s.w, y + u * s.h]]) {
          min = Math.min(min, pointSectorDistance(px, py, ox, oy, radius, halfAngle));
        }
      }
    }
    return min;
  }

  hitsCircle(cx, cy, radius) {
    return this.#hitsCircleAt(this.x, this.y, cx, cy, radius);
  }

  // Whether the hitbox, where it is at time t, touches the circle.
  hitsCircleAt(t, cx, cy, radius) {
    const p = this.positionAt(t);
    return this.#hitsCircleAt(p.x, p.y, cx, cy, radius);
  }

  #hitsCircleAt(x, y, cx, cy, radius) {
    return this.hitbox.some((s) =>
      s.kind === 'rect'
        ? circleIntersectsRect(cx, cy, radius, x + s.dx, y + s.dy, s.w, s.h)
        : circleIntersectsCircle(cx, cy, radius, x + s.dx, y + s.dy, s.r),
    );
  }
}
