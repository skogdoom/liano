import { describe, it, expect } from 'vitest';
import { Game, GameState } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { releaseWindow } from '../src/sim/feasibility.js';
import { mulberry32 } from '../src/sim/rng.js';
import { SIM_DT, SCREEN_WIDTH, LIANA_SPACING, WORLD_MARGIN, GAMEOVER_INPUT_LOCK_MS } from '../src/config.js';

// Lianas in the generation range, one extra on each side for hysteresis, plus the held one.
const MAX_LIANAS = Math.floor((SCREEN_WIDTH + 2 * WORLD_MARGIN) / LIANA_SPACING) + 1 + 2 + 1;

// Plays forward, releasing somewhere inside each gap's generated window, the way
// the frame loop drives the game (taking events every step).
function hop(game, rand) {
  const { world } = game;
  const o = world.obstacles.get(world.monkey.liana.index);
  const w = o ? releaseWindow(o.type, o.y) : releaseWindow(null, 0);
  const steps = w.start + Math.floor(rand() * w.length);
  for (let i = 0; i < steps; i++) step(game);
  game.press();
  while (world.monkey.state === MonkeyState.AIRBORNE) step(game);
}

const limits = { lianas: 0, obstacles: 0, events: 0 };
function step(game) {
  game.step(SIM_DT);
  game.takeEvents();
  limits.lianas = Math.max(limits.lianas, game.world.lianas.size);
  limits.obstacles = Math.max(limits.obstacles, game.world.obstacles.size);
  limits.events = Math.max(limits.events, game.world.events.length);
}

describe('soak', () => {
  it('plays 5,000 gaps with bounded entities and events', () => {
    const game = new Game({ createWorld: () => new World({ seed: 20260924 }) });
    const rand = mulberry32(7);
    game.press();
    for (let gap = 0; gap < 5000; gap++) hop(game, rand);
    expect(game.state).toBe(GameState.PLAYING);
    expect(game.world.monkey.liana.index).toBe(5000);
    expect(game.score).toBe(4999); // gap 0 is empty
    expect(limits.lianas).toBeLessThanOrEqual(MAX_LIANAS);
    expect(limits.obstacles).toBeLessThanOrEqual(MAX_LIANAS);
    expect(limits.events).toBeLessThanOrEqual(3);
    expect(game.events).toEqual([]);
  }, 60000);

  it('restarts 20 times without carrying anything over', () => {
    const game = new Game();
    const rand = mulberry32(8);
    game.press();
    for (let run = 0; run < 20; run++) {
      for (let h = 0; h < 5; h++) hop(game, rand);
      // Let go and drop straight out of the screen.
      game.world.release();
      Object.assign(game.world.monkey, { y: 800 });
      while (game.state === GameState.PLAYING) step(game);
      for (let i = 0; i < (GAMEOVER_INPUT_LOCK_MS / 1000) / SIM_DT; i++) step(game);
      expect(game.press()).toBe(true);
      expect(game.score).toBe(0);
      expect(game.world.lianas.size).toBeLessThanOrEqual(MAX_LIANAS);
    }
    expect(game.best).toBe(4); // each run reaches liana 5, past gaps 1-4 (gap 0 is empty)
  });
});
