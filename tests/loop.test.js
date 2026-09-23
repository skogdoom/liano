import { describe, it, expect } from 'vitest';
import { createFixedStepLoop } from '../src/loop.js';

function counter(dt, maxFrameDt = 0.1) {
  const calls = [];
  const loop = createFixedStepLoop({ dt, maxFrameDt, step: (d) => calls.push(d) });
  return { loop, calls };
}

describe('fixed-step loop', () => {
  it('runs whole steps and carries the remainder', () => {
    const { loop, calls } = counter(0.01);
    const alpha = loop.advance(0.025);
    expect(calls).toHaveLength(2);
    expect(alpha).toBeCloseTo(0.5);
    loop.advance(0.005);
    expect(calls).toHaveLength(3);
  });

  it('always passes the fixed dt to step', () => {
    const { loop, calls } = counter(1 / 120);
    loop.advance(1 / 60);
    loop.advance(1 / 30);
    expect(calls.every((d) => d === 1 / 120)).toBe(true);
  });

  it('clamps long frames', () => {
    const { loop, calls } = counter(0.01, 0.1);
    loop.advance(5);
    expect(calls).toHaveLength(10);
  });

  it('ignores negative frame time', () => {
    const { loop, calls } = counter(0.01);
    loop.advance(-1);
    loop.advance(0.01);
    expect(calls).toHaveLength(1);
  });
});
