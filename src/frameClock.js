// A frame's time step as the screen shows it. Browsers time frames to the millisecond at
// best (Safari rounds to a whole one), so on a 60 Hz screen the frames are said to come
// 16, 17, 17, 16 … ms apart while the screen shows one every 16.67 ms. Moving the game on
// by those amounts makes steady motion uneven by up to 6 % a frame, seen in the background
// most. A frame within rounding of the screen's refresh interval (learnt from the frames)
// counts as exactly one interval; what that leaves out is kept and paid back a little at
// a time once it passes a millisecond, so the game's time stays with the real time. A
// frame further off (one missed, a pause) counts as it is.
const TOLERANCE_MS = 1.5; // a frame this close to the interval is one interval
const LEARN = 0.05; // how fast the interval follows the frames
const DEADBAND_MS = 1; // time left out up to this is not paid back
const PAYBACK_MS = 0.05; // at most this paid back a frame (0.3 % at 60 Hz)
const RELEARN_AFTER = 8; // frames in a row off the interval: the refresh has changed

export class FrameClock {
  constructor() {
    this.interval = null; // the screen's refresh interval, ms
    this.owed = 0; // real time not yet given to the game, ms (negative: given ahead)
    this.off = 0; // frames in a row off the interval
  }

  // The time step (ms) for a frame `deltaMs` after the last.
  frame(deltaMs) {
    if (this.interval === null || this.off >= RELEARN_AFTER) {
      this.interval = deltaMs;
      this.owed = 0;
      this.off = 0;
      return deltaMs;
    }
    if (Math.abs(deltaMs - this.interval) > TOLERANCE_MS) {
      this.off++;
      return deltaMs;
    }
    this.off = 0;
    this.interval += (deltaMs - this.interval) * LEARN;
    this.owed += deltaMs - this.interval;
    const excess = Math.abs(this.owed) > DEADBAND_MS ? this.owed - Math.sign(this.owed) * DEADBAND_MS : 0;
    const pay = Math.max(-PAYBACK_MS, Math.min(PAYBACK_MS, excess));
    this.owed -= pay;
    return this.interval + pay;
  }
}
