import { Container, Graphics, Text } from 'pixi.js';
import { paneLayouts } from '../layout.js';
import { GameState } from '../sim/game.js';
import { drawBanana } from './bananaView.js';
import { HeartRow } from './heartView.js';

// Label colours per player, matching their monkeys' fur.
export const PLAYER_COLORS = [0xf4e7c5, 0xffb061];

function label(size, color) {
  const t = new Text({
    text: '',
    style: {
      fontFamily: 'sans-serif',
      fontSize: size,
      fontWeight: 'bold',
      fill: color,
      dropShadow: { color: 0x000000, alpha: 0.6, distance: 2, blur: 2, angle: Math.PI / 4 },
    },
  });
  t.anchor.set(1, 0);
  return t;
}

// The text for player `p` in two-player modes: their score, and OUT once they have no lives
// left (the hearts are drawn under it, see HeartRow).
export function playerLine(game, p) {
  return `P${p + 1}  ${game.playerScore(p)}${game.playerOut(p) ? '  OUT' : ''}`;
}

// Player `p`'s bananas, for the results: taken out of passed.
export function bananaLine(game, p) {
  const { taken, passed } = game.playerBananas(p);
  return `${taken} / ${passed}`;
}

// A banana and a count, right-aligned at its position.
class BananaTally {
  constructor(color) {
    this.view = new Container();
    this.icon = new Graphics();
    drawBanana(this.icon, 11);
    this.text = label(22, color);
    this.view.addChild(this.icon, this.text);
  }

  update(text) {
    if (this.text.text === text) return;
    this.text.text = text;
    this.icon.position.set(-this.text.width - 16, 15);
  }
}

// Top-right. Single player: the score and the best score of this page session. Split
// screen: each player's score at the top right of their pane; shared screen: both
// players' side by side. Under each score, how many bananas that player has taken (out of
// how many passed only shows on the results), and in games with lives, their hearts.
export class Hud {
  constructor() {
    this.view = new Container();
    this.solo = label(36, PLAYER_COLORS[0]);
    this.players = PLAYER_COLORS.map((color) => label(28, color));
    this.tallies = PLAYER_COLORS.map((color) => new BananaTally(color));
    this.heartRows = PLAYER_COLORS.map(() => new HeartRow());
    this.view.addChild(this.solo, ...this.players, ...this.tallies.map((t) => t.view), ...this.heartRows.map((r) => r.view));
    this.shown = [];
  }

  resize(layout) {
    this.layout = layout;
    this.placed = null;
  }

  update(game) {
    this.view.visible = game.state !== GameState.TITLE;
    const { layout } = this;
    const solo = game.players === 1;
    this.solo.visible = solo;
    const placement = `${game.players}:${game.worlds.length}`;
    if (placement !== this.placed) {
      this.placed = placement;
      this.shown = [];
      const right = layout.view.width - layout.insets.right - 24;
      const top = layout.insets.top + 12;
      this.solo.position.set(right, top);
      this.solo.scale.set(layout.ui);
      const panes = paneLayouts(layout, game.worlds.length);
      this.players.forEach((t, p) => {
        if (panes.length > 1) t.position.set(right, panes[p].y + 8);
        else t.position.set(right - (1 - p) * 300, top);
      });
      this.tallies.forEach((tally, p) => {
        if (solo) tally.view.position.set(right, top + 46 * layout.ui);
        else tally.view.position.set(this.players[p].x, this.players[p].y + 36);
        tally.view.scale.set(solo ? layout.ui : 1);
      });
      this.heartRows.forEach((row, p) => {
        // The last heart's right edge in line with the text above it.
        const edge = row.size * 1.05;
        if (solo) row.view.position.set(right - edge * layout.ui, top + 86 * layout.ui);
        else row.view.position.set(this.players[p].x - edge, this.players[p].y + 72);
        row.view.scale.set(solo ? layout.ui : 1);
      });
    }
    const texts = solo
      ? [`${game.score}  BEST ${Math.max(game.best, game.score)}`] // best tracks the live score
      : this.players.map((_, p) => playerLine(game, p));
    const targets = solo ? [this.solo] : this.players;
    texts.forEach((text, i) => {
      if (text !== this.shown[i]) targets[i].text = text;
    });
    this.shown = texts;
    this.players.forEach((t) => (t.visible = !solo));
    this.tallies.forEach((tally, p) => {
      tally.view.visible = p < game.players;
      if (tally.view.visible) tally.update(String(game.playerBananas(p).taken));
    });
    // The hearts, in the games with lives; none once a player is out.
    this.heartRows.forEach((row, p) => {
      row.view.visible = p < game.players && game.livesOn && !game.playerOut(p);
      if (row.view.visible) row.update(game.playerLives(p));
    });
  }
}
