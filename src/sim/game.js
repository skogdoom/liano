import { GAMEOVER_INPUT_LOCK_MS } from '../config.js';
import { World } from './world.js';

export const GameState = Object.freeze({
  READY: 'READY',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER',
});

// Top-level flow: READY -> PLAYING -> GAME_OVER -> PLAYING ...
// Owns the current world, the run score and the best score for this page session.
// In READY the monkey already swings on the first liana; the first Space only starts the run.
export class Game {
  constructor() {
    this.world = new World();
    this.state = GameState.READY;
    this.stateTime = 0;
    this.score = 0;
    this.best = 0;
  }

  step(dt) {
    this.stateTime += dt;
    this.world.step(dt);
    if (this.state === GameState.PLAYING && !this.world.alive) this.end();
  }

  // Handles a Space press. Returns true if the press changed the game state.
  press() {
    switch (this.state) {
      case GameState.READY:
        this.#startRun();
        return true;
      case GameState.PLAYING:
        this.world.release();
        return false;
      case GameState.GAME_OVER:
        if (!this.canRestart()) return false;
        this.world = new World();
        this.#startRun();
        return true;
      default:
        return false;
    }
  }

  end() {
    if (this.state !== GameState.PLAYING) return;
    this.best = Math.max(this.best, this.score);
    this.#enter(GameState.GAME_OVER);
  }

  canRestart() {
    // Small tolerance so accumulated fixed steps (e.g. 48 × 1/120 s) count as reaching the lock time.
    return this.state === GameState.GAME_OVER && this.stateTime * 1000 >= GAMEOVER_INPUT_LOCK_MS - 1e-6;
  }

  #startRun() {
    this.score = 0;
    this.#enter(GameState.PLAYING);
  }

  #enter(state) {
    this.state = state;
    this.stateTime = 0;
  }
}
