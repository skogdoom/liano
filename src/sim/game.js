import { GAMEOVER_INPUT_LOCK_MS } from '../config.js';
import { World } from './world.js';
import { MODES, playerFor } from './match.js';

const MAX_PENDING_EVENTS = 64;

export const GameState = Object.freeze({
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  RESULTS: 'RESULTS',
});

// Top-level flow: TITLE -> PLAYING -> RESULTS -> PLAYING ...
// Owns the current world, the selected mode, the run score and the best score for this
// page session. On the title screen the monkey already swings on the first liana; the
// mode picker selects a mode and the first `primary` or `start` press starts it.
export class Game {
  // `createWorld({ players })` can be replaced in tests.
  constructor({ createWorld = (options) => new World(options) } = {}) {
    this.createWorld = createWorld;
    this.mode = 'solo';
    this.world = createWorld({ players: MODES[this.mode].players });
    this.state = GameState.TITLE;
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
      if (event.type === 'score' && event.player === 0) this.score = event.score;
      else if (event.type === 'death' && !this.world.alive) this.end();
    }
  }

  // Returns and clears the world events collected since the last call.
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  // Selects the mode on the title screen. Returns false for an unknown or not yet
  // enabled mode, or outside the title screen.
  selectMode(mode) {
    if (this.state !== GameState.TITLE || !MODES[mode]?.enabled) return false;
    if (mode !== this.mode) {
      this.mode = mode;
      this.world = this.createWorld({ players: MODES[mode].players });
    }
    return true;
  }

  // Handles a press of an input role (see KEYS): `primary` is Space or a tap, `start`
  // is Enter, `p1`/`p2` the two-player keys. Returns true if the press changed the game
  // state.
  press(role = 'primary') {
    const starts = role === 'primary' || role === 'start';
    switch (this.state) {
      case GameState.TITLE:
        if (!starts) return false;
        this.#startRun();
        return true;
      case GameState.PLAYING: {
        const player = playerFor(this.mode, role);
        if (player >= 0) this.world.release(player);
        return false;
      }
      case GameState.RESULTS:
        if (!starts || !this.canRestart()) return false;
        this.world = this.createWorld({ players: MODES[this.mode].players });
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
    this.#enter(GameState.RESULTS);
  }

  canRestart() {
    // Small tolerance so accumulated fixed steps (e.g. 48 × 1/120 s) count as reaching the lock time.
    return this.state === GameState.RESULTS && this.stateTime * 1000 >= GAMEOVER_INPUT_LOCK_MS - 1e-6;
  }

  #startRun() {
    this.world.start();
    this.score = 0;
    this.newBest = false;
    this.#enter(GameState.PLAYING);
  }

  #enter(state) {
    this.state = state;
    this.stateTime = 0;
  }
}
