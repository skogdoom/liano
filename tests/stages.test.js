import { describe, it, expect } from 'vitest';
import { stageFor, movingShareFor, timeOfDayFor, TimeOfDay, dayCycleFor, dayCycleRange } from '../src/sim/stages.js';
import { World } from '../src/sim/world.js';
import { Game } from '../src/sim/game.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { Obstacle } from '../src/sim/obstacle.js';
import { createObstacle } from '../src/sim/generator.js';
import { LIANA_SPACING, OBSTACLE_HITBOXES, SIM_DT, STAGES, STAGE_LENGTH_AFTER } from '../src/config.js';

describe('stages', () => {
  it('are keyed on the obstacle index (the gap)', () => {
    expect([1, 15, 16, 30, 31, 50, 51].map((gap) => stageFor(gap).number)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    expect(stageFor(-3).number).toBe(1);
    expect([1, 16, 31, 51].map((gap) => stageFor(gap).movingShare)).toEqual([0.12, 0.2, 0.4, 0.55]);
  });

  it('counts on every STAGE_LENGTH_AFTER obstacles after the last', () => {
    expect([51, 70, 71, 90, 91, 111, 151, 1051].map((gap) => stageFor(gap).number)).toEqual([4, 4, 5, 5, 6, 7, 9, 54]);
  });

  it('asks a little more each stage after the last, up to a limit, at the last stage\'s scale', () => {
    const last = STAGES.at(-1);
    const at = (stage) => stageFor(last.first + (stage - 4) * STAGE_LENGTH_AFTER);
    expect([4, 5, 6, 9, 14].map((n) => at(n).minWindowMs)).toEqual([60, 58, 56, 50, 40]);
    [4, 5, 6, 8, 9].forEach((n, i) => expect(at(n).movingShare).toBeCloseTo([0.55, 0.59, 0.63, 0.71, 0.75][i], 9));
    for (const n of [4, 5, 20, 200]) expect(at(n).scale).toBe(last.scale);
    // Levelled out.
    for (const n of [14, 15, 200]) expect(at(n).minWindowMs).toBe(40);
    for (const n of [9, 10, 200]) expect(at(n).movingShare).toBeCloseTo(0.75, 9);
    // Never easier than the stage before.
    for (let n = 5; n < 30; n++) {
      expect(at(n).minWindowMs).toBeLessThanOrEqual(at(n - 1).minWindowMs);
      expect(at(n).movingShare).toBeGreaterThanOrEqual(at(n - 1).movingShare);
    }
  });

  it('goes through the times of day, starting each day over after dawn', () => {
    const at = (stage) => timeOfDayFor(STAGES.at(-1).first + (stage - 4) * STAGE_LENGTH_AFTER);
    expect([1, 16, 31, 51].map(timeOfDayFor)).toEqual([TimeOfDay.DAY, TimeOfDay.LATE_AFTERNOON, TimeOfDay.DUSK, TimeOfDay.NIGHT]);
    expect([4, 5, 6, 7, 8, 9, 10].map(at)).toEqual([
      TimeOfDay.NIGHT,
      TimeOfDay.DAWN,
      TimeOfDay.DAY,
      TimeOfDay.LATE_AFTERNOON,
      TimeOfDay.DUSK,
      TimeOfDay.NIGHT,
      TimeOfDay.DAWN,
    ]);
    expect(timeOfDayFor(-3)).toBe(TimeOfDay.DAY);
  });

  it('splits the obstacles into day/night cycles, five stages each', () => {
    expect(dayCycleRange(0)).toEqual([1, 90]);
    expect(dayCycleRange(1)).toEqual([91, 190]);
    expect(dayCycleRange(2)).toEqual([191, 290]);
    let next = 1;
    for (let cycle = 0; cycle < 30; cycle++) {
      const [first, last] = dayCycleRange(cycle);
      expect(first).toBe(next);
      for (const gap of [first, Math.floor((first + last) / 2), last]) expect(dayCycleFor(gap)).toBe(cycle);
      // A cycle runs from a day stage to a dawn stage.
      expect(timeOfDayFor(first)).toBe(TimeOfDay.DAY);
      expect(timeOfDayFor(last)).toBe(TimeOfDay.DAWN);
      next = last + 1;
    }
  });

  it('keeps the first five obstacles static', () => {
    expect([-4, 1, 5, 6, 15, 16, 51].map(movingShareFor)).toEqual([0, 0, 0, 0.12, 0.12, 0.2, 0.55]);
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

  it('keeps entering stages after the last, as the sky goes on through its day', () => {
    const world = new World({ makeObstacle: () => null });
    const game = new Game({ createWorld: () => world });
    game.press();
    reach(world, 52);
    expect(reach(world, 71)).toEqual([{ type: 'stage', stage: 5, player: 0 }]);
    expect(reach(world, 91)).toEqual([{ type: 'stage', stage: 6, player: 0 }]);
    expect(game.stage).toBe(6);
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
