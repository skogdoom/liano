import { describe, it, expect } from 'vitest';
import { Game, GameState } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';
import { SIM_DT } from '../src/config.js';

// How many obstacles a player who never presses anything gets past, for each of `seeds`
// seeds: with slipping on the grip slips to the tip and the monkey is forced off there;
// with it off the monkey holds on and lets go, tired, at the same point of a swing.
function passiveScores(slip, seeds) {
  const scores = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const game = new Game({ slip, createWorld: (options) => new World({ ...options, seed: seed * 7919 }) });
    game.press();
    for (let steps = 0; game.state === GameState.PLAYING && steps < 120 * 60 * 20; steps++) {
      game.step(SIM_DT);
      game.takeEvents();
    }
    scores.push(game.score);
  }
  return scores.sort((a, b) => a - b);
}

describe('a player who only lets the monkey slip off', () => {
  // Measured over 100 seeds: slipping a median of 15 obstacles and at most 30; holding a
  // median of 12 and at most 27. (The forced release used to come mid-window, 0.11 of a
  // swing: a median of 53, and up to 82, with slipping.)
  it.each([
    ['slipping', true],
    ['holding', false],
  ])('falls early when %s', (_, slip) => {
    const scores = passiveScores(slip, 30);
    expect(scores[scores.length >> 1]).toBeLessThanOrEqual(25);
    expect(scores.at(-1)).toBeLessThanOrEqual(60);
  });
});
