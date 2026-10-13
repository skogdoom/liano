import { CAMERA_TARGET_X, CAMERA_LERP } from '../config.js';

// TEMPORARY (the owner's check of the background's motion): `?camera=smooth` eases the
// camera through a second lag, so its speed changes smoothly when the monkey's does (at a
// catch); `?camera=anchor` follows the anchor of the liana the monkey hangs on in every
// layout (as portrait does), so the view holds still through a swing; both can be given
// (`?camera=smooth,anchor`). `?camera=glide` follows a target that never jumps: the
// anchor while hanging (no swaying), gliding to a new liana's anchor after a catch, and
// in flight moving with the monkey from where it was at the release, closing the gap
// as it flies; eased through two lags.
const MODES = new Set(typeof location === 'undefined' ? [] : (new URLSearchParams(location.search).get('camera') ?? '').split(','));
const SMOOTH_LERP = 12; // each of the two lags
const GLIDE_LERP = 6; // ?camera=glide: each of the two lags
const GLIDE_CATCH_S = 0.3; // … the glide to a new anchor (time constant)
const GLIDE_FLIGHT_S = 0.5; // … closing the gap to the monkey in flight (time constant)

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
    this.glide = null; // ?camera=glide: { target, hanging, carry, gap }
  }

  // At the start of each sim step: where the camera was, to draw between steps.
  mark() {
    this.prevX = this.x;
  }

  // `monkey`: what the target was taken from, for ?camera=glide.
  update(targetX, dt, monkey = null) {
    if (MODES.has('glide') && monkey) {
      const desired = this.#glideTarget(monkey, dt) - this.screenX;
      const share = 1 - Math.exp(-GLIDE_LERP * dt);
      this.eased += (desired - this.eased) * share;
      this.x += (this.eased - this.x) * share;
      return;
    }
    const desired = targetX - this.screenX;
    if (MODES.has('smooth')) {
      const share = 1 - Math.exp(-SMOOTH_LERP * dt);
      this.eased += (desired - this.eased) * share;
      this.x += (this.eased - this.x) * share;
      return;
    }
    this.x += (desired - this.x) * (1 - Math.exp(-CAMERA_LERP * dt));
  }

  #glideTarget(monkey, dt) {
    const hanging = monkey.state === 'HANGING' && monkey.liana;
    const g = (this.glide ??= { target: hanging ? monkey.liana.x : monkey.x, hanging, carry: 0, gap: 0 });
    if (hanging) {
      g.carry = g.hanging ? g.carry * Math.exp(-dt / GLIDE_CATCH_S) : g.target - monkey.liana.x;
      g.target = monkey.liana.x + g.carry;
    } else {
      g.gap = g.hanging ? g.target - monkey.x : g.gap * Math.exp(-dt / GLIDE_FLIGHT_S);
      g.target = monkey.x + g.gap;
    }
    g.hanging = hanging;
    return g.target;
  }
}

// What the camera follows: the monkey, or in portrait (`follow` 'anchor') the anchor of
// the liana it hangs on, so the view holds still through each swing.
export function cameraTarget(monkey, follow) {
  return (follow === 'anchor' || MODES.has('anchor')) && monkey.liana ? monkey.liana.x : monkey.x;
}
