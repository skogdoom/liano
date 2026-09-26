import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { Game } from '../src/sim/game.js';
import { Banana } from '../src/sim/banana.js';
import { MonkeyState, slipSteps } from '../src/sim/monkey.js';
import { createBanana, createObstacle, hasBanana, mayBeBoosted, rulesFor } from '../src/sim/generator.js';
import { emptyGapFlights, flightHits, movingWindow, releaseWindow } from '../src/sim/feasibility.js';
import {
  BANANA_POINTS,
  BOOST_GRABS,
  BOOST_PERIOD,
  ENTRY_RADII,
  LIANA_SPACING,
  SIM_DT,
  SLIP_OFF_PHASE,
  SWING_PERIOD,
} from '../src/config.js';
import { FORWARD_RELEASE_STEP, flyUntilGrab, stepN, windowForGrab } from './helpers.js';

describe('banana placement', () => {
  it('puts bananas in about 14 % of the gaps from obstacle 1, at least 3 gaps apart', () => {
    let count = 0;
    for (const seed of [1, 2, 3]) {
      let last = -Infinity;
      for (let gap = -20; gap < 1000; gap++) {
        if (!hasBanana(seed, gap)) continue;
        expect(gap).toBeGreaterThanOrEqual(1);
        expect(gap - last).toBeGreaterThanOrEqual(3);
        last = gap;
        count++;
      }
    }
    expect(count / 3000).toBeGreaterThan(0.11);
    expect(count / 3000).toBeLessThan(0.17);
  });

  it('marks the BOOST_GRABS gaps after a banana as maybe boosted', () => {
    const seed = 7;
    // A banana with none in the BOOST_GRABS gaps before it.
    const gap = Array.from({ length: 400 }, (_, i) => i + 5).find(
      (g) => hasBanana(seed, g) && ![1, 2, 3].some((i) => hasBanana(seed, g - i)),
    );
    expect(mayBeBoosted(seed, gap)).toBe(false);
    for (let i = 1; i <= BOOST_GRABS; i++) expect(mayBeBoosted(seed, gap + i)).toBe(true);
  });

  it('places each banana on a flight that clears the obstacle', () => {
    let checked = 0;
    for (let gap = 1; checked < 40; gap++) {
      if (!hasBanana(11, gap)) continue;
      const obstacle = createObstacle(11, gap);
      const banana = createBanana(11, gap, obstacle);
      expect(banana).not.toBeNull();
      expect(createBanana(11, gap, obstacle)).toEqual(banana); // deterministic
      const local = { x: banana.x - gap * LIANA_SPACING, y: banana.y };
      const inGap = obstacle.inGap(0);
      // Some release flies through the banana and clears the obstacle.
      const onFlight = ENTRY_RADII.some((r) =>
        emptyGapFlights(r, SWING_PERIOD).flights.some(
          (f) =>
            f.path.some((p) => Math.abs(p.x - local.x) < 1e-6 && p.y === local.y) &&
            (obstacle.moving || !flightHits(inGap, f, 0)),
        ),
      );
      expect(onFlight).toBe(true);
      checked++;
    }
  });

  it(`keeps a long enough window in both swings for 1,000 seeded gaps after bananas`, () => {
    let checked = 0;
    for (const seed of [4, 44, 444, 4444, 44444, 5, 55, 555]) {
      for (let gap = 1; gap < 400 && checked < 1000; gap++) {
        if (!mayBeBoosted(seed, gap)) continue;
        const o = createObstacle(seed, gap);
        const { minSteps } = rulesFor(gap);
        for (const period of [SWING_PERIOD, BOOST_PERIOD]) {
          const length = o.moving
            ? movingWindow(o.inGap(0), minSteps, period)
            : releaseWindow(o.type, o.y, o.scale, period).length;
          expect({ seed, gap, period, ok: length >= minSteps }).toEqual({ seed, gap, period, ok: true });
        }
        checked++;
      }
    }
    expect(checked).toBe(1000);
  });
});

describe('banana pickup and boost', () => {
  // A world with no obstacles and bananas only where given (gap → [x, y]).
  function bananaWorld(spots) {
    return new World({
      makeObstacle: () => null,
      makeBanana: (seed, gap) => (spots[gap] ? new Banana(gap, ...spots[gap]) : null),
    });
  }

  // Where the monkey is `steps` steps into the forward flight from liana 0.
  function flightPoint(steps) {
    const probe = bananaWorld({});
    stepN(probe, FORWARD_RELEASE_STEP);
    return probe.predictFlight().path[steps];
  }

  it('gives BANANA_POINTS and boosts the next BOOST_GRABS grabs', () => {
    const p = flightPoint(40);
    const world = bananaWorld({ 0: [p.x, p.y] });
    const game = new Game({ createWorld: () => world });
    game.press();
    stepN(game, FORWARD_RELEASE_STEP);
    game.press();
    const events = [];
    while (world.monkey.state === MonkeyState.AIRBORNE) {
      game.step(SIM_DT);
      events.push(...game.takeEvents());
    }
    expect(events.filter((e) => e.type === 'banana')).toEqual([{ type: 'banana', gap: 0, score: BANANA_POINTS, player: 0 }]);
    expect(game.score).toBe(BANANA_POINTS);
    // This grab is the first boosted one.
    expect(world.monkey.liana.period).toBe(BOOST_PERIOD);
    expect(world.monkey.boostGrabs).toBe(BOOST_GRABS - 1);
    const periods = [];
    for (let hop = 0; hop < BOOST_GRABS; hop++) {
      const w = windowForGrab(world);
      stepN(world, w.start + Math.floor(w.length / 2));
      world.release();
      expect(flyUntilGrab(world)).toBe(hop + 2);
      periods.push(world.monkey.liana.period);
    }
    expect(periods).toEqual([BOOST_PERIOD, BOOST_PERIOD, SWING_PERIOD]);
    expect(world.monkey.boostGrabs).toBe(0);
  });

  it('can only be taken once, even after its gap is culled and regenerated', () => {
    const p = flightPoint(40);
    const world = bananaWorld({ 0: [p.x, p.y] });
    stepN(world, FORWARD_RELEASE_STEP);
    world.release();
    flyUntilGrab(world);
    expect(world.takenBananas.has(0)).toBe(true);
    world.bananas.delete(0);
    world.step(SIM_DT);
    expect(world.bananas.get(0)).not.toBeNull();
    expect(world.bananaAt(0)).toBeNull();
    // Flying through its spot again gives nothing.
    world.release();
    Object.assign(world.monkey, { x: p.x, y: p.y, vx: 0, vy: 0 });
    world.step(SIM_DT);
    expect(world.takeEvents().filter((e) => e.type === 'banana')).toEqual([]);
  });

  it('resets the count on a second banana, without stacking', () => {
    const world = bananaWorld({ 0: [100, 100], 1: [800, 100] });
    world.release();
    Object.assign(world.monkey, { x: 100, y: 100, vx: 0, vy: 0 });
    world.step(SIM_DT);
    world.monkey.boostGrabs = 1;
    Object.assign(world.monkey, { x: 800, y: 100, vx: 0, vy: 0 });
    world.step(SIM_DT);
    expect(world.monkey.boostGrabs).toBe(BOOST_GRABS);
    expect(world.scores[0]).toBe(2 * BANANA_POINTS);
  });

  it('is cleared on death', () => {
    const world = bananaWorld({ 0: [100, 100] });
    world.release();
    Object.assign(world.monkey, { x: 100, y: 100, vx: 0, vy: 0 });
    world.step(SIM_DT);
    expect(world.monkey.boostGrabs).toBe(BOOST_GRABS);
    Object.assign(world.monkey, { x: 350, y: 760, vx: 0, vy: 100 });
    stepN(world, 5);
    expect(world.alive).toBe(false);
    expect(world.monkey.boostGrabs).toBe(0);
  });

  it('times the boosted forced release on the upswing to the right too', () => {
    const steps = Math.round(BOOST_PERIOD / SIM_DT);
    expect(steps % 2).toBe(0);
    expect(SWING_PERIOD / BOOST_PERIOD).toBeCloseTo(1.35, 1);
    for (const gripFrom of [147, 300, 399]) {
      const n = slipSteps(gripFrom, 0, 1, BOOST_PERIOD);
      expect(n % steps).toBe(Math.round(SLIP_OFF_PHASE * steps));
    }
  });
});
