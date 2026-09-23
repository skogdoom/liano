import { Container, Text } from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../config.js';
import { GameState } from '../sim/game.js';

const titleStyle = {
  fontFamily: 'sans-serif',
  fontSize: 96,
  fontWeight: 'bold',
  fill: 0xf4e7c5,
  dropShadow: { color: 0x000000, alpha: 0.5, distance: 4, blur: 2, angle: Math.PI / 4 },
};

const promptStyle = {
  fontFamily: 'sans-serif',
  fontSize: 32,
  fill: 0xf4e7c5,
  dropShadow: { color: 0x000000, alpha: 0.5, distance: 2, blur: 1, angle: Math.PI / 4 },
};

function centered(text, style, y) {
  const t = new Text({ text, style });
  t.anchor.set(0.5);
  t.position.set(SCREEN_WIDTH / 2, y);
  return t;
}

// Placeholder title / game-over overlays. Replaced with proper art in milestone 7.
export class Overlays {
  constructor() {
    this.view = new Container();

    this.title = new Container();
    this.title.addChild(
      centered('LIANO', titleStyle, SCREEN_HEIGHT / 2 - 60),
      centered('Press Space to start', promptStyle, SCREEN_HEIGHT / 2 + 40),
    );

    this.gameOver = new Container();
    this.gameOverPrompt = centered('Press Space to play again', promptStyle, SCREEN_HEIGHT / 2 + 40);
    this.gameOver.addChild(centered('GAME OVER', titleStyle, SCREEN_HEIGHT / 2 - 60), this.gameOverPrompt);

    this.view.addChild(this.title, this.gameOver);
  }

  update(game) {
    this.title.visible = game.state === GameState.READY;
    this.gameOver.visible = game.state === GameState.GAME_OVER;
    this.gameOverPrompt.visible = game.canRestart();
  }
}
