import { FrameClock } from '../frameClock.js';

// Safari's device trace includes 27/14/8 and 30/11/9 ms callback gaps: three
// callbacks still span about three refreshes. Rounding each gap to refreshes
// separately made these sequences advance 33/16.5/8 and 33/16.5/9 ms. That
// creates a double movement followed by a half movement in every interpolated rig.
// Keep one refresh per callback through these phase disturbances. A gap close
// to two or more refreshes still advances missed frames; residual real time is
// repaid gradually. The game driver uses this clock for Phaser callbacks.
const TIMER_PRECISION_MS = 1; // the timestamp rounding visible in the Safari trace
const DEADBAND_MS = 3;
const MAX_PAYBACK_MS = 0.1;
const PAYBACK = 0.05;
const CADENCE_CONFIRM_FRAMES = 3;

export class PhaserFrameClock {
  constructor() {
    this.refresh = new FrameClock();
    this.owed = 0;
    this.cadenceFrames = 0;
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
      this.cadenceFrames = 0;
      return advance;
    }
    // Allow whole-ms rounding at an actual missed refresh. Short callbacks
    // after a phase disturbance count as one too, rather than a half step.
    let step = interval === null || deltaMs >= 2 * interval - TIMER_PRECISION_MS ? normalized : interval;
    const priorDebt = this.owed;
    this.owed += deltaMs - step;
    // A late callback can temporarily push existing debt past one interval, then
    // give that time back in the next short callbacks (the recorded 28/10/8 ms
    // sequence). Require sustained imbalance before exposing raw timing and
    // relearning. Genuine cadence changes still accumulate debt across frames.
    const growing = Math.abs(this.owed) > Math.abs(priorDebt) + TIMER_PRECISION_MS;
    this.cadenceFrames = interval !== null && Math.abs(this.owed) > interval && growing
      ? this.cadenceFrames + 1 : 0;
    if (this.cadenceFrames >= CADENCE_CONFIRM_FRAMES) {
      this.owed = priorDebt;
      step = deltaMs;
      this.refresh.relearn();
      this.cadenceFrames = 0;
    }
    const excess = Math.abs(this.owed) > DEADBAND_MS ? this.owed - Math.sign(this.owed) * DEADBAND_MS : 0;
    const pay = Math.max(-Math.min(step, MAX_PAYBACK_MS), Math.min(MAX_PAYBACK_MS, excess * PAYBACK));
    this.owed -= pay;
    return step + pay;
  }
}
