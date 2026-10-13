import { describe, it, expect } from 'vitest';
import { FrameStats } from '../src/frameStats.js';

// Frames `gaps` ms apart, from time 0.
function run(stats, gaps) {
  let t = 0;
  stats.tick(t);
  for (const gap of gaps) stats.tick((t += gap));
  return stats;
}

describe('the frame-time readout', () => {
  it('says nothing until frames come', () => {
    expect(new FrameStats().describe()).toBe('frames …');
  });

  it('finds the refresh rate and counts no late frames in a steady run', () => {
    const stats = run(new FrameStats(), Array(120).fill(1000 / 60));
    expect(stats.all).toEqual({ frames: 120, late: 0, veryLate: 0, worst: expect.closeTo(16.7, 1) });
    expect(stats.describe()).toMatch(/^60 Hz · since reset: 120 frames, late 0 \(0\.0 %\), very late 0, worst 17 ms · last 10 s: late 0, very late 0, worst 17 ms$/);
  });

  it('counts a missed frame as late and two or more as very late, at any refresh rate', () => {
    const at120 = run(new FrameStats(), [...Array(60).fill(1000 / 120), 2 * (1000 / 120), ...Array(60).fill(1000 / 120), 4 * (1000 / 120)]);
    expect(at120.all).toMatchObject({ frames: 122, late: 2, veryLate: 1 });
    expect(Math.round(1000 / at120.typical)).toBe(120);
    expect(at120.recent()).toMatchObject({ late: 2, veryLate: 1, worst: expect.closeTo(33.3, 1) });
  });

  it('keeps the recent counts to the last 10 seconds', () => {
    const stats = run(new FrameStats(), [...Array(60).fill(1000 / 60), 50, ...Array(700).fill(1000 / 60)]);
    expect(stats.all.late).toBe(1);
    expect(stats.recent().late).toBe(0);
  });

  it('ignores a pause (the page hidden) and starts again on reset', () => {
    const stats = run(new FrameStats(), [...Array(60).fill(1000 / 60), 5000, 1000 / 60]);
    expect(stats.all).toMatchObject({ frames: 61, late: 0 });
    stats.reset();
    expect(stats.all.frames).toBe(0);
    expect(stats.describe()).toBe('frames …');
  });
});
