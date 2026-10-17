import { describe, it, expect } from 'vitest';
import { FrameTrace } from '../src/platform/frameTrace.js';

const frame = (timestamp, overrides = {}) => ({
  timestamp, rawMs: 1000 / 60, cpuMs: 2, stepMs: 1000 / 60,
  paused: false, alive: true, world: 1,
  panes: [{ cameraX: timestamp, monkeyScreen: { x: timestamp, y: 10 }, ropeRotation: 0 }],
  ...overrides,
});

describe('Phaser frame recording', () => {
  it('retains the latest frames in chronological order when the buffer wraps', () => {
    const trace = new FrameTrace(3);
    for (let i = 0; i < 7; i++) trace.add(frame(i));
    const result = trace.snapshot({ presentationMeasured: false });
    expect(result.frames.map((f) => f.timestamp)).toEqual([4, 5, 6]);
    expect(result.summary.total).toBe(7);
    expect(result.info.presentationMeasured).toBe(false);
  });

  it('preserves a late frame and measures submission time independently of its gap', () => {
    const trace = new FrameTrace();
    for (let i = 0; i < 10; i++) trace.add(frame(i));
    trace.add(frame(11, { rawMs: 70, cpuMs: 1 }));
    const result = trace.snapshot();
    expect(result.summary.late).toBe(1);
    expect(result.summary.cpuP99Ms).toBe(2);
    expect(result.frames.at(-1).rawMs).toBe(70);
  });

  it('counts repeated active poses without counting pauses, game-over or resets', () => {
    const trace = new FrameTrace();
    const still = { panes: [{ cameraX: 1, monkeyScreen: { x: 2, y: 3 }, ropeRotation: 0.1 }] };
    trace.add(frame(1, still));
    trace.add(frame(2, still));
    trace.add(frame(3, { ...still, paused: true, stepMs: 0 }));
    trace.add(frame(4, { ...still, alive: false }));
    trace.add(frame(5, { ...still, world: 2 }));
    expect(trace.snapshot().summary.unchangedMovingPoses).toBe(1);
    expect(new FrameTrace().snapshot().summary.typicalMs).toBeNull();
  });
});
