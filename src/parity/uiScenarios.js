import { Text } from 'pixi.js';
import { layoutFor } from '../layout.js';
import { Art, CATALOG, queueArt } from '../phaser/art.js';
import { Hud as PhaserHud } from '../phaser/hud.js';
import { Hud } from '../render/hud.js';
import { GameState } from '../sim/game.js';

// M6 scenarios (PHASER_PLAN.md): the HUD, the overlays and the buttons as the Pixi views
// draw them and as the Phaser version draws them, over the view as the layout places them.

const SKY = 0x2a4a35;
const artFor = (scene, zoom) => new Art(scene.cache.json.get(CATALOG), Art.scaleFor(zoom));
const withArt = (scenario) => ({ zooms: [1, 2], background: SKY, preload: (scene, zoom) => queueArt(scene.load, Art.scaleFor(zoom)), ...scenario });

// Pixi rasterizes text at the renderer's resolution; the Phaser version at the screen's
// density times the text's scale. The Pixi texts are set to the same, so the pictures
// compare (the game's Pixi text is that much softer when scaled up).
function sharpen(view, zoom, scale = 1) {
  const own = scale * view.scale.x;
  if (view instanceof Text) view.resolution = zoom * own;
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

export const UI_SCENARIOS = [
  hudScenario('ui.hud.solo', 'The HUD in single player: score and best, bananas, three hearts', hudGame({ score: 1234, best: 5678, bananas: [7, 0], livesOn: true })),
  hudScenario('ui.hud.soloMany', 'The same with more lives than hearts (the count) and no best yet', hudGame({ score: 98, best: 0, bananas: [123, 0], livesOn: true, lives: [7, 0] })),
  hudScenario('ui.hud.shared', 'The HUD in shared screen: both players side by side, P2 out', hudGame({ players: 2, scores: [12, 345], out: [false, true], bananas: [3, 41], livesOn: true, lives: [2, 0] }), { fixed: true }),
  hudScenario('ui.hud.split', 'The HUD in split screen: each player at the top of their pane', hudGame({ players: 2, worlds: 2, scores: [7, 0], bananas: [1, 0], livesOn: true, lives: [3, 1] }), { fixed: true, height: 720 }),
  hudScenario('ui.hud.portrait', 'The HUD on a portrait phone (enlarged)', hudGame({ score: 77, best: 120, bananas: [5, 0], livesOn: true, lives: [4, 0] }), { window: [390, 844], height: 300 }),
];
