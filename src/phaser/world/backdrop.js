import { FLOOR_DEPTH, SKY_BAND_HEIGHT, SKY_WIDTH } from '../../art/pieces/backdrop.js';
import { WORLD_HEIGHT } from '../../config.js';
import {
  EXTEND_DOWN,
  FAR_FACTOR,
  FLOOR_Y,
  MID_FACTOR,
  NEAR_FACTOR,
  SKY_BANDS,
  SKY_MARGIN,
  StageTint,
  layerShift,
  skyLayout,
} from '../../views/backdrop.js';
import { makeContainer } from './build.js';

// The jungle backdrop in the Phaser version (as the Pixi Background): the sky, stretched
// to the view, and three parallax layers behind the world (`back`); the canopy strip and
// the floor in front of it (`front`), which scroll with the world. The layers are tiles
// repeating sideways (TileSprites); all of it takes the stage tint, eased as the stages
// change.
const SKY = SKY_BANDS * SKY_BAND_HEIGHT; // the sky piece's height, in units

export class BackdropRig {
  constructor(scene, art) {
    this.scene = scene;
    this.art = art;
    this.back = makeContainer(scene);
    this.front = makeContainer(scene);
    // The sky: its bands, the first band reaching above them and the last below.
    this.sky = { bands: art.image(scene, 'backdrop.sky'), above: art.image(scene, 'backdrop.sky'), below: art.image(scene, 'backdrop.sky') };
    this.layers = [
      ['backdrop.far', FAR_FACTOR, this.back],
      ['backdrop.mid', MID_FACTOR, this.back],
      ['backdrop.near', NEAR_FACTOR, this.back],
      ['backdrop.nearTop', NEAR_FACTOR, this.back],
      ['backdrop.canopy', 1, this.front],
      ['backdrop.floor', 1, this.front],
    ].map(([key, factor, group]) => ({ key, factor, group, tile: art.tile(scene, key, 1) }));
    this.floor = makeContainer(scene);
    // Below the floor's undergrowth, its colour down to the bottom of taller views.
    this.floorFill = art.image(scene, 'backdrop.floorFill');
    const tileOf = (key) => this.layers.find((l) => l.key === key).tile;
    this.back.add([this.sky.bands, this.sky.above, this.sky.below, ...['far', 'mid', 'near', 'nearTop'].map((k) => tileOf(`backdrop.${k}`))]);
    this.floor.add([tileOf('backdrop.floor'), this.floorFill]);
    this.front.add([tileOf('backdrop.canopy'), this.floor]);
    this.stageTint = new StageTint();
    this.color = this.stageTint.color;
    this.shownTint = null;
  }

  // Fits the sky and the layers to the pane (one of paneLayouts()), and lifts the floor to
  // the bottom edge when the band is cropped (see layout.js).
  resize(pane) {
    const top = -pane.bandTop;
    const sky = skyLayout(top, pane.view.width, top + pane.view.height);
    const { art } = this;
    art.stretch(this.sky.bands, 'backdrop.sky', { x: sky.x, y: sky.bands.y, w: sky.w, h: sky.bands.h });
    art.stretch(this.sky.above, 'backdrop.sky', { x: sky.x, ...sky.above, w: sky.w }, { to: [SKY_WIDTH, SKY_BAND_HEIGHT] });
    art.stretch(this.sky.below, 'backdrop.sky', { x: sky.x, ...sky.below, w: sky.w }, { from: [0, SKY - SKY_BAND_HEIGHT] });
    // The layers span the view, and SKY_MARGIN more each side for the death shake.
    const width = pane.view.width / pane.scale + 2 * SKY_MARGIN;
    for (const { key, tile } of this.layers) this.art.setTile(tile.setX(-SKY_MARGIN), key, { width });
    const fillTop = FLOOR_Y + FLOOR_DEPTH;
    art.stretch(this.floorFill, 'backdrop.floorFill', { x: -SKY_MARGIN, y: fillTop, w: width, h: WORLD_HEIGHT + EXTEND_DOWN - fillTop });
    this.floor.y = pane.floorShift;
    this.cameraX = null;
  }

  // Scrolls the layers for a camera at `cameraX`.
  update(cameraX) {
    for (const { key, tile, factor } of this.layers) this.art.setTile(tile, key, { x: layerShift(cameraX, factor) - SKY_MARGIN });
  }

  // Eases the tint towards the stage's (see StageTint); returns it.
  setStage(stage, world, dt) {
    this.color = this.stageTint.update(stage, world, dt);
    if (this.color !== this.shownTint) {
      this.art.tint([this.back, this.front], this.color);
      this.shownTint = this.color;
    }
    return this.color;
  }
}
