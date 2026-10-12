import { Container, Graphics, Text } from 'pixi.js';
import { HUD_FONT, HUD_SHADOW, PLAYER_COLORS, hudPlacement, hudState, tallyIcon } from '../views/hud.js';
import { drawBanana } from './bananaView.js';
import { HeartRow } from './heartView.js';

// The parts both versions share (pure: no Pixi) are in views/hud.js.
export * from '../views/hud.js';

function label(size, color) {
  const t = new Text({
    text: '',
    style: { fontFamily: HUD_FONT.family, fontSize: size, fontWeight: HUD_FONT.weight, fill: color, dropShadow: HUD_SHADOW },
  });
  t.anchor.set(1, 0);
  return t;
}

// A banana and a count, right-aligned at its position.
class BananaTally {
  constructor(color) {
    this.view = new Container();
    this.icon = new Graphics();
    drawBanana(this.icon, 11);
    this.text = label(HUD_FONT.tally, color);
    this.view.addChild(this.icon, this.text);
  }

  update(text) {
    if (this.text.text === text) return;
    this.text.text = text;
    const icon = tallyIcon(this.text.width);
    this.icon.position.set(icon.x, icon.y);
  }
}

// Top right: the scores, banana counts and hearts (see views/hud.js).
export class Hud {
  constructor() {
    this.view = new Container();
    this.solo = label(HUD_FONT.solo, PLAYER_COLORS[0]);
    this.players = PLAYER_COLORS.map((color) => label(HUD_FONT.player, color));
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
    const state = hudState(game);
    this.view.visible = state.visible;
    this.solo.visible = state.solo;
    const placement = `${game.players}:${game.worlds.length}`;
    if (placement !== this.placed) {
      this.placed = placement;
      this.shown = [];
      const at = hudPlacement(this.layout, game.players, game.worlds.length);
      this.solo.position.set(at.solo.x, at.solo.y);
      this.solo.scale.set(at.solo.scale);
      this.players.forEach((t, p) => t.position.set(at.labels[p].x, at.labels[p].y));
      this.tallies.forEach((tally, p) => {
        tally.view.position.set(at.tallies[p].x, at.tallies[p].y);
        tally.view.scale.set(at.tallies[p].scale);
      });
      this.heartRows.forEach((row, p) => {
        row.view.position.set(at.hearts[p].x, at.hearts[p].y);
        row.view.scale.set(at.hearts[p].scale);
      });
    }
    const texts = state.solo ? [state.soloText] : state.playerTexts;
    const targets = state.solo ? [this.solo] : this.players;
    texts.forEach((text, i) => {
      if (text !== this.shown[i]) targets[i].text = text;
    });
    this.shown = texts;
    this.players.forEach((t) => (t.visible = !state.solo));
    this.tallies.forEach((tally, p) => {
      tally.view.visible = state.tallies[p] !== null;
      if (tally.view.visible) tally.update(state.tallies[p]);
    });
    this.heartRows.forEach((row, p) => {
      row.view.visible = state.lives[p] !== null;
      if (row.view.visible) row.update(state.lives[p]);
    });
  }
}
