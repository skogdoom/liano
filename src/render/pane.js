import { Container, Graphics } from 'pixi.js';
import { Background } from './background.js';
import { BananaViews, BoostBadge } from './bananaView.js';
import { Camera, cameraTarget } from './camera.js';
import { LianaView } from './lianaView.js';
import { MonkeyView, PALETTES } from './monkeyView.js';
import { ObstacleViews } from './obstacleViews.js';

// One world drawn in one rect of the view: the whole view in single player, a strip
// per player in split screen. Back to front: sky and parallax layers, the world
// (scrolled by the camera), the canopy strip and floor band, then `overlay` (the debug
// view). `scene` is what the death shake moves.
export class Pane {
  constructor() {
    this.view = new Container();
    this.scene = new Container();
    this.background = new Background();
    this.worldLayer = new Container();
    this.lianaView = new LianaView();
    this.obstacleViews = new ObstacleViews();
    this.bananaViews = new BananaViews();
    this.monkeyLayer = new Container();
    this.monkeyViews = [];
    this.badges = [];
    this.worldLayer.addChild(
      this.obstacleViews.view,
      this.lianaView.view,
      this.bananaViews.view,
      this.monkeyLayer,
    );
    this.overlay = new Container();
    this.scene.addChild(this.background.back, this.worldLayer, this.background.front, this.overlay);
    this.clip = new Graphics();
    this.view.addChild(this.scene);
    this.ownCamera = new Camera();
    this.camera = this.ownCamera;
    this.world = null;
    this.layout = null;
  }

  // `pane` is one of paneLayouts(): where it goes and how its world is drawn.
  resize(pane) {
    this.layout = pane;
    this.view.position.set(pane.x, pane.y);
    this.scene.scale.set(pane.scale);
    this.background.resize(pane);
    this.ownCamera.screenX = pane.camera.screenX;
    // Split panes clip their world (a monkey above the canopy must not draw into the
    // other pane); the single pane does without the stencil pass.
    if (pane.clip) {
      this.clip.clear().rect(0, 0, pane.width, pane.height).fill(0xffffff);
      if (!this.clip.parent) this.view.addChild(this.clip);
      this.scene.mask = this.clip;
    } else {
      this.scene.mask = null;
      this.clip.removeFromParent();
    }
    if (this.world && this.camera === this.ownCamera) this.camera.reset(this.#target());
  }

  // Shows `world`, whose monkeys belong to `players` (their palettes, by monkey index).
  // `camera`: a camera the rules move (shared screen's leader camera), else the pane
  // follows player 1's monkey with its own.
  setWorld(world, players, camera = null) {
    this.world = world;
    this.players = players;
    this.camera = camera ?? this.ownCamera;
    while (this.monkeyViews.length < world.monkeys.length) this.monkeyViews.push(null);
    world.monkeys.forEach((m, i) => {
      if (this.monkeyViews[i]?.player === players[i]) return;
      this.monkeyViews[i]?.view.destroy({ children: true });
      this.badges[i]?.view.destroy({ children: true });
      const view = new MonkeyView(PALETTES[players[i]]);
      view.player = players[i];
      this.monkeyViews[i] = view;
      this.badges[i] = new BoostBadge();
      this.monkeyLayer.addChild(view.view, this.badges[i].view);
    });
    for (const view of this.monkeyViews.splice(world.monkeys.length)) view?.view.destroy({ children: true });
    for (const badge of this.badges.splice(world.monkeys.length)) badge?.view.destroy({ children: true });
    if (this.layout && !camera) this.camera.reset(this.#target());
  }

  // Fixed-step camera update; it holds still once everyone in the world is out.
  stepCamera(dt) {
    if (this.camera === this.ownCamera && this.world.alive) this.camera.update(this.#target(), dt);
  }

  // What the pane's own camera follows: player 1's monkey.
  #target() {
    return cameraTarget(this.world.monkey, this.layout.camera.follow);
  }

  // `events`: this frame's events from this pane's world.
  update(events, dt, shake) {
    const { world, camera } = this;
    this.scene.position.set(shake.x, this.layout.bandTop * this.layout.scale + shake.y);
    this.worldLayer.x = -camera.x;
    this.overlay.x = -camera.x;
    this.background.update(camera.x);
    this.background.setStage(Math.max(...world.stages), world, dt);
    this.lianaView.update(world.lianas.values(), camera.x, this.layout.view.width, world.monkeys);
    this.obstacleViews.update(world.obstacles.values());
    this.bananaViews.update(world, events, dt);
    world.monkeys.forEach((m, i) => {
      this.monkeyViews[i].update(m, dt, world.isInvulnerable(i));
      this.badges[i].update(m);
    });
  }
}
