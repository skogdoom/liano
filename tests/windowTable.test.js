import { describe, it, expect, vi } from 'vitest';
import table from '../src/sim/windowTable.json';
import { isPassable, tableIsFresh } from '../src/sim/windowTable.js';
import { computeWindowTable, isFeasible, solverStats } from '../src/sim/feasibility.js';
import { createObstacle } from '../src/sim/generator.js';
import { World } from '../src/sim/world.js';
import { STATIC_TYPES } from '../src/sim/obstacle.js';
import { OBSTACLE_Y_RANGE, SIM_DT } from '../src/config.js';

describe('precomputed window table', () => {
  it('was built from the current tunables', () => {
    expect(tableIsFresh).toBe(true);
  });

  it('matches the solver exactly (run `npm run windows` if this fails)', () => {
    expect(table).toEqual(computeWindowTable());
  });

  it('answers the same as the solver for every type and height', () => {
    const [minY, maxY] = OBSTACLE_Y_RANGE;
    for (const type of STATIC_TYPES) {
      for (let y = minY - 5; y <= maxY + 5; y++) expect(isPassable(type, y)).toBe(isFeasible(type, y));
    }
  });
});

describe('play does not run the solver', () => {
  it('generates thousands of gaps and plays through worlds with static lookups only', () => {
    // Moving obstacles need the solver; that runs in the worker (see prefetch tests).
    const before = { queries: solverStats.queries, runs: solverStats.runs };
    for (const seed of [11, 222, 3333, 44444]) {
      for (let gap = -200; gap < 800; gap++) createObstacle(seed, gap);
    }
    const world = new World({ seed: 5 });
    world.release();
    for (let i = 1; i <= 50; i++) {
      Object.assign(world.monkey, { x: i * 700 + 350, y: -400, vx: 0, vy: 0 });
      world.step(SIM_DT);
    }
    expect({ queries: solverStats.queries, runs: solverStats.runs }).toEqual(before);
  });
});

describe('a stale table', () => {
  it('is ignored with a warning, and passability falls back to the solver', async () => {
    vi.resetModules();
    const stale = { ...table, inputs: { ...table.inputs, GRAVITY: table.inputs.GRAVITY + 1 } };
    vi.doMock('../src/sim/windowTable.json', () => ({ default: stale }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('../src/sim/windowTable.js');
    expect(mod.tableIsFresh).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(mod.isPassable('rock', 150)).toBe(isFeasible('rock', 150));
    warn.mockRestore();
    vi.doUnmock('../src/sim/windowTable.json');
  });
});
