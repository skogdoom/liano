import { CAMERA_TARGET_X, CAMERA_LERP } from '../config.js';

// Horizontal-only camera. `x` is the world x at the left edge of the screen.
// It eases towards keeping the target at CAMERA_TARGET_X on screen.
export class Camera {
  constructor(targetX = 0) {
    this.reset(targetX);
  }

  reset(targetX) {
    this.x = targetX - CAMERA_TARGET_X;
  }

  update(targetX, dt) {
    const desired = targetX - CAMERA_TARGET_X;
    this.x += (desired - this.x) * (1 - Math.exp(-CAMERA_LERP * dt));
  }
}
