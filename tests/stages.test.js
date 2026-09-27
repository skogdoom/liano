import { describe, it, expect } from 'vitest';
import { stageFor, movingShareFor } from '../src/sim/stages.js';
import { World } from '../src/sim/world.js';
import { Game } from '../src/sim/game.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { Obstacle } from '../src/sim/obstacle.js';
import { createObstacle } from '../src/sim/generator.js';
import { LIANA_SPACING, OBSTACLE_HITBOXES, SIM_DT, STAGES } from '../src/config.js';

describe('stages', () => {
  it('are keyed on the obstacle index (the gap)', () => {
    expect([1, 15, 16, 30, 31, 50, 51, 500].map((gap) => stageFor(gap).number)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(stageFor(-3).number).toBe(1);
    expect([1, 16, 31, 51].map((gap) => stageFor(gap).movingShare)).toEqual([0.15, 0.25, 0.5, 0.7]);
  });

  it('keeps the first five obstacles static', () => {
    expect([-4, 1, 5, 6, 15, 16, 51].map(movingShareFor)).toEqual([0, 0, 0, 0.15, 0.15, 0.25, 0.7]);
  });
});

describe('stages in play', () => {
  // Flies the monkey onto liana i from just before it; returns the events of the flight.
  function reach(world, i) {
    world.release();
    world.takeEvents();
    Object.assign(world.monkey, { x: i * LIANA_SPACING - 30, y: 150, vx: 400, vy: 0 });
    const events = [];
    for (let s = 0; s < 300 && world.monkey.state === MonkeyState.AIRBORNE; s++) {
      world.step(SIM_DT);
      events.push(...world.takeEvents());
    }
    expect(world.monkey.liana?.index).toBe(i);
    return events.filter((e) => e.type === 'stage');
  }

  it('enters a stage on grabbing the liana before its first obstacle, once', () => {
    const world = new World({ makeObstacle: () => null });
    const game = new Game({ createWorld: () => world });
    game.press();
    expect(game.stage).toBe(1);
    expect(reach(world, 15)).toEqual([]);
    expect(reach(world, 16)).toEqual([{ type: 'stage', stage: 2, player: 0 }]);
    expect(game.stage).toBe(2);
    expect(reach(world, 17)).toEqual([]);
    expect(reach(world, 15)).toEqual([]); // flying back does not leave it
    expect(world.stages).toEqual([2]);
    expect(reach(world, 52)).toEqual([{ type: 'stage', stage: 4, player: 0 }]);
    expect(game.stage).toBe(4);
  });

  it('is not changed by points (bananas will add points, not obstacles)', () => {
    const world = new World({ makeObstacle: () => null });
    world.scores[0] = 500;
    expect(reach(world, 3)).toEqual([]);
    expect(world.stages).toEqual([1]);
  });

  it('gives each stage’s obstacles its scale', () => {
    for (const stage of STAGES) {
      const o = createObstacle(1, Math.max(stage.first, 1));
      expect(o.scale).toBe(stage.scale);
      const base = OBSTACLE_HITBOXES[o.type][0];
      const scaled = o.hitbox[0];
      if (base.kind === 'circle') expect(scaled.r).toBeCloseTo(base.r * stage.scale, 9);
      else expect(scaled.w).toBeCloseTo(base.w * stage.scale, 9);
      expect(Obstacle.fromData(o.toData()).hitbox).toEqual(o.hitbox);
    }
  });
});
