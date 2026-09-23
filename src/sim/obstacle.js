import { OBSTACLE_HITBOXES } from '../config.js';
import { circleIntersectsCircle, circleIntersectsRect, pointSectorDistance } from './physics.js';

// Rect edges are sampled this finely when measuring distance to a sector.
const RECT_SAMPLES = 64;

export const ObstacleType = Object.freeze({
  BRANCH: 'branch',
  THORN_BUSH: 'thornBush',
  ROCK: 'rock',
});

export const OBSTACLE_TYPES = Object.values(ObstacleType);

// A static obstacle centred at (x, y) in gap `gap` (between lianas gap and gap + 1).
export class Obstacle {
  constructor(gap, type, x, y) {
    this.gap = gap;
    this.type = type;
    this.x = x;
    this.y = y;
    this.hitbox = OBSTACLE_HITBOXES[type];
  }

  // Distance between the hitbox and a sector hanging from (ox, oy); see pointSectorDistance.
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
    return this.hitbox.some((s) =>
      s.kind === 'rect'
        ? circleIntersectsRect(cx, cy, radius, this.x + s.dx, this.y + s.dy, s.w, s.h)
        : circleIntersectsCircle(cx, cy, radius, this.x + s.dx, this.y + s.dy, s.r),
    );
  }
}
