// Frames per second and frame times over a sliding window, for the debug view. Fed the
// time of every frame (ms, e.g. performance.now()); nothing else about it is rendering.
export class FpsMeter {
  constructor(windowMs = 1000) {
    this.windowMs = windowMs;
    this.times = []; // frame start times inside the window
    this.last = null;
    this.worst = 0; // the longest frame in the window, ms
    this.slow = 0; // frames over SLOW_MS since the start
    this.frames = 0;
  }

  // A frame at time `now` (ms).
  tick(now) {
    if (this.last !== null) {
      const dt = now - this.last;
      if (dt > SLOW_MS) this.slow++;
    }
    this.last = now;
    this.frames++;
    this.times.push(now);
    while (this.times.length > 2 && now - this.times[0] > this.windowMs) this.times.shift();
    this.worst = 0;
    for (let i = 1; i < this.times.length; i++) this.worst = Math.max(this.worst, this.times[i] - this.times[i - 1]);
  }

  // Frames per second over the window (0 until there are two frames).
  get fps() {
    if (this.times.length < 2) return 0;
    return (1000 * (this.times.length - 1)) / (this.times.at(-1) - this.times[0]);
  }

  // Mean frame time over the window, ms.
  get frameMs() {
    return this.fps === 0 ? 0 : 1000 / this.fps;
  }

  // For the debug view: "60 fps  16.7 ms  worst 21 ms  slow 3".
  describe() {
    if (this.fps === 0) return 'fps …';
    return `${this.fps.toFixed(0)} fps  ${this.frameMs.toFixed(1)} ms  worst ${this.worst.toFixed(0)} ms  slow ${this.slow}`;
  }
}

// A frame longer than this (ms) is a visible hitch at 60 Hz (more than two frames).
export const SLOW_MS = 34;

// The JS heap in use, MB, where the browser says (Chrome); null elsewhere.
export function heapMB(perf = globalThis.performance) {
  const used = perf?.memory?.usedJSHeapSize;
  return typeof used === 'number' ? used / (1024 * 1024) : null;
}
