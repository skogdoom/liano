import { describe, it, expect } from 'vitest';
import { createDriver } from '../src/driver.js';
import { createInput } from '../src/input.js';
import { Game, GameState } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { MAX_FRAME_DT, SIM_DT } from '../src/config.js';

// A game with empty worlds, real input on a fake key target, and stand-ins for pause,
// sound and prefetch that record what the driver asks of them.
function setup({ ready } = {}) {
  const keys = new EventTarget();
  const pointer = new EventTarget();
  const press = (code) => keys.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat: false }));
  const game = new Game({ createWorld: (options) => new World({ ...options, makeObstacle: () => null, makeBanana: () => null }) });
  const pause = {
    held: new Set(),
    get paused() {
      return this.held.size > 0;
    },
    get reason() {
      return this.held.values().next().value ?? null;
    },
    toggle(reason) {
      if (!this.held.delete(reason)) this.held.add(reason);
    },
    acceptsInput(role) {
      return !this.paused || (this.held.size === 1 && this.held.has('manual') && ['primary', 'start', 'menu'].includes(role));
    },
  };
  const sound = { paused: null, played: [], setPaused: (p) => (sound.paused = p), play: (recipe) => sound.played.push(recipe.name) };
  const prefetch = { updates: 0, update: () => prefetch.updates++ };
  const calls = { steps: 0, debug: 0, mute: 0 };
  const input = createInput(keys, pointer, { accepts: (role) => pause.acceptsInput(role) });
  const driver = createDriver({
    game,
    input,
    pause,
    sound,
    prefetch,
    ready,
    onStep: () => calls.steps++,
    onDebugToggle: () => calls.debug++,
    onMuteToggle: () => calls.mute++,
  });
  const tap = (pointerType) => pointer.dispatchEvent(Object.assign(new Event('pointerdown', { cancelable: true }), { pointerType, button: 0 }));
  return { game, input, pause, sound, prefetch, calls, driver, press, tap };
}

describe('the game driver', () => {
  it('applies a press at the next sim step: Space starts a run', () => {
    const { game, driver, press, calls } = setup();
    press('Space');
    expect(game.state).toBe(GameState.TITLE);
    driver.frame(1000 / 60);
    expect(game.state).toBe(GameState.PLAYING);
    expect(calls.steps).toBe(2); // 1/60 s is two 1/120 s steps
  });

  it('holds a press until the version is ready, then applies it', () => {
    let art = false;
    const { game, driver, press } = setup({ ready: () => art });
    press('Space');
    driver.frame(1000 / 60);
    expect(game.state).toBe(GameState.TITLE);
    art = true;
    driver.frame(1000 / 60);
    expect(game.state).toBe(GameState.PLAYING);
  });

  it('runs the sim by the frame time, up to MAX_FRAME_DT, and says how far into the next step to draw', () => {
    const { driver, calls } = setup();
    const { frameDt, alpha } = driver.frame(1.5 * SIM_DT * 1000);
    expect(frameDt).toBeCloseTo(1.5 * SIM_DT, 12);
    expect(calls.steps).toBe(1);
    expect(alpha).toBeCloseTo(0.5, 9);
    expect(driver.frame(10_000).frameDt).toBe(MAX_FRAME_DT);
  });

  it('picks a mode from 1, 2 or 3 on the title screen', () => {
    const { game, driver, press } = setup();
    press('Digit3');
    driver.frame(1000 / 60);
    expect(game.mode).toBe('split');
  });

  it('pauses a run on P, and stops the sim while paused', () => {
    const { game, driver, press, pause, sound, calls } = setup();
    // Not on the title screen: only a run pauses.
    press('KeyP');
    driver.frame(1000 / 60);
    expect(pause.paused).toBe(false);
    press('Space');
    driver.frame(1000 / 60);
    press('KeyP');
    const steps = calls.steps;
    const { frameDt, paused } = driver.frame(1000 / 60);
    expect([paused, frameDt, calls.steps, sound.paused]).toEqual([true, 0, steps, true]);
    expect(game.state).toBe(GameState.PLAYING);
    press('KeyP');
    expect(driver.frame(1000 / 60).paused).toBe(false);
    expect(sound.paused).toBe(false);
  });

  it('drops presses made while paused', () => {
    const { game, driver, press, pause } = setup();
    pause.toggle('graphics');
    press('Space');
    driver.frame(1000 / 60);
    pause.toggle('graphics');
    driver.frame(1000 / 60);
    expect(game.state).toBe(GameState.TITLE);
  });

  it.each(['Space', 'Enter', 'mouse', 'touch'])('resumes manual pause with %s without releasing the monkey', (control) => {
    const { game, driver, press, tap, pause } = setup();
    press('Space'); driver.frame(1000 / 60);
    press('KeyP'); driver.frame(1000 / 60);
    expect(pause.paused).toBe(true);
    if (control === 'mouse' || control === 'touch') tap(control); else press(control);
    driver.frame(1000 / 60);
    expect(pause.paused).toBe(false);
    expect(game.state).toBe(GameState.PLAYING);
    expect(game.world.monkey.state).toBe(MonkeyState.HANGING);
  });

  it('returns to the title and clears manual pause on Escape', () => {
    const { game, driver, press, pause } = setup();
    press('Space'); driver.frame(1000 / 60);
    press('KeyP'); driver.frame(1000 / 60);
    press('Escape'); driver.frame(1000 / 60);
    expect([game.state, pause.paused]).toEqual([GameState.TITLE, false]);
  });

  it('does not resume from input queued in the same frame that pauses the run', () => {
    const { driver, press, pause } = setup();
    press('Space'); driver.frame(1000 / 60);
    press('Space'); press('KeyP'); driver.frame(1000 / 60);
    expect(pause.paused).toBe(true);
  });

  it('hands D and M to the version, and applies G, H and S to the game', () => {
    const { game, driver, press, calls } = setup();
    const slip = game.slip;
    const lives = game.lives;
    const shadow = game.shadow;
    for (const code of ['KeyD', 'KeyM', 'KeyG', 'KeyH', 'KeyS']) press(code);
    driver.frame(1000 / 60);
    expect([calls.debug, calls.mute]).toEqual([1, 1]);
    expect([game.slip, game.lives, game.shadow]).toEqual([!slip, !lives, !shadow]);
  });

  it('plays the sounds for the frame’s events and keeps the prefetch going', () => {
    const { game, driver, press, sound, prefetch } = setup();
    press('Space');
    driver.frame(1000 / 60);
    // Drop the monkey off the bottom: a fall crashes.
    const monkey = game.worlds[0].monkeys[0];
    game.worlds[0].release(0);
    Object.assign(monkey, { y: 760, vy: 100 });
    let events = [];
    for (let i = 0; i < 20 && monkey.state !== MonkeyState.DEAD; i++) events = events.concat(driver.frame(1000 / 60).events);
    expect(events.some((e) => e.type === 'death')).toBe(true);
    expect(sound.played).toContain('crash');
    expect(prefetch.updates).toBeGreaterThan(1);
  });

  it('goes back to the title on Esc', () => {
    const { game, driver, press } = setup();
    press('Space');
    driver.frame(1000 / 60);
    press('Escape');
    driver.frame(1000 / 60);
    expect(game.state).toBe(GameState.TITLE);
  });
});
