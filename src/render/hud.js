import { Container, Text } from 'pixi.js';
import { LIVES_2P } from '../config.js';
import { paneLayouts } from '../layout.js';
import { GameState } from '../sim/game.js';

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

// The text for player `p` in two-player modes: their score and lives left.
export function playerLine(game, p) {
  const lives = game.playerLives(p);
  const hearts = game.playerOut(p) ? 'OUT' : '♥'.repeat(lives) + '♡'.repeat(Math.max(LIVES_2P - lives, 0));
  return `P${p + 1}  ${game.playerScore(p)}  ${hearts}`;
}

// Top-right. Single player: the score and the best score of this page session. Split
// screen: each player's score and lives at the top right of their pane; shared
// screen: both players' side by side.
export class Hud {
  constructor() {
    this.view = new Container();
    this.solo = label(36, PLAYER_COLORS[0]);
    this.players = PLAYER_COLORS.map((color) => label(28, color));
    this.view.addChild(this.solo, ...this.players);
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
      this.solo.position.set(right, layout.insets.top + 12);
      this.solo.scale.set(layout.ui);
      const panes = paneLayouts(layout, game.worlds.length);
      this.players.forEach((t, p) => {
        if (panes.length > 1) t.position.set(right, panes[p].y + 8);
        else t.position.set(right - (1 - p) * 300, layout.insets.top + 12);
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
  }
}
