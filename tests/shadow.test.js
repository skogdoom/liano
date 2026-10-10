import { describe, it, expect } from 'vitest';
import { Game, GameState } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';
import { SHADOW_LIANA_FADE, ShadowReplay, ShadowRun, shadowMonkey } from '../src/sim/shadow.js';
import { Monkey, MonkeyState } from '../src/sim/monkey.js';
import { Liana, LianaState } from '../src/sim/liana.js';
import { createInput } from '../src/input.js';
import { LIANA_SPACING, SIM_DT } from '../src/config.js';

const stepGame = (game, n) => {
  for (let i = 0; i < n; i++) game.step(SIM_DT);
};

// Plays a run: lets go after `releaseAt` steps and carries on until the monkey is lost (or
// `max` steps), then returns the recording.
function play(game, { releaseAt = 30, max = 3000 } = {}) {
  game.press();
  expect(game.state).toBe(GameState.PLAYING);
  const recording = game.recording;
  for (let i = 0; i < max && game.state === GameState.PLAYING; i++) {
    if (i === releaseAt) game.press();
    game.step(SIM_DT);
  }
  return recording;
}

describe('a recorded run', () => {
  it('keeps a frame per step and gives it back for a monkey view', () => {
    const run = new ShadowRun('x');
    const monkey = new Monkey();
    const liana = new Liana(0, 0);
    monkey.grab(liana, 200);
    for (let i = 0; i < 3000; i++) {
      liana.step(SIM_DT);
      monkey.step(SIM_DT);
      run.add(monkey);
    }
    expect(run.count).toBe(3000); // more than it starts with room for
    const out = shadowMonkey();
    expect(run.frame(2999, out)).toBe(out);
    expect(out.x).toBeCloseTo(monkey.x, 9);
    expect(out.y).toBeCloseTo(monkey.y, 9);
    expect(out.state).toBe(MonkeyState.HANGING);
    // Velocity is kept at single precision: enough for facing and tilt.
    expect(out.vx).toBeCloseTo(monkey.vx, 3);
    expect(out.vy).toBeCloseTo(monkey.vy, 3);
    expect(run.frame(-1, out)).toBeNull();
    // After the last frame it falls, tumbling, until it is out of the world.
    expect(run.frame(3000, out).state).toBe(MonkeyState.DEAD);
    expect(run.frame(1000000, out)).toBeNull();
  });

  it('keeps its size down: a frame is a few bytes, and the liana is only its grabs and releases', () => {
    const run = new ShadowRun();
    const monkey = new Monkey();
    monkey.grab(new Liana(0, 0), 200);
    for (let i = 0; i < 1000; i++) run.add(monkey);
    const bytes = run.position.BYTES_PER_ELEMENT * 2 + run.velocity.BYTES_PER_ELEMENT * 2 + run.state.BYTES_PER_ELEMENT;
    expect(bytes).toBeLessThanOrEqual(25);
    // One grab (before the first step) and nothing else, however long it hangs.
    expect(run.events).toEqual([{ frame: -1, index: 0, dir: 1 }]);
  });

  it('remembers flying and falling, without a liana', () => {
    const run = new ShadowRun();
    const monkey = new Monkey();
    Object.assign(monkey, { x: 10, y: 20, vx: 3, vy: -4, state: MonkeyState.AIRBORNE });
    run.add(monkey);
    monkey.kill();
    run.add(monkey);
    const out = shadowMonkey();
    expect(run.frame(0, out)).toMatchObject({ x: 10, y: 20, vx: 3, vy: -4, state: MonkeyState.AIRBORNE });
    expect(run.frame(1, out).state).toBe(MonkeyState.DEAD);
  });
});

describe('the shadow monkey in the game', () => {
  it('is off by default, and every game gets its own random level', () => {
    const game = new Game();
    expect(game.shadow).toBe(false);
    expect(game.shadowOn).toBe(false);
    const seeds = new Set([game.world.seed]);
    for (let i = 0; i < 4; i++) {
      play(game, { max: 600 });
      stepGame(game, 60);
      game.press('menu');
      seeds.add(game.world.seed);
    }
    expect(seeds.size).toBeGreaterThan(3);
    expect(game.recording).toBeNull();
    expect(game.shadowFrame()).toBeNull();
  });

  it('is turned on with the title screen toggle, for single player, on the title screen only', () => {
    const game = new Game();
    expect(game.toggleShadow()).toBe(true);
    expect(game.shadowOn).toBe(true);
    game.press();
    expect(game.toggleShadow()).toBe(false);
    expect(game.shadow).toBe(true);
    game.end();
    expect(game.toggleShadow()).toBe(false);
    stepGame(game, 60);
    game.press('menu');
    expect(game.toggleShadow()).toBe(true);
    expect(game.shadowOn).toBe(false);
  });

  it('is always off in the two-player modes, and the toggle does nothing there', () => {
    for (const mode of ['shared', 'split']) {
      const game = new Game({ shadow: true });
      game.selectMode(mode);
      expect(game.shadowOn).toBe(false);
      expect(game.toggleShadow()).toBe(false);
      game.press('start');
      expect(game.recording).toBeNull();
      expect(game.shadowFrame()).toBeNull();
    }
    // Random levels there, the shadow's level back in single player.
    const game = new Game({ shadow: true });
    const level = game.world.seed;
    game.selectMode('shared');
    game.selectMode('solo');
    expect(game.world.seed).toBe(level);
  });

  it('puts every game on the same level while it is on, and a random one again when it is off', () => {
    const game = new Game();
    game.toggleShadow();
    const level = game.world.seed;
    const seeds = [];
    for (let i = 0; i < 4; i++) {
      game.press();
      seeds.push(game.world.seed);
      game.end();
      stepGame(game, 60);
      // Half play again, half go back to the menu.
      if (i % 2) game.press('menu');
      else game.press();
      if (game.state === GameState.PLAYING) {
        seeds.push(game.world.seed);
        game.end();
        stepGame(game, 60);
        game.press('menu');
      }
    }
    expect(new Set([level, ...seeds])).toEqual(new Set([level]));
    // Off and on again: the same level (kept for the session).
    game.toggleShadow();
    expect(game.world.seed).not.toBe(level);
    game.toggleShadow();
    expect(game.world.seed).toBe(level);
  });

  it('starts every run from a fresh world, however long the title screen has swung', () => {
    const game = new Game({ shadow: true });
    stepGame(game, 500);
    expect(game.world.stepCount).toBe(500);
    game.press();
    expect(game.world.stepCount).toBe(0);
    expect(game.world.monkey.slipping).toBe(true);
  });

  it('replays the same run when the player does the same: the game is deterministic', () => {
    const game = new Game({ shadow: true });
    const first = play(game, { releaseAt: 29, max: 700 });
    game.end();
    stepGame(game, 60);
    game.press(); // again
    const second = game.recording;
    for (let i = 0; i < 700 && game.state === GameState.PLAYING; i++) {
      if (i === 29) game.press();
      game.step(SIM_DT);
    }
    expect(second).not.toBe(first);
    const n = Math.min(first.count, second.count);
    expect(n).toBeGreaterThan(100);
    for (let k = 0; k < n * 2; k++) expect(second.position[k]).toBe(first.position[k]);
    for (let k = 0; k < n * 2; k++) expect(second.velocity[k]).toBe(first.velocity[k]);
    expect(Array.from(second.state.slice(0, n))).toEqual(Array.from(first.state.slice(0, n)));
    expect(second.events.filter((e) => e.frame < n)).toEqual(first.events.filter((e) => e.frame < n));
  });

  it('records the run and makes the best one the next game’s shadow', () => {
    const game = new Game({ shadow: true });
    expect(game.shadowFrame()).toBeNull();
    game.press();
    expect(game.ghost).toBeNull(); // the first game has no shadow
    game.score = 5;
    stepGame(game, 100);
    const first = game.recording;
    expect(first.count).toBe(100);
    game.end();
    expect(game.shadows.get(game.shadowSettings)).toBe(first);
    expect(first.score).toBe(5);
    expect(game.recording).toBeNull();
    stepGame(game, 60);
    game.press(); // again
    expect(game.ghost).toBe(first);
    expect(game.recording).not.toBe(first);
  });

  it('shows the shadow frame for the step the run is at', () => {
    const game = new Game({ shadow: true });
    game.press();
    stepGame(game, 40);
    const run = game.recording;
    game.end();
    stepGame(game, 60);
    game.press();
    expect(game.shadowFrame()).toBeNull(); // nothing recorded yet at step 0
    stepGame(game, 1);
    const out = { ...game.shadowFrame() };
    const expected = shadowMonkey();
    run.frame(0, expected);
    expect(out.x).toBe(expected.x);
    expect(out.y).toBe(expected.y);
    stepGame(game, 20);
    run.frame(20, expected);
    expect(game.shadowFrame().x).toBe(expected.x);
  });

  it('falls on when its run is over, tumbling, until it is out of the world, and then is gone', () => {
    const game = new Game({ shadow: true });
    game.press();
    stepGame(game, 40);
    const run = game.recording;
    game.end();
    stepGame(game, 60);
    game.press();
    stepGame(game, 100); // past its 40 frames
    const first = { ...game.shadowFrame() };
    expect(first.state).toBe(MonkeyState.DEAD);
    expect(game.shadowFrame().lianas).toEqual([]);
    expect(game.shadowFrame().liana).toBeNull();
    stepGame(game, 20);
    // Faster and lower as it falls.
    expect(game.shadowFrame().y).toBeGreaterThan(first.y);
    expect(game.shadowFrame().vy).toBeGreaterThan(first.vy);
    // It starts from where the run ended: the very next frame is where it was, moving on.
    const last = shadowMonkey();
    run.frame(run.count - 1, last);
    const next = run.frame(run.count, shadowMonkey());
    expect(Math.abs(next.x - last.x)).toBeLessThan(Math.abs(last.vx) * SIM_DT * 2 + 1e-6);
    expect(Math.abs(next.y - last.y)).toBeLessThan(Math.abs(last.vy) * SIM_DT * 2 + 1);
    for (let i = 0; i < 3000 && game.shadowFrame(); i++) game.step(SIM_DT);
    expect(game.shadowFrame()).toBeNull();
    expect(game.world.stepCount).toBeLessThan(3000);
  });

  it('plays on after a game over, on the results screen, until it has left the screen', () => {
    const game = seededGame();
    // A first run long enough to have a shadow that is on the screen for a while.
    game.press();
    for (let i = 0; i < 600 && game.state === GameState.PLAYING; i++) {
      const m = game.world.monkey;
      if (m.state === MonkeyState.HANGING && Math.round(m.gripTime / SIM_DT) === 29) game.press();
      game.step(SIM_DT);
    }
    expect(game.recording.count).toBeGreaterThan(300);
    game.end();
    stepGame(game, 60);
    game.press();
    // The second game ends soon, while the shadow is still on its way.
    stepGame(game, 100);
    expect(game.shadowFrame()).not.toBeNull();
    game.end();
    expect(game.state).toBe(GameState.RESULTS);
    const at = game.world.stepCount;
    const before = { ...game.shadowFrame() };
    stepGame(game, 50);
    expect(game.world.stepCount).toBe(at + 50);
    const after = game.shadowFrame();
    expect(after).not.toBeNull();
    // It has moved on with the game's time.
    expect(`${after.x},${after.y}`).not.toBe(`${before.x},${before.y}`);
    // And goes on until it is gone, then stays gone.
    let steps = 0;
    while (game.shadowFrame() && steps < 20000) {
      game.step(SIM_DT);
      steps++;
    }
    expect(game.shadowFrame()).toBeNull();
    expect(steps).toBeGreaterThan(100);
    stepGame(game, 10);
    expect(game.shadowFrame()).toBeNull();
    // Not on the title screen.
    game.press('menu');
    expect(game.shadowFrame()).toBeNull();
  });

  it('keeps the best run only: a worse one does not replace it, a better one does', () => {
    const game = new Game({ shadow: true });
    const runs = [];
    for (const score of [3, 8, 5, 8, 9]) {
      game.press();
      stepGame(game, 30);
      game.score = score;
      runs.push(game.recording);
      game.end();
      stepGame(game, 60);
    }
    expect(game.shadows.get(game.shadowSettings)).toBe(runs[4]);
    // 3, then 8 replaced it, 5 and a tie at 8 did not, 9 did.
    const g2 = new Game({ shadow: true });
    const kept = [];
    for (const score of [3, 8, 5, 8]) {
      g2.press();
      stepGame(g2, 30);
      g2.score = score;
      const run = g2.recording;
      g2.end();
      kept.push(g2.shadows.get(g2.shadowSettings) === run);
      stepGame(g2, 60);
    }
    expect(kept).toEqual([true, true, false, false]);
  });

  it('counts a run ended with Esc', () => {
    const game = new Game({ shadow: true });
    game.press();
    stepGame(game, 50);
    game.score = 2;
    const run = game.recording;
    game.press('menu');
    expect(game.state).toBe(GameState.TITLE);
    expect(game.shadows.get(game.shadowSettings)).toBe(run);
  });

  it('keeps a shadow for each setting of lives and slipping', () => {
    const game = new Game({ shadow: true, slip: false });
    game.press();
    stepGame(game, 30);
    game.score = 4;
    const held = game.recording;
    game.end();
    stepGame(game, 60);
    game.press('menu');
    game.toggleLives();
    game.press();
    expect(game.ghost).toBeNull(); // no shadow for this setting yet
    stepGame(game, 30);
    game.score = 1;
    const lives = game.recording;
    game.end();
    expect(game.shadows.size).toBe(2);
    expect(game.shadows.get('lives:hold')).toBe(lives);
    stepGame(game, 60);
    game.press('menu');
    game.toggleLives();
    game.press();
    expect(game.ghost).toBe(held);
    // Slipping on is another.
    game.end();
    stepGame(game, 60);
    game.press('menu');
    game.toggleSlip();
    game.press();
    expect(game.ghost).toBeNull();
  });
});

// A game on a level of its own, so the runs below are always the same.
const seededGame = () =>
  new Game({ shadow: true, createWorld: (options) => new World({ ...options, seed: 20240 }) });

describe('the shadow’s liana, swung again from the run', () => {
  it('swings exactly as the real one did, frame by frame, while the shadow hangs on it', () => {
    const game = seededGame();
    game.press();
    // What the monkey hangs on after each step.
    const truth = [];
    for (let i = 0; i < 1500 && game.state === GameState.PLAYING; i++) {
      const m = game.world.monkey;
      // Let go 29 steps after each grab.
      if (m.state === MonkeyState.HANGING && Math.round(m.gripTime / SIM_DT) === 29) game.press();
      game.step(SIM_DT);
      const l = m.liana;
      truth.push(l ? { index: l.index, angle: l.angle, angularVelocity: l.angularVelocity, swingDir: l.swingDir } : null);
    }
    const run = game.recording;
    // Several grabs and releases.
    expect(run.events.filter((e) => e.dir !== 0).length).toBeGreaterThan(4);
    expect(run.events.filter((e) => e.dir === 0).length).toBeGreaterThan(3);
    const replay = new ShadowReplay(run);
    let hanging = 0;
    for (let k = 0; k < run.count; k++) {
      replay.advanceTo(k);
      const t = truth[k];
      if (!t) {
        // Flying: no liana to draw.
        expect(replay.held).toBeNull();
        expect(replay.lianas.every((e) => e.liana.state !== LianaState.SWINGING)).toBe(true); // at most fading
        continue;
      }
      expect(replay.lianas.at(-1)).toEqual({ liana: replay.held, alpha: 1 });
      expect(replay.held.index).toBe(t.index);
      expect(replay.held.swingDir).toBe(t.swingDir);
      expect(replay.held.angle).toBe(t.angle);
      expect(replay.held.angularVelocity).toBe(t.angularVelocity);
      hanging++;
    }
    expect(hanging).toBeGreaterThan(250);
  });

  it('give the one the shadow hangs on, and none while it flies', () => {
    const game = seededGame();
    game.press();
    const states = [];
    for (let i = 0; i < 600 && game.state === GameState.PLAYING; i++) {
      const m = game.world.monkey;
      if (m.state === MonkeyState.HANGING && Math.round(m.gripTime / SIM_DT) === 29) game.press();
      game.step(SIM_DT);
      states.push([m.state, m.liana?.index ?? null]);
    }
    const replay = new ShadowReplay(game.recording);
    for (let k = 0; k < states.length; k++) {
      replay.advanceTo(k);
      const [state, index] = states[k];
      expect(replay.held?.index ?? null).toBe(index);
      if (state === MonkeyState.HANGING) expect(replay.lianas.at(-1)).toEqual({ liana: replay.held, alpha: 1 });
      else expect(replay.lianas.every((e) => e.liana.state !== LianaState.SWINGING)).toBe(true);
    }
  });

  it('can be asked for any frame, in any order, and once past the run’s end', () => {
    const game = seededGame();
    game.press();
    const run = game.recording;
    for (let i = 0; i < 400; i++) {
      const m = game.world.monkey;
      if (m.state === MonkeyState.HANGING && Math.round(m.gripTime / SIM_DT) === 29) game.press();
      game.step(SIM_DT);
    }
    const replay = new ShadowReplay(run);
    replay.advanceTo(300);
    const angle = replay.held?.angle;
    replay.advanceTo(100);
    replay.advanceTo(300);
    expect(replay.held?.angle).toBe(angle);
    replay.advanceTo(10000);
    expect(replay.frame).toBe(10000);
  });

  it('are given to the game’s shadow frame for the monkey view', () => {
    const game = seededGame();
    game.press();
    for (let i = 0; i < 200; i++) game.step(SIM_DT);
    game.end();
    game.step(0.5);
    game.press();
    expect(game.shadowFrame()).toBeNull();
    for (let i = 0; i < 100; i++) game.step(SIM_DT);
    const frame = game.shadowFrame();
    expect(frame.state).toBe(MonkeyState.HANGING);
    expect(frame.liana.index).toBe(0);
    expect(frame.lianas.map((e) => e.liana)).toContain(frame.liana);
    expect(frame.liana.state).toBe(LianaState.SWINGING);
  });
});

describe('the shadow’s lianas fading', () => {
  // A run of 600 frames that hangs on liana 0 from the start, lets go at frame 100, grabs
  // liana 1 at frame 300 and lets go at 400.
  const run = () => {
    const r = new ShadowRun();
    r.count = 600;
    r.events.push(
      { frame: -1, index: 0, dir: 1 },
      { frame: 100, index: 0, dir: 0 },
      { frame: 300, index: 1, dir: 1 },
      { frame: 400, index: 1, dir: 0 },
    );
    return r;
  };
  const alphaOf = (replay, index) => replay.lianas.find((e) => e.liana.index === index)?.alpha;

  it('fade in over SHADOW_LIANA_FADE s before the shadow grabs them, at rest', () => {
    const replay = new ShadowReplay(run());
    const steps = Math.round(SHADOW_LIANA_FADE / SIM_DT);
    expect(SHADOW_LIANA_FADE).toBeGreaterThan(0);
    replay.advanceTo(300 - steps - 5);
    expect(alphaOf(replay, 1)).toBeUndefined();
    replay.advanceTo(300 - steps);
    expect(alphaOf(replay, 1)).toBeCloseTo(0, 9);
    replay.advanceTo(300 - steps / 2);
    expect(alphaOf(replay, 1)).toBeCloseTo(0.5, 9);
    const entry = replay.lianas.find((e) => e.liana.index === 1);
    expect(entry.liana.state).toBe(LianaState.IDLE);
    expect(entry.liana.angle).toBe(0);
    expect(replay.held).toBeNull();
    // Grabbed: fully there, and swinging.
    replay.advanceTo(310);
    expect(alphaOf(replay, 1)).toBe(1);
    expect(replay.held.index).toBe(1);
    expect(replay.held.state).toBe(LianaState.SWINGING);
  });

  it('fade out over SHADOW_LIANA_FADE s after it lets go, swaying back to rest, and are then gone', () => {
    const replay = new ShadowReplay(run());
    const steps = Math.round(SHADOW_LIANA_FADE / SIM_DT);
    replay.advanceTo(99);
    expect(alphaOf(replay, 0)).toBe(1);
    replay.advanceTo(100);
    expect(replay.held).toBeNull();
    expect(alphaOf(replay, 0)).toBeCloseTo(1, 9);
    replay.advanceTo(100 + steps / 2);
    expect(alphaOf(replay, 0)).toBeCloseTo(0.5, 9);
    const entry = replay.lianas.find((e) => e.liana.index === 0);
    expect(entry.liana.state).toBe(LianaState.SETTLING);
    replay.advanceTo(100 + steps - 1);
    expect(alphaOf(replay, 0)).toBeGreaterThan(0);
    replay.advanceTo(100 + steps);
    expect(alphaOf(replay, 0)).toBeUndefined();
    // Between the two lianas there is none.
    replay.advanceTo(200);
    expect(replay.lianas).toEqual([]);
  });

  it('show the one it lets go of and the one it is about to grab at once', () => {
    const r = run();
    r.events.splice(1, 2, { frame: 100, index: 0, dir: 0 }, { frame: 110, index: 1, dir: 1 });
    const replay = new ShadowReplay(r);
    const steps = Math.round(SHADOW_LIANA_FADE / SIM_DT);
    replay.advanceTo(110 - steps - 1);
    expect(alphaOf(replay, 1)).toBeUndefined();
    replay.advanceTo(105);
    expect(replay.held).toBeNull();
    expect(alphaOf(replay, 0)).toBeCloseTo(1 - 5 / steps, 9);
    expect(alphaOf(replay, 1)).toBeCloseTo(1 - 5 / steps, 9);
    expect(replay.lianas).toHaveLength(2);
    // Asking for an earlier frame starts over, and gives the same.
    replay.advanceTo(150);
    replay.advanceTo(105);
    expect(alphaOf(replay, 0)).toBeCloseTo(1 - 5 / steps, 9);
  });

  it('end with the run: a run ended with Esc while hanging lets go, so its liana fades out', () => {
    const r = new ShadowRun();
    const monkey = new Monkey();
    const liana = new Liana(2, 2 * LIANA_SPACING);
    monkey.grab(liana, 200);
    for (let i = 0; i < 10; i++) r.add(monkey);
    expect(r.events).toEqual([{ frame: -1, index: 2, dir: 1 }]);
    r.finish();
    expect(r.events.at(-1)).toEqual({ frame: 10, index: 2, dir: 0 });
    const replay = new ShadowReplay(r);
    replay.advanceTo(9);
    expect(replay.held.index).toBe(2);
    replay.advanceTo(30);
    expect(replay.held).toBeNull();
    expect(alphaOf(replay, 2)).toBeGreaterThan(0);
    expect(alphaOf(replay, 2)).toBeLessThan(1);
  });
});

describe('the shadow key', () => {
  it('toggles on S, once per press, and is not a key of any other role', () => {
    const target = new EventTarget();
    const input = createInput(target, null, { accepts: () => false });
    const key = (code, repeat = false) =>
      target.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat }));
    key('KeyS');
    key('KeyS', true);
    expect(input.consumeShadowToggle()).toBe(true);
    expect(input.consumeShadowToggle()).toBe(false);
    key('KeyS');
    key('KeyS');
    expect(input.consumeShadowToggle()).toBe(false);
    expect(input.consumeLivesToggle()).toBe(false);
    expect(input.consumePress('primary')).toBe(false);
  });
});

describe('the shadow drawn', () => {
  it('shows a grey, see-through liana of its own while the shadow hangs on it, and nothing without', async () => {
    const { ShadowView, SHADOW_ALPHA, SHADOW_FUR } = await import('../src/render/shadowView.js');
    const view = new ShadowView();
    expect(view.view.visible).toBe(false);
    expect(view.view.alpha).toBe(SHADOW_ALPHA);
    expect(SHADOW_ALPHA).toBeLessThan(0.5);
    // Grey: the three channels of every fur colour are close.
    for (const color of Object.values(SHADOW_FUR)) {
      const [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(24);
    }
    const frame = shadowMonkey();
    const held = new Liana(1, 700);
    held.grab(1);
    Object.assign(frame, { x: 1000, y: 200, state: MonkeyState.HANGING, liana: held, lianas: [{ liana: held, alpha: 1 }] });
    view.update(frame, 0.016);
    expect(view.view.visible).toBe(true);
    expect(view.monkey.view.position.x).toBe(1000);
    expect(view.lianas).toHaveLength(1);
    expect(view.lianas[0].visible).toBe(true);
    expect(view.lianas[0].alpha).toBe(1);
    // Fading: the liana's own alpha, on top of the shadow's.
    frame.lianas = [{ liana: held, alpha: 0.3 }];
    view.update(frame, 0.016);
    expect(view.lianas[0].alpha).toBeCloseTo(0.3, 9);
    // Flying: no liana, not even one that still sways.
    Object.assign(frame, { state: MonkeyState.AIRBORNE, liana: null, lianas: [] });
    view.update(frame, 0.016);
    expect(view.lianas[0].visible).toBe(false);
    view.update(null, 0.016);
    expect(view.view.visible).toBe(false);
  });
});
