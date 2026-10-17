import Phaser from 'phaser';
import { SHARED_ZOOM } from '../config.js';
import { paneLayouts } from '../layout.js';
import { Art, CATALOG, queueCatalog, queueSet } from '../render/art.js';
import { applyViewCamera, rectCamera } from './view.js';
import { Buttons } from '../render/buttons.js';
import { DebugOverlay } from '../render/debug.js';
import { Hud } from '../render/hud.js';
import { Overlays } from '../render/overlays.js';
import { WorldPane } from '../render/world/pane.js';
import { warmObstacleRigs } from '../render/warmup.js';

// The Phaser version's scenes (docs/plans/history/phaser-migration.md, M2): Boot loads the
// art and starts the others; Play draws the worlds (M5), UI the HUD, panels and buttons (M6).
// Each scene's camera shows the logical view as the layout places it (see view.js). The
// platform (main.js) holds the layout, pause and full screen; scenes find it in the game's
// registry.
//
// UI draws the buttons, the HUD, the overlays and the debug view (D).

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
    // main installs this before boot, ahead of its READY continuation/platform.
    const pack = this.registry.get('artPack');
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => {
      const error = new Error(`${pack === 'cartoon' ? 'Cartoon' : 'Classic'} graphics could not be loaded.`, { cause: file.url });
      error.name = 'ArtLoadError';
      platformOf(this).fail(error);
    });
    queueCatalog(this.load, pack);
  }

  create() {
    const platform = platformOf(this);
    if (platform.startup.failed) return;
    const catalog = this.cache.json.get(CATALOG);
    if (catalog.pack !== platform.artPack) throw new Error('The loaded graphics catalog does not match the selected pack');
    const scale = Art.scaleFor(platform.camera.zoom);
    platform.art = new Art(catalog, scale);
    platform.artLoad = { pack: platform.artPack, scale, sets: [] };
    const loadSet = (set, then) => {
      queueSet(this.load, catalog, set, scale);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (platform.startup.failed) return;
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
    // then gameplay presses are ignored (see main.js).
    const start = async () => {
      try {
        await platform.soundReady;
        if (platform.startup.failed) return;
        const started = performance.now();
        const rigs = await warmObstacleRigs(this, platform.art);
        if (platform.startup.failed) return;
        platform.prepared = { rigs, ms: performance.now() - started, sounds: platform.sound.cache?.buffers.size ?? 0, soundBytes: platform.sound.cache?.bytes ?? 0 };
        this.ready = true;
        this.sync();
        const onFrame = () => {
          if (platform.startup.failed) return;
          if (this.game.renderer.contextLost) return;
          platform.input.clear();
          platform.world = this;
          platform.startup.finish();
        };
        this.game.events.on(Phaser.Core.Events.POST_RENDER, onFrame);
        // Also clean up if a failure stops the loop before another frame renders.
        platform.startup.ready.then(() => this.game.events.off(Phaser.Core.Events.POST_RENDER, onFrame));
      } catch (error) {
        platform.fail(error);
      }
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



export class UiScene extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    const platform = platformOf(this);
    // Top left: the mute and full-screen buttons.
    this.buttons = new Buttons(this, platform.art, { fullscreen: platform.fullscreenButton });
    this.buttons.setMuted(platform.sound?.muted ?? false);
    this.buttons.setFullscreen(platform.fullscreen.active);
    platform.on('mute', (muted) => this.buttons.setMuted(muted));
    platform.on('fullscreen', (active) => this.buttons.setFullscreen(active));
    this.add.existing(this.buttons.view);
    // Top right: the scores, banana counts and hearts; over everything, the panels, the
    // stage banners and the arrow over a monkey above the view.
    this.hud = new Hud(this, platform.art);
    this.overlays = new Overlays(this, platform.art, { configMenu: platform.configMenu, mobile: platform.mobile });
    this.add.existing(this.hud.view);
    this.add.existing(this.overlays.view);
    // D: the debug view, over each pane, with its numbers.
    this.debug = new DebugOverlay(this);
    this.debugPanes = null;
    // Title/config/results panels can use the visible screen even when a two-player
    // game is letterboxed into a small landscape frame on a portrait phone.
    this.menuCamera = this.cameras.add(0, 0, 1, 1);
    this.cameras.main.ignore([this.overlays.title, this.overlays.config, this.overlays.gameOver]);
    this.menuCamera.ignore([this.buttons.view, this.hud.view, this.debug.view,
      this.overlays.indicator, this.overlays.paneLayer, this.overlays.paused]);
    followLayout(this, (layout, camera) => {
      this.hud.resize(layout, camera.zoom);
      this.overlays.resize(layout, camera.zoom, platform.menuArea);
      applyViewCamera(this.menuCamera, { x: 0, y: 0,
        width: this.sys.game.canvas.width, height: this.sys.game.canvas.height,
        zoom: camera.zoom, scrollX: -layout.x / layout.scale, scrollY: -layout.y / layout.scale });
      this.debug.resize(layout, camera.zoom);
      this.buttons.view.setPosition(layout.insets.left, layout.insets.top).setScale(layout.ui);
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
    this.menuCamera.setVisible((game.state === 'TITLE' || game.state === 'RESULTS') && !platform.pause.paused);
    const panes = platform.world?.panes ?? [];
    if (panes.length !== this.debugPanes?.length || panes.some((pane, i) => pane !== this.debugPanes[i])) {
      this.debug.attach(panes);
      this.debugPanes = [...panes];
    }
    this.debug.setVisible(platform.debug);
    this.debug.update(game, platform.sound, platform.fpsMeter);
  }
}
