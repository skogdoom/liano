import { describe, it, expect } from 'vitest';
import { HUD_HEART_SIZE, heartRow, heartSpacing, hudPlacement, hudState, tallyIcon } from '../src/views/hud.js';
import { layoutFor, paneLayouts } from '../src/layout.js';
import { GameState } from '../src/sim/game.js';
import { MAX_SHOWN } from '../src/views/hearts.js';

// The HUD's view-model (PHASER_PLAN.md, M6): both versions draw it from these.

const game = (over = {}) => ({
  players: 1,
  worlds: [{}],
  state: GameState.PLAYING,
  score: 0,
  best: 0,
  livesOn: false,
  playerScore: () => 0,
  playerOut: () => false,
  playerBananasTaken: () => 0,
  playerLives: () => 3,
  ...over,
});

describe('the HUD', () => {
  it('sits top right inside the safe area, enlarged with the layout in portrait', () => {
    const layout = layoutFor(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    const at = hudPlacement(layout, 1, 1);
    expect(at.solo).toEqual({ x: layout.view.width - 24, y: layout.insets.top + 12, scale: layout.ui });
    expect(layout.ui).toBeGreaterThan(1);
    // The banana count and the hearts under the score, as far apart as it is enlarged.
    expect(at.tallies[0]).toEqual({ x: at.solo.x, y: at.solo.y + 46 * layout.ui, scale: layout.ui });
    expect(at.hearts[0].y).toBeCloseTo(at.solo.y + 86 * layout.ui, 9);
    expect(at.hearts[0].x).toBeCloseTo(at.solo.x - HUD_HEART_SIZE * 1.05 * layout.ui, 9);
  });

  it('puts the players side by side in shared screen, and each at the top of their pane in split screen', () => {
    const layout = layoutFor(1280, 720, undefined, { fixed: true });
    const shared = hudPlacement(layout, 2, 1);
    expect(shared.labels[1].x - shared.labels[0].x).toBe(300);
    expect(shared.labels[0].y).toBe(shared.labels[1].y);
    const split = hudPlacement(layout, 2, 2);
    const panes = paneLayouts(layout, 2);
    split.labels.forEach((label, p) => expect(label.y).toBe(panes[p].y + 8));
    split.tallies.forEach((tally, p) => expect(tally).toEqual({ x: split.labels[p].x, y: split.labels[p].y + 36, scale: 1 }));
  });

  it('shows nothing on the title, the best tracking the live score, and hearts only with lives', () => {
    expect(hudState(game({ state: GameState.TITLE })).visible).toBe(false);
    const solo = hudState(game({ score: 12, best: 7, playerBananasTaken: () => 4 }));
    expect(solo).toMatchObject({ visible: true, solo: true, soloText: '12  BEST 12', playerTexts: [], tallies: ['4', null], lives: [null, null] });
    const two = hudState(game({ players: 2, livesOn: true, playerScore: (p) => [5, 9][p], playerOut: (p) => p === 1, playerLives: (p) => [2, 0][p] }));
    expect(two.playerTexts).toEqual(['P1  5', 'P2  9  OUT']);
    // None for a player out of lives.
    expect(two.lives).toEqual([2, null]);
  });

  it('lays out a heart row right-aligned, with the count over the leftmost past the hearts it shows', () => {
    const three = heartRow(3);
    expect(three.hearts.at(-1).x).toBe(-0);
    expect(three.hearts.every((h) => h.filled)).toBe(true);
    expect(three.count).toBeNull();
    const many = heartRow(MAX_SHOWN + 4);
    expect(many.hearts).toHaveLength(MAX_SHOWN);
    expect(many.count.text).toBe(String(MAX_SHOWN + 4));
    expect(many.count.x).toBeCloseTo(-(MAX_SHOWN - 1) * heartSpacing(HUD_HEART_SIZE) - HUD_HEART_SIZE * 0.95, 9);
    const lost = heartRow(1);
    expect(lost.hearts.filter((h) => !h.filled).length).toBeGreaterThan(0);
  });

  it('puts the banana left of its count', () => {
    expect(tallyIcon(30)).toEqual({ x: -46, y: 15 });
  });
});
