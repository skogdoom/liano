import { describe, it, expect } from 'vitest';
import { Game, GameState } from '../src/sim/game.js';
import { GAMEOVER_INPUT_LOCK_MS, SIM_DT } from '../src/config.js';

function stepFor(game, seconds) {
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) game.step(SIM_DT);
}

describe('Game state machine', () => {
  it('starts in READY', () => {
    expect(new Game().state).toBe(GameState.READY);
  });

  it('Space moves READY to PLAYING', () => {
    const game = new Game();
    expect(game.press()).toBe(true);
    expect(game.state).toBe(GameState.PLAYING);
  });

  it('Space while PLAYING does not change state', () => {
    const game = new Game();
    game.press();
    expect(game.press()).toBe(false);
    expect(game.state).toBe(GameState.PLAYING);
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
});
