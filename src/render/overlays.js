import { version } from '../../package.json';
import {
  ARROW_Y,
  BANNER_TEXTS,
  CREAM,
  FADE_IN,
  GOLD,
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
import { CONFIG_BACK_Y, CONFIG_PANEL, GRAPHICS_ITEMS } from './configMenu.js';
import { inside } from '../controls.js';
import { configMenuLayout, panelPoint, resultsMenuLayout, titleMenuLayout } from './menuLayout.js';

// The overlays (plain state and placement in views/overlays.js): the title, results and pause panels, the stage banners and "out" notes per
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

  place({ x = 0, y = 0, size }) {
    this.text.setPosition(x, y);
    if (size && this.text.style.fontSize !== `${size}px`) {
      this.text.setFontSize(size);
      this.lay();
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
  view.surface = art.nineSlice(scene, 'ui.panel', width + 2, height + 2).setPosition(-width / 2 - 1, -height / 2 + shiftY - 1);
  view.add(view.surface);
  return view;
}

function placePanel(view, geometry) {
  view.setPosition(geometry.x, geometry.y).setScale(geometry.scale);
  const surface = view.surface;
  surface.setSize((geometry.width + 2) / surface.scaleX, (geometry.height + 2) / surface.scaleY);
  surface.setPosition(-geometry.width / 2 - 1, -geometry.height / 2 - 1);
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
  constructor(scene, art, { configMenu = null, mobile = false } = {}) {
    this.view = makeContainer(scene);
    this.time = 0;
    this.configMenu = configMenu;
    this.mobile = mobile;
    this.labels = []; // every label with the scale it is drawn at: [label, () => scale]
    const label = (parent, spec, content, scale) => {
      const l = new Label(scene, spec, content);
      parent.add(l.text);
      this.labels.push([l, scale]);
      return l;
    };
    const ui = () => this.layout?.ui ?? 1;
    const menuScale = () => configMenu ? this.title.scaleX : this.layout?.ui ?? 1;
    const configScale = () => this.config?.scaleX ?? 1;
    const resultsScale = () => configMenu ? this.gameOver.scaleX : this.layout?.ui ?? 1;

    const title = PANELS.title.texts;
    this.title = panel(scene, art, configMenu ? { width: 520, height: 540, shiftY: 0 } : PANELS.title);
    this.titleName = label(this.title, title.name, undefined, menuScale);
    this.tagline = label(this.title, title.tagline, undefined, menuScale);
    this.titleControl = label(this.title, title.control, undefined, menuScale);
    this.titlePrompt = label(this.title, title.prompt, undefined, menuScale);
    this.modePicker = makeContainer(scene).setPosition(0, title.modes.y);
    this.title.add(this.modePicker);
    this.modes = modeItems().map(({ id, text }) => ({ id, label: label(this.modePicker, MODE_FONT, text, menuScale) }));
    this.layModes = true;
    this.livesLine = label(this.title, title.lives, undefined, menuScale);
    this.slipLine = label(this.title, title.slip, undefined, menuScale);
    this.shadowLine = label(this.title, title.shadow, undefined, menuScale);
    this.keysHint = label(this.title, configMenu ? { ...title.keys, y: 216, size: 13 } : title.keys, undefined, menuScale);
    this.titleVersion = label(this.title, title.version, `v${version}`, menuScale);

    if (configMenu) {
      this.configEntry = label(this.title, { y: 190, size: 18, bold: true, color: GOLD }, 'C · Config', menuScale);
      this.config = panel(scene, art, CONFIG_PANEL).setVisible(false);
      this.configHeading = label(this.config, { y: -194, size: 52, bold: true }, 'CONFIG', configScale);
      this.configSubtitle = label(this.config, { y: -146, size: 22, color: GOLD }, 'Graphics', configScale);
      this.graphicsItems = GRAPHICS_ITEMS.map((item) => ({ ...item,
        label: label(this.config, { y: item.y, size: item.choice === 'auto' ? 20 : 26, bold: true }, item.text, configScale),
      }));
      this.configHint = label(this.config, { y: 172, size: 14, alpha: 0.7 }, 'Changes reload the game', configScale);
      this.configBack = label(this.config, { y: CONFIG_BACK_Y, size: 20 }, 'C / Esc · Back', configScale);
      this.view.add(this.config);
    }

    const over = PANELS.gameOver.texts;
    this.gameOver = panel(scene, art, PANELS.gameOver);
    this.gameOverTitle = label(this.gameOver, over.title, undefined, resultsScale);
    this.scoreText = label(this.gameOver, over.score, undefined, resultsScale);
    this.bestText = label(this.gameOver, over.best, undefined, resultsScale);
    this.bananas = makeContainer(scene).setPosition(0, over.bananas.y);
    this.gameOver.add(this.bananas);
    this.bananaIcon = art.image(scene, 'banana.results');
    this.bananas.add(this.bananaIcon);
    this.bananasText = label(this.bananas, { ...over.bananas, y: 0 }, undefined, resultsScale);
    this.newBestText = label(this.gameOver, over.newBest, undefined, resultsScale);
    this.gameOverPrompt = label(this.gameOver, over.prompt, undefined, resultsScale);
    if (configMenu) this.gameOverMenu = label(this.gameOver, { y: 180, size: 24, color: GOLD }, 'Title menu', resultsScale);

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
    if (this.config) this.view.bringToTop(this.config);
    this.shown = null;
    this.promptsFor = null;
    this.zoom = 1;
  }

  // `zoom`: device pixels per view unit, for the texts.
  resize(layout, zoom = 1, menuArea = null) {
    this.layout = layout;
    this.zoom = zoom;
    for (const name of ['title', 'gameOver', 'paused']) this[name].setPosition(layout.panels[name].x, layout.panels[name].y).setScale(layout.ui);
    if (this.config && menuArea) this.#placeMenus(menuArea);
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
    this.configMenu?.sync(game);
    const configShown = shown.title && !!this.configMenu?.open;
    this.config?.setVisible(configShown);
    this.title.setVisible(shown.title && !configShown);
    this.titlePrompt.text.setAlpha(glow);
    if (shown.title) {
      if (this.titleGeometry) this.#updateMenuTitle(game, kind);
      else this.#updateTitle(game, inputType !== 'touch');
    }
    if (this.config) {
      this.configEntry.set(kind === 'touch' ? 'Config' : 'C · Config');
      if (!this.titleGeometry) this.configEntry.text.y = kind === 'touch' ? 180 : 190;
      this.configBack.set(kind === 'touch' ? 'Back' : 'C / Esc · Back');
      for (const item of this.graphicsItems) {
        const selected = item.choice === this.configMenu.choice;
        item.label.setColor(selected ? GOLD : CREAM);
        item.label.text.setAlpha(selected ? 1 : 0.8);
      }
    }

    this.gameOver.setVisible(shown.gameOver);
    if (shown.gameOver) {
      this.gameOver.setAlpha(Math.min(game.stateTime / FADE_IN, 1));
      const results = resultsState(game);
      if (results.key !== this.shown) {
        this.gameOverTitle.set(results.title);
        this.scoreText.set(results.score);
        this.bestText.set(results.best);
        this.bananasText.set(results.bananas);
        this.bananas.y = this.gameOverGeometry?.bananas.y ?? results.bananasY;
        const at = resultsBananas(this.bananasText.width);
        this.bananaIcon.setPosition(at.iconX, at.iconY);
        this.bananasText.text.x = at.textX;
        this.shown = results.key;
      }
      this.newBestText.text.setVisible(results.newBest);
      this.gameOverPrompt.text.setVisible(game.canRestart()).setAlpha(glow);
      this.gameOverMenu?.text.setVisible(game.canRestart());
    }

    this.paused.setVisible(shown.paused);
    if (shown.paused) this.pausedPrompt.set(pausePrompt(pauseReason, kind));
  }

  // Canvas pointer positions are CSS pixels. Hit regions use the same panel/UI
  // transforms as its artwork, including portrait enlargement and letterboxing.
  interceptConfigPointer(event, game, accepts) {
    if (!this.configMenu) return false;
    this.configMenu.sync(game);
    if (!accepts) return this.configMenu.open;
    const rect = this.scene.sys.game.canvas.getBoundingClientRect();
    const point = (view) => panelPoint(this.layout, rect, view, event.clientX, event.clientY);
    if (game.state === 'RESULTS' && this.gameOverGeometry) {
      if (!game.canRestart()) return true;
      if (inside(this.gameOverGeometry.menuHit, point(this.gameOver))) {
        this.configMenu.clear();
        game.press('menu');
        return true;
      }
      return false;
    }
    if (game.state !== 'TITLE') return this.configMenu.open;
    if (this.configMenu.open) {
      const p = point(this.config);
      if (inside(this.configGeometry?.backHit ?? { x: -200, y: CONFIG_BACK_Y - 32, w: 400, h: 64 }, p)) this.configMenu.close();
      else {
        const item = this.graphicsItems.find((item, i) => inside(this.configGeometry?.items[i].hit ?? { x: -200,
          y: item.y - (item.choice === 'auto' ? 25 : 37), w: 400,
          h: item.choice === 'auto' ? 50 : 74 }, p));
        if (item) this.configMenu.choose(item.choice);
      }
      return true; // outside taps do not start the underlying title screen
    }
    if (this.titleGeometry) {
      const p = point(this.title);
      const mode = this.titleGeometry.modes.findIndex((item) => inside(item.hit, p));
      if (mode !== -1) { this.configMenu.clear(); game.selectMode(this.modes[mode].id); return true; }
      const setting = this.titleGeometry.settings.findIndex((item) => inside(item.hit, p));
      if (setting !== -1) {
        this.configMenu.clear();
        if (setting === 0) game.toggleLives();
        else if (setting === 1) game.toggleSlip();
        else game.toggleShadow();
        return true;
      }
      if (inside(this.titleGeometry.configHit, p)) return this.configMenu.show(game, accepts);
      return false;
    }
    const y = event.pointerType === 'touch' ? 180 : 190;
    if (inside({ x: -190, y: y - (event.pointerType === 'touch' ? 30 : 12), w: 380,
      h: event.pointerType === 'touch' ? 60 : 36 }, point(this.title))) {
      return this.configMenu.show(game, accepts);
    }
    return false;
  }

  #placeMenus(area) {
    this.titleGeometry = titleMenuLayout(this.layout, area, { mobile: this.mobile });
    this.configGeometry = configMenuLayout(this.layout, area);
    this.gameOverGeometry = resultsMenuLayout(this.layout, area);
    const title = this.titleGeometry, config = this.configGeometry;
    placePanel(this.title, title);
    placePanel(this.config, config);
    this.titleName.place(title.name);
    this.tagline.place(title.tagline);
    this.titleControl.place(title.control);
    this.titlePrompt.place(title.prompt);
    this.configEntry.place(title.config);
    this.keysHint.place(title.keys);
    this.titleVersion.place(title.version);
    this.titleVersion.text.setVisible(true);
    this.modePicker.setPosition(0, 0);
    this.modes.forEach((item, i) => { if (title.modes[i]) item.label.place({ ...title.modes[i], size: 22 }); });
    [this.livesLine, this.slipLine, this.shadowLine].forEach((label, i) => label.place({ ...title.settings[i], size: 22 }));
    this.configHeading.place(config.heading);
    this.configSubtitle.place(config.subtitle);
    this.configHint.place(config.hint).set(config.compact ? 'Changes reload\nthe game' : 'Changes reload the game');
    this.configHint.text.setVisible(!config.condensed);
    this.configBack.place({ ...config.back, size: 22 });
    this.graphicsItems.forEach((item, i) => item.label.place({ ...config.items[i], size: config.compact ? 24 : item.choice === 'auto' ? 20 : 26 }));
    const results = this.gameOverGeometry;
    placePanel(this.gameOver, results);
    this.gameOverTitle.place(results.heading);
    this.scoreText.place(results.score);
    this.bestText.place(results.best);
    this.bananas.setPosition(results.bananas.x, results.bananas.y);
    this.bananasText.place({ size: results.bananas.size });
    this.newBestText.place(results.newBest);
    this.gameOverPrompt.place(results.replay);
    this.gameOverMenu.place(results.menu);
  }

  #updateMenuTitle(game, kind) {
    const keyboard = kind !== 'touch';
    this.modePicker.setVisible(!this.mobile);
    this.keysHint.text.setVisible(keyboard && !this.mobile && !this.titleGeometry.condensed);
    this.modes.forEach(({ id, label }, i) => {
      const look = modeLook(id, game.mode);
      label.set(keyboard ? modeItems()[i].text : ['1P', '2P shared', '2P split'][i]).setColor(look.color);
      label.text.setAlpha(look.alpha);
    });
    const solo = game.mode === 'solo';
    const settings = [
      [this.livesLine, 'H', 'Lives', solo ? game.lives : true, solo],
      [this.slipLine, 'G', 'Slipping', game.slip, true],
      [this.shadowLine, 'S', 'Shadow', game.shadowOn, solo],
    ];
    for (const [label, key, name, on, enabled] of settings) {
      label.set(`${keyboard ? `${key} · ` : ''}${name}\n${on ? 'On' : 'Off'}`).setColor(enabled && on ? GOLD : CREAM);
      label.text.setVisible(true).setAlpha(enabled ? 1 : 0.45);
    }
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
    this.gameOverPrompt.set(this.gameOverMenu ? (kind === 'touch' ? 'Tap to play again' : 'Press Space to play again') : p.again);
    this.promptsFor = key;
  }
}
