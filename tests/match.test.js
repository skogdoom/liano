import { describe, it, expect } from 'vitest';
import { MODES, MODE_ORDER, playerFor } from '../src/sim/match.js';
import { Game, GameState } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { GAMEOVER_INPUT_LOCK_MS, LIANA_SPACING, SIM_DT } from '../src/config.js';
import { FORWARD_RELEASE_STEP, lowRockWorld, stepN } from './helpers.js';

describe('modes', () => {
  it('orders the picker 1P, shared, split, with only 1P enabled so far', () => {
    expect(MODE_ORDER).toEqual(['solo', 'shared', 'split']);
    expect(MODE_ORDER.map((id) => MODES[id].enabled)).toEqual([true, false, false]);
    expect(MODE_ORDER.map((id) => MODES[id].players)).toEqual([1, 2, 2]);
  });

  it('maps input roles to players', () => {
    expect(playerFor('solo', 'primary')).toBe(0);
    expect(playerFor('solo', 'p1')).toBe(-1);
    expect(playerFor('shared', 'p1')).toBe(0);
    expect(playerFor('split', 'p2')).toBe(1);
    expect(playerFor('shared', 'primary')).toBe(-1);
  });
});

describe('game modes and roles', () => {
  const emptyGame = () => new Game({ createWorld: ({ players }) => new World({ players, makeObstacle: () => null }) });

  it('creates the world with the mode’s number of players', () => {
    const calls = [];
    new Game({ createWorld: (options) => (calls.push(options), new World({ ...options, makeObstacle: () => null })) });
    expect(calls).toEqual([{ players: 1 }]);
  });

  it('selects only enabled modes, and only on the title screen', () => {
    const game = emptyGame();
    expect(game.selectMode('solo')).toBe(true);
    expect(game.selectMode('shared')).toBe(false);
    expect(game.selectMode('split')).toBe(false);
    expect(game.selectMode('nope')).toBe(false);
    expect(game.mode).toBe('solo');
    game.press('primary');
    expect(game.selectMode('solo')).toBe(false);
  });

  it('starts from the title screen with Space, a tap or Enter, not with a 2P key', () => {
    for (const role of ['primary', 'start']) {
      const game = emptyGame();
      expect(game.press(role)).toBe(true);
      expect(game.state).toBe(GameState.PLAYING);
    }
    const game = emptyGame();
    expect(game.press('p1')).toBe(false);
    expect(game.press('p2')).toBe(false);
    expect(game.state).toBe(GameState.TITLE);
  });

  it('in 1P only the primary key releases the monkey', () => {
    const game = emptyGame();
    game.press('primary');
    game.step(SIM_DT);
    for (const role of ['p1', 'p2', 'start']) {
      game.press(role);
      expect(game.world.monkey.state).toBe(MonkeyState.HANGING);
    }
    game.press('primary');
    expect(game.world.monkey.state).toBe(MonkeyState.AIRBORNE);
  });

  it('restarts from the results with Space or Enter after the lock', () => {
    const game = emptyGame();
    game.press('primary');
    game.end();
    expect(game.state).toBe(GameState.RESULTS);
    stepN(game, Math.ceil(GAMEOVER_INPUT_LOCK_MS / 1000 / SIM_DT));
    expect(game.press('p1')).toBe(false);
    expect(game.press('start')).toBe(true);
    expect(game.state).toBe(GameState.PLAYING);
  });
});

describe('a world with two monkeys', () => {
  function twoMonkeys(makeObstacle = () => null) {
    return new World({ players: 2, makeObstacle });
  }

  it('starts both monkeys hanging on the first liana', () => {
    const world = twoMonkeys();
    expect(world.monkeys).toHaveLength(2);
    for (const m of world.monkeys) {
      expect(m.state).toBe(MonkeyState.HANGING);
      expect(m.liana.index).toBe(0);
    }
    expect(world.monkey).toBe(world.monkeys[0]);
  });

  it('releases only the given player’s monkey, and tags its events', () => {
    const world = twoMonkeys();
    stepN(world, FORWARD_RELEASE_STEP);
    expect(world.release(1)).toBe(true);
    expect(world.takeEvents()).toEqual([{ type: 'release', liana: 0, player: 1 }]);
    expect(world.monkeys[0].state).toBe(MonkeyState.HANGING);
    expect(world.monkeys[1].state).toBe(MonkeyState.AIRBORNE);
    for (let i = 0; i < 600 && world.monkeys[1].state === MonkeyState.AIRBORNE; i++) world.step(SIM_DT);
    expect(world.takeEvents().find((e) => e.type === 'grab')).toEqual({ type: 'grab', liana: 1, player: 1 });
  });

  it('keeps separate scores, and is alive until every monkey is dead', () => {
    const base = lowRockWorld();
    const world = new World({ players: 2, makeObstacle: (seed, gap) => base.makeObstacle(gap) });
    // Player 1 hops twice (scoring gap 1); player 2 stays on the first liana.
    for (let hop = 0; hop < 2; hop++) {
      stepN(world, FORWARD_RELEASE_STEP);
      world.release(0);
      for (let i = 0; i < 600 && world.monkeys[0].state === MonkeyState.AIRBORNE; i++) world.step(SIM_DT);
    }
    expect(world.scores).toEqual([1, 0]);
    expect(world.score).toBe(1);
    world.takeEvents();

    // Player 2 falls: a death for player 2 only.
    world.release(1);
    Object.assign(world.monkeys[1], { x: LIANA_SPACING / 2, y: 740, vx: 0, vy: 100 });
    stepN(world, 30);
    expect(world.takeEvents().filter((e) => e.type === 'death')).toEqual([{ type: 'death', cause: 'fall', player: 1 }]);
    expect(world.isAlive(1)).toBe(false);
    expect(world.alive).toBe(true);
  });

  it('keeps the world generated around the rearmost monkey', () => {
    const base = lowRockWorld();
    const world = new World({ players: 2, makeObstacle: (seed, gap) => base.makeObstacle(gap) });
    for (let hop = 0; hop < 6; hop++) {
      stepN(world, FORWARD_RELEASE_STEP);
      world.release(0);
      for (let i = 0; i < 600 && world.monkeys[0].state === MonkeyState.AIRBORNE; i++) world.step(SIM_DT);
    }
    expect(world.monkeys[0].liana.index).toBe(6);
    // Player 2 is still on liana 0; the lianas behind it stay, as do those ahead of player 1.
    expect(world.lianas.has(-1)).toBe(true);
    expect(world.lianas.has(10)).toBe(true);
  });
});
