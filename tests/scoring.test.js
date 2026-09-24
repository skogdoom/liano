import { describe, it, expect } from 'vitest';
import { MonkeyState } from '../src/sim/monkey.js';
import { LIANA_SPACING, SIM_DT } from '../src/config.js';
import { FORWARD_RELEASE_STEP, BACKWARD_RELEASE_STEP, PERIOD_STEPS, lowRockWorld, stepN } from './helpers.js';

// Releases after `steps` and flies to the next grab, returning the liana index
// and the gaps scored on the way.
function hop(world, steps) {
  stepN(world, steps);
  const events = [...world.takeEvents()];
  expect(world.release()).toBe(true);
  for (let i = 0; i < 600; i++) {
    world.step(SIM_DT);
    events.push(...world.takeEvents());
    if (world.monkey.state !== MonkeyState.AIRBORNE) break;
  }
  expect(world.alive).toBe(true);
  return { liana: world.monkey.liana.index, scores: events.filter((e) => e.type === 'score').map((e) => e.gap) };
}

// Releases after `steps`, then replaces the flight with the given state.
function releaseAs(world, steps, state) {
  stepN(world, steps);
  world.release();
  world.takeEvents();
  Object.assign(world.monkey, state);
}

describe('scoring', () => {
  it('scores each obstacle when the next liana is reached going forward', () => {
    const world = lowRockWorld();
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 1, scores: [] }); // gap 0 is empty
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 2, scores: [1] });
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 3, scores: [2] });
    expect(world.score).toBe(2);
  });

  it('scores in the step the liana is grabbed, not while crossing the gap', () => {
    const world = lowRockWorld();
    hop(world, FORWARD_RELEASE_STEP);
    stepN(world, FORWARD_RELEASE_STEP);
    world.release();
    world.takeEvents();
    while (world.monkey.state === MonkeyState.AIRBORNE) {
      world.step(SIM_DT);
      const events = world.takeEvents();
      if (world.monkey.state === MonkeyState.AIRBORNE) {
        expect(events).toEqual([]);
      } else {
        expect(events).toEqual([
          { type: 'grab', liana: 2 },
          { type: 'score', gap: 1, score: 1 },
        ]);
      }
    }
  });

  it('does not score while swinging on a liana', () => {
    const world = lowRockWorld();
    hop(world, FORWARD_RELEASE_STEP);
    hop(world, FORWARD_RELEASE_STEP);
    let maxX = -Infinity;
    for (let i = 0; i < 2 * PERIOD_STEPS; i++) {
      world.step(SIM_DT);
      maxX = Math.max(maxX, world.monkey.x);
    }
    // The swing stays short of the next obstacle.
    expect(maxX).toBeLessThan(2.5 * LIANA_SPACING - 36);
    expect(world.takeEvents().filter((e) => e.type !== 'swish')).toEqual([]);
    expect(world.score).toBe(1);
  });

  it('does not score a jump that flies past the obstacle but misses the liana', () => {
    const world = lowRockWorld();
    hop(world, FORWARD_RELEASE_STEP);
    // From liana 1, over and past gap 1's rock, below the tip of liana 2.
    releaseAs(world, FORWARD_RELEASE_STEP, { x: 1.5 * LIANA_SPACING - 10, y: 450, vx: 200, vy: 0 });
    for (let i = 0; i < 300 && world.alive; i++) world.step(SIM_DT);
    expect(world.monkey.x).toBeGreaterThan(1.5 * LIANA_SPACING + 36);
    expect(world.takeEvents()).toEqual([{ type: 'death', cause: 'fall' }]);
    expect(world.score).toBe(0);
  });

  it('scores every gap crossed when flying over lianas above the canopy', () => {
    const world = lowRockWorld();
    hop(world, FORWARD_RELEASE_STEP);
    releaseAs(world, FORWARD_RELEASE_STEP, { x: 1.2 * LIANA_SPACING, y: -100, vx: 700, vy: -300 });
    const events = [];
    while (world.monkey.state === MonkeyState.AIRBORNE) {
      world.step(SIM_DT);
      events.push(...world.takeEvents());
    }
    const grabbed = world.monkey.liana.index;
    expect(grabbed).toBeGreaterThanOrEqual(3);
    const gaps = Array.from({ length: grabbed - 1 }, (_, k) => k + 1);
    expect(events.filter((e) => e.type === 'score').map((e) => e.gap)).toEqual(gaps);
    expect(world.score).toBe(gaps.length);
  });

  it('does not re-score when flying backward and forward again', () => {
    const world = lowRockWorld();
    hop(world, FORWARD_RELEASE_STEP);
    hop(world, FORWARD_RELEASE_STEP);
    hop(world, FORWARD_RELEASE_STEP);
    expect(world.score).toBe(2);

    // Back over gap 2 to liana 2, then forward over it again to liana 3.
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 2, scores: [] });
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 3, scores: [] });
    // Back two lianas, over gaps 2 and 1, and forward again.
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 2, scores: [] });
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 1, scores: [] });
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 2, scores: [] });
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 3, scores: [] });
    expect(world.score).toBe(2);

    // New obstacles still score.
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 4, scores: [3] });
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 5, scores: [4] });
    expect(world.score).toBe(4);
  });

  it('does not re-score after the obstacle is culled and regenerated', () => {
    const world = lowRockWorld();
    hop(world, FORWARD_RELEASE_STEP);
    hop(world, FORWARD_RELEASE_STEP);
    expect(world.score).toBe(1);
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 1, scores: [] });

    const original = world.obstacles.get(1);
    world.obstacles.delete(1);
    world.step(SIM_DT);
    expect(world.obstacles.get(1)).not.toBe(original);
    expect(hop(world, BACKWARD_RELEASE_STEP - 1)).toEqual({ liana: 2, scores: [] });
    expect(world.score).toBe(1);
  });
});
