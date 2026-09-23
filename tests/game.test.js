import { describe, it, expect } from 'vitest';
import { Game, GameState } from '../src/sim/game.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { GAMEOVER_INPUT_LOCK_MS, SIM_DT } from '../src/config.js';
import { FALL_RELEASE_STEP, FORWARD_RELEASE_STEP, emptyWorld, lowRockWorld } from './helpers.js';

function stepFor(game, seconds) {
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) game.step(SIM_DT);
}

describe('Game state machine', () => {
  it('starts in READY', () => {
    expect(new Game().state).toBe(GameState.READY);
  });

  it('swings the monkey on the first liana while READY', () => {
    const game = new Game();
    stepFor(game, 0.3);
    expect(game.world.monkey.state).toBe(MonkeyState.HANGING);
    expect(game.world.monkey.liana.angle).not.toBe(0);
  });

  it('Space moves READY to PLAYING without releasing', () => {
    const game = new Game();
    expect(game.press()).toBe(true);
    expect(game.state).toBe(GameState.PLAYING);
    expect(game.world.monkey.state).toBe(MonkeyState.HANGING);
  });

  it('Space while PLAYING releases the monkey without changing state', () => {
    const game = new Game();
    game.press();
    expect(game.press()).toBe(false);
    expect(game.state).toBe(GameState.PLAYING);
    expect(game.world.monkey.state).toBe(MonkeyState.AIRBORNE);
  });

  it('starts a fresh world on restart', () => {
    const game = new Game();
    game.press();
    game.press();
    game.end();
    const oldWorld = game.world;
    stepFor(game, GAMEOVER_INPUT_LOCK_MS / 1000);
    game.press();
    expect(game.world).not.toBe(oldWorld);
    expect(game.world.monkey.state).toBe(MonkeyState.HANGING);
  });

  it('end() moves PLAYING to GAME_OVER and is ignored otherwise', () => {
    const game = new Game();
    game.end();
    expect(game.state).toBe(GameState.READY);
    game.press();
    game.end();
    expect(game.state).toBe(GameState.GAME_OVER);
  });

  it('locks restart input for GAMEOVER_INPUT_LOCK_MS after game over', () => {
    const game = new Game();
    game.press();
    game.end();

    stepFor(game, GAMEOVER_INPUT_LOCK_MS / 1000 - SIM_DT);
    expect(game.canRestart()).toBe(false);
    expect(game.press()).toBe(false);
    expect(game.state).toBe(GameState.GAME_OVER);

    game.step(SIM_DT);
    expect(game.canRestart()).toBe(true);
    expect(game.press()).toBe(true);
    expect(game.state).toBe(GameState.PLAYING);
  });

  it('resets score on a new run and keeps the session best', () => {
    const game = new Game();
    game.press();
    game.score = 7;
    game.end();
    expect(game.best).toBe(7);

    stepFor(game, GAMEOVER_INPUT_LOCK_MS / 1000);
    game.press();
    expect(game.score).toBe(0);
    game.score = 3;
    game.end();
    expect(game.best).toBe(7);
  });

  it('falling ends the run, and Space restarts it after the input lock', () => {
    const game = new Game({ createWorld: emptyWorld });
    game.press();
    stepFor(game, FALL_RELEASE_STEP * SIM_DT);
    game.press();
    let steps = 0;
    while (game.state === GameState.PLAYING && steps++ < 600) game.step(SIM_DT);
    expect(game.state).toBe(GameState.GAME_OVER);
    expect(game.world.alive).toBe(false);

    // Presses during the lock are ignored.
    expect(game.press()).toBe(false);
    stepFor(game, GAMEOVER_INPUT_LOCK_MS / 1000 - 0.1);
    expect(game.press()).toBe(false);
    stepFor(game, 0.1);
    expect(game.press()).toBe(true);
    expect(game.state).toBe(GameState.PLAYING);
    expect(game.world.alive).toBe(true);
    expect(game.world.monkey.liana.index).toBe(0);

    // The new run plays normally.
    stepFor(game, FORWARD_RELEASE_STEP * SIM_DT);
    game.press();
    stepFor(game, 1);
    expect(game.state).toBe(GameState.PLAYING);
    expect(game.world.monkey.liana.index).toBe(1);
  });

  describe('score and best', () => {
    function playUntilOver(game) {
      let steps = 0;
      while (game.state === GameState.PLAYING && steps++ < 2000) game.step(SIM_DT);
    }

    function restart(game) {
      stepFor(game, GAMEOVER_INPUT_LOCK_MS / 1000);
      expect(game.press()).toBe(true);
    }

    // Hops forward `hops` times, then misses.
    function playRun(game, hops) {
      for (let i = 0; i < hops; i++) {
        stepFor(game, FORWARD_RELEASE_STEP * SIM_DT);
        game.press();
        while (game.world.monkey.state === MonkeyState.AIRBORNE) game.step(SIM_DT);
      }
      stepFor(game, FALL_RELEASE_STEP * SIM_DT);
      game.press();
      playUntilOver(game);
      expect(game.state).toBe(GameState.GAME_OVER);
    }

    it('tracks the world score during the run', () => {
      const game = new Game({ createWorld: lowRockWorld });
      game.press();
      // Lianas 2 and 3 are reached past gaps 1 and 2; gap 0 is empty.
      playRun(game, 3);
      expect(game.score).toBe(2);
      expect(game.best).toBe(2);
    });

    it('flags a run that beats the previous best', () => {
      const game = new Game({ createWorld: lowRockWorld });
      game.press();
      playRun(game, 3);
      expect(game.newBest).toBe(true); // 2 > 0

      restart(game);
      expect(game.newBest).toBe(false);
      playRun(game, 2);
      expect(game.newBest).toBe(false); // 1 < 2

      restart(game);
      playRun(game, 3);
      expect(game.newBest).toBe(false); // equal is not new

      restart(game);
      playRun(game, 1);
      expect(game.score).toBe(0);
      expect(game.newBest).toBe(false);
    });

    it('keeps the best score across restarts and resets it on a new page', () => {
      const game = new Game({ createWorld: lowRockWorld });
      game.press();
      playRun(game, 4);
      expect(game.best).toBe(3);

      restart(game);
      expect(game.score).toBe(0);
      expect(game.best).toBe(3);
      playRun(game, 2);
      expect(game.score).toBe(1);
      expect(game.best).toBe(3);

      restart(game);
      playRun(game, 6);
      expect(game.best).toBe(5);

      // A page reload creates a new Game.
      expect(new Game({ createWorld: lowRockWorld }).best).toBe(0);
    });
  });

  it('drains world events every step', () => {
    const game = new Game({ createWorld: emptyWorld });
    game.press();
    stepFor(game, FORWARD_RELEASE_STEP * SIM_DT);
    game.press();
    stepFor(game, 1);
    expect(game.world.events).toEqual([]);
  });
});
