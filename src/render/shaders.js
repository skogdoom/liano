// Phaser 4 draws a batch of images (and of tiles and ropes, which batch the same way)
// from up to as many textures as the GPU can sample at once (16 on most), with a shader
// made for the exact number in the batch, compiled the first time it is needed. Two
// costs: an obstacle that brought a batch to a number of textures not seen yet compiled
// a shader in the middle of play (in Safari a stall of tens of ms: 76 ms on a MacBook Air
// M1 when the first beehive showed), and every pixel drawn picks its texture among the
// batch's, which costs the GPU more than the extra draw calls it saves (the shader for 16
// textures made Safari draw at 40 fps). So a batch takes one texture, as Phaser does by
// default on phones: one shader per kind of batch, compiled before the title, and the
// cheapest one per pixel (less than half the drawing time of either, in Chromium's
// software renderer).
export function oneTexturePerBatch(renderer) {
  renderer.renderNodes.setMaxParallelTextureUnits(1);
}
