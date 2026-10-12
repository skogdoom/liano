import Phaser from 'phaser';
import { version } from '../../package.json';
import { SHARED_ZOOM, WORLD_HEIGHT } from '../config.js';
import { paneLayouts } from '../layout.js';
import { FULLSCREEN_HIT, MUTE_HIT } from '../controls.js';
import { MODES } from '../sim/match.js';
import { Art, CATALOG, queueCatalog, queueSet } from './art.js';
import { applyViewCamera } from './view.js';
import { WorldPane } from './world/pane.js';

// The Phaser version's scenes (PHASER_PLAN.md, M2): Boot loads the art and starts the
// others; Play draws the worlds (M5), UI the HUD, panels and buttons (M6). Each scene's
// camera shows the logical view as the layout places it (see view.js). The platform
// (main.js) holds the layout, pause and full screen; scenes find it in the game's
// registry.
//
// So far Play draws the worlds over a plain frame (until the backdrop, M5d), and UI a
// readout of the game (readout below), "Paused", and stand-in mute and full-screen
// buttons.

const VIEW = 0x10261a;
const BAND = 0x4a8060;
const CREAM = '#f4e7c5';

const platformOf = (scene) => scene.registry.get('platform');

// Keeps a scene's main camera on the view, now and after every layout change.
function followLayout(scene, onLayout = () => {}) {
  const platform = platformOf(scene);
  const place = () => {
    applyViewCamera(scene.cameras.main, platform.camera);
    onLayout(platform.layout, platform.camera);
  };
  platform.on('layout', place);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => platform.off('layout', place));
  place();
}

// Loads the art (art.js): the catalog, then the boot set of atlases at the scale the
// screen needs (device pixels per world unit: the camera's zoom), then starts the other
// scenes and loads the main set behind them. The platform gets `art` (an Art) and emits
// 'art' with the set's name as each set comes in; `artLoad` keeps the times taken.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.started = performance.now();
    queueCatalog(this.load);
  }

  create() {
    const platform = platformOf(this);
    const catalog = this.cache.json.get(CATALOG);
    const scale = Art.scaleFor(platform.camera.zoom);
    platform.art = new Art(catalog, scale);
    platform.artLoad = { scale, sets: [] };
    const loadSet = (set, then) => {
      queueSet(this.load, catalog, set, scale);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        platform.artLoad.sets.push({ set, ms: Math.round(performance.now() - this.started) });
        platform.emit('art', set);
        then?.();
      });
      this.load.start();
    };
    loadSet('boot', () => {
      this.scene.launch('ui');
      this.scene.launch('play');
      loadSet('main');
    });
  }
}

export class PlayScene extends Phaser.Scene {
  constructor() {
    super('play');
  }

  create() {
    const platform = platformOf(this);
    this.platform = platform;
    this.panes = [];
    this.paneWorlds = null;
    // Screen shake is off for players who ask for reduced motion.
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const frame = this.add.graphics();
    followLayout(this, ({ view, bandTop }) => {
      frame.clear().fillStyle(VIEW).fillRect(0, 0, view.width, view.height).fillStyle(BAND).fillRect(0, bandTop, view.width, WORLD_HEIGHT);
      this.layoutPanes();
    });
    // The world is drawn once the main set of the art is in (obstacles are in it); until
    // then the game holds presses (see main.js).
    const start = () => {
      this.ready = true;
      platform.world = this;
      this.sync();
    };
    if (platform.artLoad.sets.some((s) => s.set === 'main')) start();
    else {
      const onArt = (set) => {
        if (set !== 'main') return;
        platform.off('art', onArt);
        start();
      };
      platform.on('art', onArt);
    }
  }

  // Places the panes as the layout says (paneLayouts): shared screen shows a wider stretch.
  layoutPanes() {
    const { game, layout } = this.platform;
    if (!this.panes.length) return;
    const zoom = game.mode === 'shared' ? SHARED_ZOOM : 1;
    paneLayouts(layout, this.panes.length, zoom).forEach((pane, i) => this.panes[i].resize(pane));
  }

  // A pane per world, rebuilt when the mode or match changes the worlds. In split screen
  // pane p shows player p; otherwise the one pane shows every player.
  sync() {
    if (!this.ready) return;
    const { game } = this.platform;
    const same = this.paneWorlds && this.paneWorlds.length === game.worlds.length && this.paneWorlds.every((w, i) => w === game.worlds[i]);
    if (same) return;
    const relayout = !this.paneWorlds || this.paneWorlds.length !== game.worlds.length;
    while (this.panes.length < game.worlds.length) this.panes.push(new WorldPane(this, this.platform.art));
    for (const pane of this.panes.splice(game.worlds.length)) pane.destroy();
    game.worlds.forEach((world, i) => {
      const players = game.worlds.length > 1 ? [i] : world.monkeys.map((_, m) => m);
      this.panes[i].setWorld(world, players, game.sharedView?.camera);
    });
    this.paneWorlds = [...game.worlds];
    if (relayout) this.layoutPanes();
  }

  // After every sim step (see main.js).
  stepCameras(dt) {
    for (const pane of this.panes) pane.stepCamera(dt);
  }

  update() {
    const { frame, game } = this.platform;
    if (!this.ready || !frame) return;
    this.sync();
    const { frameDt, alpha, events } = frame;
    const ghost = game.shadowFrame();
    this.panes.forEach((pane, i) =>
      pane.update(events.length === 0 ? events : events.filter((e) => e.pane === i), frameDt, !this.reducedMotion.matches, i === 0 ? ghost : null, alpha),
    );
  }
}

// Four corner brackets, pointing out to enter full screen and in to leave it (a stand-in
// for the button's art, M6).
function drawFullscreenIcon(g, active) {
  const size = 38;
  const arm = 12;
  g.clear().lineStyle(4, 0xf4e7c5);
  for (const [cx, cy, dx, dy] of [
    [0, 0, 1, 1],
    [size, 0, -1, 1],
    [0, size, 1, -1],
    [size, size, -1, -1],
  ]) {
    const x = active ? cx + dx * arm : cx;
    const y = active ? cy + dy * arm : cy;
    const sx = active ? -dx : dx;
    const sy = active ? -dy : dy;
    g.lineBetween(x + sx * arm, y, x, y).lineBetween(x, y, x, y + sy * arm);
  }
}

// A speaker, crossed out when muted (a stand-in for the button's art, M6).
function drawMuteIcon(g, muted) {
  g.clear().fillStyle(0xf4e7c5).fillPoints(
    [0, 12, 10, 12, 22, 2, 22, 38, 10, 28, 0, 28].reduce((pts, v, i, all) => (i % 2 ? pts : [...pts, { x: v, y: all[i + 1] }]), []),
    true,
  );
  g.lineStyle(3.5, 0xf4e7c5);
  if (muted) g.lineBetween(28, 12, 42, 28).lineBetween(42, 12, 28, 28);
  else g.lineBetween(28, 14, 32, 20).lineBetween(32, 20, 28, 26).lineBetween(34, 8, 40, 20).lineBetween(40, 20, 34, 32);
}

// What the game is doing, as text, until the game is drawn (M5, M6). With `debug` (D),
// the frame rate and the sound's state too.
export function readout(game, { debug = false, fps = null, sound = null, artLoad = null, inputType = 'keyboard' } = {}) {
  const press = inputType === 'touch' ? 'Tap' : 'Space';
  const lines = [
    `${MODES[game.mode].label}  ${game.state}  score ${game.score}  best ${game.best}  stage ${game.stage}`,
    `slipping ${game.slip ? 'on' : 'off'} (G)  lives ${game.livesOn ? 'on' : 'off'} (H)  shadow ${game.shadowOn ? 'on' : 'off'} (S)`,
    `${press}: start or let go  1 2 3: mode  Esc: title  P: pause  M: mute  D: details`,
  ];
  if (debug) lines.push(`${fps?.describe() ?? ''}  sound ${sound?.details ?? '—'}`);
  if (debug && artLoad) lines.push(`art ${artLoad.scale}×: ${artLoad.sets.map((s) => `${s.set} in ${s.ms} ms`).join(', ') || 'loading'}`);
  return lines.join('\n');
}

export class UiScene extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    const platform = platformOf(this);
    const style = { fontFamily: 'sans-serif', color: CREAM, align: 'center' };
    this.title = this.add.text(0, 0, `Liano v${version} · Phaser ${Phaser.VERSION}: the world is drawn; the HUD comes in M6`, { ...style, fontSize: '22px' }).setOrigin(0.5);
    this.status = this.add.text(0, 0, '', { ...style, fontSize: '18px', lineSpacing: 4 }).setOrigin(0.5, 0);
    this.paused = this.add.text(0, 0, 'Paused', { ...style, fontSize: '56px', fontStyle: 'bold' }).setOrigin(0.5);
    this.controls = this.add.container(0, 0);
    this.muteIcon = this.add.graphics();
    // Where the Pixi button draws its icon inside its tap target.
    this.muteIcon.setPosition(MUTE_HIT.x + 20, MUTE_HIT.y + 16);
    drawMuteIcon(this.muteIcon, false);
    platform.on('mute', (muted) => drawMuteIcon(this.muteIcon, muted));
    this.controls.add(this.muteIcon);
    this.fullscreenIcon = this.add.graphics();
    // Where the Pixi button draws its icon inside its tap target.
    this.fullscreenIcon.setPosition(FULLSCREEN_HIT.x + 8, FULLSCREEN_HIT.y + 17);
    this.controls.add(this.fullscreenIcon);
    this.fullscreenIcon.visible = platform.fullscreenButton;
    drawFullscreenIcon(this.fullscreenIcon, platform.fullscreen.active);
    platform.on('fullscreen', (active) => drawFullscreenIcon(this.fullscreenIcon, active));
    followLayout(this, (layout, camera) => {
      const { view } = layout;
      this.title.setPosition(view.width / 2, layout.bandTop + 70);
      this.status.setPosition(view.width / 2, layout.bandTop + 90);
      this.paused.setPosition(layout.panels.paused.x, layout.panels.paused.y - 120);
      this.controls.setPosition(layout.insets.left, layout.insets.top).setScale(layout.ui);
      // Text is drawn at the camera's zoom: rasterized at it, it stays sharp.
      for (const text of [this.title, this.status, this.paused]) text.setResolution(camera.zoom);
    });
    // The platform wires the game's input to this scene's keyboard and pointers.
    platform.emit('ui', this);
  }

  update() {
    const platform = platformOf(this);
    this.paused.visible = platform.pause.paused;
    if (platform.game) {
      this.status.setText(
        readout(platform.game, { debug: platform.debug, fps: platform.fpsMeter, sound: platform.sound, artLoad: platform.artLoad, inputType: platform.input?.lastType }),
      );
    }
  }
}
