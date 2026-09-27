import { describe, it, expect } from 'vitest';
import { Game, GameState } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { MODE_ORDER } from '../src/sim/match.js';
import { GAMEOVER_INPUT_LOCK_MS, SIM_DT } from '../src/config.js';
import { stepN } from './helpers.js';

const lockSteps = Math.ceil(GAMEOVER_INPUT_LOCK_MS / 1000 / SIM_DT);

function game() {
  return new Game({ createWorld: (options) => new World({ ...options, makeObstacle: () => null, makeBanana: () => null }) });
}

// Drops every monkey still in until the match is over.
function playOut(g) {
  for (let i = 0; i < 40 && g.state === GameState.PLAYING; i++) {
    for (const world of g.worlds) {
      world.monkeys.forEach((m, index) => {
        if (m.state === MonkeyState.DEAD) return;
        world.release(index);
        Object.assign(m, { y: 760, vy: 100 });
      });
    }
    // Past the respawn delay, stopping as the results come up.
    for (let s = 0; s < 150 && g.state === GameState.PLAYING; s++) g.step(SIM_DT);
  }
}

describe('the full loop', () => {
  it.each(MODE_ORDER)('goes title → play → results → title in %s, with no reload', (mode) => {
    const g = game();
    expect(g.selectMode(mode)).toBe(true);
    for (let round = 0; round < 2; round++) {
      expect(g.state).toBe(GameState.TITLE);
      const titleWorlds = g.worlds;
      expect(g.press('start')).toBe(true);
      expect(g.state).toBe(GameState.PLAYING);
      stepN(g, 30);
      playOut(g);
      expect(g.state).toBe(GameState.RESULTS);
      // Not before the input lock.
      expect(g.press('menu')).toBe(false);
      stepN(g, lockSteps);
      expect(g.press('menu')).toBe(true);
      expect(g.state).toBe(GameState.TITLE);
      expect(g.mode).toBe(mode);
      expect(g.worlds).not.toBe(titleWorlds);
      expect(g.score).toBe(0);
      // A fresh title world: monkeys hanging still on the first liana.
      for (const world of g.worlds) for (const m of world.monkeys) expect(m.liana.index).toBe(0);
    }
  });

  it.each(MODE_ORDER)('quits a run in %s back to the title screen with Esc', (mode) => {
    const g = game();
    g.selectMode(mode);
    g.press('start');
    stepN(g, 30);
    g.score = 4; // the run's score, as score events set it
    expect(g.press('menu')).toBe(true);
    expect(g.state).toBe(GameState.TITLE);
    expect(g.mode).toBe(mode);
    // In single player the quit run still counts for the session best.
    expect(g.best).toBe(mode === 'solo' ? 4 : 0);
    expect(g.world.scores[0]).toBe(0);
  });

  it('can be paused with P only during a run', () => {
    const g = game();
    expect(g.pausable).toBe(false);
    g.press('start');
    expect(g.pausable).toBe(true);
    g.end();
    expect(g.pausable).toBe(false);
  });

  it('switches mode from the results straight back to the title screen', () => {
    const g = game();
    g.press('start');
    playOut(g);
    stepN(g, lockSteps);
    expect(g.selectMode('split')).toBe(true);
    expect(g.state).toBe(GameState.TITLE);
    expect(g.mode).toBe('split');
    expect(g.worlds).toHaveLength(2);
    // Not while playing.
    g.press('start');
    expect(g.selectMode('solo')).toBe(false);
  });
});
