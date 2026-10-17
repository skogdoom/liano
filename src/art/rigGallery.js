import Phaser from 'phaser';
import { WORLD_SCENARIOS } from '../reference/worldScenarios.js';
import { UI_SCENARIOS } from '../reference/uiScenarios.js';
import { Art, queueArt } from '../render/art.js';
import { artChoice } from '../platform/artStyle.js';

const pack = artChoice(location.search);
const only = new URLSearchParams(location.search).get('only');
const zoom = new URLSearchParams(location.search).get('zoom') === '2' ? 2 : 1;
const select = document.getElementById('pack');
select.value = pack;
select.addEventListener('change', () => { const next = new URL(location.href); next.searchParams.set('art', select.value); location.assign(next); });
const scenarios = [...WORLD_SCENARIOS, ...UI_SCENARIOS].filter((s) => !only || s.id === only);
const results = [];
for (const scenario of scenarios) {
  const parent = document.createElement('div'); parent.className = 'offscreen'; document.body.append(parent);
  let game;
  try {
    const canvas = await new Promise((resolve, reject) => {
      game = new Phaser.Game({ type: Phaser.WEBGL, parent, width: scenario.width * zoom, height: scenario.height * zoom,
        banner: false, audio: { noAudio: true }, backgroundColor: scenario.background,
        // Set this before renderer boot, including its first/loading frames.
        // Match gameplay's single-texture batching; multi-texture sampling can
        // drop fragments of the grey bat over the backdrop at the 1× atlas scale.
        render: { antialias: true, preserveDrawingBuffer: true, maxTextures: 1 },
        scene: {
          preload() {
            this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => reject(new Error(`Could not load ${file.url}`)));
            queueArt(this.load, Art.scaleFor(zoom), ['boot', 'main'], pack);
          },
          create() {
            try {
              const [x, y] = scenario.scroll ?? [0, 0];
              this.cameras.main.setOrigin(0, 0).setZoom(zoom).setScroll(x, y);
              scenario.draw(this, zoom);
              this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
                const canvas = document.createElement('canvas'); canvas.width = scenario.width * zoom; canvas.height = scenario.height * zoom;
                canvas.getContext('2d').drawImage(this.game.canvas, 0, 0); resolve(canvas);
              });
            } catch (error) { reject(error); }
          },
        },
      });
    });
    const section = document.createElement('section'); section.id = scenario.id;
    const title = document.createElement('h2'); title.textContent = scenario.id;
    section.append(title, canvas); document.getElementById('rigs').append(section);
    results.push(scenario.id);
  } finally { game?.destroy(true); parent.remove(); }
}
document.getElementById('status').textContent = `${pack}: ${results.length} assembled fixtures`;
window.__rigGallery = { pack, fixtures: results };
document.documentElement.dataset.rigs = 'ready';
