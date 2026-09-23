import { Text } from 'pixi.js';
import { SCREEN_WIDTH } from '../config.js';
import { GameState } from '../sim/game.js';

// Top-right: current score and the best score of this page session.
export class Hud {
  constructor() {
    this.view = new Text({
      text: '',
      style: {
        fontFamily: 'sans-serif',
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xf4e7c5,
        dropShadow: { color: 0x000000, alpha: 0.6, distance: 2, blur: 2, angle: Math.PI / 4 },
      },
    });
    this.view.anchor.set(1, 0);
    this.view.position.set(SCREEN_WIDTH - 24, 12);
    this.shown = null;
  }

  update(game) {
    this.view.visible = game.state !== GameState.READY;
    // game.best is only updated when a run ends; show a best that tracks the live score.
    const text = `${game.score}  BEST ${Math.max(game.best, game.score)}`;
    if (text !== this.shown) {
      this.view.text = text;
      this.shown = text;
    }
  }
}
