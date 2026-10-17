import { MONKEY_RADIUS } from '../config.js';
import { paneLayouts } from '../layout.js';
import { GameState } from '../sim/game.js';
import { MODES, MODE_ORDER } from '../sim/match.js';
import { bananaLine } from './hud.js';

// The overlays: plain drawing and placement data. The title, results and
// pause panels, the stage banners and "out" notes per pane, and the arrow over a monkey
// above the view: their texts, sizes and places, and how they fade and pulse.

export const CREAM = 0xf4e7c5;
export const GOLD = 0xffcf4a;
export const PANEL = 0x0b1a10;
export const OVERLAY_SHADOW = { color: 0x000000, alpha: 0.5, distance: 3, blur: 2, angle: Math.PI / 4 };
// The texts: centred, sans-serif, with the shadow.
export const OVERLAY_FONT = 'sans-serif';
export const FADE_IN = 0.25; // s

// A panel's rounded rectangle: see-through dark, with a faint edge.
export const PANEL_RADIUS = 18;
export function drawPanel(g, x, y, width, height) {
  return g.roundRect(x, y, width, height, PANEL_RADIUS).fill({ color: PANEL, alpha: 0.72 }).stroke({ width: 2, color: CREAM, alpha: 0.25 });
}

// The off-screen arrow, its tip at the origin, pointing up.
export function drawArrow(g) {
  return g.poly([0, 0, 11, 16, 4, 16, 4, 26, -4, 26, -4, 16, -11, 16]).fill(CREAM).stroke({ width: 2, color: 0x2a1a0c, join: 'round' });
}

// The title panel runs from TITLE_TOP to the bottom of the last line plus TITLE_PADDING,
// the room there is above the first line (the version), measured from its centre.
const TITLE_PADDING = 35;
const TITLE_TOP = -192;
const TITLE_LAST_LINE = 196;
const TITLE_BOTTOM = TITLE_LAST_LINE + TITLE_PADDING;

// The panels: each a rounded rectangle centred on its spot (`width` × `height`, `shiftY`
// lower than the centre to grow it at the bottom only), and its texts, from the centre:
// `size` px, `color`, bold or not, and how see-through.
export const PANELS = {
  title: {
    width: 440,
    height: TITLE_BOTTOM - TITLE_TOP,
    shiftY: (TITLE_TOP + TITLE_BOTTOM) / 2,
    texts: {
      name: { text: 'LIANO', size: 104, bold: true, y: -90 },
      tagline: { text: 'Swing from vine to vine.\nLet go to fly to the next one.', size: 22, y: 10 },
      control: { size: 22, color: GOLD, bold: true, y: 70 },
      prompt: { size: 28, y: 125 },
      modes: { y: 92 },
      // The settings, side by side.
      lives: { size: 17, bold: true, y: 120 },
      slip: { size: 17, bold: true, y: 120 },
      shadow: { size: 17, bold: true, y: 120 },
      // The pause, menu and setting keys, under the prompt (with a keyboard).
      keys: { text: 'P  pause  ·  Esc  menu', size: 15, y: 188, alpha: 0.7 },
      // Top right, right-aligned.
      version: { size: 13, y: -150, x: 204, alpha: 0.55, anchorX: 1 },
    },
  },
  gameOver: {
    width: 520,
    height: 340,
    shiftY: 0,
    texts: {
      title: { text: 'GAME OVER', size: 72, bold: true, y: -110 },
      score: { size: 44, bold: true, y: -38 },
      best: { size: 26, y: 6 },
      // A banana, then the bananas taken out of those passed, per player.
      bananas: { size: 24, color: GOLD, y: 42 },
      newBest: { text: 'New best!', size: 28, color: GOLD, bold: true, y: 82 },
      prompt: { size: 28, y: 128 },
    },
  },
  paused: {
    width: 420,
    height: 170,
    shiftY: 0,
    texts: {
      title: { text: 'Paused', size: 64, bold: true, y: -25 },
      prompt: { size: 22, y: 45 },
    },
  },
};
// The mode picker's items, `MODE_GAP` apart; the settings lines, `SETTINGS_GAP` apart.
export const MODE_FONT = { size: 17, bold: true };
export const MODE_GAP = 26;
export const SETTINGS_GAP = 22;
// The results' banana, and the gap from it to its text.
export const RESULTS_BANANA_WIDTH = 26;
export const RESULTS_BANANA_GAP = 10;

// The prompts' gentle pulse (their alpha) `time` s into the overlays.
export const pulse = (time) => 0.65 + 0.35 * Math.sin(time * 4);

// Prompt wording for the input type the player used last.
export const PROMPTS = {
  touch: { start: 'Tap to start', control: 'TAP  ·  let go', again: 'Tap to play again', resume: 'Tap to resume' },
  other: {
    start: 'Press Space to start',
    control: 'SPACE  ·  let go',
    again: 'Space: play again  ·  Esc: menu',
    resume: 'Click the game to resume',
  },
};
// The two-player modes' keys, one per player.
export const CONTROL_2P = 'P1  A   ·   P2  L   ·   let go';

// The prompts for the input in use (`kind`: 'touch' or 'other'); the control hint also
// names each player's key.
export function prompts(kind, players) {
  const p = PROMPTS[kind];
  return { start: p.start, control: players > 1 ? CONTROL_2P : p.control, again: p.again, resume: p.resume };
}

// The x of each of a row of items `widths` wide, `gap` apart, centred together on 0.
export function centredRow(widths, gap) {
  let x = -(widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1)) / 2;
  return widths.map((w) => {
    const at = x + w / 2;
    x += w + gap;
    return at;
  });
}

// The mode picker: "1 · 1P   2 · 2P shared   3 · 2P split", the selected mode in gold and
// modes that aren't available yet dimmed.
export const modeItems = () => MODE_ORDER.map((id, i) => ({ id, text: `${i + 1} · ${MODES[id].label}` }));
export const modeLook = (id, mode) => (id === mode ? { color: GOLD, alpha: 1 } : { color: CREAM, alpha: MODES[id].enabled ? 0.8 : 0.35 });

// The title's settings and where its lines go. The mode picker, the settings and the keys
// hint show only with a keyboard (`showModes`: the two-player modes need one, and lives
// are for the desktop); the lines above them move up to make room. Single player: lives
// ("H · Lives: off") and the shadow ("S · Shadow: off") are settings; the two-player
// modes always have lives and no shadow.
export function titleState(game, showModes) {
  const solo = game.mode === 'solo';
  const setting = (on, settable) => ({ color: settable && on ? GOLD : CREAM, alpha: settable ? (on ? 1 : 0.8) : 0.55 });
  return {
    showModes,
    lives: { text: solo ? `H · Lives: ${game.lives ? 'on' : 'off'}` : 'Lives: on', ...setting(game.lives, solo) },
    slip: { text: `G · Slipping: ${game.slip ? 'on' : 'off'}`, ...setting(game.slip, true) },
    shadow: { text: solo ? `S · Shadow: ${game.shadow ? 'on' : 'off'}` : 'Shadow: off', ...setting(game.shadow, solo) },
    taglineY: showModes ? 0 : 10,
    controlY: showModes ? 58 : 70,
    promptY: showModes ? 156 : 125,
  };
}

// What the results panel says: single player's score, best and bananas; in the
// two-player modes who won (totals over all lives decide) and both scores. `key` changes
// whenever any of it does.
export function resultsState(game) {
  const solo = game.players === 1;
  const bananas = Array.from({ length: game.players }, (_, p) => bananaLine(game, p));
  const key = [solo ? `${game.score}:${game.best}:${game.newBest}` : `${game.mode}:${game.playerScore(0)}:${game.playerScore(1)}`, ...bananas].join(':');
  if (solo) {
    return { key, title: 'GAME OVER', score: `Score ${game.score}`, best: `Best ${game.best}`, bananas: bananas[0], bananasY: 42, newBest: game.newBest };
  }
  const winners = game.winners;
  return {
    key,
    title: winners.length > 1 ? 'DRAW' : `P${winners[0] + 1} WINS`,
    score: `P1 ${game.playerScore(0)}  ·  P2 ${game.playerScore(1)}`,
    best: '',
    bananas: `P1 ${bananas[0]}  ·  P2 ${bananas[1]}`,
    // In the line Best has in single player.
    bananasY: 10,
    newBest: false,
  };
}

// The results' banana and its text, centred together: their x for a text `textWidth` wide.
export function resultsBananas(textWidth) {
  const left = -(RESULTS_BANANA_WIDTH + RESULTS_BANANA_GAP + textWidth) / 2;
  return { iconX: left + RESULTS_BANANA_WIDTH / 2, iconY: -1, textX: left + RESULTS_BANANA_WIDTH + RESULTS_BANANA_GAP + textWidth / 2 };
}

// The pause panel's prompt: paused by the player (P) or by the window losing focus.
export const pausedShown = (reason) => reason === 'unfocused' || reason === 'manual';
export const pausePrompt = (reason, kind) => (reason === 'manual' ? 'Press P to resume' : PROMPTS[kind].resume);

// Names for the stages, by time of day (the background tint follows them); after Dawn
// the day starts over.
export const STAGE_NAMES = ['Day', 'Late afternoon', 'Dusk', 'Night', 'Dawn'];
const BANNER_IN = 0.3; // s
const BANNER_HOLD = 1.6;
const BANNER_OUT = 0.6;
export const BANNER_TEXTS = {
  title: { size: 56, bold: true, y: -18 },
  subtitle: { size: 24, color: GOLD, y: 30 },
};

// Opacity of the stage banner `t` s after it appeared: fades in, holds, fades out.
export function bannerAlpha(t) {
  if (t < 0 || t >= BANNER_IN + BANNER_HOLD + BANNER_OUT) return 0;
  if (t < BANNER_IN) return t / BANNER_IN;
  if (t < BANNER_IN + BANNER_HOLD) return 1;
  return 1 - (t - BANNER_IN - BANNER_HOLD) / BANNER_OUT;
}

// "Stage 2" with the time of day, shown on entering each stage after the first: update()
// with the world it is for returns its texts and opacity.
export class StageBannerState {
  constructor() {
    this.stage = 1;
    this.world = null;
    this.time = Infinity;
    this.title = '';
    this.subtitle = '';
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
      this.title = `Stage ${this.stage}`;
      this.subtitle = STAGE_NAMES[(this.stage - 1) % STAGE_NAMES.length];
      this.time = 0;
    }
    this.time += dt;
    const alpha = game.state === GameState.PLAYING ? bannerAlpha(this.time) : 0;
    return { alpha, title: this.title, subtitle: this.subtitle };
  }
}

// Where pane `i` of `count` shows its banner: low in the band (the layout's spot) for the
// single pane, low in its pane, smaller, in split screen.
export function bannerPlacement(layout, count, i) {
  if (count === 1) return { x: layout.panels.banner.x, y: layout.panels.banner.y, scale: layout.ui };
  const pane = paneLayouts(layout, count)[i];
  return { x: pane.width / 2, y: pane.y + pane.height * 0.72, scale: 0.6 };
}

// The note on a pane whose player is out of lives while the other plays on (null for
// none): its text and centre.
export const OUT_NOTE_FONT = { size: 40, bold: true };
export function outNote(game, layout, count, i) {
  if (count < 2 || game.state !== GameState.PLAYING || !game.playerOut(i)) return null;
  const pane = paneLayouts(layout, count)[i];
  return { text: `P${i + 1} is out`, x: pane.width / 2, y: pane.y + pane.height / 2 };
}

// The arrow at the top edge, at the monkey's x, while it is above the view (single player;
// x is null in the two-player modes).
export const ARROW_Y = 8;
export function arrowState(game, monkey, cameraX, layout) {
  if (game.players !== 1) return { visible: false, x: null };
  return { visible: monkey.y + layout.bandTop < -MONKEY_RADIUS, x: Math.min(Math.max(monkey.x - cameraX, 16), layout.view.width - 16) };
}

// Which panels show: the title on the title screen, the results after a run, the pause
// panel when paused by the player or the window; none of the first two while paused.
export function panelsShown(game, pauseReason) {
  const paused = pauseReason !== null;
  return {
    title: game.state === GameState.TITLE && !paused,
    gameOver: game.state === GameState.RESULTS && !paused,
    paused: pausedShown(pauseReason),
  };
}
