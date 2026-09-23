import { OBSTACLE_HITBOXES } from '../config.js';
import { circleIntersectsCircle, circleIntersectsRect } from './physics.js';

export const ObstacleType = Object.freeze({
  BRANCH: 'branch',
  THORN_BUSH: 'thornBush',
  ROCK: 'rock',
});

export const OBSTACLE_TYPES = Object.values(ObstacleType);

function shapeRight(shape) {
  return shape.kind === 'rect' ? shape.dx + shape.w : shape.dx + shape.r;
}

// A static obstacle centred at (x, y) in gap `gap` (between lianas gap and gap + 1).
export class Obstacle {
  constructor(gap, type, x, y) {
    this.gap = gap;
    this.type = type;
    this.x = x;
    this.y = y;
    this.hitbox = OBSTACLE_HITBOXES[type];
    // Scoring line: the monkey scores when its x passes this.
    this.right = x + Math.max(...this.hitbox.map(shapeRight));
  }

  hitsCircle(cx, cy, radius) {
    return this.hitbox.some((s) =>
      s.kind === 'rect'
        ? circleIntersectsRect(cx, cy, radius, this.x + s.dx, this.y + s.dy, s.w, s.h)
        : circleIntersectsCircle(cx, cy, radius, this.x + s.dx, this.y + s.dy, s.r),
    );
  }
}
