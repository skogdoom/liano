import { describe, it, expect } from 'vitest';
import { Obstacle, ObstacleType, STATIC_TYPES } from '../src/sim/obstacle.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { LianaState } from '../src/sim/liana.js';
import {
  LIANA_SPACING,
  MONKEY_RADIUS,
  START_GRIP,
  ANCHOR_Y,
  SIM_DT,
  SWING_PERIOD,
  GRAVITY,
  WORLD_HEIGHT,
  DEATH_BOUNCE,
  DEATH_POP,
} from '../src/config.js';
import { FORWARD_RELEASE_STEP, emptyWorld, worldWith, stepN, releaseAfter, flyUntilGrab, throwMonkey } from './helpers.js';

describe('moving obstacles', () => {
  const motion = { period: 2, phase: 0.5, ax: 30, ay: 40, bob: 5 };

  it('follow (baseX + ax·sin u, baseY + ay·cos u + bob·sin 2u) with u = 2πt/period + phase', () => {
    const o = new Obstacle(3, ObstacleType.BIRD, 100, 200, motion);
    for (const t of [0, 0.3, 1.7, 5]) {
      const u = (2 * Math.PI * t) / 2 + 0.5;
      const p = o.positionAt(t);
      expect(p.x).toBeCloseTo(100 + 30 * Math.sin(u), 9);
      expect(p.y).toBeCloseTo(200 + 40 * Math.cos(u) + 5 * Math.sin(2 * u), 9);
      o.setTime(t);
      expect([o.x, o.y]).toEqual([p.x, p.y]);
      expect(o.positionAt(t + 2).x).toBeCloseTo(p.x, 9); // periodic
    }
    expect(o.vxAt(0.4)).toBeCloseTo((o.positionAt(0.4 + 1e-6).x - o.positionAt(0.4 - 1e-6).x) / 2e-6, 3);
  });

  it('hit where they are at the given time', () => {
    const o = new Obstacle(0, ObstacleType.SPIDER, 0, 100, { period: 2, phase: 0, ax: 0, ay: 50, bob: 0 });
    // t = 0: at y = 150; t = 1: at y = 50.
    expect(o.hitsCircleAt(0, 0, 150, 5)).toBe(true);
    expect(o.hitsCircleAt(1, 0, 150, 5)).toBe(false);
    expect(o.hitsCircleAt(1, 0, 50, 5)).toBe(true);
  });

  it('cover their whole motion in their bounds, and move between gaps', () => {
    const o = new Obstacle(2, ObstacleType.BIRD, 1750, 360, motion);
    const b = o.bounds;
    for (const p of o.pathPoints(360)) {
      expect(p.x - 16).toBeGreaterThanOrEqual(b.minX - 1e-9);
      expect(p.x + 16).toBeLessThanOrEqual(b.maxX + 1e-9);
      expect(p.y - 16).toBeGreaterThanOrEqual(b.minY - 1e-9);
      expect(p.y + 16).toBeLessThanOrEqual(b.maxY + 1e-9);
    }
    const moved = o.inGap(0);
    expect([moved.gap, moved.baseX, moved.baseY, moved.motion]).toEqual([0, 1750 - 2 * LIANA_SPACING, 360, motion]);
    expect(new Obstacle(0, ObstacleType.ROCK, 5, 6).moving).toBe(false);
  });
});

describe('obstacle hitboxes', () => {
  it('has a hitbox for every type', () => {
    expect(STATIC_TYPES.sort()).toEqual(['branch', 'rock', 'thornBush']);
    for (const type of STATIC_TYPES) expect(new Obstacle(0, type, 0, 0).hitbox.length).toBeGreaterThan(0);
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
    expect(events).toEqual([{ type: 'death', cause: 'obstacle', obstacle: 'rock', player: 0 }]);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
  });

  it('bounces the monkey back and up on a hit, then lets it fall out of the screen', () => {
    const p = midFlightPoint();
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, p.x, p.y) });
    releaseAfter(world, FORWARD_RELEASE_STEP);
    let before = null;
    while (world.alive) {
      before = { vx: world.monkey.vx, vy: world.monkey.vy };
      world.step(SIM_DT);
    }
    const vyAfterGravity = before.vy + GRAVITY * SIM_DT;
    expect(world.monkey.vx).toBeCloseTo(-DEATH_BOUNCE * before.vx, 9);
    expect(world.monkey.vy).toBeCloseTo(Math.min(vyAfterGravity, 0) - DEATH_POP, 9);
    stepN(world, 600);
    expect(world.monkey.y).toBeGreaterThan(WORLD_HEIGHT + MONKEY_RADIUS);
  });

  it('does not hit the same obstacle when it is placed away from the path', () => {
    const p = midFlightPoint();
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, p.x, p.y + 100) });
    releaseAfter(world, FORWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(1);
  });

  it('ends the run while hanging when the swing reaches an obstacle', () => {
    // Generated obstacles never sit on a swing (see feasibility tests), but the world
    // still handles one that does: here on the hanging monkey's arc.
    const x = 200;
    const y = ANCHOR_Y + Math.sqrt(START_GRIP ** 2 - x ** 2);
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, x, y) });
    const liana = world.monkey.liana;

    let stateBeforeDeath = null;
    for (let i = 0; i < SWING_PERIOD / SIM_DT && world.alive; i++) {
      stateBeforeDeath = world.monkey.state;
      world.step(SIM_DT);
    }
    expect(world.alive).toBe(false);
    expect(stateBeforeDeath).toBe(MonkeyState.HANGING);
    expect(world.takeEvents()).toEqual([{ type: 'death', cause: 'obstacle', obstacle: 'rock', player: 0 }]);
    expect(world.monkey.liana).toBeNull();
    expect(liana.state).toBe(LianaState.SETTLING);
  });

  it('an obstacle hit wins over a grab in the same step', () => {
    const world = worldWith({ 0: new Obstacle(0, ObstacleType.ROCK, LIANA_SPACING, 200) });
    throwMonkey(world, { x: LIANA_SPACING - 10, y: 200, vx: 0, vy: 0 });
    world.step(SIM_DT);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
    expect(world.takeEvents()).toEqual([{ type: 'death', cause: 'obstacle', obstacle: 'rock', player: 0 }]);
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
