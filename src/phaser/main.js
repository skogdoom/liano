import Phaser from 'phaser';
import { version } from '../../package.json';
import { createFatalOverlay, isOwnError } from '../fatal.js';

// The Phaser version of the game (see PHASER_PLAN.md). M0: it boots an empty scene
// that says what it is; the game itself comes in the later milestones.

const fatal = createFatalOverlay(document);
window.addEventListener('error', (event) => {
  if (isOwnError(event, location.origin)) fatal.show(event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => fatal.show(event.reason));

class PlaceholderScene extends Phaser.Scene {
  constructor() {
    super('placeholder');
  }

  create() {
    const text = this.add.text(0, 0, `Liano v${version}\nPhaser ${Phaser.VERSION}: not playable yet`, {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#f4e7c5',
      align: 'center',
    });
    text.setOrigin(0.5);
    const centre = () => text.setPosition(this.scale.width / 2, this.scale.height / 2);
    centre();
    this.scale.on('resize', centre);
  }
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: document.body,
  backgroundColor: '#000000',
  banner: false,
  // Sound comes with M3; until then Phaser must not open an audio context of its own.
  audio: { noAudio: true },
  // The game's own fixed-step loop needs the real frame times.
  fps: { smoothStep: false },
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [PlaceholderScene],
});
await new Promise((resolve) => game.events.once(Phaser.Core.Events.READY, resolve));

// Hooks for inspecting the game from the browser console and tests.
if (import.meta.env.DEV) window.__liano = { game, engine: 'phaser' };
