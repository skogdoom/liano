import { BANANA_RADIUS } from '../config.js';
import { circleIntersectsCircle } from './physics.js';

// A banana at (x, y) in gap `gap`. It stays put (the bob is only drawn).
export class Banana {
  constructor(gap, x, y) {
    this.gap = gap;
    this.x = x;
    this.y = y;
  }

  touches(cx, cy, radius) {
    return circleIntersectsCircle(cx, cy, radius, this.x, this.y, BANANA_RADIUS);
  }

  toData() {
    return { gap: this.gap, x: this.x, y: this.y };
  }

  static fromData(d) {
    return d && new Banana(d.gap, d.x, d.y);
  }
}
