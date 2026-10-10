import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world.js';
import { Game, GameState } from '../src/sim/game.js';
import { Banana } from '../src/sim/banana.js';
import { createInput } from '../src/input.js';
import { soundsFor } from '../src/audio/sounds.js';
import { lifeUp, pling } from '../src/audio/recipes.js';
import { HeartRow, heartsFor } from '../src/render/heartView.js';
import { BANANAS_PER_HEART, LIANA_SPACING, LIVES_2P, MAX_LIVES, SIM_DT } from '../src/config.js';

// A banana in each of the given gaps, at the same height in the middle of the gap.
function heartWorld(gaps, options = {}) {
  return new World({
    makeObstacle: () => null,
    makeBanana: (seed, gap) => (gaps.includes(gap) ? new Banana(gap, (gap + 0.5) * LIANA_SPACING, 100) : null),
    hearts: true,
    lives: LIVES_2P,
    ...options,
  });
}

// Player `player`'s monkey flies through the banana of gap `gap`.
function take(world, gap, player = 0) {
  world.release(player);
  Object.assign(world.monkeys[player], { x: (gap + 0.5) * LIANA_SPACING, y: 100, vx: 0, vy: 0 });
  world.step(SIM_DT);
}

const gaps = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('hearts in the world', () => {
  it('turn the next banana into a heart for every BANANAS_PER_HEART taken', () => {
    expect(BANANAS_PER_HEART).toBe(5);
    const world = heartWorld(gaps(1, 20));
    for (let gap = 1; gap <= 4; gap++) take(world, gap);
    expect([...world.bananas.values()].some((b) => b?.heart)).toBe(false);
    take(world, 5);
    // The next banana ahead, and only that one.
    expect(world.bananas.get(6).heart).toBe(true);
    expect([...world.bananas.values()].filter((b) => b?.heart)).toHaveLength(1);
    expect(world.heartGaps).toEqual(new Set([6]));
  });

  it('give a life when taken, and count as no banana', () => {
    const world = heartWorld(gaps(1, 20));
    for (let gap = 1; gap <= 5; gap++) take(world, gap);
    world.takeEvents();
    expect(world.lives[0]).toBe(LIVES_2P);
    take(world, 6);
    expect(world.takeEvents()).toEqual([{ type: 'heart', gap: 6, lives: LIVES_2P + 1, player: 0 }]);
    expect(world.lives[0]).toBe(LIVES_2P + 1);
    // Five bananas, passed or not: the heart is neither taken nor in the bananas passed.
    expect(world.bananasTaken[0]).toBe(5);
    world.scoredGapsBy[0].add(6);
    expect(world.bananaTally(0)).toEqual({ taken: 5, passed: 5 });
    expect(world.bananaAt(6)).toBeNull();
  });

  it('come again after five more bananas, not counting the heart', () => {
    const world = heartWorld(gaps(1, 30));
    for (let gap = 1; gap <= 6; gap++) take(world, gap); // gap 6 is a heart
    for (let gap = 7; gap <= 10; gap++) take(world, gap);
    expect([...world.bananas.values()].filter((b) => b?.heart && !world.takenBananas.has(b.gap))).toHaveLength(0);
    take(world, 11);
    expect(world.bananasTaken[0]).toBe(10);
    expect(world.bananas.get(12).heart).toBe(true);
  });

  it('wait for the next banana to be generated when none is left ahead', () => {
    const world = heartWorld([...gaps(1, 5), 90]);
    for (let gap = 1; gap <= 5; gap++) take(world, gap);
    expect(world.pendingHearts).toBe(1);
    expect(world.heartGaps.size).toBe(0);
    // Generated later, it is the heart (and it is not counted as a banana).
    const banana = world.makeBanana(90);
    expect(banana.heart).toBe(true);
    expect(world.pendingHearts).toBe(0);
    expect(world.bananaGaps.has(90)).toBe(false);
    // And stays one if it is generated again after being culled.
    expect(world.makeBanana(90).heart).toBe(true);
  });

  it('never give more than MAX_LIVES', () => {
    expect(MAX_LIVES).toBe(99);
    const world = heartWorld(gaps(1, 20));
    world.lives[0] = MAX_LIVES - 1;
    for (let gap = 1; gap <= 5; gap++) take(world, gap);
    take(world, 6);
    expect(world.lives[0]).toBe(MAX_LIVES);
    // Another heart is taken and used up, and the lives stay.
    for (let gap = 7; gap <= 11; gap++) take(world, gap);
    take(world, 12);
    expect(world.lives[0]).toBe(MAX_LIVES);
    expect(world.bananaAt(12)).toBeNull();
  });

  it('are not turned on in the games without lives', () => {
    const world = heartWorld(gaps(1, 20), { hearts: false, lives: 1 });
    for (let gap = 1; gap <= 10; gap++) take(world, gap);
    expect([...world.bananas.values()].some((b) => b?.heart)).toBe(false);
    expect(world.bananasTaken[0]).toBe(10);
    expect(world.lives[0]).toBe(1);
  });

  it('go to whoever takes it, in shared screen, after five bananas of one player', () => {
    const world = heartWorld(gaps(1, 20), { players: 2, ownLianas: true });
    world.start();
    for (let gap = 1; gap <= 5; gap++) take(world, gap, 0);
    expect(world.bananas.get(6).heart).toBe(true);
    take(world, 6, 1);
    expect(world.lives).toEqual([LIVES_2P, LIVES_2P + 1]);
    expect(world.bananasTaken).toEqual([5, 0]);
  });

  it('count lives from the start of the match: the life lost on respawn comes off the total', () => {
    const world = heartWorld(gaps(1, 20));
    world.lives[0] = 6;
    world.eliminate(0, 'test');
    expect(world.lives[0]).toBe(5);
  });
});

describe('lives for single player', () => {
  const makeGame = (options) =>
    new Game({ createWorld: (o) => new World({ ...o, makeObstacle: () => null, makeBanana: () => null }), ...options });

  it('are off by default, with one life and no hearts', () => {
    const game = makeGame();
    expect(game.lives).toBe(false);
    expect(game.livesOn).toBe(false);
    expect(game.playerLives(0)).toBe(1);
    expect(game.world.hearts).toBe(false);
  });

  it('are turned on with the title screen toggle: LIVES_2P lives and hearts, as in two-player games', () => {
    const game = makeGame();
    expect(game.toggleLives()).toBe(true);
    expect(game.livesOn).toBe(true);
    expect(game.playerLives(0)).toBe(LIVES_2P);
    expect(game.world.hearts).toBe(true);
    // Kept for the next match, and toggled back.
    game.press();
    game.end();
    game.step(0.5); // the results take input after a moment
    game.press('menu');
    expect(game.state).toBe(GameState.TITLE);
    expect(game.world.lives[0]).toBe(LIVES_2P);
    game.toggleLives();
    expect(game.playerLives(0)).toBe(1);
    expect(game.world.hearts).toBe(false);
  });

  it('only change on the title screen', () => {
    const game = makeGame();
    game.press();
    expect(game.state).toBe(GameState.PLAYING);
    expect(game.toggleLives()).toBe(false);
    expect(game.lives).toBe(false);
    game.end();
    expect(game.toggleLives()).toBe(false);
  });

  it('are always on in the two-player modes, whatever the toggle says', () => {
    for (const mode of ['shared', 'split']) {
      const game = makeGame();
      game.selectMode(mode);
      expect(game.livesOn).toBe(true);
      expect(game.toggleLives()).toBe(false);
      expect(game.worlds.every((w) => w.hearts && w.lives[0] === LIVES_2P)).toBe(true);
    }
    // The single-player setting survives a visit to two players.
    const game = makeGame({ lives: true });
    game.selectMode('shared');
    game.selectMode('solo');
    expect(game.playerLives(0)).toBe(LIVES_2P);
  });

  it('keep a best score of their own', () => {
    const game = makeGame();
    game.press();
    game.score = 9;
    game.end();
    expect(game.best).toBe(9);
    game.step(0.5);
    game.press('menu');
    game.toggleLives();
    expect(game.best).toBe(0);
    game.press();
    game.score = 4;
    game.end();
    expect(game.newBest).toBe(true);
    expect(game.best).toBe(4);
    game.step(0.5);
    game.press('menu');
    game.toggleLives();
    expect(game.best).toBe(9);
  });

  it('carry on until the last life is lost, with a heart shown in the HUD count', () => {
    const game = makeGame({ lives: true });
    game.press();
    expect(game.alive).toBe(true);
    game.world.eliminate(0, 'test');
    expect(game.world.lives[0]).toBe(LIVES_2P - 1);
    expect(game.alive).toBe(true);
  });
});

describe('the lives key', () => {
  it('toggles on H, once per press, and is not a key of any other role', () => {
    const target = new EventTarget();
    const input = createInput(target, null, { accepts: () => false });
    const key = (code, repeat = false) =>
      target.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat }));
    key('KeyH');
    key('KeyH', true);
    expect(input.consumeLivesToggle()).toBe(true);
    expect(input.consumeLivesToggle()).toBe(false);
    key('KeyH');
    key('KeyH');
    expect(input.consumeLivesToggle()).toBe(false);
    expect(input.consumeSlipToggle()).toBe(false);
  });
});

describe('hearts shown and heard', () => {
  it('shows up to five hearts: filled for the lives left, outlined for the lives lost of the start', () => {
    expect(heartsFor(3)).toEqual({ filled: 3, empty: 0, count: 0 });
    expect(heartsFor(2)).toEqual({ filled: 2, empty: 1, count: 0 });
    expect(heartsFor(1)).toEqual({ filled: 1, empty: 2, count: 0 });
    expect(heartsFor(0)).toEqual({ filled: 0, empty: 3, count: 0 });
    expect(heartsFor(4)).toEqual({ filled: 4, empty: 0, count: 0 });
    expect(heartsFor(5)).toEqual({ filled: 5, empty: 0, count: 0 });
  });

  it('shows five hearts and the number of lives once there are more than five, up to 99', () => {
    expect(heartsFor(6)).toEqual({ filled: 5, empty: 0, count: 6 });
    expect(heartsFor(42)).toEqual({ filled: 5, empty: 0, count: 42 });
    expect(heartsFor(99)).toEqual({ filled: 5, empty: 0, count: 99 });
  });

  it('draws the row, with the number at the top left of the leftmost heart only for more than five', () => {
    const row = new HeartRow(11);
    row.update(3);
    expect(row.hearts.children).toHaveLength(3);
    expect(row.count.visible).toBe(false);
    row.update(1);
    expect(row.hearts.children).toHaveLength(3); // one filled, two outlines
    row.update(7);
    expect(row.hearts.children).toHaveLength(5);
    expect(row.count.visible).toBe(true);
    expect(row.count.text).toBe('7');
    // At the top left of the leftmost heart (the first child, furthest left).
    const leftmost = row.hearts.children[0];
    expect(row.count.x).toBeLessThan(leftmost.x);
    expect(row.count.y).toBeLessThan(leftmost.y);
    row.update(99);
    expect(row.count.text).toBe('99');
    row.update(5);
    expect(row.count.visible).toBe(false);
  });

  it('plays its own sound for a heart, apart from the banana’s', () => {
    const [heart] = soundsFor([{ type: 'heart', gap: 6, lives: 4, player: 0 }]);
    expect(heart.name).toBe('life');
    expect(soundsFor([{ type: 'banana', gap: 1, taken: 1, player: 0 }])[0].name).toBe(pling().name);
    expect(lifeUp().voices.length).toBeGreaterThan(pling().voices.length);
  });
});
