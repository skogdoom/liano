import { Text } from 'pixi.js';
import { layoutFor } from '../layout.js';
import { Art, CATALOG, queueArt } from '../phaser/art.js';
import { Hud as PhaserHud } from '../phaser/hud.js';
import { textResolution } from '../phaser/text.js';
import { Hud } from '../render/hud.js';
import { Overlays as PhaserOverlays } from '../phaser/overlays.js';
import { Overlays } from '../render/overlays.js';
import { GameState } from '../sim/game.js';
import { Container } from 'pixi.js';
import { Buttons } from '../phaser/buttons.js';
import { MuteButton } from '../render/muteButton.js';
import { FullscreenButton } from '../render/fullscreenButton.js';

// M6 scenarios (PHASER_PLAN.md): the HUD, the overlays and the buttons as the Pixi views
// draw them and as the Phaser version draws them, over the view as the layout places them.

const SKY = 0x2a4a35;
const artFor = (scene, zoom) => new Art(scene.cache.json.get(CATALOG), Art.scaleFor(zoom));
const withArt = (scenario) => ({ zooms: [1, 2], background: SKY, preload: (scene, zoom) => queueArt(scene.load, Art.scaleFor(zoom)), ...scenario });

// Pixi rasterizes text at the renderer's resolution; the Phaser version at the screen's
// density, times the text's scale when it is enlarged (textResolution). The Pixi texts are
// set to the same, so the pictures compare (the game's Pixi text is that much softer when
// enlarged).
function sharpen(view, zoom, scale = 1) {
  const own = scale * view.scale.x;
  if (view instanceof Text) view.resolution = textResolution(zoom, own);
  for (const child of view.children ?? []) sharpen(child, zoom, own);
}

// What the HUD reads of a game.
function hudGame({ players = 1, worlds = 1, score = 0, best = 0, scores = [0, 0], out = [false, false], bananas = [0, 0], livesOn = false, lives = [3, 3] } = {}) {
  return {
    players,
    worlds: Array.from({ length: worlds }, () => ({})),
    state: GameState.PLAYING,
    score,
    best,
    livesOn,
    playerScore: (p) => scores[p],
    playerOut: (p) => out[p],
    playerBananasTaken: (p) => bananas[p],
    playerLives: (p) => lives[p],
  };
}

// The HUD's corner of the view (`height` units tall) for `game`, on a window `window`.
const hudScenario = (id, title, game, { window = [1280, 720], fixed = false, height = 160 } = {}) => {
  const layout = layoutFor(...window, undefined, { fixed });
  const width = 640;
  return withArt({
    id,
    title,
    width,
    height,
    scroll: [layout.view.width - width, 0],
    pixi(world, pixi, zoom) {
      const hud = new Hud();
      hud.resize(layout);
      hud.update(game);
      sharpen(hud.view, zoom);
      world.addChild(hud.view);
    },
    phaser(scene, zoom) {
      const hud = new PhaserHud(scene, artFor(scene, zoom));
      hud.resize(layout, zoom);
      hud.update(game);
      scene.add.existing(hud.view);
    },
  });
};

// What the overlays read of a game (in `stages` steps: each frame's stage per world).
function overlayGame({ mode = 'solo', players = 1, worlds = 1, state = GameState.TITLE, stateTime = 1, lives = false, slip = false, shadow = false, score = 0, best = 0, newBest = false, winners = [0], scores = [0, 0], bananas = [[0, 0], [0, 0]], out = [false, false], restart = true, monkey = { x: 300, y: 200 } } = {}) {
  const ws = Array.from({ length: worlds }, () => ({ stages: [1] }));
  return {
    mode,
    players,
    worlds: ws,
    world: { ...ws[0], monkey },
    state,
    stateTime,
    lives,
    slip,
    shadow,
    score,
    best,
    newBest,
    winners,
    playerScore: (p) => scores[p],
    playerBananas: (p) => ({ taken: bananas[p][0], passed: bananas[p][1] }),
    playerOut: (p) => out[p],
    canRestart: () => restart,
  };
}

// The overlays for `game` over a view `crop` (x, y, width, height in view units) on a
// window `window`; `frames`: [dt, stages per world] for each update (the banners need
// the stage to change between two).
const overlayScenario = (id, title, game, { window = [1280, 720], fixed = false, crop = null, pauseReason = null, inputType = 'keyboard', cameraX = 0, frames = [[0.3, null]] } = {}) => {
  const layout = layoutFor(...window, undefined, { fixed });
  // Whole units: a canvas a fraction of a pixel off its size would squeeze the picture.
  const [x, y, width, height] = crop ?? [0, 0, Math.floor(layout.view.width), Math.floor(layout.view.height)];
  const run = (overlays) => {
    for (const [dt, stages] of frames) {
      if (stages) game.worlds.forEach((w, i) => (w.stages = [stages[i]]));
      overlays.update(game, cameraX, { pauseReason, inputType, dt });
    }
  };
  return withArt({
    id,
    title,
    width,
    height,
    scroll: [x, y],
    pixi(world, pixi, zoom) {
      const overlays = new Overlays();
      overlays.resize(layout);
      run(overlays);
      sharpen(overlays.view, zoom);
      world.addChild(overlays.view);
    },
    phaser(scene, zoom) {
      const overlays = new PhaserOverlays(scene, artFor(scene, zoom));
      overlays.resize(layout, zoom);
      run(overlays);
      scene.add.existing(overlays.view);
    },
  });
};
// The mute and full-screen buttons in the top-left corner (as main.js and the UI scene
// place them), `muted` and `fullscreen` on or off, on a window `window`: the view's
// corner as large as the HUD's (hudScenario). What differs is the round ends of the
// speaker's waves, which Pixi starts short (PHASER_PLAN.md, M4's gallery).
const buttonScenario = (id, title, { muted = false, fullscreen = false, window = [1280, 720] } = {}) => {
  const layout = layoutFor(...window);
  return withArt({
    id,
    title,
    width: Math.ceil(640 * layout.ui),
    height: Math.ceil(160 * layout.ui),
    pixi(world) {
      const controls = new Container();
      const mute = new MuteButton();
      const full = new FullscreenButton();
      mute.update(muted);
      full.update(fullscreen);
      controls.addChild(mute.view, full.view);
      controls.position.set(layout.insets.left, layout.insets.top);
      controls.scale.set(layout.ui);
      world.addChild(controls);
    },
    phaser(scene, zoom) {
      const buttons = new Buttons(scene, artFor(scene, zoom));
      buttons.setMuted(muted);
      buttons.setFullscreen(fullscreen);
      buttons.view.setPosition(layout.insets.left, layout.insets.top).setScale(layout.ui);
      scene.add.existing(buttons.view);
    },
  });
};

// The title panel's area, in a 1280 × 720 view.
const TITLE_CROP = [740, 100, 500, 520];
const RESULTS_CROP = [360, 150, 560, 420];

export const UI_SCENARIOS = [
  hudScenario('ui.hud.solo', 'The HUD in single player: score and best, bananas, three hearts', hudGame({ score: 1234, best: 5678, bananas: [7, 0], livesOn: true })),
  hudScenario('ui.hud.soloMany', 'The same with more lives than hearts (the count) and no best yet', hudGame({ score: 98, best: 0, bananas: [123, 0], livesOn: true, lives: [7, 0] })),
  hudScenario('ui.hud.shared', 'The HUD in shared screen: both players side by side, P2 out', hudGame({ players: 2, scores: [12, 345], out: [false, true], bananas: [3, 41], livesOn: true, lives: [2, 0] }), { fixed: true }),
  hudScenario('ui.hud.split', 'The HUD in split screen: each player at the top of their pane', hudGame({ players: 2, worlds: 2, scores: [7, 0], bananas: [1, 0], livesOn: true, lives: [3, 1] }), { fixed: true, height: 720 }),
  overlayScenario('ui.title', 'The title: single player with a keyboard, every setting off', overlayGame(), { crop: TITLE_CROP }),
  overlayScenario('ui.title.on', 'The title with lives, slipping and the shadow on', overlayGame({ lives: true, slip: true, shadow: true }), { crop: TITLE_CROP }),
  overlayScenario('ui.title.shared', 'The title in shared screen (two players: their keys, lives always on)', overlayGame({ mode: 'shared', players: 2, lives: true }), { crop: TITLE_CROP, fixed: true }),
  overlayScenario('ui.title.touch', 'The title on a touch screen (no modes or settings)', overlayGame(), { crop: TITLE_CROP, inputType: 'touch' }),
  overlayScenario('ui.title.portrait', 'The title on a portrait phone (enlarged, below the band)', overlayGame(), { window: [390, 844], inputType: 'touch' }),
  overlayScenario('ui.results', 'The results in single player, with a new best', overlayGame({ state: GameState.RESULTS, score: 321, best: 321, newBest: true, bananas: [[12, 20], [0, 0]] }), { crop: RESULTS_CROP }),
  overlayScenario('ui.results.fading', 'The results fading in, without the prompt yet', overlayGame({ state: GameState.RESULTS, stateTime: 0.1, score: 5, best: 40, bananas: [[0, 3], [0, 0]], restart: false }), { crop: RESULTS_CROP }),
  overlayScenario('ui.results.2p', 'The results of a two-player match: P2 wins', overlayGame({ mode: 'split', players: 2, worlds: 2, state: GameState.RESULTS, winners: [1], scores: [14, 30], bananas: [[3, 9], [7, 9]] }), { crop: RESULTS_CROP, fixed: true }),
  overlayScenario('ui.paused', 'Paused by the player (P)', overlayGame({ state: GameState.PLAYING }), { crop: [400, 200, 480, 320], pauseReason: 'manual' }),
  overlayScenario('ui.paused.away', 'Paused by the window losing focus, on a touch screen', overlayGame({ state: GameState.PLAYING }), { crop: [400, 200, 480, 320], pauseReason: 'unfocused', inputType: 'touch' }),
  overlayScenario('ui.banner', 'The stage banner, entering stage 2', overlayGame({ state: GameState.PLAYING }), { crop: [340, 420, 600, 200], frames: [[0, [1]], [1, [2]]] }),
  overlayScenario('ui.banner.split', 'Split screen: a banner in each pane (stages 4 and 5), and P1 out', overlayGame({ mode: 'split', players: 2, worlds: 2, state: GameState.PLAYING, out: [true, false] }), { fixed: true, frames: [[0, [1, 1]], [1, [4, 5]]] }),
  overlayScenario('ui.arrow', 'The arrow over a monkey above the view', overlayGame({ state: GameState.PLAYING, monkey: { x: 700, y: -80 } }), { crop: [400, 0, 600, 80], cameraX: 100 }),
  buttonScenario('ui.buttons', 'The mute and full-screen buttons: sound on, not full screen'),
  buttonScenario('ui.buttons.on', 'The same muted and full screen', { muted: true, fullscreen: true }),
  buttonScenario('ui.buttons.portrait', 'The buttons on a portrait phone (enlarged)', { window: [390, 844] }),
  hudScenario('ui.hud.portrait', 'The HUD on a portrait phone (enlarged)', hudGame({ score: 77, best: 120, bananas: [5, 0], livesOn: true, lives: [4, 0] }), { window: [390, 844], height: 300 }),
];
