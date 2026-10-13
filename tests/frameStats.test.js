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
    expect(stats.describe()).toMatch(/^60 Hz · since reset: 120 frames, late 0 \(0\.0 %\), very late 0, worst 17 ms · last 10 s: late 0, very late 0, worst 17 ms, on time 17–17 ms, work 0\/0\/0 ms$/);
  });

  it('counts a missed frame as late and two or more as very late, at any refresh rate', () => {
    const at120 = run(new FrameStats(), [...Array(60).fill(1000 / 120), 2 * (1000 / 120), ...Array(60).fill(1000 / 120), 4 * (1000 / 120)]);
    expect(at120.all).toMatchObject({ frames: 122, late: 2, veryLate: 1 });
    expect(Math.round(1000 / at120.typical)).toBe(120);
    expect(at120.recent()).toMatchObject({ late: 2, veryLate: 1, worst: expect.closeTo(33.3, 1) });
  });

  it('says how far apart the frames on time came, and how long the game worked in a frame', () => {
    const stats = new FrameStats();
    let t = 0;
    stats.tick(t);
    for (let i = 0; i < 200; i++) stats.tick((t += i % 3 === 2 ? 16 : 17), i === 50 ? 12 : 1 + (i % 2));
    stats.tick((t += 34), 3); // one missed: not on time
    expect(stats.recent()).toMatchObject({ onTime: [16, 17], work: [2, 2, 12] });
  });

  it('lists the late frames with what happened in the frame before and in the late one', () => {
    const stats = new FrameStats();
    let t = 0;
    stats.tick(t);
    for (let i = 0; i < 60; i++) stats.tick((t += 1000 / 60), 1);
    stats.note('grab');
    stats.note('upload 300×60');
    stats.note('upload 300×60');
    stats.tick((t += 1000 / 60), 4);
    stats.note('new panther');
    stats.tick((t += 50), 2);
    expect(stats.lateFrames).toEqual([{ gap: expect.closeTo(50, 6), work: 4, before: 'grab, 2× upload 300×60', notes: 'new panther' }]);
    expect(stats.describe()).toMatch(/\nlate 50 ms \(work before 4 ms\): before \[grab, 2× upload 300×60\] then \[new panther\]$/);
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
