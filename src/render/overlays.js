import { Container, Graphics, Text } from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, MONKEY_RADIUS } from '../config.js';
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

// Arrow at the top edge, at the monkey's x, while it is above the screen.
class OffscreenIndicator {
  constructor() {
    this.view = new Graphics()
      .poly([0, 0, 11, 16, 4, 16, 4, 26, -4, 26, -4, 16, -11, 16])
      .fill(0xf4e7c5)
      .stroke({ width: 2, color: 0x2a1a0c, join: 'round' });
    this.view.y = 8;
  }

  update(monkey, cameraX) {
    this.view.visible = monkey.y < -MONKEY_RADIUS;
    this.view.x = Math.min(Math.max(monkey.x - cameraX, 16), SCREEN_WIDTH - 16);
  }
}

// Placeholder title / game-over overlays (proper ones come in milestone 7) and the
// off-screen indicator.
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

    this.indicator = new OffscreenIndicator();
    this.view.addChild(this.indicator.view, this.title, this.gameOver);
  }

  update(game, cameraX) {
    this.indicator.update(game.world.monkey, cameraX);
    this.title.visible = game.state === GameState.READY;
    this.gameOver.visible = game.state === GameState.GAME_OVER;
    this.gameOverPrompt.visible = game.canRestart();
  }
}
