// A frame's time step as the screen shows it. A screen shows a new picture every refresh
// interval, but browsers report frame times unevenly: Safari rounds them to a whole
// millisecond (16, 17, 17, 16 … ms apart on a 60 Hz screen), and the callback can run a
// little early or late. Moving the game on by those amounts makes steady motion uneven,
// seen in the background most. So a frame is counted as the whole number of refresh
// intervals it is nearest to (one, or more when frames were missed); the interval is
// learnt from the frames. What that leaves out is kept, and paid back a little at a time
// once it grows past a few ms, so the game's time stays with the real time. A frame that
// is no whole number of intervals (a pause, a stall) counts as it is. Frames that keep
// missing the interval, or the game's time drifting far from the real time, mean the
// refresh rate has changed: the interval is learnt again.
const WARMUP = 8; // frames to learn the interval from
// A frame within this share of an interval of a whole number of them fits (under a half, so
// a 120 Hz frame never fits a 60 Hz interval).
const FIT = 0.4;
const MAX_INTERVALS = 4; // more than this many missed is a stall, counted as it is
const DEADBAND_MS = 3; // time left out up to this is not paid back
const PAYBACK = 0.05; // the share of the rest paid back a frame …
const MAX_PAYBACK_MS = 0.1; // … at most this (0.6 % at 60 Hz)
const RELEARN_AFTER = 8; // frames in a row that do not fit
const LOST_MS = 50; // the game this far from the real time: the interval is wrong
const WINDOW = 600; // intervals the estimate is averaged over, about

export class FrameClock {
  constructor() {
    this.relearn();
  }

  relearn() {
    this.interval = null; // the screen's refresh interval, ms
    this.warmup = []; // the first frames' times
    this.span = 0; // ms and …
    this.count = 0; // … intervals of the frames that fit, for the estimate
    this.owed = 0; // real time not yet given to the game, ms (negative: given ahead)
    this.off = 0; // frames in a row that did not fit
  }

  // The time step (ms) for a frame `deltaMs` after the last.
  frame(deltaMs) {
    if (this.interval === null) {
      this.warmup.push(deltaMs);
      if (this.warmup.length >= WARMUP) {
        const sorted = [...this.warmup].sort((a, b) => a - b);
        this.interval = sorted[sorted.length >> 1];
        this.span = this.interval;
        this.count = 1;
      }
      return deltaMs;
    }
    const n = Math.round(deltaMs / this.interval);
    if (n < 1 || n > MAX_INTERVALS || Math.abs(deltaMs - n * this.interval) > FIT * this.interval) {
      if (++this.off >= RELEARN_AFTER) this.relearn();
      return deltaMs;
    }
    this.off = 0;
    this.span += deltaMs;
    this.count += n;
    if (this.count > WINDOW) {
      this.span /= 2;
      this.count /= 2;
    }
    this.interval = this.span / this.count;
    this.owed += deltaMs - n * this.interval;
    if (Math.abs(this.owed) > LOST_MS) {
      this.relearn();
      return deltaMs;
    }
    const excess = Math.abs(this.owed) > DEADBAND_MS ? this.owed - Math.sign(this.owed) * DEADBAND_MS : 0;
    const pay = Math.max(-MAX_PAYBACK_MS, Math.min(MAX_PAYBACK_MS, excess * PAYBACK));
    this.owed -= pay;
    return n * this.interval + pay;
  }
}
