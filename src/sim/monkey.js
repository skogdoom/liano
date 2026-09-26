import {
  BOOST_PERIOD,
  FLOW_GRIP,
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
    this.slipSpeed = 0;
    this.slipTime = 0;
    this.quickTo = 0;
    this.quickTime = 0;
    // The liana just released; it cannot be regrabbed until another one is grabbed.
    this.excludedLiana = null;
    // Boosted grabs left (from a banana): each new grab while above zero swings with
    // BOOST_PERIOD and uses one up.
    this.boostGrabs = 0;
  }

  // Grabs `liana` at `contactRadius` from its anchor (at most MAX_ENTRY_RADIUS); the
  // grip then slips towards the tip (see slipSteps). The swing starts in the direction
  // the monkey was moving horizontally, boosted if the monkey has boosted grabs left.
  // On a liana another monkey swings on, it joins that swing (and keeps its boost).
  grab(liana, contactRadius) {
    const dir = this.vx < 0 ? -1 : 1;
    this.state = MonkeyState.HANGING;
    this.liana = liana;
    this.gripFrom = Math.min(contactRadius, MAX_ENTRY_RADIUS);
    this.excludedLiana = null;
    const boosted = !liana.held && this.boostGrabs > 0;
    if (boosted) this.boostGrabs--;
    liana.grab(dir, boosted ? BOOST_PERIOD : SWING_PERIOD);
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

  // Ends the run (or the life). The monkey keeps its velocity and falls ballistically;
  // any boost is lost.
  kill() {
    this.boostGrabs = 0;
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
    this.#planSlip();
  }

  // A quick slide down to FLOW_GRIP if caught above it, then a steady slip timed to
  // reach the tip at SLIP_OFF_PHASE (see slipSteps).
  #planSlip() {
    const { liana } = this;
    const steps = slipSteps(this.gripFrom, Math.round(liana.swingTime / SIM_DT), liana.swingDir, liana.period);
    const { quickTo, quickTime } = quickSlide(this.gripFrom);
    this.gripTime = 0;
    this.quickTo = quickTo;
    this.quickTime = quickTime;
    this.slipTime = steps * SIM_DT;
    this.slipSpeed = (LIANA_LENGTH - quickTo) / (this.slipTime - quickTime);
  }

  // True once the grip has slipped to the tip: the world then forces a release. The
  // tolerance absorbs the rounding of the summed steps, so the release comes on the
  // step slipSteps() predicts.
  get atTip() {
    return this.state === MonkeyState.HANGING && this.gripRadius >= LIANA_LENGTH - 1e-6;
  }

  // Seconds until the slipping grip reaches the tip, or Infinity when not slipping.
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
    this.gripRadius = quick
      ? this.gripFrom + QUICK_SLIP_SPEED * t
      : Math.min(this.quickTo + this.slipSpeed * (t - this.quickTime), LIANA_LENGTH);

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
