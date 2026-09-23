import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { LianaState } from '../src/sim/liana.js';
import { tangentialVelocity } from '../src/sim/physics.js';
import {
  PERIOD_STEPS,
  FORWARD_RELEASE_STEP,
  BACKWARD_RELEASE_STEP,
  stepN,
  flyUntilGrab,
  releaseAfter,
  throwMonkey,
} from './helpers.js';
import {
  SIM_DT,
  SWING_AMPLITUDE,
  GRIP_RADIUS,
  GRIP_SLIDE_TIME,
  LIANA_SPACING,
  ANCHOR_Y,
} from '../src/config.js';

function recordSwing(world, steps) {
  const angles = [];
  for (let i = 0; i < steps; i++) {
    world.step(SIM_DT);
    angles.push(world.monkey.liana.angle);
  }
  return angles;
}

describe('swing', () => {
  it('starts hanging on liana 0 at the grip radius', () => {
    const world = new World();
    const { monkey } = world;
    expect(monkey.state).toBe(MonkeyState.HANGING);
    expect(monkey.liana.index).toBe(0);
    expect(monkey.x).toBeCloseTo(0);
    expect(monkey.y).toBeCloseTo(ANCHOR_Y + GRIP_RADIUS);
  });

  it.each([
    { name: 'slow, moving right', vx: 150, vy: 50, dir: 1 },
    { name: 'fast, moving right', vx: 1400, vy: -600, dir: 1 },
    { name: 'fast, moving left', vx: -1100, vy: 300, dir: -1 },
  ])('has fixed amplitude and period regardless of arrival speed ($name)', ({ vx, vy, dir }) => {
    const world = new World();
    const x = vx > 0 ? LIANA_SPACING - 30 : LIANA_SPACING + 30;
    throwMonkey(world, { x, y: 250, vx, vy });
    expect(flyUntilGrab(world)).toBe(1);

    const angles = recordSwing(world, 2 * PERIOD_STEPS);
    const peak = Math.max(...angles.map(Math.abs));
    expect(peak).toBeCloseTo(SWING_AMPLITUDE, 3);
    // Starts at vertical towards the arrival direction; peaks a quarter period later.
    expect(angles[PERIOD_STEPS / 4 - 1]).toBeCloseTo(dir * SWING_AMPLITUDE, 6);
    expect(angles[PERIOD_STEPS - 1]).toBeCloseTo(0, 6);
    expect(angles[2 * PERIOD_STEPS - 1]).toBeCloseTo(0, 6);
    // Periodic: same angle one period apart.
    for (let i = 0; i < PERIOD_STEPS; i += 7) {
      expect(angles[i + PERIOD_STEPS]).toBeCloseTo(angles[i], 9);
    }
  });

  it('slides from the contact point to the grip radius', () => {
    const world = new World();
    throwMonkey(world, { x: LIANA_SPACING - 30, y: 150, vx: 400, vy: 0 });
    expect(flyUntilGrab(world)).toBe(1);
    const { monkey } = world;
    expect(monkey.gripRadius).toBeLessThan(GRIP_RADIUS - 100);

    let previous = monkey.gripRadius;
    const slideSteps = Math.ceil(GRIP_SLIDE_TIME / SIM_DT);
    for (let i = 0; i < slideSteps; i++) {
      world.step(SIM_DT);
      expect(monkey.gripRadius).toBeGreaterThanOrEqual(previous);
      previous = monkey.gripRadius;
    }
    expect(monkey.gripRadius).toBeCloseTo(GRIP_RADIUS, 9);
    const dx = monkey.x - monkey.liana.x;
    const dy = monkey.y - monkey.liana.anchorY;
    expect(Math.hypot(dx, dy)).toBeCloseTo(GRIP_RADIUS, 9);
  });
});

describe('release', () => {
  it.each([0, 11, 20, 54, 80, 130, 200])('keeps the tangential velocity (release after %i steps)', (steps) => {
    const world = new World();
    stepN(world, steps);
    const { monkey } = world;
    const liana = monkey.liana;
    const expected = tangentialVelocity(GRIP_RADIUS, liana.angle, liana.angularVelocity);
    const before = { x: monkey.x, y: monkey.y };

    expect(world.release()).toBe(true);
    expect(monkey.state).toBe(MonkeyState.AIRBORNE);
    expect(monkey.vx).toBeCloseTo(expected.vx, 9);
    expect(monkey.vy).toBeCloseTo(expected.vy, 9);
    // Position is continuous across the release.
    expect(monkey.x).toBe(before.x);
    expect(monkey.y).toBe(before.y);
  });

  it('matches the hanging motion around the release', () => {
    // Positions one step before and after the release time, from an identical world.
    const probe = new World();
    stepN(probe, 30);
    const p0 = { x: probe.monkey.x, y: probe.monkey.y };
    stepN(probe, 2);
    const p2 = { x: probe.monkey.x, y: probe.monkey.y };

    const world = new World();
    releaseAfter(world, 31);
    expect(world.monkey.vx).toBeCloseTo((p2.x - p0.x) / (2 * SIM_DT), 0);
    expect(world.monkey.vy).toBeCloseTo((p2.y - p0.y) / (2 * SIM_DT), 0);
  });

  it('is ignored while airborne', () => {
    const world = new World();
    releaseAfter(world, 10);
    const { vx, vy } = world.monkey;
    expect(world.release()).toBe(false);
    expect(world.takeEvents()).toEqual([]);
    expect(world.monkey.vx).toBe(vx);
    expect(world.monkey.vy).toBe(vy);
  });

  it('lets the released liana settle back to vertical', () => {
    const world = new World();
    releaseAfter(world, 40);
    const liana = world.lianas.get(0);
    expect(liana.state).toBe(LianaState.SETTLING);
    expect(liana.angle).not.toBe(0);
    stepN(world, 20 * PERIOD_STEPS);
    expect(liana.state).toBe(LianaState.IDLE);
    expect(liana.angle).toBe(0);
  });
});

describe('grab', () => {
  it('auto-grabs the next liana on contact', () => {
    const world = new World();
    releaseAfter(world, FORWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(1);
    expect(world.monkey.state).toBe(MonkeyState.HANGING);
    expect(world.monkey.liana).toBe(world.lianas.get(1));
    expect(world.lianas.get(1).state).toBe(LianaState.SWINGING);
  });

  it('cannot regrab the liana just released', () => {
    const world = new World();
    // Released at the bottom of the swing the monkey still overlaps liana 0.
    releaseAfter(world, 0);
    world.step(SIM_DT);
    const { monkey } = world;
    expect(Math.abs(monkey.x)).toBeLessThan(22);
    expect(monkey.state).toBe(MonkeyState.AIRBORNE);
    expect(world.takeEvents()).toEqual([]);

    // Even when dropped straight onto it.
    Object.assign(monkey, { x: 5, y: 200, vx: 0, vy: 0 });
    stepN(world, 30);
    expect(monkey.state).toBe(MonkeyState.AIRBORNE);
  });

  it('can grab the previously released liana again after grabbing another one', () => {
    const world = new World();
    releaseAfter(world, FORWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(1);
    world.release();
    world.takeEvents();
    Object.assign(world.monkey, { x: 10, y: 200, vx: -10, vy: 0 });
    expect(flyUntilGrab(world)).toBe(0);
  });

  it('can release on the backswing and land on the previous liana', () => {
    const world = new World();
    releaseAfter(world, FORWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(1);

    releaseAfter(world, BACKWARD_RELEASE_STEP);
    expect(world.monkey.vx).toBeLessThan(0);
    expect(flyUntilGrab(world)).toBe(0);
    // The swing on liana 0 now starts moving backward.
    stepN(world, 30);
    expect(world.monkey.liana.angle).toBeLessThan(0);
  });

  it('can fly backward from the start liana', () => {
    const world = new World();
    releaseAfter(world, BACKWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(-1);
  });
});
