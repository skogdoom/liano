import { describe, it, expect } from 'vitest';
import { stageFor } from '../src/sim/stages.js';

describe('stages', () => {
  it('are keyed on the obstacle index (the gap)', () => {
    expect([1, 15, 16, 30, 31, 50, 51, 500].map((gap) => stageFor(gap).number)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(stageFor(-3).number).toBe(1);
    expect([1, 16, 31, 51].map((gap) => stageFor(gap).movingShare)).toEqual([0, 0.25, 0.5, 0.7]);
  });
});
