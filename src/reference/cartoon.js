import Phaser from 'phaser';
import manifest from '../../browser-tests/references/cartoon/manifest.json';
import { queueArt } from '../render/art.js';
import { compareImages, passes, solidPixels } from '../visualDiff.js';
import { cartoonScenario } from './cartoonScenarios.js';

const params = new URLSearchParams(location.search);
const capture = params.get('capture') === '1';
const only = params.get('only');
const results = [];
const canvasOf = (width, height) => Object.assign(document.createElement('canvas'), { width, height });

async function draw(reference) {
  const scenario = cartoonScenario(reference, manifest.version);
  const parent = document.createElement('div');
  parent.className = 'offscreen';
  document.body.append(parent);
  let game;
  try {
    return await new Promise((resolve, reject) => {
      game = new Phaser.Game({
        type: Phaser.WEBGL, parent, width: reference.width, height: reference.height,
        backgroundColor: scenario.background ?? 0x000000,
        banner: false, audio: { noAudio: true },
        render: { antialias: true, preserveDrawingBuffer: true, maxTextures: 1 },
        scene: {
          preload() {
            this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, file => reject(new Error(`Could not load ${file.url}`)));
            queueArt(this.load, manifest.atlasScale, ['boot', 'main'], 'cartoon');
          },
          create() {
            try {
              const [x, y] = scenario.scroll ?? [0, 0];
              this.cameras.main.setOrigin(0, 0).setZoom(1).setScroll(x, y);
              scenario.draw(this, manifest.atlasScale);
              game.events.once(Phaser.Core.Events.POST_RENDER, () => {
                const canvas = canvasOf(reference.width, reference.height);
                canvas.getContext('2d').drawImage(game.canvas, 0, 0);
                resolve(canvas);
              });
            } catch (error) { reject(error); }
          },
        },
      });
    });
  } finally {
    game?.destroy(true);
    parent.remove();
  }
}

function figure(canvas, caption) {
  const result = document.createElement('figure');
  result.append(canvas, Object.assign(document.createElement('figcaption'), { textContent: caption }));
  return result;
}

try {
  for (const reference of manifest.references.filter(r => !only || r.id === only)) {
    const { id, width, height } = reference;
    const current = await draw(reference);
    current.dataset.current = id;
    const section = document.createElement('section');
    section.id = id;
    const heading = Object.assign(document.createElement('h2'), { textContent: id });
    section.append(heading);
    if (capture) {
      section.append(figure(current, 'Current capture; saved only by the explicit capture script'));
      results.push({ id, width, height });
    } else {
      const image = new Image();
      image.src = `/browser-tests/references/cartoon/${id}.png`;
      await image.decode();
      if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error(`Wrong reference dimensions: ${id}`);
      const saved = canvasOf(width, height);
      const context = saved.getContext('2d');
      context.drawImage(image, 0, 0);
      const comparison = compareImages(context.getImageData(0, 0, width, height).data,
        current.getContext('2d').getImageData(0, 0, width, height).data);
      const solid = solidPixels(comparison, width);
      const result = { id, pixels: comparison.pixels, share: comparison.share, solid,
        pass: passes({ ...comparison, solid }) };
      results.push(result);
      heading.textContent += result.pass ? ': matches' : ': changed';
      const diff = canvasOf(width, height);
      diff.getContext('2d').putImageData(new ImageData(comparison.diff, width, height), 0, 0);
      section.append(figure(saved, 'Saved reference'), figure(current, 'Current'), figure(diff, 'Difference'));
    }
    document.getElementById('references').append(section);
  }
  if (!results.length) throw new Error('No matching cartoon reference');
  document.documentElement.dataset.references = capture ? 'captured' : 'done';
} catch (error) {
  console.error(error);
  document.getElementById('references').textContent = error.message;
  document.documentElement.dataset.references = 'error';
}
window.__cartoonReferences = results;
