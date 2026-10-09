import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { Game } from '../src/sim/game.js';
import { Banana } from '../src/sim/banana.js';
import { Liana } from '../src/sim/liana.js';
import { Monkey, MonkeyState, slipSteps } from '../src/sim/monkey.js';
import { createInput } from '../src/input.js';
import { settingsLine } from '../src/render/hud.js';
import { createObstacle, mayBeBoosted, rulesFor } from '../src/sim/generator.js';
import { forcedReleaseStep, longestRun, movingWindow, PERIODS, validReleaseSteps } from '../src/sim/feasibility.js';
import {
  BOOST_GRABS,
  ENTRY_RADII,
  FLOW_GRIP,
  HOLD_GRIP,
  HOLD_SLIDE_TIME,
  LIANA_LENGTH,
  MAX_ENTRY_RADIUS,
  SIM_DT,
  START_GRIP,
  SWING_PERIOD,
} from '../src/config.js';
import { FORWARD_RELEASE_STEP, flyUntilGrab, stepN } from './helpers.js';

// A world with no obstacles and bananas only where given (gap → [x, y]).
function world({ spots = {}, ...options } = {}) {
  return new World({
    makeObstacle: () => null,
    makeBanana: (seed, gap) => (spots[gap] ? new Banana(gap, ...spots[gap]) : null),
    ...options,
  });
}

// Steps a monkey holding on at `entryRadius` until the grip gives; returns the steps
// and the grip radius at each.
function holdUntilOff(entryRadius, period = SWING_PERIOD, catchSpeed = 0) {
  const liana = new Liana(0, 0);
  const monkey = new Monkey();
  monkey.vx = 1;
  monkey.vy = catchSpeed;
  monkey.holds = true;
  monkey.boostGrabs = period === SWING_PERIOD ? 0 : 1;
  monkey.boostPeriod = period;
  monkey.grab(liana, entryRadius);
  const radii = [];
  let steps = 0;
  while (!monkey.forcedOff && steps < 5000) {
    liana.step(SIM_DT);
    monkey.step(SIM_DT);
    radii.push(monkey.gripRadius);
    steps++;
  }
  return { steps, radii };
}

describe('slipping off (G)', () => {
  it('holds a catch from HOLD_GRIP down still where it caught: the grip never moves up', () => {
    for (const r of [HOLD_GRIP, 370, MAX_ENTRY_RADIUS, LIANA_LENGTH]) {
      const { radii } = holdUntilOff(r, SWING_PERIOD, 300);
      expect(radii.every((x) => x === Math.min(r, MAX_ENTRY_RADIUS))).toBe(true);
    }
  });

  it('slides a catch above HOLD_GRIP down to it, braking to a stop within HOLD_SLIDE_TIME', () => {
    for (const r of [60, FLOW_GRIP, 330, HOLD_GRIP - 1]) {
      for (const speed of [0, 280, 600]) {
        const { radii } = holdUntilOff(r, SWING_PERIOD, speed);
        const settled = radii.findIndex((x) => x === HOLD_GRIP);
        expect(settled).toBeGreaterThanOrEqual(0);
        expect(settled).toBeLessThanOrEqual(Math.round(HOLD_SLIDE_TIME / SIM_DT));
        expect(radii.slice(settled).every((x) => x === HOLD_GRIP)).toBe(true);
        // Down only, slowing as it goes.
        const moves = [r, ...radii.slice(0, settled + 1)].map((x, i, all) => (i ? x - all[i - 1] : 0)).slice(1);
        expect(moves.every((m) => m > 0)).toBe(true);
        for (let i = 1; i < moves.length; i++) expect(moves[i]).toBeLessThan(moves[i - 1] + 1e-9);
      }
    }
  });

  it('starts the slide at the speed the monkey came in along the rope, when that is fast enough', () => {
    // 40 px at 600 px/s: braking evenly, it stops after 2 · 40 / 600 s.
    const { radii } = holdUntilOff(310, SWING_PERIOD, 600);
    expect(radii[0] - 310).toBeCloseTo(600 * SIM_DT, 0);
    expect(radii.findIndex((x) => x === HOLD_GRIP)).toBe(Math.ceil((2 * 40) / 600 / SIM_DT) - 1);
  });

  it('hangs at HOLD_GRIP before the run and on a respawn, so the grip does not move then', () => {
    const w = world({ slip: false, players: 2, lives: 2 });
    expect(w.monkeys.map((m) => m.gripRadius)).toEqual([HOLD_GRIP, HOLD_GRIP]);
    w.setSlip(true);
    expect(w.monkeys.map((m) => m.gripRadius)).toEqual([START_GRIP, START_GRIP]);
    w.setSlip(false);
    expect(w.monkeys.map((m) => m.gripRadius)).toEqual([HOLD_GRIP, HOLD_GRIP]);
    w.start();
    for (let i = 0; i < 60; i++) {
      w.step(SIM_DT);
      expect(w.monkey.gripRadius).toBe(HOLD_GRIP);
    }
    w.eliminate(0, 'test');
    let respawned = false;
    for (let i = 0; i < 400 && !respawned; i++) {
      w.step(SIM_DT);
      respawned = w.takeEvents().some((e) => e.type === 'respawn');
    }
    expect(respawned).toBe(true);
    for (let i = 0; i < 60; i++) {
      expect(w.monkey.gripRadius).toBe(HOLD_GRIP);
      w.step(SIM_DT);
    }
  });

  it('lets go, tired, when a slip from the catch (or from FLOW_GRIP below it) would reach the tip', () => {
    for (const period of Object.values(PERIODS)) {
      for (const r of [60, ...ENTRY_RADII, LIANA_LENGTH]) {
        const expected = slipSteps(Math.min(r, MAX_ENTRY_RADIUS, FLOW_GRIP), 0, 1, period);
        expect(holdUntilOff(r, period).steps).toBe(expected);
        expect(forcedReleaseStep(r, 1, 0, period, true)).toBe(expected);
      }
    }
  });

  it('forces a release in the world, warning with the tip countdown first', () => {
    const w = world({ slip: false });
    w.start();
    const { monkey } = w;
    const steps = slipSteps(START_GRIP);
    stepN(w, 60);
    expect(monkey.gripRadius).toBe(HOLD_GRIP);
    expect(monkey.tipTime).toBeCloseTo((steps - 60) * SIM_DT, 9);
    stepN(w, steps - 61);
    expect(monkey.state).toBe(MonkeyState.HANGING);
    w.takeEvents();
    w.step(SIM_DT);
    expect(w.takeEvents()).toEqual([{ type: 'release', liana: 0, player: 0, forced: true }]);
    // A forward hop.
    expect(monkey.vx).toBeGreaterThan(0);
  });

  it('carries an idle monkey from liana to liana over empty gaps', () => {
    const w = world({ slip: false });
    w.start();
    for (let liana = 1; liana <= 4; liana++) expect(flyUntilGrab(w, 2000)).toBe(liana);
  });

  it('takes effect from the next grab, both ways', () => {
    const w = world();
    w.start();
    stepN(w, 30);
    w.setSlip(false);
    expect(w.monkey.holds).toBe(false);
    stepN(w, FORWARD_RELEASE_STEP - 30);
    w.release();
    expect(flyUntilGrab(w)).toBe(1);
    expect(w.monkey.holds).toBe(true);
    w.setSlip(true);
    stepN(w, Math.round(HOLD_SLIDE_TIME / SIM_DT));
    const held = w.monkey.gripRadius;
    expect(held).toBeGreaterThanOrEqual(HOLD_GRIP);
    stepN(w, 20);
    expect(w.monkey.gripRadius).toBe(held);
    expect(w.monkey.holds).toBe(true);
  });

  it('starts the run with the setting chosen on the title screen', () => {
    const w = world();
    w.setSlip(false);
    w.start();
    expect(w.monkey.holds).toBe(true);
  });

  it(`keeps every generated gap's windows with the grip held`, () => {
    let checked = 0;
    for (const seed of [3, 33, 333, 3333]) {
      for (let gap = 1; gap <= 70; gap++) {
        const o = createObstacle(seed, gap);
        if (!o) continue;
        const { minSteps, boosted } = rulesFor(gap, mayBeBoosted(seed, gap));
        const inGap = o.inGap(0);
        for (const period of boosted ? Object.values(PERIODS) : [SWING_PERIOD]) {
          const length = o.moving
            ? movingWindow(inGap, minSteps, period, true)
            : Math.min(...ENTRY_RADII.map((r) => longestRun(validReleaseSteps(inGap, r, 0, 1, 0, period, true).valid).length));
          expect({ seed, gap, period, ok: length >= minSteps }).toEqual({ seed, gap, period, ok: true });
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(250);
  }, 120_000);
});

describe('bananas off (B)', () => {
  // Where the monkey is `steps` steps into the forward flight from liana 0.
  function flightPoint(steps) {
    const probe = world();
    stepN(probe, FORWARD_RELEASE_STEP);
    return probe.predictFlight().path[steps];
  }

  it('hides bananas and takes none, and brings back the ones not taken', () => {
    const p = flightPoint(40);
    const w = world({ spots: { 0: [p.x, p.y] } });
    w.setBananas(false);
    expect(w.bananaAt(0)).toBeNull();
    stepN(w, FORWARD_RELEASE_STEP);
    w.release();
    w.takeEvents();
    flyUntilGrab(w);
    expect(w.score).toBe(0);
    expect(w.monkey.boostGrabs).toBe(0);
    w.setBananas(true);
    expect(w.bananaAt(0)).not.toBeNull();
  });

  it('ends every boost', () => {
    const w = world({ players: 2 });
    for (const m of w.monkeys) m.boostGrabs = BOOST_GRABS;
    w.setBananas(false);
    expect(w.monkeys.map((m) => m.boostGrabs)).toEqual([0, 0]);
  });
});

describe('settings in the game', () => {
  const makeGame = () =>
    new Game({ createWorld: (options) => new World({ ...options, makeObstacle: () => null, makeBanana: () => null }) });

  it('applies to every world, and to the next matches', () => {
    const game = makeGame();
    game.selectMode('split');
    game.toggleSlip();
    game.toggleBananas();
    expect(game.worlds.map((w) => [w.slip, w.bananasOn])).toEqual([
      [false, false],
      [false, false],
    ]);
    game.selectMode('solo');
    expect([game.world.slip, game.world.bananasOn]).toEqual([false, false]);
    game.toggleSlip();
    expect([game.world.slip, game.world.bananasOn]).toEqual([true, false]);
  });

  it('starts with the settings it is given, in every world', () => {
    const game = new Game({
      slip: false,
      bananas: false,
      createWorld: (options) => new World({ ...options, makeObstacle: () => null, makeBanana: () => null }),
    });
    expect([game.slip, game.bananas, game.world.slip, game.world.bananasOn, game.world.monkey.holds]).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    game.selectMode('split');
    expect(game.worlds.map((w) => [w.slip, w.bananasOn])).toEqual([
      [false, false],
      [false, false],
    ]);
  });

  it('names the settings for the HUD in debug mode only', () => {
    for (const slip of [true, false]) for (const bananas of [true, false]) expect(settingsLine({ slip, bananas }, false)).toBe('');
    expect(settingsLine({ slip: true, bananas: false }, true)).toBe('Slipping on  ·  Bananas off');
    expect(settingsLine({ slip: false, bananas: true }, true)).toBe('Slipping off  ·  Bananas on');
  });
});

describe('setting keys', () => {
  const keydown = (target, code, repeat = false) =>
    target.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat }));

  it('toggles slipping on G and bananas on B, also while presses are not accepted', () => {
    const target = new EventTarget();
    const input = createInput(target, null, { accepts: () => false });
    keydown(target, 'KeyG');
    keydown(target, 'KeyG', true);
    keydown(target, 'KeyB');
    keydown(target, 'KeyB');
    expect(input.consumeSlipToggle()).toBe(true);
    expect(input.consumeSlipToggle()).toBe(false);
    expect(input.consumeBananasToggle()).toBe(false);
    expect(input.consumeModePick()).toBeNull();
  });
});
