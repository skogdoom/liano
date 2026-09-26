import { Container, Graphics, Text } from 'pixi.js';
import { MONKEY_RADIUS } from '../config.js';
import { GameState } from '../sim/game.js';
import { MODES, MODE_ORDER } from '../sim/match.js';
import { paneLayouts } from '../layout.js';
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

// Names for the stages, by time of day (the background tint follows them).
export const STAGE_NAMES = ['Day', 'Late afternoon', 'Dusk', 'Night'];
const BANNER_IN = 0.3; // s
const BANNER_HOLD = 1.6;
const BANNER_OUT = 0.6;

// Opacity of the stage banner `t` s after it appeared: fades in, holds, fades out.
export function bannerAlpha(t) {
  if (t < 0 || t >= BANNER_IN + BANNER_HOLD + BANNER_OUT) return 0;
  if (t < BANNER_IN) return t / BANNER_IN;
  if (t < BANNER_IN + BANNER_HOLD) return 1;
  return 1 - (t - BANNER_IN - BANNER_HOLD) / BANNER_OUT;
}

// "Stage 2" with the time of day, shown on entering each stage after the first.
class StageBanner {
  constructor() {
    this.view = new Container();
    this.title = place(this.view, text('', 56, { weight: 'bold' }), -18);
    this.subtitle = place(this.view, text('', 24, { color: GOLD }), 30);
    this.stage = 1;
    this.world = null;
    this.time = Infinity;
    this.view.visible = false;
  }

  // Shows the stage `world` has reached (the furthest of its monkeys).
  update(game, world, dt) {
    const stage = Math.max(...world.stages);
    // A new world starts over at stage 1 without a banner.
    if (world !== this.world) {
      this.world = world;
      this.stage = stage;
      this.time = Infinity;
    }
    if (stage > this.stage) {
      this.stage = stage;
      this.title.text = `Stage ${this.stage}`;
      this.subtitle.text = STAGE_NAMES[this.stage - 1] ?? '';
      this.time = 0;
    }
    this.time += dt;
    const alpha = game.state === GameState.PLAYING ? bannerAlpha(this.time) : 0;
    this.view.visible = alpha > 0;
    this.view.alpha = alpha;
  }
}

// Arrow at the top edge, at the monkey's x, while it is above the view.
class OffscreenIndicator {
  constructor() {
    this.view = new Graphics()
      .poly([0, 0, 11, 16, 4, 16, 4, 26, -4, 26, -4, 16, -11, 16])
      .fill(CREAM)
      .stroke({ width: 2, color: 0x2a1a0c, join: 'round' });
    this.view.y = 8;
  }

  update(monkey, cameraX, layout) {
    this.view.visible = monkey.y + layout.bandTop < -MONKEY_RADIUS;
    this.view.x = Math.min(Math.max(monkey.x - cameraX, 16), layout.view.width - 16);
  }
}

// The title screen's mode picker: "1 · 1P   2 · 2P shared   3 · 2P split", with the
// selected mode highlighted and modes that aren't available yet dimmed.
class ModePicker {
  constructor() {
    this.view = new Container();
    this.items = MODE_ORDER.map((id, i) => {
      const t = text(`${i + 1} · ${MODES[id].label}`, 17, { weight: 'bold' });
      this.view.addChild(t);
      return { id, t };
    });
    const gap = 26;
    const total = this.items.reduce((sum, { t }) => sum + t.width, 0) + gap * (this.items.length - 1);
    let x = -total / 2;
    for (const { t } of this.items) {
      t.x = x + t.width / 2;
      x += t.width + gap;
    }
    this.shown = null;
  }

  update(mode) {
    if (mode === this.shown) return;
    for (const { id, t } of this.items) {
      const selected = id === mode;
      t.style.fill = selected ? GOLD : CREAM;
      t.alpha = selected ? 1 : MODES[id].enabled ? 0.8 : 0.35;
    }
    this.shown = mode;
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

// Title, game over and pause screens, and the off-screen indicator. Positions and
// sizes come from the layout (see layout.js).
export class Overlays {
  constructor() {
    this.view = new Container();
    this.time = 0;

    // Right of the title-screen swing, so the monkey stays in view.
    this.title = panel(0, 0, 440, 330);
    place(this.title, text('LIANO', 104, { weight: 'bold' }), -90);
    this.tagline = place(this.title, text('Swing from vine to vine.\nLet go to fly to the next one.', 22), 10);
    this.titleControl = place(this.title, text('', 22, { color: GOLD, weight: 'bold' }), 70);
    this.titlePrompt = place(this.title, text('', 28), 125);
    this.modePicker = new ModePicker();
    place(this.title, this.modePicker.view, 92);
    const versionText = place(this.title, text(`v${version}`, 13, { color: CREAM }), 150);
    versionText.anchor.set(1, 0.5);
    versionText.x = 204;
    versionText.alpha = 0.55;

    this.gameOver = panel(0, 0, 520, 340);
    this.gameOverTitle = place(this.gameOver, text('GAME OVER', 72, { weight: 'bold' }), -105);
    this.scoreText = place(this.gameOver, text('', 44, { weight: 'bold' }), -25);
    this.bestText = place(this.gameOver, text('', 26), 25);
    this.newBestText = place(this.gameOver, text('New best!', 28, { color: GOLD, weight: 'bold' }), 70);
    this.gameOverPrompt = place(this.gameOver, text('', 28), 125);

    this.paused = panel(0, 0, 420, 170);
    place(this.paused, text('Paused', 64, { weight: 'bold' }), -25);
    this.pausedPrompt = place(this.paused, text('', 22), 45);

    this.indicator = new OffscreenIndicator();
    // A stage banner and an "out" note per pane.
    this.banners = [];
    this.outNotes = [];
    this.paneLayer = new Container();
    this.view.addChild(this.indicator.view, this.paneLayer, this.title, this.gameOver, this.paused);
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
    const paused = pauseReason !== null;
    this.time += dt;
    this.#setPrompts(inputType === 'touch' ? 'touch' : 'other');
    const pulse = 0.65 + 0.35 * Math.sin(this.time * 4);

    // The arrow over a monkey above the view is for the single, full-size pane.
    this.indicator.view.visible = game.worlds.length === 1;
    if (this.indicator.view.visible) this.indicator.update(game.world.monkey, cameraX, this.layout);
    this.#updatePanes(game, dt);

    this.title.visible = game.state === GameState.TITLE && !paused;
    this.titlePrompt.alpha = pulse;
    if (this.title.visible) this.#updateTitle(game.mode, inputType !== 'touch');

    this.gameOver.visible = game.state === GameState.RESULTS && !paused;
    if (this.gameOver.visible) {
      this.gameOver.alpha = Math.min(game.stateTime / FADE_IN, 1);
      const solo = game.players === 1;
      const shown = solo ? `${game.score}:${game.best}:${game.newBest}` : `${game.mode}:${game.playerScore(0)}:${game.playerScore(1)}`;
      if (shown !== this.shown) {
        if (solo) {
          this.gameOverTitle.text = 'GAME OVER';
          this.scoreText.text = `Score ${game.score}`;
          this.bestText.text = `Best ${game.best}`;
        } else {
          // Totals over all lives decide.
          const winners = game.winners;
          this.gameOverTitle.text = winners.length > 1 ? 'DRAW' : `P${winners[0] + 1} WINS`;
          this.scoreText.text = `P1 ${game.playerScore(0)}  ·  P2 ${game.playerScore(1)}`;
          this.bestText.text = '';
        }
        this.shown = shown;
      }
      this.newBestText.visible = game.newBest && solo;
      this.gameOverPrompt.visible = game.canRestart();
      this.gameOverPrompt.alpha = pulse;
    }

    this.paused.visible = pauseReason === 'unfocused';
  }

  // Split screen's panes, or the single one: where each world is drawn in the view.
  #updatePanes(game, dt) {
    const count = game.worlds.length;
    while (this.banners.length < count) {
      const banner = new StageBanner();
      const note = text('', 40, { weight: 'bold' });
      this.banners.push(banner);
      this.outNotes.push(note);
      this.paneLayer.addChild(banner.view, note);
    }
    const panes = paneLayouts(this.layout, count);
    this.banners.forEach((banner, i) => {
      const note = this.outNotes[i];
      if (i >= count) {
        banner.view.visible = false;
        note.visible = false;
        return;
      }
      banner.update(game, game.worlds[i], dt);
      if (count === 1) {
        banner.view.position.set(this.layout.panels.banner.x, this.layout.panels.banner.y);
        banner.view.scale.set(this.layout.ui);
      } else {
        // Low in the pane, like the single pane's.
        banner.view.position.set(panes[i].width / 2, panes[i].y + panes[i].height * 0.72);
        banner.view.scale.set(0.6);
      }
      // A player out of lives, while the other plays on.
      note.visible = count > 1 && game.state === GameState.PLAYING && game.playerOut(i);
      if (note.visible) {
        note.text = `P${i + 1} is out`;
        note.position.set(panes[i].width / 2, panes[i].y + panes[i].height / 2);
      }
    });
  }

  // The mode picker shows only with a keyboard (the two-player modes need one); the
  // lines above it move up to make room.
  #updateTitle(mode, showModes) {
    this.modePicker.view.visible = showModes;
    this.modePicker.update(mode);
    this.tagline.y = showModes ? 0 : 10;
    this.titleControl.y = showModes ? 58 : 70;
    this.titlePrompt.y = showModes ? 128 : 125;
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
