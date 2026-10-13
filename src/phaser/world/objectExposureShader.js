import Phaser from 'phaser';
import { expandExposure } from './objectExposure.js';

const { BatchHandlerQuad, SubmitterQuad, TransformerImage } = Phaser.Renderer.WebGL.RenderNodes;
const { getTintAppendFloatAlpha } = Phaser.Renderer.WebGL.Utils;
const BATCH = 'ObjectExposureBatch', SUBMITTER = 'ObjectExposureSubmitter', TRANSFORMER = 'ObjectExposureTransformer';
const UV_KEYS = ['x', 'y', 'u0', 'v0', 'u1', 'v1'];

const exposure = {
  name: 'ObjectExposure',
  additions: {
    vertexHeader: 'attribute vec2 inMotion; attribute vec4 inFrameBounds; varying vec2 outMotion; varying vec4 outFrameBounds;',
    vertexProcess: 'outMotion = inMotion; outFrameBounds = inFrameBounds;',
    fragmentHeader: `
      varying vec2 outMotion;
      varying vec4 outFrameBounds;
      vec4 motionSample(vec2 uv) {
        vec2 inside = step(outFrameBounds.xy, uv) * step(uv, outFrameBounds.zw);
        vec2 halfTexel = 0.5 / getTexRes();
        return getTexture(clamp(uv, outFrameBounds.xy + halfTexel, outFrameBounds.zw - halfTexel)) * inside.x * inside.y;
      }
    `,
    fragmentProcess: `
      if (dot(outMotion, outMotion) > 0.0) {
        fragColor = (motionSample(texCoord - outMotion * 0.5) +
          motionSample(texCoord - outMotion * 0.25) + fragColor +
          motionSample(texCoord + outMotion * 0.25) + motionSample(texCoord + outMotion * 0.5)) / 5.0;
      }
    `,
  },
};

// Same native one-texture quad batching, with six extra floats per vertex. Motion
// and frame bounds vary per image, avoiding a uniform change/draw call per piece.
class ExposureBatch extends BatchHandlerQuad {
  constructor(manager) {
    const additions = [...BatchHandlerQuad.prototype.defaultConfig.shaderAdditions];
    const sampler = additions.findIndex((a) => a.tags?.includes('TEXTURE'));
    // Reuse the native center lookup rather than adding a sixth texture fetch.
    // Only moving images clamp/mask it; zero exposure keeps the exact native path.
    additions[sampler] = { ...additions[sampler], additions: { ...additions[sampler].additions,
      fragmentProcess: `
        vec2 centerUV = texCoord;
        float centerMask = 1.0;
        if (dot(outMotion, outMotion) > 0.0) {
          vec2 inside = step(outFrameBounds.xy, texCoord) * step(texCoord, outFrameBounds.zw);
          centerMask = inside.x * inside.y;
          vec2 halfTexel = 0.5 / getTexRes();
          centerUV = clamp(texCoord, outFrameBounds.xy + halfTexel, outFrameBounds.zw - halfTexel);
        }
        vec4 fragColor = getTexture(centerUV) * centerMask;
      `,
    } };
    additions.splice(sampler + 1, 0, exposure);
    super(manager, { name: BATCH, shaderName: 'OBJECT_EXPOSURE', shaderAdditions: additions,
      vertexBufferLayoutAdd: [{ name: 'inMotion', size: 2 }, { name: 'inFrameBounds', size: 4 }] });
    this.nextRenderOptions.texRes = true;
    this.updateShaderConfig();
  }

  updateRenderOptions(options) {
    super.updateRenderOptions(options);
    this.nextRenderOptions.texRes = true;
    if (!this.renderOptions.texRes) this._renderOptionsChanged = true;
  }

  // Phaser 4.2.1's quad writer has a fixed seven-word stride. Keep its batching
  // protocol and tint packing, and write our thirteen-word layout directly.
  batch(context, texture, x0, y0, x1, y1, x2, y2, x3, y3, u, v, w, h, tintMode,
    tl, bl, tr, br, options, tl2, bl2, tr2, br2) {
    if (this.instanceCount === 0) this.manager.setCurrentBatchNode(this, context);
    options.alphaStrategy = context.alphaStrategy;
    this.updateRenderOptions(options);
    if (this._renderOptionsChanged) { this.run(context); this.updateShaderConfig(); }
    this.datum = this.batchTextures(texture, options);
    this.offset = this.instanceCount * this.floatsPerInstance;
    this.tintMode = tintMode;
    this.attributes = options.exposure;
    this.writeVertex(x1, y1, u, v + h, bl, bl2);
    this.writeVertex(x0, y0, u, v, tl, tl2);
    this.writeVertex(x3, y3, u + w, v + h, br, br2);
    this.writeVertex(x2, y2, u + w, v, tr, tr2);
    this.instanceCount++;
    this.currentBatchEntry.count++;
    if (this.instanceCount === this.instancesPerBatch) this.run(context);
  }

  writeVertex(x, y, u, v, tint, secondary) {
    let offset = this.offset;
    const { viewF32: floats, viewU32: integers } = this.vertexBufferLayout.buffer;
    floats[offset++] = x; floats[offset++] = y;
    floats[offset++] = u; floats[offset++] = v; floats[offset++] = this.datum;
    integers[offset++] = secondary === undefined ? this.tintMode << 24 : getTintAppendFloatAlpha(secondary, this.tintMode / 255);
    integers[offset++] = tint;
    floats.set(this.attributes, offset);
    this.offset = offset + 6;
  }
}

class ExposureTransformer extends TransformerImage {
  constructor(manager) { super(manager, { name: TRANSFORMER }); }

  run(context, image, texturer, parent, element) {
    super.run(context, image, texturer, parent, element);
    const data = image.objectExposure.sample(image, this.quad);
    expandExposure(this.quad, texturer.uvSource, data.dx, data.dy, data.attributes);
    image.objectExposureAttributes = data.attributes;
  }
}

class ExposureSubmitter extends SubmitterQuad {
  constructor(manager) {
    super(manager, { name: SUBMITTER });
    this._renderOptions.multiTexturing = false;
    this._renderOptions.texRes = true;
    // A private UV copy lets the transformer expand geometry/UVs without changing
    // Phaser's cached Frame/crop, or the next image's native texture coordinates.
    this.proxy = { uvSource: {}, run(context, image, element) {
      this.base.run?.(context, image, element);
      this.frame = this.base.frame;
      this.frameWidth = this.base.frameWidth; this.frameHeight = this.base.frameHeight;
      const uv = this.base.uvSource;
      for (const key of UV_KEYS) this.uvSource[key] = uv[key];
    } };
  }

  run(context, image, parent, element, texturer, transformer, tinter, normalMap, rotation) {
    this.proxy.base = texturer;
    super.run(context, image, parent, element, this.proxy, transformer, tinter, normalMap, rotation);
  }

  setRenderOptions(image, normalMap, rotation) {
    super.setRenderOptions(image, normalMap, rotation);
    this._renderOptions.exposure = image.objectExposureAttributes;
  }
}

export function exposureNodes(scene) {
  const manager = scene.sys.renderer.renderNodes;
  const get = (name, Type) => {
    let node = manager.getNode(name);
    if (!node) manager.addNode(name, node = new Type(manager));
    return node;
  };
  const batch = get(BATCH, ExposureBatch);
  const submitter = get(SUBMITTER, ExposureSubmitter);
  const transformer = get(TRANSFORMER, ExposureTransformer);
  // Compile while resources are prepared, before the first obstacle moves.
  batch.programManager.getCurrentProgramSuite();
  return { batch, submitter, transformer };
}

export function exposeImages(view, state, nodes) {
  if (view.list) for (const child of view.list) exposeImages(child, state, nodes);
  // Thirty-two large additive glow discs are already soft. Extra sampling adds
  // GPU work there with essentially no useful change to their moving edges.
  else if (view.type === 'Image' && view.artKey !== 'temple.glow') {
    view.objectExposure = state;
    view.setRenderNodeRole('BatchHandler', nodes.batch)
      .setRenderNodeRole('Submitter', nodes.submitter).setRenderNodeRole('Transformer', nodes.transformer);
  }
}
