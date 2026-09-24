import { Container, Graphics, Text } from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, MONKEY_RADIUS } from '../config.js';
import { GameState } from '../sim/game.js';
import { version } from '../../package.json';

const CREAM = 0xf4e7c5;
const GOLD = 0xffcf4a;
const PANEL = 0x0b1a10;
const SHADOW = { color: 0x000000, alpha: 0.5, distance: 3, blur: 2, angle: Math.PI / 4 };
const FADE_IN = 0.25; // s

function text(content, size, { color = CREAM, weight = 'normal' } = {}) {
  const t = new Text({
    text: content,
    style: { fontFamily: 'sans-serif', fontSize: size, fontWeight: weight, fill: color, dropShadow: SHADOW, align: 'center' },
  });
  t.anchor.set(0.5);
  return t;
}

// A rounded panel centred at (cx, cy), with children placed relative to its centre.
function panel(cx, cy, width, height) {
  const view = new Container();
  view.position.set(cx, cy);
  view.addChild(
    new Graphics()
      .roundRect(-width / 2, -height / 2, width, height, 18)
      .fill({ color: PANEL, alpha: 0.72 })
      .stroke({ width: 2, color: CREAM, alpha: 0.25 }),
  );
  return view;
}

function place(parent, child, y) {
  child.y = y;
  parent.addChild(child);
  return child;
}

// Arrow at the top edge, at the monkey's x, while it is above the screen.
class OffscreenIndicator {
  constructor() {
    this.view = new Graphics()
      .poly([0, 0, 11, 16, 4, 16, 4, 26, -4, 26, -4, 16, -11, 16])
      .fill(CREAM)
      .stroke({ width: 2, color: 0x2a1a0c, join: 'round' });
    this.view.y = 8;
  }

  update(monkey, cameraX) {
    this.view.visible = monkey.y < -MONKEY_RADIUS;
    this.view.x = Math.min(Math.max(monkey.x - cameraX, 16), SCREEN_WIDTH - 16);
  }
}

// Prompt wording for the input type the player used last.
const PROMPTS = {
  touch: { start: 'Tap to start', control: 'TAP  ·  let go', again: 'Tap to play again', resume: 'Tap to resume' },
  other: {
    start: 'Press Space to start',
    control: 'SPACE  ·  let go',
    again: 'Press Space to play again',
    resume: 'Click the game to resume',
  },
};

// Title, game over and pause screens, and the off-screen indicator. (The "turn your
// device" message for upright phones is an HTML overlay, see index.html.)
export class Overlays {
  constructor() {
    this.view = new Container();
    this.time = 0;

    // Right of the title-screen swing, so the monkey stays in view.
    this.title = panel(990, SCREEN_HEIGHT / 2 - 20, 440, 330);
    place(this.title, text('LIANO', 104, { weight: 'bold' }), -90);
    place(this.title, text('Swing from vine to vine.\nLet go to fly to the next one.', 22), 10);
    this.titleControl = place(this.title, text('', 22, { color: GOLD, weight: 'bold' }), 70);
    this.titlePrompt = place(this.title, text('', 28), 125);
    const versionText = place(this.title, text(`v${version}`, 13, { color: CREAM }), 150);
    versionText.anchor.set(1, 0.5);
    versionText.x = 204;
    versionText.alpha = 0.55;

    this.gameOver = panel(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20, 520, 340);
    place(this.gameOver, text('GAME OVER', 72, { weight: 'bold' }), -105);
    this.scoreText = place(this.gameOver, text('', 44, { weight: 'bold' }), -25);
    this.bestText = place(this.gameOver, text('', 26), 25);
    this.newBestText = place(this.gameOver, text('New best!', 28, { color: GOLD, weight: 'bold' }), 70);
    this.gameOverPrompt = place(this.gameOver, text('', 28), 125);

    this.paused = panel(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, 420, 170);
    place(this.paused, text('Paused', 64, { weight: 'bold' }), -25);
    this.pausedPrompt = place(this.paused, text('', 22), 45);

    this.indicator = new OffscreenIndicator();
    this.view.addChild(this.indicator.view, this.title, this.gameOver, this.paused);
    this.shown = null;
    this.promptsFor = null;
  }

  // `pauseReason` is null while running; 'portrait' is shown by the HTML overlay.
  update(game, cameraX, { pauseReason, inputType, dt }) {
    const paused = pauseReason !== null;
    this.time += dt;
    this.#setPrompts(inputType === 'touch' ? 'touch' : 'other');
    const pulse = 0.65 + 0.35 * Math.sin(this.time * 4);

    this.indicator.update(game.world.monkey, cameraX);

    this.title.visible = game.state === GameState.READY && !paused;
    this.titlePrompt.alpha = pulse;

    this.gameOver.visible = game.state === GameState.GAME_OVER && !paused;
    if (this.gameOver.visible) {
      this.gameOver.alpha = Math.min(game.stateTime / FADE_IN, 1);
      const shown = `${game.score}:${game.best}:${game.newBest}`;
      if (shown !== this.shown) {
        this.scoreText.text = `Score ${game.score}`;
        this.bestText.text = `Best ${game.best}`;
        this.shown = shown;
      }
      this.newBestText.visible = game.newBest;
      this.gameOverPrompt.visible = game.canRestart();
      this.gameOverPrompt.alpha = pulse;
    }

    this.paused.visible = pauseReason === 'unfocused';
  }

  #setPrompts(kind) {
    if (kind === this.promptsFor) return;
    const p = PROMPTS[kind];
    this.titlePrompt.text = p.start;
    this.titleControl.text = p.control;
    this.gameOverPrompt.text = p.again;
    this.pausedPrompt.text = p.resume;
    this.promptsFor = kind;
  }
}
