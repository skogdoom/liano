import Phaser from 'phaser';
import { SHARED_ZOOM } from '../config.js';
import { paneLayouts } from '../layout.js';
import { FULLSCREEN_HIT, MUTE_HIT } from '../controls.js';
import { Art, CATALOG, queueCatalog, queueSet } from './art.js';
import { applyViewCamera, rectCamera } from './view.js';
import { Hud } from './hud.js';
import { Overlays } from './overlays.js';
import { WorldPane } from './world/pane.js';

// The Phaser version's scenes (PHASER_PLAN.md, M2): Boot loads the art and starts the
// others; Play draws the worlds (M5), UI the HUD, panels and buttons (M6). Each scene's
// camera shows the logical view as the layout places it (see view.js). The platform
// (main.js) holds the layout, pause and full screen; scenes find it in the game's
// registry.
//
// UI draws the HUD and the overlays (M6a, M6b); the buttons are still stand-ins, and D
// shows a readout of details (readout below) until the debug view (M6c).

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
    // Each pane is drawn by a camera of its own (see placeCameras); the main camera, which
    // follows the view, draws nothing.
    this.paneCameras = [];
    this.cameras.main.setVisible(false);
    // Screen shake is off for players who ask for reduced motion.
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    followLayout(this, () => this.layoutPanes());
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
    const layouts = paneLayouts(layout, this.panes.length, zoom);
    layouts.forEach((pane, i) => this.panes[i].resize(pane, this.platform.camera.zoom));
    this.placeCameras(layouts);
  }

  // A camera per pane, its viewport the pane's rect: it clips the pane, as the Pixi panes'
  // masks do (in split screen the lower pane's backdrop, which reaches far above the band
  // for taller views, must not cover the upper pane), and draws only that pane.
  placeCameras(layouts) {
    while (this.paneCameras.length < this.panes.length) this.paneCameras.push(this.cameras.add(0, 0, 1, 1));
    for (const pane of this.panes) pane.view.cameraFilter = 0;
    this.paneCameras.forEach((camera, i) => {
      camera.setVisible(i < this.panes.length);
      if (i >= this.panes.length) return;
      applyViewCamera(camera, rectCamera(this.platform.camera, layouts[i]));
      camera.ignore(this.panes.filter((_, j) => j !== i).map((pane) => pane.view));
    });
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

// The details D shows, until the debug view (M6c): the frame rate, the sound's state and
// how the art loaded.
export function readout({ fps = null, sound = null, artLoad = null } = {}) {
  const lines = [`${fps?.describe() ?? ''}  sound ${sound?.details ?? '—'}`];
  if (artLoad) lines.push(`art ${artLoad.scale}×: ${artLoad.sets.map((s) => `${s.set} in ${s.ms} ms`).join(', ') || 'loading'}`);
  return lines.join('\n');
}

export class UiScene extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    const platform = platformOf(this);
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
    // Top right: the scores, banana counts and hearts; over everything, the panels, the
    // stage banners and the arrow over a monkey above the view.
    this.hud = new Hud(this, platform.art);
    this.overlays = new Overlays(this, platform.art);
    this.add.existing(this.hud.view);
    this.add.existing(this.overlays.view);
    // The details D shows (until the debug view).
    this.status = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', lineSpacing: 4 }).setVisible(false);
    followLayout(this, (layout, camera) => {
      this.hud.resize(layout, camera.zoom);
      this.overlays.resize(layout, camera.zoom);
      this.status.setPosition(layout.insets.left + 16, layout.insets.top + 96).setResolution(camera.zoom);
      this.controls.setPosition(layout.insets.left, layout.insets.top).setScale(layout.ui);
    });
    // The platform wires the game's input to this scene's keyboard and pointers.
    platform.emit('ui', this);
  }

  update() {
    const platform = platformOf(this);
    const { game } = platform;
    if (!game) return;
    this.hud.update(game);
    const cameraX = platform.world?.panes[0]?.camera.x ?? 0;
    this.overlays.update(game, cameraX, { pauseReason: platform.pause.reason, inputType: platform.input?.lastType, dt: platform.frame?.frameDt ?? 0 });
    this.status.setVisible(platform.debug);
    if (platform.debug) this.status.setText(readout({ fps: platform.fpsMeter, sound: platform.sound, artLoad: platform.artLoad }));
  }
}
