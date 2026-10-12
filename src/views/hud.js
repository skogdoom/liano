import { paneLayouts } from '../layout.js';
import { GameState } from '../sim/game.js';
import { heartsFor } from './hearts.js';

// The HUD: what both versions draw from (no Pixi here). Top right: in single player the
// score and the best score of this page session; in split screen each player's score at
// the top right of their pane; in shared screen both players' side by side. Under each
// score, how many bananas that player has taken and, in games with lives, their hearts.
// The Pixi view is render/hud.js.

// Label colours per player, matching their monkeys' fur.
export const PLAYER_COLORS = [0xf4e7c5, 0xffb061];
// The labels' font: bold sans-serif with a soft shadow down and right.
export const HUD_FONT = { family: 'sans-serif', weight: 'bold', solo: 36, player: 28, tally: 22 };
export const HUD_SHADOW = { color: 0x000000, alpha: 0.6, distance: 2, blur: 2, angle: Math.PI / 4 };
// A heart row's heart (its size, as drawHeart takes it) and the gap from one to the next.
export const HUD_HEART_SIZE = 11;
export const heartSpacing = (size) => size * 2.3;
// The count on a row with more hearts than it shows: white, edged in dark red.
export const heartCountFont = (size) => ({ family: 'sans-serif', weight: 'bold', size: Math.round(size * 1.05), stroke: 3 });

// The text for player `p` in two-player modes: their score, and OUT once they have no lives
// left (the hearts are drawn under it).
export function playerLine(game, p) {
  return `P${p + 1}  ${game.playerScore(p)}${game.playerOut(p) ? '  OUT' : ''}`;
}

// Player `p`'s bananas, for the results: taken out of passed.
export function bananaLine(game, p) {
  const { taken, passed } = game.playerBananas(p);
  return `${taken} / ${passed}`;
}

// Where the HUD's parts go in the view (each right-aligned at its point; `scale` is how
// much it is enlarged), for `players` players and `worlds` worlds.
export function hudPlacement(layout, players, worlds) {
  const { ui } = layout;
  const solo = players === 1;
  const right = layout.view.width - layout.insets.right - 24;
  const top = layout.insets.top + 12;
  const panes = paneLayouts(layout, worlds);
  const labels = PLAYER_COLORS.map((_, p) => (panes.length > 1 ? { x: right, y: panes[p].y + 8 } : { x: right - (1 - p) * 300, y: top }));
  // The last heart's right edge in line with the text above it.
  const edge = HUD_HEART_SIZE * 1.05;
  return {
    solo: { x: right, y: top, scale: ui },
    labels,
    tallies: labels.map((label) => (solo ? { x: right, y: top + 46 * ui, scale: ui } : { x: label.x, y: label.y + 36, scale: 1 })),
    hearts: labels.map((label) => (solo ? { x: right - edge * ui, y: top + 86 * ui, scale: ui } : { x: label.x - edge, y: label.y + 72, scale: 1 })),
  };
}

// What the HUD shows for `game`: whether it shows at all, the solo line (single player)
// or each player's line, and per player their banana count and hearts (null when hidden).
export function hudState(game) {
  const solo = game.players === 1;
  return {
    visible: game.state !== GameState.TITLE,
    solo,
    // The best tracks the live score.
    soloText: solo ? `${game.score}  BEST ${Math.max(game.best, game.score)}` : null,
    playerTexts: solo ? [] : PLAYER_COLORS.map((_, p) => playerLine(game, p)),
    tallies: PLAYER_COLORS.map((_, p) => (p < game.players ? String(game.playerBananasTaken(p)) : null)),
    // The hearts, in the games with lives; none once a player is out.
    lives: PLAYER_COLORS.map((_, p) => (p < game.players && game.livesOn && !game.playerOut(p) ? game.playerLives(p) : null)),
  };
}

// A banana tally: the count right-aligned at the tally's point, and the banana's centre
// left of it, for a count `textWidth` wide.
export const tallyIcon = (textWidth) => ({ x: -textWidth - 16, y: 15 });

// A row of hearts right-aligned at its point: each heart's centre and whether it is
// filled, and the count at the top left of the leftmost (null for none).
export function heartRow(lives, size = HUD_HEART_SIZE) {
  const { filled, empty, count } = heartsFor(lives);
  const spacing = heartSpacing(size);
  const total = filled + empty;
  return {
    hearts: Array.from({ length: total }, (_, i) => ({ x: -(total - 1 - i) * spacing, filled: i < filled })),
    count: count > 0 ? { text: String(count), x: -(total - 1) * spacing - size * 0.95, y: -size * 0.85 } : null,
  };
}
