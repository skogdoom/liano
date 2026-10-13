import { Container, Graphics, Text } from 'pixi.js';
import { version } from '../../package.json';
import {
  ARROW_Y,
  BANNER_TEXTS,
  CREAM,
  FADE_IN,
  MODE_FONT,
  MODE_GAP,
  OUT_NOTE_FONT,
  OVERLAY_FONT,
  OVERLAY_SHADOW,
  PANELS,
  SETTINGS_GAP,
  StageBannerState,
  arrowState,
  bannerPlacement,
  centredRow,
  drawArrow,
  drawPanel,
  modeItems,
  modeLook,
  outNote,
  panelsShown,
  pausePrompt,
  prompts,
  pulse,
  resultsBananas,
  resultsState,
  titleState,
} from '../views/overlays.js';
import { drawBanana } from './bananaView.js';

// The parts both versions share (pure: no Pixi) are in views/overlays.js.
export * from '../views/overlays.js';

function text(content, size, { color = CREAM, bold = false } = {}) {
  const t = new Text({
    text: content,
    style: { fontFamily: OVERLAY_FONT, fontSize: size, fontWeight: bold ? 'bold' : 'normal', fill: color, dropShadow: OVERLAY_SHADOW, align: 'center' },
  });
  t.anchor.set(0.5);
  return t;
}

// A panel's text from its description (views/overlays.js), placed in the panel.
function panelText(parent, spec, content = spec.text ?? '') {
  const t = text(content, spec.size, spec);
  t.y = spec.y;
  if (spec.x !== undefined) t.x = spec.x;
  if (spec.anchorX !== undefined) t.anchor.set(spec.anchorX, 0.5);
  if (spec.alpha !== undefined) t.alpha = spec.alpha;
  parent.addChild(t);
  return t;
}

// A rounded panel, with children placed relative to its centre.
function panel({ width, height, shiftY }) {
  const view = new Container();
  view.addChild(drawPanel(new Graphics(), -width / 2, -height / 2 + shiftY, width, height));
  return view;
}

// "Stage 2" with the time of day (see StageBannerState).
class StageBanner {
  constructor() {
    this.view = new Container();
    this.title = panelText(this.view, BANNER_TEXTS.title);
    this.subtitle = panelText(this.view, BANNER_TEXTS.subtitle);
    this.state = new StageBannerState();
    this.view.visible = false;
  }

  update(game, world, dt) {
    const { alpha, title, subtitle } = this.state.update(game, world, dt);
    if (this.title.text !== title) this.title.text = title;
    if (this.subtitle.text !== subtitle) this.subtitle.text = subtitle;
    this.view.visible = alpha > 0;
    this.view.alpha = alpha;
  }
}

// The title screen's mode picker, with the selected mode highlighted.
class ModePicker {
  constructor() {
    this.view = new Container();
    this.items = modeItems().map(({ id, text: content }) => {
      const t = text(content, MODE_FONT.size, MODE_FONT);
      this.view.addChild(t);
      return { id, t };
    });
    centredRow(
      this.items.map(({ t }) => t.width),
      MODE_GAP,
    ).forEach((x, i) => (this.items[i].t.x = x));
    this.shown = null;
  }

  update(mode) {
    if (mode === this.shown) return;
    for (const { id, t } of this.items) {
      const look = modeLook(id, mode);
      t.style.fill = look.color;
      t.alpha = look.alpha;
    }
    this.shown = mode;
  }
}

// Title, game over and pause screens, the stage banners and "out" notes, and the
// off-screen indicator. Positions and sizes come from the layout (see layout.js).
export class Overlays {
  constructor() {
    this.view = new Container();
    this.time = 0;

    // Right of the title-screen swing, so the monkey stays in view.
    const title = PANELS.title.texts;
    this.title = panel(PANELS.title);
    panelText(this.title, title.name);
    this.tagline = panelText(this.title, title.tagline);
    this.titleControl = panelText(this.title, title.control);
    this.titlePrompt = panelText(this.title, title.prompt);
    this.modePicker = new ModePicker();
    this.modePicker.view.y = title.modes.y;
    this.title.addChild(this.modePicker.view);
    this.livesLine = panelText(this.title, title.lives);
    this.slipLine = panelText(this.title, title.slip);
    this.shadowLine = panelText(this.title, title.shadow);
    this.keysHint = panelText(this.title, title.keys);
    panelText(this.title, title.version, `v${version}`);

    const over = PANELS.gameOver.texts;
    this.gameOver = panel(PANELS.gameOver);
    this.gameOverTitle = panelText(this.gameOver, over.title);
    this.scoreText = panelText(this.gameOver, over.score);
    this.bestText = panelText(this.gameOver, over.best);
    this.bananas = new Container();
    this.bananas.y = over.bananas.y;
    this.gameOver.addChild(this.bananas);
    this.bananaIcon = new Graphics();
    drawBanana(this.bananaIcon, 13);
    this.bananasText = text('', over.bananas.size, over.bananas);
    this.bananas.addChild(this.bananaIcon, this.bananasText);
    this.newBestText = panelText(this.gameOver, over.newBest);
    this.gameOverPrompt = panelText(this.gameOver, over.prompt);

    this.paused = panel(PANELS.paused);
    panelText(this.paused, PANELS.paused.texts.title);
    this.pausedPrompt = panelText(this.paused, PANELS.paused.texts.prompt);

    this.indicator = drawArrow(new Graphics());
    this.indicator.y = ARROW_Y;
    // A stage banner and an "out" note per pane.
    this.banners = [];
    this.outNotes = [];
    this.paneLayer = new Container();
    this.view.addChild(this.indicator, this.paneLayer, this.title, this.gameOver, this.paused);
    this.shown = null;
    this.promptsFor = null;
  }

  resize(layout) {
    this.layout = layout;
    for (const [name, view] of [
      ['title', this.title],
      ['gameOver', this.gameOver],
      ['paused', this.paused],
    ]) {
      view.position.set(layout.panels[name].x, layout.panels[name].y);
      view.scale.set(layout.ui);
    }
  }

  // `pauseReason` is null while running.
  update(game, cameraX, { pauseReason, inputType, dt }) {
    this.time += dt;
    const kind = inputType === 'touch' ? 'touch' : 'other';
    this.#setPrompts(kind, game.players);
    const glow = pulse(this.time);

    // The arrow over a monkey above the view is for single player.
    const arrow = arrowState(game, game.world.monkey, cameraX, this.layout);
    this.indicator.visible = arrow.visible;
    if (arrow.x !== null) this.indicator.x = arrow.x;
    this.#updatePanes(game, dt);

    const shown = panelsShown(game, pauseReason);
    this.title.visible = shown.title;
    this.titlePrompt.alpha = glow;
    if (this.title.visible) this.#updateTitle(game, inputType !== 'touch');

    this.gameOver.visible = shown.gameOver;
    if (this.gameOver.visible) {
      this.gameOver.alpha = Math.min(game.stateTime / FADE_IN, 1);
      const results = resultsState(game);
      if (results.key !== this.shown) {
        this.gameOverTitle.text = results.title;
        this.scoreText.text = results.score;
        this.bestText.text = results.best;
        this.bananasText.text = results.bananas;
        this.bananas.y = results.bananasY;
        const at = resultsBananas(this.bananasText.width);
        this.bananaIcon.position.set(at.iconX, at.iconY);
        this.bananasText.x = at.textX;
        this.shown = results.key;
      }
      this.newBestText.visible = results.newBest;
      this.gameOverPrompt.visible = game.canRestart();
      this.gameOverPrompt.alpha = glow;
    }

    this.paused.visible = shown.paused;
    if (this.paused.visible) this.pausedPrompt.text = pausePrompt(pauseReason, kind);
  }

  // Split screen's panes, or the single one: a banner and a note in each.
  #updatePanes(game, dt) {
    const count = game.worlds.length;
    while (this.banners.length < count) {
      const banner = new StageBanner();
      const note = text('', OUT_NOTE_FONT.size, OUT_NOTE_FONT);
      this.banners.push(banner);
      this.outNotes.push(note);
      this.paneLayer.addChild(banner.view, note);
    }
    this.banners.forEach((banner, i) => {
      const note = this.outNotes[i];
      if (i >= count) {
        banner.view.visible = false;
        note.visible = false;
        return;
      }
      banner.update(game, game.worlds[i], dt);
      const at = bannerPlacement(this.layout, count, i);
      banner.view.position.set(at.x, at.y);
      banner.view.scale.set(at.scale);
      const out = outNote(game, this.layout, count, i);
      note.visible = out !== null;
      if (out) {
        note.text = out.text;
        note.position.set(out.x, out.y);
      }
    });
  }

  #updateTitle(game, showModes) {
    const state = titleState(game, showModes);
    for (const view of [this.modePicker.view, this.livesLine, this.slipLine, this.shadowLine, this.keysHint]) view.visible = showModes;
    this.modePicker.update(game.mode);
    const lines = [
      [this.livesLine, state.lives],
      [this.slipLine, state.slip],
      [this.shadowLine, state.shadow],
    ];
    for (const [line, look] of lines) {
      line.text = look.text;
      line.style.fill = look.color;
      line.alpha = look.alpha;
    }
    centredRow(
      lines.map(([line]) => line.width),
      SETTINGS_GAP,
    ).forEach((x, i) => (lines[i][0].x = x));
    this.tagline.y = state.taglineY;
    this.titleControl.y = state.controlY;
    this.titlePrompt.y = state.promptY;
  }

  // Prompts for the input in use; the control hint also names each player's key.
  #setPrompts(kind, players) {
    const key = `${kind}:${players}`;
    if (key === this.promptsFor) return;
    const p = prompts(kind, players);
    this.titlePrompt.text = p.start;
    this.titleControl.text = p.control;
    this.gameOverPrompt.text = p.again;
    this.promptsFor = key;
  }
}
