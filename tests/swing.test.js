import { describe, it, expect } from 'vitest';
import { MonkeyState } from '../src/sim/monkey.js';
import { LianaState } from '../src/sim/liana.js';
import { tangentialVelocity, hangingVelocity } from '../src/sim/physics.js';
import { tipFlashOn } from '../src/render/lianaView.js';
import { slipSteps, quickSlide } from '../src/sim/monkey.js';
import { validReleaseSteps } from '../src/sim/feasibility.js';
import {
  PERIOD_STEPS,
  FORWARD_RELEASE_STEP,
  BACKWARD_RELEASE_STEP,
  emptyWorld,
  stepN,
  flyUntilGrab,
  releaseAfter,
  throwMonkey,
} from './helpers.js';
import {
  SIM_DT,
  SWING_AMPLITUDE,
  START_GRIP,
  MAX_SLIP_SPEED,
  FLOW_GRIP,
  SWING_PERIOD,
  BOOST_PERIOD,
  ENTRY_RADII,
  QUICK_SLIP_SPEED,
  SLIP_OFF_PHASE,
  MAX_ENTRY_RADIUS,
  LIANA_LENGTH,
  TIP_WARNING_TIME,
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
  it('starts hanging on liana 0 at the start grip, without slipping until the run starts', () => {
    const world = emptyWorld();
    const { monkey } = world;
    expect(monkey.state).toBe(MonkeyState.HANGING);
    expect(monkey.liana.index).toBe(0);
    expect(monkey.x).toBeCloseTo(0);
    expect(monkey.y).toBeCloseTo(ANCHOR_Y + START_GRIP);
    stepN(world, 3 * PERIOD_STEPS);
    expect(monkey.gripRadius).toBe(START_GRIP);
    world.start();
    stepN(world, 60);
    expect(monkey.slipSpeed).toBeGreaterThan(0);
    expect(monkey.gripRadius).toBeCloseTo(START_GRIP + monkey.slipSpeed * 60 * SIM_DT, 9);
  });

  it.each([
    { name: 'slow, moving right', vx: 150, vy: 50, dir: 1 },
    { name: 'fast, moving right', vx: 1400, vy: -600, dir: 1 },
    { name: 'fast, moving left', vx: -1100, vy: 300, dir: -1 },
  ])('has fixed amplitude and period regardless of arrival speed ($name)', ({ vx, vy, dir }) => {
    const world = emptyWorld();
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

  it('grabs at the contact point, slides quickly down to FLOW_GRIP, then slips steadily', () => {
    const world = emptyWorld();
    world.start();
    throwMonkey(world, { x: LIANA_SPACING - 30, y: 150, vx: 400, vy: 0 });
    expect(flyUntilGrab(world)).toBe(1);
    const { monkey } = world;
    const entry = monkey.gripRadius;
    const speed = monkey.slipSpeed;
    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeLessThanOrEqual(MAX_SLIP_SPEED);
    // The contact point: where the monkey touched the rope, about 170 px down.
    expect(entry).toBeGreaterThan(140);
    expect(entry).toBeLessThan(200);
    const quickTime = (FLOW_GRIP - entry) / QUICK_SLIP_SPEED;
    for (let i = 1; i <= 120; i++) {
      world.step(SIM_DT);
      const t = i * SIM_DT;
      const expected = t < quickTime ? entry + QUICK_SLIP_SPEED * t : FLOW_GRIP + speed * (t - quickTime);
      expect(monkey.gripRadius).toBeCloseTo(expected, 9);
      const dx = monkey.x - monkey.liana.x;
      const dy = monkey.y - monkey.liana.anchorY;
      expect(Math.hypot(dx, dy)).toBeCloseTo(monkey.gripRadius, 9);
    }
  });

  it('grips no lower than MAX_ENTRY_RADIUS when catching the tip', () => {
    const world = emptyWorld();
    world.start();
    throwMonkey(world, { x: LIANA_SPACING - 30, y: ANCHOR_Y + LIANA_LENGTH + 10, vx: 400, vy: 0 });
    expect(flyUntilGrab(world)).toBe(1);
    expect(world.monkey.gripRadius).toBeCloseTo(MAX_ENTRY_RADIUS, 0);
  });

  it('times each slip to reach the tip on the upswing to the right, no faster than MAX_SLIP_SPEED', () => {
    const offStep = Math.round(SLIP_OFF_PHASE * PERIOD_STEPS);
    for (const gripFrom of [100, 147, 250, 300, 310, 380, 399]) {
      for (const swing of [0, 17, 150, 311]) {
        for (const dir of [1, -1]) {
          const n = slipSteps(gripFrom, swing, dir);
          // After any quick slide down to FLOW_GRIP.
          const { quickTo, quickTime } = quickSlide(gripFrom);
          const speedIn = (steps) => (LIANA_LENGTH - quickTo) / (steps * SIM_DT - quickTime);
          expect(speedIn(n)).toBeLessThanOrEqual(MAX_SLIP_SPEED + 1e-9);
          // As fast as allowed: one period sooner would be too fast.
          const sooner = n - PERIOD_STEPS;
          expect(sooner * SIM_DT <= quickTime || speedIn(sooner) > MAX_SLIP_SPEED).toBe(true);
          // θ = dir · A · sin(ωt) is then right of vertical and rising.
          const t = (swing + n) * SIM_DT;
          const w = (2 * Math.PI) / (PERIOD_STEPS * SIM_DT);
          expect(dir * Math.sin(w * t)).toBeGreaterThan(0);
          expect(dir * Math.cos(w * t)).toBeGreaterThan(0);
          expect(((swing + n - (dir > 0 ? 0 : PERIOD_STEPS / 2)) % PERIOD_STEPS + PERIOD_STEPS) % PERIOD_STEPS).toBe(offStep);
        }
      }
    }
  });

  it('forces a release at the tip, flying on with the current velocity', () => {
    const world = emptyWorld();
    world.start();
    const { monkey } = world;
    const steps = slipSteps(START_GRIP);
    stepN(world, steps - 1);
    expect(monkey.state).toBe(MonkeyState.HANGING);
    world.takeEvents();
    const liana = monkey.liana;
    world.step(SIM_DT);
    expect(world.takeEvents()).toEqual([{ type: 'release', liana: 0, player: 0, forced: true }]);
    expect(monkey.state).toBe(MonkeyState.AIRBORNE);
    expect(monkey.excludedLiana).toBe(liana);
    expect(liana.angle).toBeGreaterThan(0);
    expect(liana.angularVelocity).toBeGreaterThan(0);
    const expected = hangingVelocity(LIANA_LENGTH, monkey.slipSpeed, liana.angle, liana.angularVelocity);
    expect(monkey.vx).toBeCloseTo(expected.vx, 9);
    expect(monkey.vy).toBeCloseTo(expected.vy, 9);
  });
});

describe('flow', () => {
  it('lets every catch go on at the first forward swing, boosted or not', () => {
    for (const period of [SWING_PERIOD, BOOST_PERIOD]) {
      const half = Math.round(period / SIM_DT / 2);
      for (const r of [60, 100, ...ENTRY_RADII, LIANA_LENGTH]) {
        const { valid } = validReleaseSteps(null, r, 0, 1, 0, period);
        const first = valid.indexOf(true);
        expect({ period, r, early: first >= 0 && first < half }).toEqual({ period, r, early: true });
      }
    }
  });

  it('does not throw the monkey with the quick slide', () => {
    const world = emptyWorld();
    world.start();
    throwMonkey(world, { x: LIANA_SPACING - 30, y: 60, vx: 400, vy: 0 });
    expect(flyUntilGrab(world)).toBe(1);
    world.step(SIM_DT);
    const { monkey } = world;
    const liana = monkey.liana;
    expect(monkey.gripRadius).toBeLessThan(FLOW_GRIP);
    const tangential = tangentialVelocity(monkey.gripRadius, liana.angle, liana.angularVelocity);
    world.release();
    expect(monkey.vx).toBeCloseTo(tangential.vx, 9);
    expect(monkey.vy).toBeCloseTo(tangential.vy, 9);
  });
});

describe('forced release', () => {
  it('carries an idle monkey from liana to liana over empty gaps', () => {
    const world = emptyWorld();
    world.start();
    for (let liana = 1; liana <= 4; liana++) {
      expect(flyUntilGrab(world, 2000)).toBe(liana);
    }
    expect(world.alive).toBe(true);
  });
});

describe('tip warning', () => {
  it('counts down to the tip, and blinks the vine end faster near it', () => {
    const world = emptyWorld();
    const { monkey } = world;
    expect(monkey.tipTime).toBe(Infinity);
    world.start();
    stepN(world, 60);
    expect(monkey.tipTime).toBeCloseTo((slipSteps(START_GRIP) - 60) * SIM_DT, 9);

    expect(tipFlashOn(Infinity)).toBe(false);
    expect(tipFlashOn(TIP_WARNING_TIME + 0.01)).toBe(false);
    const blinks = (from, to) => {
      let changes = 0;
      for (let t = from; t > to + 1e-9; t -= SIM_DT) if (tipFlashOn(t) !== tipFlashOn(t - SIM_DT)) changes++;
      return changes;
    };
    const half = TIP_WARNING_TIME / 2;
    expect(blinks(TIP_WARNING_TIME, half)).toBeGreaterThan(0);
    expect(blinks(half, 0)).toBeGreaterThan(blinks(TIP_WARNING_TIME, half));
  });
});

describe('release', () => {
  it.each([0, 11, 20, 54, 80, 130, 200])('keeps the tangential velocity (release after %i steps)', (steps) => {
    const world = emptyWorld();
    stepN(world, steps);
    const { monkey } = world;
    const liana = monkey.liana;
    const expected = tangentialVelocity(START_GRIP, liana.angle, liana.angularVelocity);
    const before = { x: monkey.x, y: monkey.y };

    expect(world.release()).toBe(true);
    expect(monkey.state).toBe(MonkeyState.AIRBORNE);
    expect(monkey.vx).toBeCloseTo(expected.vx, 9);
    expect(monkey.vy).toBeCloseTo(expected.vy, 9);
    // Position is continuous across the release.
    expect(monkey.x).toBe(before.x);
    expect(monkey.y).toBe(before.y);
  });

  it('adds the slip along the rope to the tangential velocity (unit tested)', () => {
    const world = emptyWorld();
    world.start();
    stepN(world, 50);
    const { monkey } = world;
    const liana = monkey.liana;
    const tangential = tangentialVelocity(monkey.gripRadius, liana.angle, liana.angularVelocity);
    world.release();
    expect(monkey.vx).toBeCloseTo(tangential.vx + monkey.slipSpeed * Math.sin(liana.angle), 9);
    expect(monkey.vy).toBeCloseTo(tangential.vy + monkey.slipSpeed * Math.cos(liana.angle), 9);
  });

  it('matches the slipping motion around the release', () => {
    const probe = emptyWorld();
    probe.start();
    stepN(probe, 30);
    const p0 = { x: probe.monkey.x, y: probe.monkey.y };
    stepN(probe, 2);
    const p2 = { x: probe.monkey.x, y: probe.monkey.y };

    const world = emptyWorld();
    world.start();
    releaseAfter(world, 31);
    expect(world.monkey.vx).toBeCloseTo((p2.x - p0.x) / (2 * SIM_DT), 0);
    expect(world.monkey.vy).toBeCloseTo((p2.y - p0.y) / (2 * SIM_DT), 0);
  });

  it('matches the hanging motion around the release', () => {
    // Positions one step before and after the release time, from an identical world.
    const probe = emptyWorld();
    stepN(probe, 30);
    const p0 = { x: probe.monkey.x, y: probe.monkey.y };
    stepN(probe, 2);
    const p2 = { x: probe.monkey.x, y: probe.monkey.y };

    const world = emptyWorld();
    releaseAfter(world, 31);
    expect(world.monkey.vx).toBeCloseTo((p2.x - p0.x) / (2 * SIM_DT), 0);
    expect(world.monkey.vy).toBeCloseTo((p2.y - p0.y) / (2 * SIM_DT), 0);
  });

  it('is ignored while airborne', () => {
    const world = emptyWorld();
    releaseAfter(world, 10);
    const { vx, vy } = world.monkey;
    expect(world.release()).toBe(false);
    expect(world.takeEvents()).toEqual([]);
    expect(world.monkey.vx).toBe(vx);
    expect(world.monkey.vy).toBe(vy);
  });

  it('lets the released liana settle back to vertical', () => {
    const world = emptyWorld();
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
    const world = emptyWorld();
    releaseAfter(world, FORWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(1);
    expect(world.monkey.state).toBe(MonkeyState.HANGING);
    expect(world.monkey.liana).toBe(world.lianas.get(1));
    expect(world.lianas.get(1).state).toBe(LianaState.SWINGING);
  });

  it('cannot regrab the liana just released', () => {
    const world = emptyWorld();
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
    const world = emptyWorld();
    releaseAfter(world, FORWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(1);
    world.release();
    world.takeEvents();
    Object.assign(world.monkey, { x: 10, y: 200, vx: -10, vy: 0 });
    expect(flyUntilGrab(world)).toBe(0);
  });

  it('can release on the backswing and land on the previous liana', () => {
    const world = emptyWorld();
    releaseAfter(world, FORWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(1);

    releaseAfter(world, BACKWARD_RELEASE_STEP);
    expect(world.monkey.vx).toBeLessThan(0);
    expect(flyUntilGrab(world)).toBe(0);
    // The swing on liana 0 now starts moving backward.
    stepN(world, 30);
    expect(world.monkey.liana.angle).toBeLessThan(0);
  });

  it('can fly back to the previous liana while the grip slips', () => {
    // Backward windows need a grip no lower than about 340 px before the forced release;
    // the start grip has one on its first backswing.
    const world = emptyWorld();
    world.start();
    releaseAfter(world, BACKWARD_RELEASE_STEP);
    expect(world.monkey.vx).toBeLessThan(0);
    expect(flyUntilGrab(world)).toBe(-1);
  });

  it('can fly backward from the start liana', () => {
    const world = emptyWorld();
    releaseAfter(world, BACKWARD_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBe(-1);
  });
});
