import { GRAVITY, GRIP_RADIUS, GRIP_SLIDE_TIME } from '../config.js';
import { ballisticStep, pendulumPosition, tangentialVelocity } from './physics.js';

export const MonkeyState = Object.freeze({
  HANGING: 'HANGING',
  AIRBORNE: 'AIRBORNE',
});

export class Monkey {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.state = MonkeyState.AIRBORNE;
    this.liana = null;
    this.gripRadius = 0;
    this.gripFrom = 0;
    this.gripTime = 0;
    // The liana just released; it cannot be regrabbed until another one is grabbed.
    this.excludedLiana = null;
  }

  // Grabs `liana` at `contactRadius` from its anchor, then slides to GRIP_RADIUS.
  // The swing starts in the direction the monkey was moving horizontally.
  grab(liana, contactRadius) {
    const dir = this.vx < 0 ? -1 : 1;
    this.state = MonkeyState.HANGING;
    this.liana = liana;
    this.gripFrom = contactRadius;
    this.gripTime = 0;
    this.excludedLiana = null;
    liana.grab(dir);
    this.#updateHanging();
  }

  // Lets go of the liana, keeping the tangential velocity. Returns the released
  // liana, or null if the monkey was not hanging.
  release() {
    if (this.state !== MonkeyState.HANGING) return null;
    const liana = this.liana;
    liana.release();
    this.state = MonkeyState.AIRBORNE;
    this.liana = null;
    this.excludedLiana = liana;
    return liana;
  }

  canGrab(liana) {
    return this.state === MonkeyState.AIRBORNE && liana !== this.excludedLiana;
  }

  // Lianas must be stepped before the monkey so a hanging monkey follows the current angle.
  step(dt) {
    if (this.state === MonkeyState.HANGING) {
      this.gripTime += dt;
      this.#updateHanging();
    } else {
      ballisticStep(this, dt, GRAVITY);
    }
  }

  #updateHanging() {
    const u = GRIP_SLIDE_TIME > 0 ? Math.min(this.gripTime / GRIP_SLIDE_TIME, 1) : 1;
    const eased = 1 - (1 - u) * (1 - u);
    this.gripRadius = this.gripFrom + (GRIP_RADIUS - this.gripFrom) * eased;

    const { liana } = this;
    const p = pendulumPosition(liana.x, liana.anchorY, this.gripRadius, liana.angle);
    const v = tangentialVelocity(this.gripRadius, liana.angle, liana.angularVelocity);
    this.x = p.x;
    this.y = p.y;
    this.vx = v.vx;
    this.vy = v.vy;
  }
}
