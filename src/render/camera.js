import { CAMERA_TARGET_X, CAMERA_LERP, CAMERA_EASE, CAMERA_SWAY } from '../config.js';

const CATCH_S = 0.3; // the glide to the new liana after a catch (time constant)
const FLIGHT_S = 0.5; // closing the gap to the monkey in flight (time constant)

// Horizontal-only camera. `x` is the world x at the left edge of the screen.
// It eases towards keeping the target at `screenX` on screen (set by the layout).
//
// A pane's camera eases through two lags in a row (`lags: 2`, CAMERA_EASE each): the first
// follows the target, the camera follows the first. Its speed then changes smoothly when
// the target's does (a catch turns the monkey's speed at once), where one lag would pass
// that on as a jolt of the whole view. Shared screen defaults to one lag (CAMERA_LERP),
// and can opt into two faster lags with the same average tracking delay.
export class Camera {
  constructor(targetX = 0, screenX = CAMERA_TARGET_X, { lags = 2, rate = lags === 1 ? CAMERA_LERP : CAMERA_EASE } = {}) {
    this.screenX = screenX;
    this.lags = lags;
    this.rate = rate;
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
      this.x += (desired - this.x) * (1 - Math.exp(-this.rate * dt));
      return;
    }
    // Two equal lags k in a row, towards D: e(t) = D + (e0 - D)·a and
    // x(t) = D + (x0 - D)·a + k·t·(e0 - D)·a, with a = exp(-k·t).
    const k = this.rate;
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

// What a landscape pane's camera follows: while the monkey hangs, the liana's anchor plus
// a share (`sway`, CAMERA_SWAY) of the monkey's swing about it, so the view does not swing
// the whole world back and forth (the lianas, obstacles and floor looked stepped at 60 Hz
// moving that fast); in flight, the monkey. It never jumps: after a catch it glides to the
// new liana, after a release it closes the gap to the monkey as it flies. In portrait
// (`follow` 'anchor') it is the anchor (cameraTarget).
export class SwingTarget {
  constructor(sway = CAMERA_SWAY) {
    this.sway = sway;
    this.reset();
  }

  reset() {
    this.state = null;
  }

  // The target for `monkey` after a step of `dt` s.
  of(monkey, follow, dt) {
    if (follow === 'anchor') return cameraTarget(monkey, follow);
    const hanging = Boolean(monkey.state === 'HANGING' && monkey.liana);
    const raw = hanging ? monkey.liana.x + this.sway * (monkey.x - monkey.liana.x) : monkey.x;
    const s = (this.state ??= { target: raw, hanging, carry: 0 });
    if (hanging !== s.hanging) s.carry = s.target - raw;
    else s.carry *= Math.exp(-dt / (hanging ? CATCH_S : FLIGHT_S));
    s.hanging = hanging;
    s.target = raw + s.carry;
    return s.target;
  }
}
