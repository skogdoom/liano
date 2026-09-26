import { GRAVITY, LIANA_LENGTH, MAX_ENTRY_RADIUS, SLIP_SPEED } from '../config.js';
import { ballisticStep, pendulumPosition, hangingVelocity } from './physics.js';

export const MonkeyState = Object.freeze({
  HANGING: 'HANGING',
  AIRBORNE: 'AIRBORNE',
  DEAD: 'DEAD',
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
    // Whether the grip slips towards the tip (off on the title screen).
    this.slipping = true;
    // The liana just released; it cannot be regrabbed until another one is grabbed.
    this.excludedLiana = null;
  }

  // Grabs `liana` at `contactRadius` from its anchor (at most MAX_ENTRY_RADIUS); the
  // grip then slips towards the tip at SLIP_SPEED. The swing starts in the direction the monkey was moving
  // horizontally.
  grab(liana, contactRadius) {
    const dir = this.vx < 0 ? -1 : 1;
    this.state = MonkeyState.HANGING;
    this.liana = liana;
    this.gripFrom = Math.min(contactRadius, MAX_ENTRY_RADIUS);
    this.gripTime = 0;
    this.excludedLiana = null;
    liana.grab(dir);
    this.#updateHanging();
  }

  // Lets go of the liana, keeping its velocity (tangential plus the slip along the
  // rope). Returns the released liana, or null if the monkey was not hanging.
  release() {
    if (this.state !== MonkeyState.HANGING) return null;
    const liana = this.liana;
    liana.release();
    this.state = MonkeyState.AIRBORNE;
    this.liana = null;
    this.excludedLiana = liana;
    return liana;
  }

  // Ends the run. The monkey keeps its velocity and falls ballistically.
  kill() {
    if (this.liana) {
      this.liana.release();
      this.liana = null;
    }
    this.state = MonkeyState.DEAD;
  }

  // Starts (or restarts) slipping from where the monkey hangs now.
  startSlipping() {
    this.slipping = true;
    this.gripFrom = this.gripRadius;
    this.gripTime = 0;
  }

  // True once the grip has slipped to the tip: the world then forces a release. The
  // tolerance absorbs the rounding of the summed steps, so the release comes on the
  // step forcedReleaseStep() predicts.
  get atTip() {
    return this.state === MonkeyState.HANGING && this.gripRadius >= LIANA_LENGTH - 1e-6;
  }

  // How far (px) the slipping grip is from the tip, or Infinity when not slipping.
  get tipDistance() {
    if (this.state !== MonkeyState.HANGING || !this.slipping) return Infinity;
    return Math.max(LIANA_LENGTH - this.gripRadius, 0);
  }

  // Lianas must be stepped before the monkey so a hanging monkey follows the current angle.
  step(dt) {
    if (this.state === MonkeyState.HANGING) {
      if (this.slipping) this.gripTime += dt;
      this.#updateHanging();
    } else {
      ballisticStep(this, dt, GRAVITY);
    }
  }

  #updateHanging() {
    this.gripRadius = Math.min(this.gripFrom + SLIP_SPEED * this.gripTime, LIANA_LENGTH);

    const { liana } = this;
    const p = pendulumPosition(liana.x, liana.anchorY, this.gripRadius, liana.angle);
    const v = hangingVelocity(this.gripRadius, this.slipping ? SLIP_SPEED : 0, liana.angle, liana.angularVelocity);
    this.x = p.x;
    this.y = p.y;
    this.vx = v.vx;
    this.vy = v.vy;
  }
}
