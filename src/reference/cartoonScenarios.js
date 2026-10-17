import { WORLD_SCENARIOS } from './worldScenarios.js';
import { UI_SCENARIOS } from './uiScenarios.js';
import { Art, CATALOG } from '../render/art.js';
import { Overlays } from '../render/overlays.js';
import { ConfigMenu } from '../render/configMenu.js';
import { visibleMenuArea } from '../render/menuLayout.js';
import { layoutFor } from '../layout.js';
import { Game } from '../sim/game.js';
import { World } from '../sim/world.js';

const rigs = new Map([...WORLD_SCENARIOS, ...UI_SCENARIOS].map(s => [s.id, s]));

// Use the same fixed rig poses as the artwork review. Mobile menus use the real
// responsive overlay and visible-area geometry, with deterministic state/time.
export function cartoonScenario(reference, version) {
  if (!reference.menu) {
    const scenario = rigs.get(reference.id);
    if (!scenario) throw new Error(`Missing cartoon fixture: ${reference.id}`);
    if (scenario.width !== reference.width || scenario.height !== reference.height) {
      throw new Error(`Changed cartoon fixture size: ${reference.id}`);
    }
    return scenario;
  }
  return {
    ...reference,
    background: 0x16382b,
    draw(scene, atlasScale) {
      const { width, height, menu } = reference;
      const layout = layoutFor(width, height);
      const art = new Art(scene.cache.json.get(CATALOG), atlasScale);
      const game = new Game({ slip: false, createWorld: options => new World({ ...options, seed: 4242 }) });
      game.stateTime = 1;
      const configMenu = new ConfigMenu('auto', { art: 'cartoon' });
      if (menu === 'config') configMenu.show(game);
      const overlays = new Overlays(scene, art, { configMenu, mobile: true });
      overlays.resize(layout, layout.scale, visibleMenuArea({ innerWidth: width, innerHeight: height }));
      overlays.update(game, 0, { pauseReason: null, inputType: 'touch', dt: 1.37 });
      overlays.titleVersion.set(`v${version}`);
      scene.add.existing(overlays.view);
      scene.cameras.main.setOrigin(0, 0).setZoom(layout.scale)
        .setScroll(-layout.x / layout.scale, -layout.y / layout.scale);
    },
  };
}
