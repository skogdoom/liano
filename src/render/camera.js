import { CAMERA_TARGET_X, CAMERA_LERP, CAMERA_EASE } from '../config.js';

// Horizontal-only camera. `x` is the world x at the left edge of the screen.
// It eases towards keeping the target at `screenX` on screen (set by the layout).
//
// A pane's camera eases through two lags in a row (`lags: 2`, CAMERA_EASE each): the first
// follows the target, the camera follows the first. Its speed then changes smoothly when
// the target's does (a catch turns the monkey's speed at once), where one lag would pass
// that on as a jolt of the whole view. The shared screen's camera, whose position decides
// who falls behind, keeps one lag (CAMERA_LERP).
export class Camera {
  constructor(targetX = 0, screenX = CAMERA_TARGET_X, { lags = 2 } = {}) {
    this.screenX = screenX;
    this.lags = lags;
    this.reset(targetX);
  }

  reset(targetX) {
    this.x = targetX - this.screenX;
    this.prevX = this.x;
    this.eased = this.x; // the first lag's position (two lags)
  }

  // At the start of each sim step: where the camera was, to draw between steps.
  mark() {
    this.prevX = this.x;
  }

  // Exact for a target held still over the step, so the motion does not depend on the
  // step size.
  update(targetX, dt) {
    const desired = targetX - this.screenX;
    if (this.lags === 1) {
      this.x += (desired - this.x) * (1 - Math.exp(-CAMERA_LERP * dt));
      return;
    }
    // Two equal lags k in a row, towards D: e(t) = D + (e0 - D)·a and
    // x(t) = D + (x0 - D)·a + k·t·(e0 - D)·a, with a = exp(-k·t).
    const k = CAMERA_EASE;
    const a = Math.exp(-k * dt);
    const e0 = this.eased - desired;
    this.x = desired + (this.x - desired) * a + k * dt * e0 * a;
    this.eased = desired + e0 * a;
  }
}

// What the camera follows: the monkey, or in portrait (`follow` 'anchor') the anchor of
// the liana it hangs on, so the view holds still through each swing.
export function cameraTarget(monkey, follow) {
  return follow === 'anchor' && monkey.liana ? monkey.liana.x : monkey.x;
}
