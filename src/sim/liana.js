import { ANCHOR_Y, LIANA_LENGTH, SWING_AMPLITUDE, SWING_PERIOD, LIANA_SETTLE_DAMPING } from '../config.js';
import { pendulumAngle, pendulumAngularVelocity } from './physics.js';

export const SWING_OMEGA = (2 * Math.PI) / SWING_PERIOD;

export const LianaState = Object.freeze({
  IDLE: 'IDLE',
  SWINGING: 'SWINGING',
  SETTLING: 'SETTLING',
});

const SETTLE_EPSILON = 1e-3;

// A liana hanging from (x, anchorY). While grabbed it swings with a fixed
// amplitude and period, starting at vertical. After release it sways back to
// vertical; that sway is cosmetic, so the gameplay hitbox is always the
// vertical segment from the anchor to the tip.
export class Liana {
  constructor(index, x) {
    this.index = index;
    this.x = x;
    this.anchorY = ANCHOR_Y;
    this.length = LIANA_LENGTH;
    this.state = LianaState.IDLE;
    this.angle = 0;
    this.angularVelocity = 0;
    this.swingTime = 0;
    this.swingDir = 1;
    this.period = SWING_PERIOD;
    // Monkeys hanging on it (both can, in shared screen).
    this.holders = 0;
  }

  // True while a monkey swings on it: another monkey grabbing it joins that swing.
  get held() {
    return this.state === LianaState.SWINGING && this.holders > 0;
  }

  get tipY() {
    return this.anchorY + this.length;
  }

  // Starts swinging in `dir` with `period` (SWING_PERIOD, or BOOST_PERIOD when the
  // monkey is boosted). If a monkey already swings on it, the new one joins that swing
  // instead: same phase, direction and period.
  grab(dir, period = SWING_PERIOD) {
    const joining = this.held;
    this.holders++;
    if (joining) return;
    this.state = LianaState.SWINGING;
    this.swingDir = dir;
    this.swingTime = 0;
    this.period = period;
    this.#updateSwing();
  }

  // One monkey lets go; the liana settles once none holds it.
  release() {
    this.holders = Math.max(this.holders - 1, 0);
    if (this.holders === 0 && this.state === LianaState.SWINGING) this.state = LianaState.SETTLING;
  }

  step(dt) {
    if (this.state === LianaState.SWINGING) {
      this.swingTime += dt;
      this.#updateSwing();
    } else if (this.state === LianaState.SETTLING) {
      const w = SWING_OMEGA;
      const acceleration = -w * w * this.angle - 2 * LIANA_SETTLE_DAMPING * w * this.angularVelocity;
      this.angularVelocity += acceleration * dt;
      this.angle += this.angularVelocity * dt;
      if (Math.abs(this.angle) < SETTLE_EPSILON && Math.abs(this.angularVelocity) < SETTLE_EPSILON) {
        this.state = LianaState.IDLE;
        this.angle = 0;
        this.angularVelocity = 0;
      }
    }
  }

  #updateSwing() {
    const omega = (2 * Math.PI) / this.period;
    this.angle = pendulumAngle(this.swingTime, this.swingDir, SWING_AMPLITUDE, omega);
    this.angularVelocity = pendulumAngularVelocity(this.swingTime, this.swingDir, SWING_AMPLITUDE, omega);
  }
}
