import { describe, it, expect } from 'vitest';
import { Game, GameState } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';
import { Obstacle } from '../src/sim/obstacle.js';
import { MonkeyState } from '../src/sim/monkey.js';
import {
  LIANA_SPACING,
  LIVES_2P,
  RESPAWN_DELAY_MS,
  RESPAWN_GRIP,
  RESPAWN_INVULN_MS,
  SIM_DT,
} from '../src/config.js';
import { FORWARD_RELEASE_STEP, flyUntilGrab, stepN } from './helpers.js';

const steps = (ms) => Math.round(ms / 1000 / SIM_DT);

// A split-screen game over worlds without obstacles or bananas (unless given).
function splitGame(makeObstacle = () => null) {
  const game = new Game({ createWorld: (options) => new World({ ...options, makeObstacle, makeBanana: () => null }) });
  game.selectMode('split');
  return game;
}

// Drops player p's monkey out of the bottom of the world.
function drop(game, p) {
  const { world, index } = game.slot(p);
  world.release(index);
  Object.assign(world.monkeys[index], { x: world.monkeys[index].x, y: 760, vx: 0, vy: 100 });
}

describe('split screen', () => {
  it('has a world per player, with the same seed and LIVES_2P lives each', () => {
    const game = splitGame();
    expect(game.worlds).toHaveLength(2);
    expect(game.worlds[0].seed).toBe(game.worlds[1].seed);
    for (const world of game.worlds) {
      expect(world.monkeys).toHaveLength(1);
      expect(world.lives).toEqual([LIVES_2P]);
    }
    expect(game.slot(1)).toEqual({ world: game.worlds[1], index: 0 });
    // Same seed, same level.
    const a = new World({ seed: game.world.seed });
    const b = new World({ seed: game.world.seed });
    for (const gap of [1, 5, 20]) expect(a.makeObstacle(gap)?.toData()).toEqual(b.makeObstacle(gap)?.toData());
  });

  it('gives each player their own key and world, and tags events with the player', () => {
    const game = splitGame();
    game.press('start');
    stepN(game, FORWARD_RELEASE_STEP);
    game.press('p2');
    expect(game.worlds[0].monkey.state).toBe(MonkeyState.HANGING);
    expect(game.worlds[1].monkey.state).toBe(MonkeyState.AIRBORNE);
    game.step(SIM_DT);
    expect(game.takeEvents().filter((e) => e.type === 'release')).toEqual([{ type: 'release', liana: 0, player: 1, pane: 1 }]);
    game.press('primary');
    expect(game.worlds[0].monkey.state).toBe(MonkeyState.HANGING);
  });

  it('respawns on the last liana grabbed, at RESPAWN_GRIP, invulnerable for a while', () => {
    // A rock right where the monkey will hang on liana 1 after respawning.
    const rock = new Obstacle(1, 'rock', LIANA_SPACING + 60, 330);
    const game = splitGame((seed, gap) => (gap === 1 ? rock : null));
    game.press('start');
    const world = game.worlds[0];
    stepN(game, FORWARD_RELEASE_STEP);
    world.release();
    expect(flyUntilGrab(world)).toBe(1);
    drop(game, 0);
    stepN(game, 3);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
    expect(world.lives[0]).toBe(LIVES_2P - 1);
    expect(game.state).toBe(GameState.PLAYING);
    stepN(game, steps(RESPAWN_DELAY_MS) - 3);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
    game.takeEvents();
    game.step(SIM_DT);
    expect(game.takeEvents()).toEqual([{ type: 'respawn', liana: 1, player: 0, pane: 0 }]);
    expect(world.monkey.state).toBe(MonkeyState.HANGING);
    expect(world.monkey.liana.index).toBe(1);
    expect(world.monkey.gripRadius).toBeCloseTo(RESPAWN_GRIP, 0); // slipping since this step
    // Invulnerable: the swing passes through the rock.
    expect(world.isInvulnerable(0)).toBe(true);
    let passedThrough = false;
    for (let i = 0; i < steps(RESPAWN_INVULN_MS) - 1; i++) {
      game.step(SIM_DT);
      if (rock.hitsCircle(world.monkey.x, world.monkey.y, 22)) passedThrough = true;
    }
    expect(passedThrough).toBe(true);
    expect(world.monkey.state).toBe(MonkeyState.HANGING);
    game.step(SIM_DT);
    expect(world.isInvulnerable(0)).toBe(false);
  });

  it('stops a player with no lives left; the other plays on; totals decide the winner', () => {
    const game = splitGame();
    game.press('start');
    // Player 2 scores by hopping (gaps are empty here, so give points directly).
    game.worlds[1].scores[0] = 5;
    for (let life = 0; life < LIVES_2P; life++) {
      drop(game, 0);
      stepN(game, steps(RESPAWN_DELAY_MS) + 5);
    }
    expect(game.playerOut(0)).toBe(true);
    expect(game.playerLives(0)).toBe(0);
    expect(game.worlds[0].respawnStep[0]).toBeNull();
    expect(game.state).toBe(GameState.PLAYING);
    expect(game.worlds[1].monkey.state).toBe(MonkeyState.HANGING);
    game.worlds[0].scores[0] = 2; // scores add up over all lives
    for (let life = 0; life < LIVES_2P; life++) {
      drop(game, 1);
      stepN(game, steps(RESPAWN_DELAY_MS) + 5);
    }
    expect(game.state).toBe(GameState.RESULTS);
    expect([game.playerScore(0), game.playerScore(1)]).toEqual([2, 5]);
    expect(game.winners).toEqual([1]);
    // The session best is for single player.
    expect(game.best).toBe(0);
  });

  it('calls a draw on equal totals', () => {
    const game = splitGame();
    game.press('start');
    game.worlds[0].scores[0] = 3;
    game.worlds[1].scores[0] = 3;
    expect(game.winners).toEqual([0, 1]);
  });

  it('starts a new match with a new seed on restart', () => {
    const game = splitGame();
    const seed = game.world.seed;
    game.press('start');
    game.end();
    stepN(game, 60);
    expect(game.press('start')).toBe(true);
    expect(game.worlds).toHaveLength(2);
    expect(game.world.seed).not.toBe(seed);
    expect(game.worlds[1].seed).toBe(game.world.seed);
  });
});

describe('two-player HUD', () => {
  it('shows each player’s score and lives, and OUT when they have none', async () => {
    const { playerLine } = await import('../src/render/hud.js');
    const game = splitGame();
    game.press('start');
    game.worlds[1].scores[0] = 7;
    expect(playerLine(game, 0)).toBe('P1  0  ♥♥♥');
    drop(game, 1);
    stepN(game, 3);
    expect(playerLine(game, 1)).toBe('P2  7  ♥♥♡');
    game.worlds[1].lives[0] = 1;
    game.worlds[1].respawnStep[0] = null;
    expect(playerLine(game, 1)).toBe('P2  7  OUT');
  });
});
