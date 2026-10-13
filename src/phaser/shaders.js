// Phaser 4 draws a batch of images (and of tiles and ropes, which batch the same way)
// with a shader made for the exact number of textures in the batch, and compiles each
// such shader the first time it is needed. An obstacle that brought a batch to a number
// of textures not seen yet thus compiled a shader in the middle of play: in Safari, a
// stall of tens of ms (76 ms on a MacBook Air M1 when the first beehive showed). Here
// every batch uses the shader for the most textures a batch can take, so each kind of
// batch has one shader, compiled as the game starts. A batch with fewer textures leaves
// the shader's other texture slots unused, at no cost to speak of.
export function oneShaderPerBatchKind(renderer) {
  let proto = Object.getPrototypeOf(renderer.renderNodes.getNode('BatchHandlerQuad'));
  while (proto && !Object.hasOwn(proto, 'finalizeTextureCount')) proto = Object.getPrototypeOf(proto);
  if (!proto || proto.finalizeTextureCount.oneShader) return;
  const finalize = proto.finalizeTextureCount;
  proto.finalizeTextureCount = function () {
    finalize.call(this, this.maxTexturesPerBatch);
  };
  proto.finalizeTextureCount.oneShader = true;
}
