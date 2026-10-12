import { RED_DARK } from '../views/hearts.js';
import { HUD_FONT, HUD_HEART_SIZE, HUD_SHADOW, PLAYER_COLORS, heartCountFont, heartRow, hudPlacement, hudState, tallyIcon } from '../views/hud.js';
import { makeContainer } from './world/build.js';
import { makeText, setTextOrigin, setTextResolution } from './text.js';

// The HUD in the Phaser version, as the Pixi Hud (views/hud.js has what both share): top
// right, the scores, the banana counts and the hearts. Texts are Phaser Text, laid out as
// Pixi lays them out (text.js); the icons are pieces.

// A label right-aligned at its point.
const label = (scene, size, color) => makeText(scene, '', { family: HUD_FONT.family, size, weight: HUD_FONT.weight, fill: color, shadow: HUD_SHADOW });
const setLabel = (text, content) => setTextOrigin(text.setText(content), 1, 0);

// A banana and a count, right-aligned at its position.
class BananaTally {
  constructor(scene, art, color) {
    this.view = makeContainer(scene);
    this.icon = art.image(scene, 'banana.hud');
    this.text = label(scene, HUD_FONT.tally, color);
    this.view.add([this.icon, this.text]);
    this.shown = null;
  }

  update(content) {
    if (content === this.shown) return;
    this.shown = content;
    setLabel(this.text, content);
    const icon = tallyIcon(this.text.pixiWidth);
    this.icon.setPosition(icon.x, icon.y);
  }
}

// A row of hearts right-aligned at its position, with the count on the leftmost when
// there are more lives than hearts.
class HeartRow {
  constructor(scene, art, size = HUD_HEART_SIZE) {
    this.scene = scene;
    this.art = art;
    this.size = size;
    this.view = makeContainer(scene);
    this.hearts = makeContainer(scene);
    const font = heartCountFont(size);
    this.count = makeText(scene, '', { family: font.family, size: font.size, weight: font.weight, fill: 0xffffff, stroke: RED_DARK, strokeWidth: font.stroke });
    this.view.add([this.hearts, this.count]);
    this.shown = null;
  }

  update(lives) {
    if (lives === this.shown) return;
    this.shown = lives;
    const row = heartRow(lives, this.size);
    this.hearts.removeAll(true);
    for (const { x, filled } of row.hearts) this.hearts.add(this.art.image(this.scene, 'heart.hud', filled ? 0 : 1).setPosition(x, 0));
    this.count.setVisible(row.count !== null);
    if (row.count) setTextOrigin(this.count.setText(row.count.text)).setPosition(row.count.x, row.count.y);
  }
}

export class Hud {
  constructor(scene, art) {
    this.view = makeContainer(scene);
    this.solo = label(scene, HUD_FONT.solo, PLAYER_COLORS[0]);
    this.players = PLAYER_COLORS.map((color) => label(scene, HUD_FONT.player, color));
    this.tallies = PLAYER_COLORS.map((color) => new BananaTally(scene, art, color));
    this.heartRows = PLAYER_COLORS.map(() => new HeartRow(scene, art));
    this.view.add([this.solo, ...this.players, ...this.tallies.map((t) => t.view), ...this.heartRows.map((r) => r.view)]);
    this.shown = [];
    this.resolution = 1;
  }

  // `zoom`: device pixels per view unit, for the texts.
  resize(layout, zoom = 1) {
    this.layout = layout;
    this.zoom = zoom;
    this.placed = null;
  }

  update(game) {
    const state = hudState(game);
    this.view.setVisible(state.visible);
    if (!state.visible) return;
    this.solo.setVisible(state.solo);
    const placement = `${game.players}:${game.worlds.length}`;
    if (placement !== this.placed) {
      this.placed = placement;
      this.shown = [];
      const at = hudPlacement(this.layout, game.players, game.worlds.length);
      this.solo.setPosition(at.solo.x, at.solo.y).setScale(at.solo.scale);
      setTextResolution(this.solo, this.zoom * at.solo.scale);
      this.players.forEach((t, p) => setTextResolution(t.setPosition(at.labels[p].x, at.labels[p].y), this.zoom));
      this.tallies.forEach((tally, p) => {
        tally.view.setPosition(at.tallies[p].x, at.tallies[p].y).setScale(at.tallies[p].scale);
        setTextResolution(tally.text, this.zoom * at.tallies[p].scale);
        tally.shown = null;
      });
      this.heartRows.forEach((row, p) => {
        row.view.setPosition(at.hearts[p].x, at.hearts[p].y).setScale(at.hearts[p].scale);
        setTextResolution(row.count, this.zoom * at.hearts[p].scale);
        row.shown = null;
      });
    }
    const texts = state.solo ? [state.soloText] : state.playerTexts;
    const targets = state.solo ? [this.solo] : this.players;
    texts.forEach((text, i) => {
      if (text !== this.shown[i]) setLabel(targets[i], text);
    });
    this.shown = texts;
    this.players.forEach((t) => t.setVisible(!state.solo));
    this.tallies.forEach((tally, p) => {
      tally.view.setVisible(state.tallies[p] !== null);
      if (state.tallies[p] !== null) tally.update(state.tallies[p]);
    });
    this.heartRows.forEach((row, p) => {
      row.view.setVisible(state.lives[p] !== null);
      if (state.lives[p] !== null) row.update(state.lives[p]);
    });
  }
}
