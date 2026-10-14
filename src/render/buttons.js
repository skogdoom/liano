import { FULLSCREEN_ICON, MUTE_ICON } from '../views/buttons.js';
import { makeContainer } from './world/build.js';

// The mute and full-screen buttons in the Phaser version, as the Pixi ones
// (views/buttons.js has what both share): pieces in the top-left corner, which the UI
// scene places inside the safe area and scales by the layout's `ui`. Their taps are
// handled by the platform (main.js, controls.js).
export class Buttons {
  constructor(scene, art, { fullscreen = true } = {}) {
    this.art = art;
    this.view = makeContainer(scene);
    this.mute = makeContainer(scene).setPosition(MUTE_ICON.x, MUTE_ICON.y);
    this.waves = art.image(scene, 'ui.speakerWaves');
    this.cross = art.image(scene, 'ui.speakerCross');
    this.mute.add([art.image(scene, 'ui.speaker'), this.waves, this.cross]);
    // Hidden where full screen is unavailable (or the home-screen app is already).
    this.fullscreen = art.image(scene, 'ui.fullscreen').setPosition(FULLSCREEN_ICON.x, FULLSCREEN_ICON.y).setVisible(fullscreen);
    this.view.add([this.mute, this.fullscreen]);
    this.setMuted(false);
  }

  setMuted(muted) {
    this.waves.setVisible(!muted);
    this.cross.setVisible(muted);
  }

  setFullscreen(active) {
    this.art.setFrame(this.fullscreen, 'ui.fullscreen', active ? 1 : 0);
  }
}
