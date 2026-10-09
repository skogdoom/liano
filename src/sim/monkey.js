import {
  FLOW_GRIP,
  HOLD_GRIP,
  HOLD_SLIDE_TIME,
  GRAVITY,
  QUICK_SLIP_SPEED,
  LIANA_LENGTH,
  MAX_ENTRY_RADIUS,
  MAX_SLIP_SPEED,
  SIM_DT,
  SLIP_OFF_PHASE,
  SWING_PERIOD,
} from '../config.js';
import { ballisticStep, pendulumPosition, hangingVelocity } from './physics.js';

// The quick slide after a catch above FLOW_GRIP: where it ends and how long it takes (s).
export function quickSlide(gripFrom) {
  const quickTo = Math.max(gripFrom, FLOW_GRIP);
  return { quickTo, quickTime: (quickTo - gripFrom) / QUICK_SLIP_SPEED };
}

// Whole steps in a swing period (both periods are an even number of steps).
export const periodSteps = (period) => Math.round(period / SIM_DT);

// Steps from the start of a slip from `gripFrom` until the grip reaches the tip, when
// the liana swings in `dir` with `period` and is `swingSteps` steps into its swing: the
// first step at SLIP_OFF_PHASE that does not need more than MAX_SLIP_SPEED. There,
// θ = dir · A · sin(ωt) is on the upswing to the right (for dir −1, half a period later).
export function slipSteps(gripFrom, swingSteps = 0, dir = 1, period = SWING_PERIOD) {
  const steps = periodSteps(period);
  const { quickTo, quickTime } = quickSlide(gripFrom);
  const minSteps = Math.ceil((quickTime + (LIANA_LENGTH - quickTo) / MAX_SLIP_SPEED) / SIM_DT - 1e-9);
  const offStep = Math.round(SLIP_OFF_PHASE * steps) + (dir > 0 ? 0 : steps / 2);
  const first = offStep - swingSteps + steps * Math.ceil((swingSteps + minSteps - offStep) / steps);
  return Math.max(first, 1);
}

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
    // Whether the grip slips towards the tip (off on the title screen), and how fast.
    this.slipping = true;
    // With slipping turned off (G), the monkey holds on instead: the grip stays where it
    // caught, or slides down to HOLD_GRIP from above it, and the monkey tires and lets go
    // on the step a slip would have reached the tip (see #planSlip). Read at each grab.
    this.holds = false;
    // Speed along the rope (px/s, down positive) when the monkey caught it.
    this.catchSpeed = 0;
    this.slipSpeed = 0;
    this.slipTime = 0;
    this.quickTo = 0;
    this.quickTime = 0;
    // The liana just released; it cannot be regrabbed until another one is grabbed.
    this.excludedLiana = null;
  }

  // Grabs `liana` at `contactRadius` from its anchor (at most MAX_ENTRY_RADIUS); the
  // grip then slips towards the tip (see slipSteps). The swing starts in the direction
  // the monkey was moving horizontally. On a liana another monkey swings on, it joins
  // that swing.
  grab(liana, contactRadius) {
    const dir = this.vx < 0 ? -1 : 1;
    this.state = MonkeyState.HANGING;
    this.liana = liana;
    this.gripFrom = Math.min(contactRadius, MAX_ENTRY_RADIUS);
    this.excludedLiana = null;
    liana.grab(dir);
    const angle = liana.angle;
    this.catchSpeed = this.vx * Math.sin(angle) + this.vy * Math.cos(angle);
    this.#planSlip();
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

  // Ends the run (or the life). The monkey keeps its velocity and falls ballistically.
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
    this.catchSpeed = 0;
    this.#planSlip();
  }

  // Moves the grip of a monkey hanging still (on the title screen) to `radius`.
  hangAt(radius) {
    if (this.state !== MonkeyState.HANGING) return;
    this.gripFrom = Math.min(radius, MAX_ENTRY_RADIUS);
    this.catchSpeed = 0;
    this.#planSlip();
    this.#updateHanging();
  }

  // A quick slide down to FLOW_GRIP if caught above it, then a steady slip timed to
  // reach the tip at SLIP_OFF_PHASE (see slipSteps). Holding on, the grip stays where
  // it caught, or (caught above HOLD_GRIP) slides down to it, carrying on the catch speed
  // along the rope and braking evenly to a stop, in at most HOLD_SLIDE_TIME; the grip
  // gives when a slip from FLOW_GRIP (or from a catch above it) would have reached the tip.
  #planSlip() {
    const { liana } = this;
    const swingSteps = Math.round(liana.swingTime / SIM_DT);
    this.gripTime = 0;
    if (this.holds) {
      const steps = slipSteps(Math.min(this.gripFrom, FLOW_GRIP), swingSteps, liana.swingDir, liana.period);
      const distance = Math.max(HOLD_GRIP - this.gripFrom, 0);
      this.quickTo = this.gripFrom + distance;
      this.quickTime = distance > 0 ? Math.min((2 * distance) / Math.max(this.catchSpeed, 0), HOLD_SLIDE_TIME) : 0;
      this.slipTime = steps * SIM_DT;
      this.slipSpeed = 0;
      return;
    }
    const steps = slipSteps(this.gripFrom, swingSteps, liana.swingDir, liana.period);
    const { quickTo, quickTime } = quickSlide(this.gripFrom);
    this.quickTo = quickTo;
    this.quickTime = quickTime;
    this.slipTime = steps * SIM_DT;
    this.slipSpeed = (LIANA_LENGTH - quickTo) / (this.slipTime - quickTime);
  }

  // True once the grip gives: slipped to the tip, or (holding on) tired out. The world
  // then forces a release. The tolerances absorb the rounding of the summed steps, so
  // the release comes on the step slipSteps() predicts.
  get forcedOff() {
    if (this.state !== MonkeyState.HANGING) return false;
    if (this.holds) return this.slipping && this.gripTime >= this.slipTime - SIM_DT / 2;
    return this.gripRadius >= LIANA_LENGTH - 1e-6;
  }

  // Seconds until the grip gives (see forcedOff), or Infinity when not slipping.
  get tipTime() {
    if (this.state !== MonkeyState.HANGING || !this.slipping) return Infinity;
    return Math.max(this.slipTime - this.gripTime, 0);
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
    const t = this.gripTime;
    const quick = t < this.quickTime;
    if (!quick) this.gripRadius = Math.min(this.quickTo + this.slipSpeed * (t - this.quickTime), LIANA_LENGTH);
    else if (this.holds) {
      // Braking evenly from the start of the slide to a stop at quickTo.
      const u = 1 - t / this.quickTime;
      this.gripRadius = this.quickTo - (this.quickTo - this.gripFrom) * u * u;
    } else this.gripRadius = this.gripFrom + QUICK_SLIP_SPEED * t;

    const { liana } = this;
    const p = pendulumPosition(liana.x, liana.anchorY, this.gripRadius, liana.angle);
    const radialSpeed = this.slipping && !quick ? this.slipSpeed : 0;
    const v = hangingVelocity(this.gripRadius, radialSpeed, liana.angle, liana.angularVelocity);
    this.x = p.x;
    this.y = p.y;
    this.vx = v.vx;
    this.vy = v.vy;
  }
}
