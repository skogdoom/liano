import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { Game } from '../src/sim/game.js';
import { Banana } from '../src/sim/banana.js';
import { Obstacle } from '../src/sim/obstacle.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { bananaLine } from '../src/render/hud.js';
import { createBanana, createObstacle, hasBanana } from '../src/sim/generator.js';
import { emptyGapFlights, flightHits } from '../src/sim/feasibility.js';
import { ENTRY_RADII, LIANA_SPACING, SIM_DT, SWING_PERIOD } from '../src/config.js';
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
        emptyGapFlights(r).flights.some(
          (f) =>
            f.path.some((p) => Math.abs(p.x - local.x) < 1e-6 && p.y === local.y) &&
            (obstacle.moving || !flightHits(inGap, f, 0)),
        ),
      );
      expect(onFlight).toBe(true);
      checked++;
    }
  });
});

describe('banana pickup and tally', () => {
  // A world with a low rock in every gap (so every gap crossed scores) and bananas only
  // where given (gap → [x, y]).
  function bananaWorld(spots, options = {}) {
    return new World({
      makeObstacle: (seed, gap) => new Obstacle(gap, 'rock', (gap + 0.5) * LIANA_SPACING, 620),
      makeBanana: (seed, gap) => (spots[gap] ? new Banana(gap, ...spots[gap]) : null),
      ...options,
    });
  }

  // Where the monkey is `steps` steps into the forward flight from liana 0.
  function flightPoint(steps) {
    const probe = bananaWorld({});
    stepN(probe, FORWARD_RELEASE_STEP);
    return probe.predictFlight().path[steps];
  }

  // Hops forward from the liana the monkey hangs on to the next, in its window.
  function hop(world) {
    const w = windowForGrab(world);
    stepN(world, w.start + Math.floor(w.length / 2));
    world.release();
    return flyUntilGrab(world);
  }

  it('counts a banana for its taker, without points or a faster swing', () => {
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
    expect(events.filter((e) => e.type === 'banana')).toEqual([{ type: 'banana', gap: 0, taken: 1, player: 0, pane: 0 }]);
    expect(game.score).toBe(1); // the gap crossed, nothing for the banana
    expect(world.monkey.liana.period).toBe(SWING_PERIOD);
    expect(game.playerBananas(0)).toEqual({ taken: 1, passed: 1 });
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
    expect(world.bananaTally(0)).toEqual({ taken: 1, passed: 1 });
  });

  it('counts the bananas of the gaps passed as the most there were to take', () => {
    // High above every flight: passed, never taken.
    const world = bananaWorld({ 0: [350, -300], 2: [1750, -300], 5: [3850, -300] });
    world.start();
    expect(world.bananaTally(0)).toEqual({ taken: 0, passed: 0 });
    const tallies = [];
    for (let i = 0; i < 4; i++) {
      expect(hop(world)).toBe(i + 1);
      tallies.push(world.bananaTally(0).passed);
    }
    // Gaps 0 to 3 crossed; the banana in gap 5 is not passed yet.
    expect(tallies).toEqual([1, 1, 2, 2]);
    expect(world.bananaTally(0).taken).toBe(0);
  });

  it('keeps the count through a death', () => {
    const world = bananaWorld({ 0: [100, 100] }, { lives: 2 });
    world.release();
    Object.assign(world.monkey, { x: 100, y: 100, vx: 0, vy: 0 });
    world.step(SIM_DT);
    Object.assign(world.monkey, { x: 350, y: 760, vx: 0, vy: 100 });
    stepN(world, 5);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
    expect(world.bananaTally(0)).toEqual({ taken: 1, passed: 1 });
  });

  it('in split screen counts each world on its own, and reads "taken / passed"', () => {
    const game = new Game({ createWorld: (options) => bananaWorld({ 0: [100, 100] }, options) });
    game.selectMode('split');
    game.press('start');
    const [w1] = game.worlds;
    w1.release();
    Object.assign(w1.monkey, { x: 100, y: 100, vx: 0, vy: 0 });
    game.step(SIM_DT);
    expect([game.playerBananas(0), game.playerBananas(1)]).toEqual([
      { taken: 1, passed: 1 },
      { taken: 0, passed: 0 },
    ]);
    expect([bananaLine(game, 0), bananaLine(game, 1)]).toEqual(['1 / 1', '0 / 0']);
  });

  it('in shared screen goes to the first to take it, out of the same bananas passed for both', () => {
    const world = bananaWorld({ 0: [100, 100], 1: [1050, -300] }, { players: 2, ownLianas: true, lives: 3 });
    world.start();
    world.release(0);
    Object.assign(world.monkeys[0], { x: 100, y: 100, vx: 0, vy: 0 });
    world.step(SIM_DT);
    expect([world.bananaTally(0), world.bananaTally(1)]).toEqual([
      { taken: 1, passed: 1 },
      { taken: 0, passed: 1 },
    ]);
    // Player 2 flies through the spot after: it is gone.
    world.release(1);
    Object.assign(world.monkeys[1], { x: 100, y: 100, vx: 0, vy: 0 });
    world.step(SIM_DT);
    expect(world.bananaTally(1).taken).toBe(0);
    // A gap passed by either player counts for both.
    world.scoredGapsBy[0].add(1);
    expect([world.bananaTally(0).passed, world.bananaTally(1).passed]).toEqual([2, 2]);
  });
});
