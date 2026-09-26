import { GAMEOVER_INPUT_LOCK_MS } from '../config.js';
import { World } from './world.js';
import { MODES, playerFor } from './match.js';
import { randomSeed } from './rng.js';
import { SharedView } from './sharedView.js';

const MAX_PENDING_EVENTS = 64;

export const GameState = Object.freeze({
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  RESULTS: 'RESULTS',
});

// Top-level flow: TITLE -> PLAYING -> RESULTS -> PLAYING ...
// Owns the worlds of the current match, the selected mode, the run score and the best
// score for this page session. On the title screen the monkeys already swing on the
// first liana; the mode picker selects a mode and the first `primary` or `start` press
// starts it.
//
// Single player and shared screen have one world with all the monkeys; split screen
// has one world per player, all with the same seed. Events carry the index of the
// world they come from (`pane`) and the match-wide `player`.
export class Game {
  // `createWorld({ players, lives, seed })` can be replaced in tests.
  constructor({ createWorld = (options) => new World(options) } = {}) {
    this.createWorld = createWorld;
    this.mode = 'solo';
    this.#newMatch();
    this.state = GameState.TITLE;
    this.stateTime = 0;
    this.score = 0;
    this.best = 0;
    // Whether the run that just ended beat the previous best.
    this.newBest = false;
    // World events since the last takeEvents(), for sound and other per-frame consumers.
    this.events = [];
  }

  // The world of player 1 (the only one outside split screen).
  get world() {
    return this.worlds[0];
  }

  get players() {
    return MODES[this.mode].players;
  }

  // Where player `p` is: their world and their monkey's index in it.
  slot(p) {
    return this.worlds.length > 1 ? { world: this.worlds[p], index: 0 } : { world: this.worlds[0], index: p };
  }

  playerScore(p) {
    const { world, index } = this.slot(p);
    return world.scores[index];
  }

  playerLives(p) {
    const { world, index } = this.slot(p);
    return world.lives[index];
  }

  playerOut(p) {
    const { world, index } = this.slot(p);
    return world.isOut(index);
  }

  // Indices of the players with the highest score (both on a draw).
  get winners() {
    const scores = Array.from({ length: this.players }, (_, p) => this.playerScore(p));
    const top = Math.max(...scores);
    return scores.flatMap((s, p) => (s === top ? [p] : []));
  }

  get alive() {
    return this.worlds.some((w) => w.alive);
  }

  step(dt) {
    this.stateTime += dt;
    const events = [];
    this.worlds.forEach((world, pane) => {
      world.step(dt);
      if (this.sharedView) this.sharedView.step(dt, this.state === GameState.PLAYING);
      // Drain events every step so they do not pile up in any state.
      for (const event of world.takeEvents()) {
        const player = this.worlds.length > 1 ? pane : event.player;
        events.push({ ...event, player, pane });
      }
    });
    this.events.push(...events);
    // Keep only the latest if nobody is reading them.
    if (this.events.length > MAX_PENDING_EVENTS) this.events.splice(0, this.events.length - MAX_PENDING_EVENTS);
    if (this.state !== GameState.PLAYING) return;
    for (const event of events) {
      if ((event.type === 'score' || event.type === 'banana') && event.player === 0) this.score = event.score;
      else if (event.type === 'death' && !this.alive) this.end();
    }
  }

  // The furthest stage any monkey has reached this run.
  get stage() {
    return Math.max(...this.worlds.flatMap((w) => w.stages));
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
      this.#newMatch();
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
        if (player >= 0) {
          const { world, index } = this.slot(player);
          world.release(index);
        }
        return false;
      }
      case GameState.RESULTS:
        if (!starts || !this.canRestart()) return false;
        this.#newMatch();
        this.#startRun();
        return true;
      default:
        return false;
    }
  }

  end() {
    if (this.state !== GameState.PLAYING) return;
    // The session best is for single player.
    if (this.mode === 'solo') {
      this.newBest = this.score > this.best;
      this.best = Math.max(this.best, this.score);
    }
    this.#enter(GameState.RESULTS);
  }

  canRestart() {
    // Small tolerance so accumulated fixed steps (e.g. 48 × 1/120 s) count as reaching the lock time.
    return this.state === GameState.RESULTS && this.stateTime * 1000 >= GAMEOVER_INPUT_LOCK_MS - 1e-6;
  }

  // New worlds for the selected mode, all from one new seed.
  #newMatch() {
    const { players, lives, id } = MODES[this.mode];
    const seed = randomSeed();
    const panes = id === 'split' ? players : 1;
    this.worlds = Array.from({ length: panes }, () => this.createWorld({ players: players / panes, lives, seed }));
    // Shared screen's view is part of the rules: it leaves trailing monkeys behind.
    this.sharedView = id === 'shared' ? new SharedView(this.worlds[0]) : null;
  }

  #startRun() {
    for (const world of this.worlds) world.start();
    this.score = 0;
    this.newBest = false;
    this.#enter(GameState.PLAYING);
  }

  #enter(state) {
    this.state = state;
    this.stateTime = 0;
  }
}
