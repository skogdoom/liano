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
import { makeContainer } from './world/build.js';
import { makeText, setTextOrigin, setTextResolution, textResolution } from './text.js';

// The overlays in the Phaser version, as the Pixi Overlays (views/overlays.js has what
// both share): the title, results and pause panels, the stage banners and "out" notes per
// pane, and the arrow over a monkey above the view. Panels and the arrow are pieces; the
// texts are Phaser Text laid out as Pixi lays them out (text.js).

const css = (color) => `#${color.toString(16).padStart(6, '0')}`;

// A text centred on its point (or anchored at `anchorX` across), with the overlays' shadow.
class Label {
  constructor(scene, spec, content = spec.text ?? '') {
    this.anchorX = spec.anchorX ?? 0.5;
    this.text = makeText(scene, content, { family: OVERLAY_FONT, size: spec.size, weight: spec.bold ? 'bold' : 'normal', fill: spec.color ?? CREAM, align: 'center', shadow: OVERLAY_SHADOW });
    this.text.setPosition(spec.x ?? 0, spec.y ?? 0).setAlpha(spec.alpha ?? 1);
    this.lay();
  }

  lay() {
    setTextOrigin(this.text, this.anchorX, 0.5);
  }

  set(content) {
    if (this.text.text !== content) {
      this.text.setText(content);
      this.lay();
    }
    return this;
  }

  setColor(color) {
    const value = css(color);
    if (this.text.style.color !== value) {
      this.text.setColor(value);
    }
    return this;
  }

  // Pixels per unit to rasterize at.
  setResolution(resolution) {
    if (this.text.style.resolution !== resolution) {
      setTextResolution(this.text, resolution);
      this.lay();
    }
    return this;
  }

  // Pixi's measured width.
  get width() {
    return this.text.pixiWidth;
  }
}

// A panel's rounded rectangle (the 9-sliced piece) centred on the container's origin, and
// its texts placed in it.
function panel(scene, art, { width, height, shiftY }) {
  const view = makeContainer(scene);
  // The piece's box reaches a unit past the rectangle on each side (its edge's stroke).
  view.add(art.nineSlice(scene, 'ui.panel', width + 2, height + 2).setPosition(-width / 2 - 1, -height / 2 + shiftY - 1));
  return view;
}

// "Stage 2" with the time of day (see StageBannerState).
class StageBanner {
  constructor(scene) {
    this.view = makeContainer(scene).setVisible(false);
    this.title = new Label(scene, BANNER_TEXTS.title);
    this.subtitle = new Label(scene, BANNER_TEXTS.subtitle);
    this.labels = [this.title, this.subtitle];
    this.view.add(this.labels.map((l) => l.text));
    this.state = new StageBannerState();
  }

  update(game, world, dt) {
    const { alpha, title, subtitle } = this.state.update(game, world, dt);
    this.title.set(title);
    this.subtitle.set(subtitle);
    this.view.setVisible(alpha > 0).setAlpha(alpha);
  }
}

export class Overlays {
  constructor(scene, art) {
    this.view = makeContainer(scene);
    this.time = 0;
    this.labels = []; // every label with the scale it is drawn at: [label, () => scale]
    const label = (parent, spec, content, scale) => {
      const l = new Label(scene, spec, content);
      parent.add(l.text);
      this.labels.push([l, scale]);
      return l;
    };
    const ui = () => this.layout?.ui ?? 1;

    const title = PANELS.title.texts;
    this.title = panel(scene, art, PANELS.title);
    label(this.title, title.name, undefined, ui);
    this.tagline = label(this.title, title.tagline, undefined, ui);
    this.titleControl = label(this.title, title.control, undefined, ui);
    this.titlePrompt = label(this.title, title.prompt, undefined, ui);
    this.modePicker = makeContainer(scene).setPosition(0, title.modes.y);
    this.title.add(this.modePicker);
    this.modes = modeItems().map(({ id, text }) => ({ id, label: label(this.modePicker, MODE_FONT, text, ui) }));
    this.layModes = true;
    this.livesLine = label(this.title, title.lives, undefined, ui);
    this.slipLine = label(this.title, title.slip, undefined, ui);
    this.shadowLine = label(this.title, title.shadow, undefined, ui);
    this.keysHint = label(this.title, title.keys, undefined, ui);
    label(this.title, title.version, `v${version}`, ui);

    const over = PANELS.gameOver.texts;
    this.gameOver = panel(scene, art, PANELS.gameOver);
    this.gameOverTitle = label(this.gameOver, over.title, undefined, ui);
    this.scoreText = label(this.gameOver, over.score, undefined, ui);
    this.bestText = label(this.gameOver, over.best, undefined, ui);
    this.bananas = makeContainer(scene).setPosition(0, over.bananas.y);
    this.gameOver.add(this.bananas);
    this.bananaIcon = art.image(scene, 'banana.results');
    this.bananas.add(this.bananaIcon);
    this.bananasText = label(this.bananas, { ...over.bananas, y: 0 }, undefined, ui);
    this.newBestText = label(this.gameOver, over.newBest, undefined, ui);
    this.gameOverPrompt = label(this.gameOver, over.prompt, undefined, ui);

    this.paused = panel(scene, art, PANELS.paused);
    label(this.paused, PANELS.paused.texts.title, undefined, ui);
    this.pausedPrompt = label(this.paused, PANELS.paused.texts.prompt, undefined, ui);

    this.indicator = art.image(scene, 'ui.arrow').setPosition(0, ARROW_Y);
    // A stage banner and an "out" note per pane.
    this.scene = scene;
    this.banners = [];
    this.outNotes = [];
    this.paneLayer = makeContainer(scene);
    this.view.add([this.indicator, this.paneLayer, this.title, this.gameOver, this.paused]);
    this.shown = null;
    this.promptsFor = null;
    this.zoom = 1;
  }

  // `zoom`: device pixels per view unit, for the texts.
  resize(layout, zoom = 1) {
    this.layout = layout;
    this.zoom = zoom;
    for (const name of ['title', 'gameOver', 'paused']) this[name].setPosition(layout.panels[name].x, layout.panels[name].y).setScale(layout.ui);
    for (const [l, scale] of this.labels) l.setResolution(textResolution(zoom, scale()));
    this.layModes = true;
    this.shown = null;
  }

  // `pauseReason` is null while running.
  update(game, cameraX, { pauseReason, inputType, dt }) {
    this.time += dt;
    const kind = inputType === 'touch' ? 'touch' : 'other';
    this.#setPrompts(kind, game.players);
    const glow = pulse(this.time);

    const arrow = arrowState(game, game.world.monkey, cameraX, this.layout);
    this.indicator.setVisible(arrow.visible);
    if (arrow.x !== null) this.indicator.x = arrow.x;
    this.#updatePanes(game, dt);

    const shown = panelsShown(game, pauseReason);
    this.title.setVisible(shown.title);
    this.titlePrompt.text.setAlpha(glow);
    if (shown.title) this.#updateTitle(game, inputType !== 'touch');

    this.gameOver.setVisible(shown.gameOver);
    if (shown.gameOver) {
      this.gameOver.setAlpha(Math.min(game.stateTime / FADE_IN, 1));
      const results = resultsState(game);
      if (results.key !== this.shown) {
        this.gameOverTitle.set(results.title);
        this.scoreText.set(results.score);
        this.bestText.set(results.best);
        this.bananasText.set(results.bananas);
        this.bananas.y = results.bananasY;
        const at = resultsBananas(this.bananasText.width);
        this.bananaIcon.setPosition(at.iconX, at.iconY);
        this.bananasText.text.x = at.textX;
        this.shown = results.key;
      }
      this.newBestText.text.setVisible(results.newBest);
      this.gameOverPrompt.text.setVisible(game.canRestart()).setAlpha(glow);
    }

    this.paused.setVisible(shown.paused);
    if (shown.paused) this.pausedPrompt.set(pausePrompt(pauseReason, kind));
  }

  #updatePanes(game, dt) {
    const count = game.worlds.length;
    while (this.banners.length < count) {
      const banner = new StageBanner(this.scene);
      const note = new Label(this.scene, OUT_NOTE_FONT);
      note.text.setVisible(false);
      this.banners.push(banner);
      this.outNotes.push(note);
      this.paneLayer.add([banner.view, note.text]);
    }
    this.banners.forEach((banner, i) => {
      const note = this.outNotes[i];
      if (i >= count) {
        banner.view.setVisible(false);
        note.text.setVisible(false);
        return;
      }
      banner.update(game, game.worlds[i], dt);
      const at = bannerPlacement(this.layout, count, i);
      banner.view.setPosition(at.x, at.y).setScale(at.scale);
      for (const l of banner.labels) l.setResolution(textResolution(this.zoom, at.scale));
      const out = outNote(game, this.layout, count, i);
      note.text.setVisible(out !== null);
      if (out) {
        note.setResolution(this.zoom).set(out.text);
        note.text.setPosition(out.x, out.y);
      }
    });
  }

  #updateTitle(game, showModes) {
    const state = titleState(game, showModes);
    for (const view of [this.modePicker, this.livesLine.text, this.slipLine.text, this.shadowLine.text, this.keysHint.text]) view.setVisible(showModes);
    if (this.layModes) {
      centredRow(
        this.modes.map(({ label }) => label.width),
        MODE_GAP,
      ).forEach((x, i) => (this.modes[i].label.text.x = x));
      this.layModes = false;
    }
    for (const { id, label } of this.modes) {
      const look = modeLook(id, game.mode);
      label.setColor(look.color);
      label.text.setAlpha(look.alpha);
    }
    const lines = [
      [this.livesLine, state.lives],
      [this.slipLine, state.slip],
      [this.shadowLine, state.shadow],
    ];
    for (const [line, look] of lines) {
      line.set(look.text).setColor(look.color);
      line.text.setAlpha(look.alpha);
    }
    centredRow(
      lines.map(([line]) => line.width),
      SETTINGS_GAP,
    ).forEach((x, i) => (lines[i][0].text.x = x));
    this.tagline.text.y = state.taglineY;
    this.titleControl.text.y = state.controlY;
    this.titlePrompt.text.y = state.promptY;
  }

  #setPrompts(kind, players) {
    const key = `${kind}:${players}`;
    if (key === this.promptsFor) return;
    const p = prompts(kind, players);
    this.titlePrompt.set(p.start);
    this.titleControl.set(p.control);
    this.gameOverPrompt.set(p.again);
    this.promptsFor = key;
  }
}
