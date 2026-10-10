import { GAMEOVER_INPUT_LOCK_MS, LIVES_2P } from '../config.js';
import { World } from './world.js';
import { MODES, playerFor } from './match.js';
import { randomSeed } from './rng.js';
import { SharedView } from './sharedView.js';
import { ShadowReplay, ShadowRun, shadowMonkey } from './shadow.js';

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
  // `createWorld({ players, lives, hearts, seed })` can be replaced in tests. `slip`, `lives`
  // and `shadow` are the settings the game starts with (see toggleSlip, toggleLives,
  // toggleShadow).
  constructor({ createWorld = (options) => new World(options), slip = true, lives = false, shadow = false } = {}) {
    this.createWorld = createWorld;
    this.mode = 'solo';
    // Slipping (G), for every world and match until the page is reloaded.
    this.slip = slip;
    // Lives for single player (H on the title screen); the two-player modes always have them.
    this.lives = lives;
    // The session's best single-player score, without and with lives.
    this.bests = { off: 0, on: 0 };
    // The shadow monkey (S on the title screen, single player only): every game is on the
    // same level, picked when the shadow is first turned on and kept until the page is
    // reloaded, and the best run so far (per setting of lives and slipping) is replayed as
    // a shadow. `shadows` has those runs; `recording` is the one being played now.
    this.shadow = shadow;
    this.shadowSeed = null;
    this.shadows = new Map();
    this.recording = null;
    this.ghost = null;
    this.replay = null;
    this.ghostMonkey = shadowMonkey();
    this.#newMatch();
    this.state = GameState.TITLE;
    this.stateTime = 0;
    this.score = 0;
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

  // Whether the match has lives (and hearts): always in the two-player modes, in single
  // player if turned on.
  get livesOn() {
    return this.players > 1 || this.lives;
  }

  // Whether the shadow monkey is on: single player only, whatever the toggle says.
  get shadowOn() {
    return this.mode === 'solo' && this.shadow;
  }

  // The settings a shadow goes with: a run under other rules is not the same race.
  get shadowSettings() {
    return `${this.lives ? 'lives' : 'one'}:${this.slip ? 'slip' : 'hold'}`;
  }

  // The frame of the shadow monkey to draw now (a monkey-like object for MonkeyView), or
  // null when there is none: no shadow, or it has left the screen. It plays on after the game
  // is over, on the results screen, until it is out of the world (see ShadowRun.frame).
  shadowFrame() {
    if ((this.state !== GameState.PLAYING && this.state !== GameState.RESULTS) || !this.ghost) return null;
    const index = this.world.stepCount - 1;
    const frame = this.ghost.frame(index, this.ghostMonkey);
    if (!frame) return null;
    // The lianas it swings on, swung again from its grabs and releases.
    this.replay.advanceTo(index);
    frame.liana = this.replay.held;
    frame.lianas = this.replay.lianas;
    return frame;
  }

  // The best score of this page session for the current single-player setting.
  get best() {
    return this.bests[this.lives ? 'on' : 'off'];
  }

  // Where player `p` is: their world and their monkey's index in it.
  slot(p) {
    return this.worlds.length > 1 ? { world: this.worlds[p], index: 0 } : { world: this.worlds[0], index: p };
  }

  playerScore(p) {
    const { world, index } = this.slot(p);
    return world.scores[index];
  }

  // Player `p`'s bananas: how many they took, and how many they could have (see
  // World.bananaTally).
  playerBananas(p) {
    const { world, index } = this.slot(p);
    return world.bananaTally(index);
  }

  // How many bananas player `p` has taken. The HUD asks every frame, so it is a lookup: the
  // tally (`playerBananas`) walks every banana of the run.
  playerBananasTaken(p) {
    const { world, index } = this.slot(p);
    return world.bananasTaken[index];
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
      if (this.recording && this.state === GameState.PLAYING) this.recording.add(world.monkey);
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
      if (event.type === 'score' && event.player === 0) this.score = event.score;
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

  // Selects the mode on the title screen, or from the results (once they take input)
  // goes back to the title screen with it. Returns false for an unknown or not
  // enabled mode, or while playing.
  selectMode(mode) {
    if (!MODES[mode]?.enabled) return false;
    if (this.state === GameState.RESULTS && this.canRestart()) {
      this.mode = mode;
      this.#toTitle();
      return true;
    }
    if (this.state !== GameState.TITLE) return false;
    if (mode !== this.mode) {
      this.mode = mode;
      this.#newMatch();
    }
    return true;
  }

  // Turns slipping on or off in every world (see World.setSlip).
  toggleSlip() {
    this.slip = !this.slip;
    for (const world of this.worlds) world.setSlip(this.slip);
  }

  // Turns lives on or off for single player (see livesOn), on the title screen only. A
  // new match: the worlds are the title screen's, so nothing is lost. Returns whether it
  // changed anything.
  toggleLives() {
    if (this.state !== GameState.TITLE || this.mode !== 'solo') return false;
    this.lives = !this.lives;
    for (const world of this.worlds) world.setLives(this.lives ? LIVES_2P : 1, this.lives);
    return true;
  }

  // Turns the shadow monkey on or off for single player, on the title screen only (see
  // shadowOn). The level changes with it: the shadow's level, or a random one. Returns
  // whether it changed anything.
  toggleShadow() {
    if (this.state !== GameState.TITLE || this.mode !== 'solo') return false;
    this.shadow = !this.shadow;
    this.#newMatch();
    return true;
  }

  // Handles a press of an input role (see KEYS): `primary` is Space or a tap, `start`
  // is Enter, `p1`/`p2` the two-player keys, `menu` (Esc) goes back to the title screen
  // (ending a run in progress, which still counts for the best). Returns true if the
  // press changed the game state.
  press(role = 'primary') {
    const starts = role === 'primary' || role === 'start';
    switch (this.state) {
      case GameState.TITLE:
        if (!starts) return false;
        this.#startRun();
        return true;
      case GameState.PLAYING: {
        if (role === 'menu') {
          this.end();
          this.#toTitle();
          return true;
        }
        const player = playerFor(this.mode, role);
        if (player >= 0) {
          const { world, index } = this.slot(player);
          world.release(index);
        }
        return false;
      }
      case GameState.RESULTS:
        if (role === 'menu' && this.canRestart()) {
          this.#toTitle();
          return true;
        }
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
      this.bests[this.lives ? 'on' : 'off'] = Math.max(this.best, this.score);
    }
    // The best run under these settings is the next game's shadow.
    if (this.recording) {
      this.recording.finish();
      this.recording.score = this.score;
      const best = this.shadows.get(this.recording.settings);
      if (!best || this.recording.score > best.score) this.shadows.set(this.recording.settings, this.recording);
      this.recording = null;
    }
    this.#enter(GameState.RESULTS);
  }

  // Whether P can pause: only during a run, not on the title screen or the results.
  get pausable() {
    return this.state === GameState.PLAYING;
  }

  canRestart() {
    // Small tolerance so accumulated fixed steps (e.g. 48 × 1/120 s) count as reaching the lock time.
    return this.state === GameState.RESULTS && this.stateTime * 1000 >= GAMEOVER_INPUT_LOCK_MS - 1e-6;
  }

  // New worlds for the selected mode, all from one new seed.
  #newMatch() {
    const { players, lives: modeLives, id } = MODES[this.mode];
    // Single player has one life, unless lives are on.
    const lives = id === 'solo' && this.lives ? LIVES_2P : modeLives;
    // With the shadow every game has the same level.
    const seed = this.shadowOn ? (this.shadowSeed ??= randomSeed()) : randomSeed();
    const panes = id === 'split' ? players : 1;
    // In shared screen each monkey has its own lianas.
    const own = id === 'shared' ? { ownLianas: true } : {};
    const settings = { slip: this.slip };
    this.worlds = Array.from({ length: panes }, () =>
      this.createWorld({ players: players / panes, lives, hearts: lives > 1, seed, ...own, ...settings }),
    );
    // Shared screen's view is part of the rules: it leaves trailing monkeys behind.
    this.sharedView = id === 'shared' ? new SharedView(this.worlds[0]) : null;
  }

  // Back to the title screen with a new match in the current mode.
  #toTitle() {
    this.#newMatch();
    this.score = 0;
    this.newBest = false;
    this.#enter(GameState.TITLE);
  }

  #startRun() {
    // With the shadow every run starts from the same state, at time zero: from the title
    // screen, whose swing has been going for a while, that means a fresh world.
    if (this.shadowOn && this.state === GameState.TITLE) this.#newMatch();
    this.ghost = this.shadowOn ? (this.shadows.get(this.shadowSettings) ?? null) : null;
    this.replay = this.ghost ? new ShadowReplay(this.ghost) : null;
    this.recording = this.shadowOn ? new ShadowRun(this.shadowSettings) : null;
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
