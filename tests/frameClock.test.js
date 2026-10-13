import { describe, it, expect } from 'vitest';
import { FrameClock } from '../src/frameClock.js';

// The time steps a clock gives for frames at the true times `times` (ms), as the browser
// reports them: rounded to a whole ms when `round`.
function steps(times, round = true) {
  const clock = new FrameClock();
  const seen = times.map((t) => (round ? Math.round(t) : t));
  return seen.slice(1).map((t, i) => clock.frame(t - seen[i]));
}
const frames = (count, interval, start = 0) => Array.from({ length: count }, (_, i) => start + 0.37 + i * interval);
const spread = (list) => Math.max(...list) - Math.min(...list);
const sum = (list) => list.reduce((a, b) => a + b, 0);

describe('the frame clock', () => {
  it('gives a 60 Hz screen even steps from timestamps rounded to the ms (Safari)', () => {
    const raw = frames(601, 1000 / 60).map(Math.round);
    expect(spread(raw.slice(1).map((t, i) => t - raw[i]))).toBe(1); // 16 and 17 ms
    const out = steps(frames(601, 1000 / 60)).slice(60);
    expect(spread(out)).toBeLessThan(0.15);
    for (const dt of out) expect(dt).toBeCloseTo(1000 / 60, 0);
  });

  it('does the same on a 120 Hz screen', () => {
    const out = steps(frames(1201, 1000 / 120)).slice(60);
    expect(spread(out)).toBeLessThan(0.15);
  });

  it('keeps the game time with the real time', () => {
    const times = frames(3601, 1000 / 60); // a minute
    const out = steps(times);
    expect(Math.abs(sum(out) - (Math.round(times.at(-1)) - Math.round(times[0])))).toBeLessThan(4);
  });

  it('counts a missed frame as two, and stays in time after it', () => {
    const times = [...frames(120, 1000 / 60), ...frames(120, 1000 / 60, 121 * (1000 / 60))];
    const out = steps(times);
    expect(out[119]).toBeCloseTo(2 * (1000 / 60), 1);
    expect(Math.abs(sum(out) - (Math.round(times.at(-1)) - Math.round(times[0])))).toBeLessThan(4);
  });

  it('learns a new refresh rate (a window moved to another screen)', () => {
    for (const hz of [120, 75, 50]) {
      const times = [...frames(120, 1000 / 60), ...frames(600, 1000 / hz, 120 * (1000 / 60))];
      const out = steps(times).slice(-60);
      for (const dt of out) expect(dt).toBeCloseTo(1000 / hz, 0);
    }
  });

  it('evens out frame times that come a few ms early or late', () => {
    // A seeded jitter of up to ±3 ms on each frame's time, then rounded to the ms.
    let seed = 7;
    const jitter = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 6;
    const times = frames(1201, 1000 / 60).map((t, i) => (i === 0 ? t : t + jitter()));
    const out = steps(times).slice(60);
    expect(spread(out)).toBeLessThan(0.3);
    expect(Math.abs(sum(steps(times)) - (Math.round(times.at(-1)) - Math.round(times[0])))).toBeLessThan(5);
  });

  it('counts a stall that is no whole number of frames as it is', () => {
    const times = [...frames(60, 1000 / 60), 59 * (1000 / 60) + 0.37 + 200, ...frames(60, 1000 / 60, 60 * (1000 / 60) + 200)];
    const out = steps(times);
    expect(out[59]).toBeCloseTo(200, 0);
  });

  it('leaves exact frame times exact', () => {
    const out = steps(frames(301, 1000 / 60), false);
    for (const dt of out) expect(dt).toBeCloseTo(1000 / 60, 6);
  });
});
