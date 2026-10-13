import { CAMERA_TARGET_X, CAMERA_LERP, CAMERA_EASE } from '../config.js';

// TEMPORARY (the owner's check of the stutter while swinging): `?sway=0.5` makes a
// landscape pane's camera follow that share of each swing about the liana's anchor (1:
// all of it, as by default; 0: none), see SwingTarget.
const SWAY = (() => {
  const value = typeof location === 'undefined' ? NaN : Number(new URLSearchParams(location.search).get('sway') ?? NaN);
  return value >= 0 && value <= 1 ? value : 1;
})();
const CATCH_S = 0.3; // the glide to the new liana after a catch (time constant)
const FLIGHT_S = 0.5; // closing the gap to the monkey in flight (time constant)

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

// What a landscape pane's camera follows with ?sway below 1: while the monkey hangs, the
// liana's anchor plus that share of the monkey's swing about it; in flight, the monkey.
// It never jumps: after a catch it glides to the new liana, after a release it closes the
// gap to the monkey as it flies.
export class SwingTarget {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = null;
  }

  // The target for `monkey` after a step of `dt` s.
  of(monkey, follow, dt) {
    if (follow === 'anchor' || SWAY === 1) return cameraTarget(monkey, follow);
    const hanging = monkey.state === 'HANGING' && monkey.liana;
    const raw = hanging ? monkey.liana.x + SWAY * (monkey.x - monkey.liana.x) : monkey.x;
    const s = (this.state ??= { target: raw, hanging, carry: 0 });
    if (hanging !== s.hanging) s.carry = s.target - raw;
    else s.carry *= Math.exp(-dt / (hanging ? CATCH_S : FLIGHT_S));
    s.hanging = hanging;
    s.target = raw + s.carry;
    return s.target;
  }
}
