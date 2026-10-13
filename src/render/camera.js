import { CAMERA_TARGET_X, CAMERA_LERP } from '../config.js';

// TEMPORARY (the owner's check of the background's motion): `?camera=smooth` eases the
// camera through a second lag, so its speed changes smoothly when the monkey's does (at a
// catch); `?camera=anchor` follows the anchor of the liana the monkey hangs on in every
// layout (as portrait does), so the view holds still through a swing; both can be given
// (`?camera=smooth,anchor`).
const MODES = new Set(typeof location === 'undefined' ? [] : (new URLSearchParams(location.search).get('camera') ?? '').split(','));
const SMOOTH_LERP = 12; // each of the two lags

// Horizontal-only camera. `x` is the world x at the left edge of the screen.
// It eases towards keeping the target at `screenX` on screen (set by the layout).
export class Camera {
  constructor(targetX = 0, screenX = CAMERA_TARGET_X) {
    this.screenX = screenX;
    this.reset(targetX);
  }

  reset(targetX) {
    this.x = targetX - this.screenX;
    this.prevX = this.x;
    this.eased = this.x; // ?camera=smooth: the first lag's position
  }

  // At the start of each sim step: where the camera was, to draw between steps.
  mark() {
    this.prevX = this.x;
  }

  update(targetX, dt) {
    const desired = targetX - this.screenX;
    if (MODES.has('smooth')) {
      const share = 1 - Math.exp(-SMOOTH_LERP * dt);
      this.eased += (desired - this.eased) * share;
      this.x += (this.eased - this.x) * share;
      return;
    }
    this.x += (desired - this.x) * (1 - Math.exp(-CAMERA_LERP * dt));
  }
}

// What the camera follows: the monkey, or in portrait (`follow` 'anchor') the anchor of
// the liana it hangs on, so the view holds still through each swing.
export function cameraTarget(monkey, follow) {
  return (follow === 'anchor' || MODES.has('anchor')) && monkey.liana ? monkey.liana.x : monkey.x;
}
