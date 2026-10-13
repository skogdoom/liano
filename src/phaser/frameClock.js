import { FrameClock } from '../frameClock.js';

// Safari's device trace includes 27/14/8 and 30/11/9 ms callback gaps: three
// callbacks still span about three refreshes. Rounding each gap to refreshes
// separately made these sequences advance 33/16.5/8 and 33/16.5/9 ms. That
// creates a double movement followed by a half movement in every interpolated rig.
// Keep one refresh per callback through these phase disturbances. A gap close
// to two or more refreshes still advances missed frames; residual real time is
// repaid gradually. This clock is used only by Phaser, not the Pixi driver.
const TIMER_PRECISION_MS = 1; // the timestamp rounding visible in the Safari trace
const DEADBAND_MS = 3;
const MAX_PAYBACK_MS = 0.1;
const PAYBACK = 0.05;

export class PhaserFrameClock {
  constructor() {
    this.refresh = new FrameClock();
    this.owed = 0;
  }

  frame(deltaMs) {
    // TimeStep.wake can issue an immediate tick before the next RAF. Do not
    // turn a zero/sub-ms callback into a full refresh of movement.
    if (deltaMs <= TIMER_PRECISION_MS) return Math.max(0, deltaMs);
    const normalized = this.refresh.frame(deltaMs);
    const interval = this.refresh.interval;
    // A genuine long stall still advances elapsed time, including any small
    // outstanding balance. Normalizing it to one frame would slow the game.
    if (interval !== null && deltaMs >= 4 * interval) {
      const debt = this.owed;
      const advance = Math.max(0, deltaMs + debt);
      this.owed = deltaMs + debt - advance;
      return advance;
    }
    // Allow whole-ms rounding at an actual missed refresh. Short callbacks
    // after a phase disturbance count as one too, rather than a half step.
    let step = interval === null || deltaMs >= 2 * interval - TIMER_PRECISION_MS ? normalized : interval;
    const priorDebt = this.owed;
    this.owed += deltaMs - step;
    // A persistent cadence change must be learnt promptly. Keep the remaining
    // balance and repay it gradually; never reverse time or jump by that debt.
    if (interval !== null && Math.abs(this.owed) > interval) {
      this.owed = priorDebt;
      step = deltaMs;
      this.refresh.relearn();
    }
    const excess = Math.abs(this.owed) > DEADBAND_MS ? this.owed - Math.sign(this.owed) * DEADBAND_MS : 0;
    const pay = Math.max(-Math.min(step, MAX_PAYBACK_MS), Math.min(MAX_PAYBACK_MS, excess * PAYBACK));
    this.owed -= pay;
    return step + pay;
  }
}
