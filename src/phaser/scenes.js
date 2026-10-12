import Phaser from 'phaser';
import { version } from '../../package.json';
import { WORLD_HEIGHT } from '../config.js';
import { FULLSCREEN_HIT } from '../controls.js';
import { applyViewCamera } from './view.js';

// The Phaser version's scenes (PHASER_PLAN.md, M2): Boot loads the art and starts the
// others; Play will draw the worlds (M5), UI the HUD, panels and buttons (M6). Each
// scene's camera shows the logical view as the layout places it (see view.js). The
// platform (main.js) holds the layout, pause and full screen; scenes find it in the
// game's registry.
//
// M2: Play draws an empty frame (the view and the world band in it) and UI names the
// version, shows when the game is paused, and a stand-in full-screen button.

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

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  // The atlases come with the art pipeline (M4): the set for the screen's pixel ratio,
  // a small boot set first.
  preload() {}

  create() {
    this.scene.launch('ui');
    this.scene.start('play');
  }
}

export class PlayScene extends Phaser.Scene {
  constructor() {
    super('play');
  }

  create() {
    const frame = this.add.graphics();
    followLayout(this, ({ view, bandTop }) => {
      frame.clear().fillStyle(VIEW).fillRect(0, 0, view.width, view.height).fillStyle(BAND).fillRect(0, bandTop, view.width, WORLD_HEIGHT);
    });
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

export class UiScene extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    const platform = platformOf(this);
    const style = { fontFamily: 'sans-serif', color: CREAM, align: 'center' };
    this.title = this.add.text(0, 0, `Liano v${version}\nPhaser ${Phaser.VERSION}: not playable yet`, { ...style, fontSize: '40px' }).setOrigin(0.5);
    this.paused = this.add.text(0, 0, 'Paused', { ...style, fontSize: '56px', fontStyle: 'bold' }).setOrigin(0.5);
    this.controls = this.add.container(0, 0);
    this.fullscreenIcon = this.add.graphics();
    // Where the Pixi button draws its icon inside its tap target.
    this.fullscreenIcon.setPosition(FULLSCREEN_HIT.x + 8, FULLSCREEN_HIT.y + 17);
    this.controls.add(this.fullscreenIcon);
    this.controls.visible = platform.fullscreenButton;
    drawFullscreenIcon(this.fullscreenIcon, platform.fullscreen.active);
    platform.on('fullscreen', (active) => drawFullscreenIcon(this.fullscreenIcon, active));
    followLayout(this, (layout, camera) => {
      const { view } = layout;
      this.title.setPosition(view.width / 2, view.height / 2);
      this.paused.setPosition(layout.panels.paused.x, layout.panels.paused.y - 120);
      this.controls.setPosition(layout.insets.left, layout.insets.top).setScale(layout.ui);
      // Text is drawn at the camera's zoom: rasterized at it, it stays sharp.
      for (const text of [this.title, this.paused]) text.setResolution(camera.zoom);
    });
  }

  update() {
    this.paused.visible = platformOf(this).pause.paused;
  }
}
