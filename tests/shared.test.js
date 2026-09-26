import { describe, it, expect } from 'vitest';
import { Game, GameState } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { LianaState } from '../src/sim/liana.js';
import {
  BOOST_PERIOD,
  CAMERA_LERP,
  LIANA_SPACING,
  LIVES_2P,
  MONKEY_RADIUS,
  RESPAWN_DELAY_MS,
  SCREEN_WIDTH,
  SHARED_LEADER_X,
  SIM_DT,
  SWING_PERIOD,
} from '../src/config.js';
import { FORWARD_RELEASE_STEP, flyUntilGrab, stepN } from './helpers.js';

const steps = (ms) => Math.round(ms / 1000 / SIM_DT);

function sharedGame() {
  const game = new Game({
    createWorld: (options) => new World({ ...options, makeObstacle: () => null, makeBanana: () => null }),
  });
  game.selectMode('shared');
  return game;
}

// Flies monkey `player` of `world` from its liana to the next one.
function hop(world, player) {
  world.release(player);
  for (let i = 0; i < 600 && world.monkeys[player].state === MonkeyState.AIRBORNE; i++) world.step(SIM_DT);
}

describe('shared lianas', () => {
  it('holds both monkeys, each at its own grip radius, in the same swing', () => {
    const world = new World({ players: 2, makeObstacle: () => null, makeBanana: () => null });
    world.start();
    const [a, b] = world.monkeys;
    // Player 1 hops to liana 1; player 2 follows a bit later and joins its swing.
    // Both inside the start grip's first window (steps 21-36).
    stepN(world, 22);
    world.release(0);
    stepN(world, 12);
    world.release(1);
    for (let i = 0; i < 600 && (a.state !== MonkeyState.HANGING || b.state !== MonkeyState.HANGING); i++) world.step(SIM_DT);
    expect(a.liana.index).toBe(1);
    expect(b.liana).toBe(a.liana);
    const liana = a.liana;
    expect(liana.holders).toBe(2);
    // Joining did not restart the swing: it is older than player 2's grip.
    expect(liana.swingTime).toBeGreaterThan(b.gripTime + SIM_DT);
    expect(a.gripRadius).not.toBeCloseTo(b.gripRadius, 1);
    for (const m of [a, b]) {
      expect(Math.hypot(m.x - liana.x, m.y - liana.anchorY)).toBeCloseTo(m.gripRadius, 9);
    }
    // One letting go leaves the other swinging.
    world.release(0);
    expect(liana.state).toBe(LianaState.SWINGING);
    world.release(1);
    expect(liana.state).toBe(LianaState.SETTLING);
  });

  it('keeps a boost for the next liana of its own when joining a swing', () => {
    const world = new World({ players: 2, makeObstacle: () => null, makeBanana: () => null });
    world.start();
    const [a, b] = world.monkeys;
    b.boostGrabs = 2;
    stepN(world, 22);
    world.release(1); // boosted: player 2 gets to liana 1 first, swinging it boosted
    stepN(world, 12);
    world.release(0);
    for (let i = 0; i < 600 && (a.state !== MonkeyState.HANGING || b.state !== MonkeyState.HANGING); i++) world.step(SIM_DT);
    expect(b.liana.period).toBe(BOOST_PERIOD);
    expect(a.liana).toBe(b.liana);
    expect(b.boostGrabs).toBe(1);
    expect(a.boostGrabs).toBe(0);
    // A monkey with a boost joining an unboosted swing keeps its boost.
    const c = new World({ players: 2, makeObstacle: () => null, makeBanana: () => null });
    c.monkeys[1].boostGrabs = 3;
    c.monkeys[1].release();
    c.monkeys[1].vx = 1;
    c.monkeys[1].grab(c.lianas.get(0), 200);
    expect(c.lianas.get(0).period).toBe(SWING_PERIOD);
    expect(c.monkeys[1].boostGrabs).toBe(3);
  });
});

describe('shared screen', () => {
  it('follows the leader, the alive and non-invulnerable monkey furthest right', () => {
    const game = sharedGame();
    game.press('start');
    const world = game.world;
    const view = game.sharedView;
    expect(view.camera.screenX).toBeCloseTo(SHARED_LEADER_X * SCREEN_WIDTH, 9);
    stepN(game, FORWARD_RELEASE_STEP);
    game.press('p2');
    for (let i = 0; i < 600 && world.monkeys[1].state === MonkeyState.AIRBORNE; i++) game.step(SIM_DT);
    expect(world.monkeys[1].liana.index).toBe(1);
    expect(view.leader).toBe(1);
    // It holds on the leader's liana, not its swing; player 1, a liana behind, is safe
    // however the two swing.
    for (let i = 0; i < 600; i++) {
      game.step(SIM_DT);
      if (world.monkeys[1].state !== MonkeyState.HANGING) break;
    }
    expect(Math.abs(view.camera.x + view.camera.screenX - LIANA_SPACING)).toBeLessThan(40);
    expect(game.playerLives(0)).toBe(LIVES_2P);
  });

  it('pans to the other monkey when the leader dies, without snapping', () => {
    const game = sharedGame();
    game.press('start');
    const world = game.world;
    const view = game.sharedView;
    stepN(game, FORWARD_RELEASE_STEP);
    game.press('p2');
    for (let i = 0; i < 600 && world.monkeys[1].state === MonkeyState.AIRBORNE; i++) game.step(SIM_DT);
    stepN(game, 120);
    // The leader falls out of the world.
    world.release(1);
    Object.assign(world.monkeys[1], { y: 760, vy: 100 });
    let biggestMove = 0;
    let previous = view.camera.x;
    for (let i = 0; i < 240; i++) {
      game.step(SIM_DT);
      biggestMove = Math.max(biggestMove, Math.abs(view.camera.x - previous));
      previous = view.camera.x;
    }
    expect(view.leader).toBe(0);
    // Eased: at most CAMERA_LERP·dt of the remaining distance per step (a liana apart).
    expect(biggestMove).toBeLessThan(LIANA_SPACING * CAMERA_LERP * SIM_DT);
    expect(Math.abs(view.camera.x + view.camera.screenX - world.monkeys[0].liana.x)).toBeLessThan(40);
  });

  it('takes a life from a monkey left behind the left edge, and respawns it on the leftmost liana in view', () => {
    const game = sharedGame();
    game.press('start');
    const world = game.world;
    const view = game.sharedView;
    // Player 2 hops ahead three lianas; player 1 stays on liana 0.
    for (let h = 0; h < 3; h++) {
      stepN(game, FORWARD_RELEASE_STEP);
      game.press('p2');
      game.takeEvents();
      for (let i = 0; i < 600 && world.monkeys[1].state === MonkeyState.AIRBORNE; i++) {
        game.step(SIM_DT);
        if (world.monkeys[0].state === MonkeyState.DEAD) break;
      }
      if (world.monkeys[0].state === MonkeyState.DEAD) break;
    }
    expect(world.monkeys[0].state).toBe(MonkeyState.DEAD);
    expect(world.monkeys[0].x + MONKEY_RADIUS).toBeLessThan(view.camera.x + 20);
    expect(game.playerLives(0)).toBe(LIVES_2P - 1);
    for (let i = 0; i < steps(RESPAWN_DELAY_MS) + 2; i++) game.step(SIM_DT);
    const liana = world.monkeys[0].liana;
    expect(world.monkeys[0].state).toBe(MonkeyState.HANGING);
    expect(liana.index).toBe(view.respawnLiana());
    expect(liana.x - MONKEY_RADIUS).toBeGreaterThanOrEqual(view.camera.x - 5);
    expect(liana.x - LIANA_SPACING - MONKEY_RADIUS).toBeLessThan(view.camera.x);
    expect(world.isInvulnerable(0)).toBe(true);
    expect(game.state).toBe(GameState.PLAYING);
  });

  it('never leaves a monkey behind on the title screen', () => {
    const game = sharedGame();
    game.world.monkeys[0].x = -5000;
    game.step(SIM_DT);
    expect(game.world.monkeys[0].state).not.toBe(MonkeyState.DEAD);
  });
});
