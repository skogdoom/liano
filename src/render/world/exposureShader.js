import Phaser from 'phaser';
import { EXPOSURE_SAMPLES } from './exposure.js';

const { BatchHandlerQuad, SubmitterQuad } = Phaser.Renderer.WebGL.RenderNodes;
const BATCH = 'BackdropExposureBatch';
const SUBMITTER = 'BackdropExposureSubmitter';

// Keep the ordinary Image geometry, crop, tint and premultiplied-alpha blend. Only
// its texture sampling changes. One pass, the same texture, no offscreen buffers.
const offsets = Array.from({ length: EXPOSURE_SAMPLES }, (_, i) => (i - (EXPOSURE_SAMPLES - 1) / 2) / (EXPOSURE_SAMPLES - 1)).filter((n) => n !== 0);
const exposure = {
  name: 'BackdropExposure',
  additions: {
    fragmentHeader: 'uniform float uExposure;',
    fragmentProcess: `
      if (uExposure > 0.0) {
        fragColor = (fragColor + ${offsets.map((offset) => `getTexture(vec2(fract(texCoord.x + uExposure * ${offset.toFixed(3)}), texCoord.y))`).join(' + ')}) / ${EXPOSURE_SAMPLES.toFixed(1)};
      }
    `,
  },
};

class ExposureBatch extends BatchHandlerQuad {
  constructor(manager) {
    const additions = [...BatchHandlerQuad.prototype.defaultConfig.shaderAdditions];
    const sampler = additions.findIndex((a) => a.tags?.includes('TEXTURE'));
    additions.splice(sampler + 1, 0, exposure);
    super(manager, { name: BATCH, shaderName: 'BACKDROP_EXPOSURE', shaderAdditions: additions });
    this.renderOptions.exposure = this.nextRenderOptions.exposure = 0;
  }

  updateRenderOptions(options) {
    super.updateRenderOptions(options);
    this.nextRenderOptions.exposure = options.exposure;
    // Flush the preceding layer before changing the uniform. Each layer has its
    // own speed; sharing the final layer's blur would give the wrong exposure.
    if (this.renderOptions.exposure !== options.exposure) this._renderOptionsChanged = true;
  }

  updateShaderConfig() {
    super.updateShaderConfig();
    this.renderOptions.exposure = this.nextRenderOptions.exposure;
  }

  setupUniforms(context) {
    super.setupUniforms(context);
    this.programManager.setUniform('uExposure', this.renderOptions.exposure);
  }
}

class ExposureSubmitter extends SubmitterQuad {
  constructor(manager) {
    super(manager, { name: SUBMITTER });
    this._renderOptions.multiTexturing = false;
  }

  setRenderOptions(image, ...args) {
    super.setRenderOptions(image, ...args);
    this._renderOptions.exposure = image.exposureUV ?? 0;
  }
}

export function addExposure(image) {
  const manager = image.scene.sys.renderer.renderNodes;
  let batch = manager.getNode(BATCH);
  if (!batch) manager.addNode(BATCH, (batch = new ExposureBatch(manager)));
  let submitter = manager.getNode(SUBMITTER);
  if (!submitter) manager.addNode(SUBMITTER, (submitter = new ExposureSubmitter(manager)));
  image.exposureUV = 0;
  return image.setRenderNodeRole('BatchHandler', batch).setRenderNodeRole('Submitter', submitter);
}
