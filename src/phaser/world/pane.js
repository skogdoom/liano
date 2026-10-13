import { DEATH_SHAKE_PX, DEATH_SHAKE_TIME } from '../../config.js';
import { Camera, cameraTarget } from '../../render/camera.js';
import { blend } from '../../render/interpolate.js';
import { Shake } from '../../render/shake.js';
import { BackdropRig } from './backdrop.js';
import { BananaLayer } from './bananas.js';
import { LianaSetRig } from './lianas.js';
import { ObstacleLayer } from './obstacleLayer.js';
import { MonkeyRig } from './monkey.js';
import { ShadowRig } from './shadow.js';
import { makeContainer } from './build.js';

// One world drawn in one rect of the view, as the Pixi Pane (render/pane.js): the whole
// view in single player, a strip per player in split screen. `scene` is what the death
// shake moves; in it, back to front: the sky and the parallax layers, the world
// (scrolled by the camera: the obstacles, the lianas, the bananas, then the shadow and
// the monkeys), the canopy strip and the floor, then `overlay` (the debug view, scrolled
// with the world). The play scene's camera for the pane clips it (PlayScene.placeCameras).
const FURS = ['p1', 'p2'];
const COLOURINGS = ['green', 'gold'];

export class WorldPane {
  constructor(scene, art) {
    this.phaser = scene;
    this.art = art;
    this.view = scene.add.container(0, 0);
    this.scene = makeContainer(scene);
    this.worldLayer = makeContainer(scene);
    this.obstacles = new ObstacleLayer(scene, art);
    this.lianaLayer = makeContainer(scene);
    this.bananas = new BananaLayer(scene, art);
    this.monkeyLayer = makeContainer(scene);
    this.lianaSets = [];
    this.monkeys = [];
    this.shadow = new ShadowRig(scene, art);
    this.monkeyLayer.add(this.shadow.view);
    this.worldLayer.add([this.obstacles.view, this.lianaLayer, this.bananas.view, this.monkeyLayer]);
    this.backdrop = new BackdropRig(scene, art);
    this.overlay = makeContainer(scene);
    this.scene.add([this.backdrop.back, this.worldLayer, this.backdrop.front, this.overlay]);
    this.view.add(this.scene);
    this.ownCamera = new Camera();
    this.camera = this.ownCamera;
    this.shake = new Shake();
    this.world = null;
    this.layout = null;
  }

  // `pane` is one of paneLayouts(): where it goes and how its world is drawn. `zoom`:
  // device pixels per view unit (the camera's), for text.
  resize(pane, zoom = 1) {
    this.bananas.setTextResolution(zoom * pane.scale);
    this.layout = pane;
    this.view.setPosition(pane.x, pane.y);
    this.scene.setScale(pane.scale);
    this.backdrop.resize(pane);
    this.ownCamera.screenX = pane.camera.screenX;
    if (this.world && this.camera === this.ownCamera) this.camera.reset(this.#target());
  }

  // Shows `world`, whose monkeys belong to `players` (their furs, by monkey index).
  // `camera`: a camera the rules move (shared screen's leader camera), else the pane
  // follows player 1's monkey with its own.
  setWorld(world, players, camera = null) {
    this.world = world;
    this.players = players;
    this.camera = camera ?? this.ownCamera;
    const sets = world.lianaSets.length;
    if (this.lianaSets.length !== sets) {
      for (const set of this.lianaSets) set.destroy();
      this.lianaSets =
        sets === 1 ? [new LianaSetRig(this.phaser, this.art)] : world.lianaSets.map((_, i) => new LianaSetRig(this.phaser, this.art, COLOURINGS[i % COLOURINGS.length], i === 0 ? -1 : 1));
      this.lianaLayer.add(this.lianaSets.map((set) => set.view));
    }
    world.monkeys.forEach((m, i) => {
      if (this.monkeys[i]?.player === players[i]) return;
      this.monkeys[i]?.destroy();
      const rig = new MonkeyRig(this.phaser, this.art, FURS[players[i]]);
      rig.player = players[i];
      this.monkeys[i] = rig;
      this.monkeyLayer.add(rig.view);
    });
    for (const rig of this.monkeys.splice(world.monkeys.length)) rig?.destroy();
    if (this.layout && !camera) this.camera.reset(this.#target());
  }

  // Fixed-step camera update; it holds still once everyone in the world is out.
  // (A shared camera is marked and moved by the rules.)
  stepCamera(dt) {
    if (this.camera !== this.ownCamera) return;
    this.camera.mark();
    if (this.world.alive) this.camera.update(this.#target(), dt, this.world.monkey);
  }

  #target() {
    return cameraTarget(this.world.monkey, this.layout.camera.follow);
  }

  // As the Pixi Pane's update.
  update(events, dt, shakes = true, ghost = null, alpha = 1) {
    const { world, camera, shake, layout } = this;
    if (shakes && events.some((e) => e.type === 'death')) shake.trigger(DEATH_SHAKE_PX, DEATH_SHAKE_TIME);
    shake.update(dt);
    this.scene.setPosition(shake.x, layout.bandTop * layout.scale + shake.y);
    const cameraX = blend(camera.prevX, camera.x, alpha);
    this.cameraX = cameraX;
    this.worldLayer.x = -cameraX;
    this.overlay.x = -cameraX;
    this.backdrop.update(cameraX);
    const tint = this.backdrop.setStage(Math.max(...world.stages), world, dt);
    this.obstacles.update(world.obstacles.values(), world.time, tint);
    world.lianaSets.forEach((set, i) => this.lianaSets[i].update(set.values(), cameraX, layout.view.width, world.monkeys, alpha));
    this.bananas.update(world, events, dt);
    world.monkeys.forEach((m, i) => this.monkeys[i].update(m, dt, world.isInvulnerable(i), alpha));
    this.shadow.update(ghost, dt);
  }

  destroy() {
    this.view.destroy();
  }
}
