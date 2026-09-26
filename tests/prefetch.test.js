import { describe, it, expect } from 'vitest';
import { ObstaclePrefetch, PREFETCH_AHEAD } from '../src/obstaclePrefetch.js';
import { createObstacle } from '../src/sim/generator.js';
import { solverStats } from '../src/sim/feasibility.js';
import { World } from '../src/sim/world.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { SIM_DT } from '../src/config.js';
import { windowForGrab } from './helpers.js';

// Runs obstacleWorker.js's job when flushed, the way the real worker answers later.
class FakeWorker {
  constructor() {
    this.inbox = [];
    this.onmessage = null;
  }

  postMessage(data) {
    this.inbox.push(data);
  }

  flush() {
    for (const { seed, gap } of this.inbox.splice(0)) {
      const obstacle = createObstacle(seed, gap);
      this.onmessage({ data: { seed, gap, obstacle: obstacle && obstacle.toData() } });
    }
  }
}

const SEED = 4711;

function prefetchedWorld() {
  const worker = new FakeWorker();
  const prefetch = new ObstaclePrefetch(worker);
  prefetch.reset(SEED);
  const world = new World({ seed: SEED, makeObstacle: prefetch.makeObstacle });
  return { worker, prefetch, world };
}

describe('obstacle prefetch', () => {
  it('asks for the gaps ahead of the generated ones, once each', () => {
    const { worker, prefetch, world } = prefetchedWorld();
    const last = Math.max(...world.obstacles.keys());
    prefetch.update(world.obstacles);
    prefetch.update(world.obstacles);
    expect(worker.inbox.map((m) => m.gap)).toEqual(Array.from({ length: PREFETCH_AHEAD }, (_, i) => last + 1 + i));
    expect(worker.inbox.every((m) => m.seed === SEED)).toBe(true);
  });

  it('gives the world exactly what createObstacle would, and ignores answers for an old seed', () => {
    const { worker, prefetch } = prefetchedWorld();
    worker.postMessage({ seed: SEED, gap: 40 });
    worker.flush();
    const o = prefetch.take(SEED, 40);
    expect(o.toData()).toEqual(createObstacle(SEED, 40).toData());
    prefetch.reset(SEED + 1);
    worker.onmessage({ data: { seed: SEED, gap: 41, obstacle: null } });
    expect(prefetch.ready.size).toBe(0);
  });

  it('runs no moving-obstacle solver on the main thread while playing through the stages', () => {
    const { worker, prefetch, world } = prefetchedWorld();
    world.start();
    let mainThreadRuns = 0;
    let slowest = 0;
    // Plays forward like the frame loop: the worker answers between frames.
    const frame = (steps) => {
      const runs = solverStats.movingRuns;
      const start = performance.now();
      for (let i = 0; i < steps; i++) world.step(SIM_DT);
      slowest = Math.max(slowest, performance.now() - start);
      mainThreadRuns += solverStats.movingRuns - runs;
      prefetch.update(world.obstacles);
      worker.flush();
    };
    frame(1);
    while (world.monkey.liana?.index !== 70) {
      expect(world.alive).toBe(true);
      const w = windowForGrab(world);
      for (let i = 0; i < w.start + Math.floor(w.length / 2); i += 2) frame(2);
      world.release();
      while (world.monkey.state === MonkeyState.AIRBORNE) frame(2);
    }
    expect(prefetch.misses).toBe(0);
    expect(mainThreadRuns).toBe(0);
    expect([...world.obstacles.values()].some((o) => o?.moving)).toBe(true);
    // No frame spends a frame's worth of time on generation.
    expect(slowest).toBeLessThan(16);
  });

  it('stays within 20 ms per moving gap in the worker', () => {
    createObstacle(1, 60); // warms the empty-gap flight cache
    let slowest = 0;
    let moving = 0;
    for (let gap = 16; gap < 216; gap++) {
      const start = performance.now();
      const o = createObstacle(99, gap);
      if (o.moving) {
        moving++;
        slowest = Math.max(slowest, performance.now() - start);
      }
    }
    expect(moving).toBeGreaterThan(50);
    expect(slowest).toBeLessThan(20);
  });
});
