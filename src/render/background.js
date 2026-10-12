import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { FAR_FACTOR, MID_FACTOR, NEAR_FACTOR, STAGE_TINTS, StageTint, TILE, drawCanopyLayer, drawFarLayer, drawFloorLayer, drawMidLayer, drawNearLayer, drawSky, layerShift } from '../views/backdrop.js';

// The parts both versions share (pure: no Pixi) are in views/backdrop.js.
export * from '../views/backdrop.js';

class ParallaxLayer {
  constructor(context, factor) {
    this.factor = factor;
    // A render group keeps the static geometry on the GPU: moving the layer only
    // changes its transform, instead of re-packing every vertex each frame. Its
    // coordinates stay within a few tiles, so float precision is not a concern.
    this.view = new Container({ isRenderGroup: true });
    for (let i = 0; i < 2; i++) {
      const copy = new Graphics(context);
      copy.x = i * TILE;
      this.view.addChild(copy);
    }
  }

  update(cameraX) {
    this.view.x = -layerShift(cameraX, this.factor);
  }
}

// Far: hazy tree silhouettes and canopy masses.
function farLayer() {
  return new ParallaxLayer(drawFarLayer(new GraphicsContext()), FAR_FACTOR);
}

// Mid: darker trunks with a few branch stubs.
function midLayer() {
  return new ParallaxLayer(drawMidLayer(new GraphicsContext()), MID_FACTOR);
}

// Near: ferns along the floor and leaf clumps under the canopy.
function nearLayer() {
  return new ParallaxLayer(drawNearLayer(new GraphicsContext()), NEAR_FACTOR);
}

// Front, moving with the world: the canopy strip the lianas hang from.
function canopyLayer() {
  return new ParallaxLayer(drawCanopyLayer(new GraphicsContext()), 1);
}

// Front, moving with the world: the dark jungle floor. Falling in here ends the run.
// It reaches EXTEND_DOWN below the band, for taller views.
function floorLayer() {
  return new ParallaxLayer(drawFloorLayer(new GraphicsContext()), 1);
}

export class Background {
  constructor() {
    this.back = new Container();
    this.front = new Container();
    this.far = farLayer();
    this.mid = midLayer();
    this.near = nearLayer();
    this.canopy = canopyLayer();
    this.floor = floorLayer();
    this.sky = new Graphics();
    const skyGroup = new Container({ isRenderGroup: true });
    skyGroup.addChild(this.sky);
    this.back.addChild(skyGroup, this.far.view, this.mid.view, this.near.view);
    this.front.addChild(this.canopy.view, this.floor.view);
    this.stageTint = new StageTint();
    // The tint now, for the scenery that is drawn between the layers (the temple).
    this.color = STAGE_TINTS[0];
  }

  // Shifts the tint towards the stage's; a new world starts at once from the first.
  setStage(stage, world, dt) {
    const color = this.stageTint.update(stage, world, dt);
    this.color = color;
    this.back.tint = color;
    this.front.tint = color;
  }

  // Fits the sky to the view, and lifts the floor to the bottom edge when the band is
  // cropped (see layout.js).
  resize(layout) {
    const top = -layout.bandTop;
    drawSky(this.sky, top, layout.view.width, top + layout.view.height);
    this.floor.view.y = layout.floorShift;
  }

  update(cameraX) {
    for (const layer of [this.far, this.mid, this.near, this.canopy, this.floor]) layer.update(cameraX);
  }
}
