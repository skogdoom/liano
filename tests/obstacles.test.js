import { describe, it, expect } from 'vitest';
import { Obstacle, ObstacleType, OBSTACLE_TYPES } from '../src/sim/obstacle.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { LianaState } from '../src/sim/liana.js';
import { LIANA_SPACING, MONKEY_RADIUS, GRIP_RADIUS, ANCHOR_Y, SIM_DT, SWING_PERIOD } from '../src/config.js';
import { FORWARD_RELEASE_STEP, emptyWorld, worldWith, stepN, releaseAfter, flyUntilGrab, throwMonkey } from './helpers.js';

describe('obstacle hitboxes', () => {
  it('has a hitbox for every type', () => {
    expect(OBSTACLE_TYPES.sort()).toEqual(['branch', 'rock', 'thornBush']);
    for (const type of OBSTACLE_TYPES) expect(new Obstacle(0, type, 0, 0).hitbox.length).toBeGreaterThan(0);
  });

  it('puts the scoring line at the right edge of the hitbox', () => {
    expect(new Obstacle(0, ObstacleType.BRANCH, 1000, 300).right).toBe(1080);
    expect(new Obstacle(0, ObstacleType.ROCK, 1000, 300).right).toBe(1036);
    expect(new Obstacle(0, ObstacleType.THORN_BUSH, 1000, 300).right).toBe(1056);
  });

  it('rock is a circle', () => {
    const rock = new Obstacle(0, ObstacleType.ROCK, 0, 0);
    expect(rock.hitsCircle(36 + MONKEY_RADIUS, 0, MONKEY_RADIUS)).toBe(true);
    expect(rock.hitsCircle(36 + MONKEY_RADIUS + 0.1, 0, MONKEY_RADIUS)).toBe(false);
  });

  it('branch is a wide flat rect', () => {
    const branch = new Obstacle(0, ObstacleType.BRANCH, 0, 0);
    expect(branch.hitsCircle(79 + MONKEY_RADIUS, 0, MONKEY_RADIUS)).toBe(true);
    expect(branch.hitsCircle(81 + MONKEY_RADIUS, 0, MONKEY_RADIUS)).toBe(false);
    expect(branch.hitsCircle(0, 11 + MONKEY_RADIUS, MONKEY_RADIUS)).toBe(true);
    expect(branch.hitsCircle(0, 13 + MONKEY_RADIUS, MONKEY_RADIUS)).toBe(false);
  });

  it('thorn bush is the union of its circles', () => {
    const bush = new Obstacle(0, ObstacleType.THORN_BUSH, 0, 0);
    expect(bush.hitsCircle(-26 - 30 - MONKEY_RADIUS + 0.5, 6, MONKEY_RADIUS)).toBe(true);
    expect(bush.hitsCircle(0, -14 - 34 - MONKEY_RADIUS + 0.5, MONKEY_RADIUS)).toBe(true);
    expect(bush.hitsCircle(0, -14 - 34 - MONKEY_RADIUS - 0.5, MONKEY_RADIUS)).toBe(false);
  });
});

describe('obstacle collision', () => {
  // Position halfway along the forward flight from liana 0 to liana 1.
  function midFlightPoint() {
    const world = emptyWorld();
    releaseAfter(world, FORWARD_RELEASE_STEP);
    const path = [];
    while (world.monkey.state === MonkeyState.AIRBORNE) {
      world.step(SIM_DT);
      path.push({ x: world.monkey.x, y: world.monkey.y });
    }
    return path[Math.floor(path.length / 2)];
  }

  it('ends the run when the airborne monkey hits an obstacle', () => {
    const p = midFlightPoint();
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, p.x, p.y) });
    releaseAfter(world, FORWARD_RELEASE_STEP);
    const events = [];
    for (let i = 0; i < 300 && world.alive; i++) {
      world.step(SIM_DT);
      events.push(...world.takeEvents());
    }
    expect(events).toEqual([{ type: 'death', cause: 'obstacle' }]);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
  });

  it('does not hit the same obstacle when it is placed away from the path', () => {
    const p = midFlightPoint();
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, p.x, p.y + 100) });
    releaseAfter(world, FORWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(1);
  });

  it('ends the run while hanging when the swing reaches an obstacle', () => {
    // Where the hanging monkey's arc crosses the middle of gap 0.
    const x = LIANA_SPACING / 2;
    const y = ANCHOR_Y + Math.sqrt(GRIP_RADIUS ** 2 - x ** 2);
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, x, y) });
    const liana = world.monkey.liana;

    let stateBeforeDeath = null;
    for (let i = 0; i < SWING_PERIOD / SIM_DT && world.alive; i++) {
      stateBeforeDeath = world.monkey.state;
      world.step(SIM_DT);
    }
    expect(world.alive).toBe(false);
    expect(stateBeforeDeath).toBe(MonkeyState.HANGING);
    expect(world.takeEvents()).toEqual([{ type: 'death', cause: 'obstacle' }]);
    expect(world.monkey.liana).toBeNull();
    expect(liana.state).toBe(LianaState.SETTLING);
  });

  it('an obstacle hit wins over a grab in the same step', () => {
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, LIANA_SPACING, 200) });
    throwMonkey(world, { x: LIANA_SPACING - 10, y: 200, vx: 0, vy: 0 });
    world.step(SIM_DT);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
    expect(world.takeEvents()).toEqual([{ type: 'death', cause: 'obstacle' }]);
  });

  it('stops checking after death', () => {
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, LIANA_SPACING, 200) });
    throwMonkey(world, { x: LIANA_SPACING - 10, y: 200, vx: 0, vy: 0 });
    world.step(SIM_DT);
    world.takeEvents();
    stepN(world, 10);
    expect(world.takeEvents()).toEqual([]);
  });
});
