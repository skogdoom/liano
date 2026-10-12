import { Application, Container, Graphics } from 'pixi.js';
import Phaser from 'phaser';
import { SCENARIOS } from './scenarios.js';
import { PARITY, compareImages, passes, solidPixels } from './diff.js';

// The parity page (parity.html, dev only): draws each scenario with the Pixi version and
// the Phaser version, and shows both pictures, their differences and whether they count
// as identical. The results are also on `window.__parity` for the browser tests.

// The RGBA pixels of a WebGL canvas (drawn with preserveDrawingBuffer).
function pixelsOf(canvas, width, height) {
  const copy = document.createElement('canvas');
  copy.width = width;
  copy.height = height;
  const context = copy.getContext('2d', { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

// Scenarios are drawn at each of their `zooms` (default 1: 2 is a 2× screen), the world
// seen from `scroll` (its top-left corner, in world units), over `background`.
async function drawWithPixi(scenario, zoom) {
  const width = scenario.width * zoom;
  const height = scenario.height * zoom;
  const app = new Application();
  await app.init({
    width,
    height,
    preference: 'webgl',
    antialias: true,
    resolution: 1,
    background: scenario.background ?? 0x000000,
    preserveDrawingBuffer: true,
    autoStart: false,
  });
  const world = new Container();
  const [sx, sy] = scenario.scroll ?? [0, 0];
  world.scale.set(zoom);
  world.position.set(-sx * zoom, -sy * zoom);
  app.stage.addChild(world);
  scenario.pixi(world, { Graphics, Container });
  app.render();
  const image = pixelsOf(app.canvas, width, height);
  app.destroy(true, { children: true });
  return image;
}

async function drawWithPhaser(scenario, zoom) {
  const width = scenario.width * zoom;
  const height = scenario.height * zoom;
  const parent = document.createElement('div');
  parent.className = 'offscreen';
  document.body.append(parent);
  let game;
  const image = await new Promise((resolve) => {
    game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent,
      width,
      height,
      backgroundColor: scenario.background ?? 0x000000,
      banner: false,
      audio: { noAudio: true },
      render: { antialias: true, preserveDrawingBuffer: true },
      scene: {
        preload() {
          scenario.preload?.(this, zoom);
        },
        create() {
          const [sx, sy] = scenario.scroll ?? [0, 0];
          this.cameras.main.setOrigin(0, 0).setZoom(zoom).setScroll(sx, sy);
          scenario.phaser(this, zoom);
          this.game.events.once(Phaser.Core.Events.POST_RENDER, () => resolve(pixelsOf(this.game.canvas, width, height)));
        },
      },
    });
  });
  game.destroy(true);
  parent.remove();
  return image;
}

function canvasOf(data, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

function figure(caption, canvas) {
  const el = document.createElement('figure');
  const label = document.createElement('figcaption');
  label.textContent = caption;
  el.append(canvas, label);
  return el;
}

const results = [];
const list = document.getElementById('scenarios');
try {
  for (const scenario of SCENARIOS) {
    for (const zoom of scenario.zooms ?? [1]) {
      const width = scenario.width * zoom;
      const height = scenario.height * zoom;
      const pixi = await drawWithPixi(scenario, zoom);
      const phaser = await drawWithPhaser(scenario, zoom);
      const result = compareImages(pixi.data, phaser.data);
      const solid = solidPixels(result, width);
      const pass = passes({ ...result, solid });
      const id = zoom === 1 ? scenario.id : `${scenario.id}@${zoom}x`;
      results.push({ id, pixels: result.pixels, differing: result.differing, share: result.share, maxDelta: result.maxDelta, solid, pass });

      const section = document.createElement('section');
      const heading = document.createElement('h2');
      heading.textContent = `${id}: ${scenario.title}`;
      const summary = document.createElement('p');
      summary.className = pass ? 'pass' : 'fail';
      summary.textContent = `${pass ? 'Identical' : 'Different'}: ${(result.share * 100).toFixed(2)} % of the pixels differ by more than ${PARITY.channel}/255 (limit ${PARITY.share * 100} %); largest difference ${result.maxDelta}/255; ${solid} in solid patches (${((solid / result.pixels) * 1e6).toFixed(0)} per million, limit ${PARITY.solidPerMillion}).`;
      const row = document.createElement('div');
      row.className = 'row';
      row.append(
        figure('Pixi', canvasOf(pixi.data, width, height)),
        figure('Phaser', canvasOf(phaser.data, width, height)),
        figure('Differences (red: over the limit)', canvasOf(result.diff, width, height)),
      );
      section.append(heading, summary, row);
      list.append(section);
    }
  }
  document.documentElement.dataset.parity = 'done';
} catch (error) {
  console.error(error);
  list.append(Object.assign(document.createElement('p'), { className: 'fail', textContent: `Failed: ${error.message}` }));
  document.documentElement.dataset.parity = 'error';
}
window.__parity = results;
