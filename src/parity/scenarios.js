import { SPIKE_SCENARIOS } from './spikeScenarios.js';

// The scenarios the parity page draws with both versions (see main.js). Each draws the
// same picture twice: `pixi(world, PIXI)` into a Pixi container and `phaser(scene, zoom)`
// in a Phaser scene (after `preload(scene, zoom)`, if given), on a canvas of `width` ×
// `height` at each of its `zooms` (default [1]; 2 is a 2× screen), seeing the world from
// `scroll` (the top-left corner, in world units; default [0, 0]) over `background`.
//
// M0 has one, drawn with each library's own shape calls, to prove the tool; M1 adds the
// spike's three objects (spikeScenarios.js). The game's scenarios (the title, each stage,
// every obstacle kind, ...) come with the milestones that draw them in the Phaser version.
export const SCENARIOS = [
  {
    id: 'shapes',
    title: 'Basic shapes, with each library’s own drawing calls',
    width: 420,
    height: 210,
    pixi(world, { Graphics }) {
      const g = new Graphics();
      g.rect(0, 0, 420, 210).fill(0x1f4a2a);
      g.circle(90, 90, 50).fill(0xe2a93c);
      g.ellipse(230, 90, 70, 40).fill({ color: 0xf4fbff, alpha: 0.6 });
      g.poly([320, 40, 400, 140, 300, 140]).fill(0x858b90);
      g.moveTo(20, 170).lineTo(380, 190).stroke({ width: 4, color: 0xd8cf9a });
      world.addChild(g);
    },
    phaser(scene) {
      const g = scene.add.graphics();
      g.fillStyle(0x1f4a2a).fillRect(0, 0, 420, 210);
      g.fillStyle(0xe2a93c).fillCircle(90, 90, 50);
      g.fillStyle(0xf4fbff, 0.6).fillEllipse(230, 90, 140, 80);
      g.fillStyle(0x858b90).fillPoints([{ x: 320, y: 40 }, { x: 400, y: 140 }, { x: 300, y: 140 }], true);
      g.lineStyle(4, 0xd8cf9a).lineBetween(20, 170, 380, 190);
    },
  },
  ...SPIKE_SCENARIOS,
];
