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
  }

  get tipY() {
    return this.anchorY + this.length;
  }

  grab(dir) {
    this.state = LianaState.SWINGING;
    this.swingDir = dir;
    this.swingTime = 0;
    this.#updateSwing();
  }

  release() {
    if (this.state === LianaState.SWINGING) this.state = LianaState.SETTLING;
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
    this.angle = pendulumAngle(this.swingTime, this.swingDir, SWING_AMPLITUDE, SWING_OMEGA);
    this.angularVelocity = pendulumAngularVelocity(this.swingTime, this.swingDir, SWING_AMPLITUDE, SWING_OMEGA);
  }
}
