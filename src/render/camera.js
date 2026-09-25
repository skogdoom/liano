import { CAMERA_TARGET_X, CAMERA_LERP } from '../config.js';

// Horizontal-only camera. `x` is the world x at the left edge of the screen.
// It eases towards keeping the target at `screenX` on screen (set by the layout).
export class Camera {
  constructor(targetX = 0, screenX = CAMERA_TARGET_X) {
    this.screenX = screenX;
    this.reset(targetX);
  }

  reset(targetX) {
    this.x = targetX - this.screenX;
  }

  update(targetX, dt) {
    const desired = targetX - this.screenX;
    this.x += (desired - this.x) * (1 - Math.exp(-CAMERA_LERP * dt));
  }
}

// What the camera follows: the monkey, or in portrait (`follow` 'anchor') the anchor of
// the liana it hangs on, so the view holds still through each swing.
export function cameraTarget(monkey, follow) {
  return follow === 'anchor' && monkey.liana ? monkey.liana.x : monkey.x;
}
