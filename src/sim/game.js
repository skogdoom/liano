import { GAMEOVER_INPUT_LOCK_MS } from '../config.js';
import { World } from './world.js';

const MAX_PENDING_EVENTS = 64;

export const GameState = Object.freeze({
  READY: 'READY',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER',
});

// Top-level flow: READY -> PLAYING -> GAME_OVER -> PLAYING ...
// Owns the current world, the run score and the best score for this page session.
// In READY the monkey already swings on the first liana; the first Space only starts the run.
export class Game {
  // `createWorld` can be replaced in tests.
  constructor({ createWorld = () => new World() } = {}) {
    this.createWorld = createWorld;
    this.world = createWorld();
    this.state = GameState.READY;
    this.stateTime = 0;
    this.score = 0;
    this.best = 0;
    // Whether the run that just ended beat the previous best.
    this.newBest = false;
    // World events since the last takeEvents(), for sound and other per-frame consumers.
    this.events = [];
  }

  step(dt) {
    this.stateTime += dt;
    this.world.step(dt);
    // Drain events every step so they do not pile up in any state.
    const events = this.world.takeEvents();
    this.events.push(...events);
    // Keep only the latest if nobody is reading them.
    if (this.events.length > MAX_PENDING_EVENTS) this.events.splice(0, this.events.length - MAX_PENDING_EVENTS);
    if (this.state !== GameState.PLAYING) return;
    for (const event of events) {
      if (event.type === 'score') this.score = event.score;
      else if (event.type === 'death') this.end();
    }
  }

  // Returns and clears the world events collected since the last call.
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
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
        this.world = this.createWorld();
        this.#startRun();
        return true;
      default:
        return false;
    }
  }

  end() {
    if (this.state !== GameState.PLAYING) return;
    this.newBest = this.score > this.best;
    this.best = Math.max(this.best, this.score);
    this.#enter(GameState.GAME_OVER);
  }

  canRestart() {
    // Small tolerance so accumulated fixed steps (e.g. 48 × 1/120 s) count as reaching the lock time.
    return this.state === GameState.GAME_OVER && this.stateTime * 1000 >= GAMEOVER_INPUT_LOCK_MS - 1e-6;
  }

  #startRun() {
    this.score = 0;
    this.newBest = false;
    this.#enter(GameState.PLAYING);
  }

  #enter(state) {
    this.state = state;
    this.stateTime = 0;
  }
}
