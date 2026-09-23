import { describe, it, expect } from 'vitest';
import { Obstacle, ObstacleType } from '../src/sim/obstacle.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { World } from '../src/sim/world.js';
import { LIANA_SPACING, SIM_DT } from '../src/config.js';
import {
  FORWARD_RELEASE_STEP,
  BACKWARD_RELEASE_STEP,
  lowRockWorld,
  stepN,
  throwMonkey,
} from './helpers.js';

// Releases after `steps` and flies to the next grab, returning the liana index
// and all events on the way.
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

describe('scoring', () => {
  it('scores each obstacle passed going forward', () => {
    const world = lowRockWorld();
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 1, scores: [] }); // gap 0 is empty
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 2, scores: [1] });
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 3, scores: [2] });
    expect(world.score).toBe(2);
  });

  it('scores the next obstacle while swinging past it on a liana', () => {
    // The forward swing reaches further than any obstacle's right edge in the next gap.
    const world = lowRockWorld();
    hop(world, FORWARD_RELEASE_STEP);
    hop(world, FORWARD_RELEASE_STEP);
    expect(world.score).toBe(1);
    stepN(world, 60); // swing to the forward peak on liana 2
    expect(world.takeEvents()).toEqual([{ type: 'score', gap: 2, score: 2 }]);
  });

  it('does not re-score when flying backward and forward again', () => {
    const world = lowRockWorld();
    hop(world, FORWARD_RELEASE_STEP);
    hop(world, FORWARD_RELEASE_STEP);
    hop(world, FORWARD_RELEASE_STEP);
    expect(world.score).toBe(2);

    // The backswing release first passes gap 3 at the forward peak (scored once),
    // then flies back over gap 2 to liana 2.
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 2, scores: [3] });
    // Forward over gap 2 again to liana 3, and past gap 3 again on the swing.
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 3, scores: [] });
    // Back two lianas, over gaps 2 and 1, and forward again.
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 2, scores: [] });
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 1, scores: [] });
    expect(hop(world, BACKWARD_RELEASE_STEP)).toEqual({ liana: 2, scores: [] });
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 3, scores: [] });
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 4, scores: [] });
    expect(world.score).toBe(3);

    // A new obstacle still scores.
    expect(hop(world, FORWARD_RELEASE_STEP)).toEqual({ liana: 5, scores: [4] });
    expect(world.score).toBe(4);
  });

  describe('crossing the right edge', () => {
    // Only gap 1 has an obstacle: a rock below the test flights, built fresh on each generation.
    const rockWorld = () =>
      new World({ makeObstacle: (seed, gap) => (gap === 1 ? new Obstacle(1, ObstacleType.ROCK, 1.5 * LIANA_SPACING, 650) : null) });
    const right = 1.5 * LIANA_SPACING + 36;

    it('scores when x moves past the right edge, not before', () => {
      const world = rockWorld();
      throwMonkey(world, { x: right - 2.5, y: 100, vx: 120, vy: 0 }); // 1 px per step
      world.step(SIM_DT);
      world.step(SIM_DT);
      expect(world.score).toBe(0);
      world.step(SIM_DT);
      expect(world.score).toBe(1);
      expect(world.takeEvents()).toEqual([{ type: 'score', gap: 1, score: 1 }]);
    });

    it('does not score when crossing leftward', () => {
      const world = rockWorld();
      throwMonkey(world, { x: right + 3, y: 100, vx: -600, vy: 0 });
      stepN(world, 5);
      expect(world.score).toBe(0);
    });

    it('scores at most once even after the obstacle is culled and regenerated', () => {
      const world = rockWorld();
      throwMonkey(world, { x: right - 1, y: 100, vx: 600, vy: 0 });
      world.step(SIM_DT);
      expect(world.score).toBe(1);

      const original = world.obstacles.get(1);
      world.obstacles.delete(1);
      Object.assign(world.monkey, { x: right - 1, y: 100, vx: 600, vy: 0 });
      world.step(SIM_DT);
      expect(world.obstacles.get(1)).not.toBe(original);
      expect(world.score).toBe(1);
    });

    it('does not score once dead', () => {
      const world = rockWorld();
      throwMonkey(world, { x: right - 1, y: 100, vx: 600, vy: 0 });
      world.monkey.kill();
      world.step(SIM_DT);
      expect(world.score).toBe(0);
    });
  });
});
