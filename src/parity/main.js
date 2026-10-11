import { Application, Container, Graphics } from 'pixi.js';
import Phaser from 'phaser';
import { SCENARIOS } from './scenarios.js';
import { PARITY, compareImages, passes } from './diff.js';

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

async function drawWithPixi(scenario) {
  const app = new Application();
  await app.init({
    width: scenario.width,
    height: scenario.height,
    preference: 'webgl',
    antialias: true,
    resolution: 1,
    background: 0x000000,
    preserveDrawingBuffer: true,
    autoStart: false,
  });
  scenario.pixi(app.stage, { Graphics, Container });
  app.render();
  const image = pixelsOf(app.canvas, scenario.width, scenario.height);
  app.destroy(true, { children: true });
  return image;
}

async function drawWithPhaser(scenario) {
  const parent = document.createElement('div');
  parent.className = 'offscreen';
  document.body.append(parent);
  let game;
  const image = await new Promise((resolve) => {
    game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent,
      width: scenario.width,
      height: scenario.height,
      backgroundColor: '#000000',
      banner: false,
      audio: { noAudio: true },
      render: { antialias: true, preserveDrawingBuffer: true },
      scene: {
        create() {
          scenario.phaser(this);
          this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
            resolve(pixelsOf(this.game.canvas, scenario.width, scenario.height)),
          );
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
    const { width, height } = scenario;
    const pixi = await drawWithPixi(scenario);
    const phaser = await drawWithPhaser(scenario);
    const result = compareImages(pixi.data, phaser.data);
    const pass = passes(result);
    results.push({ id: scenario.id, pixels: result.pixels, differing: result.differing, share: result.share, maxDelta: result.maxDelta, pass });

    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = `${scenario.id}: ${scenario.title}`;
    const summary = document.createElement('p');
    summary.className = pass ? 'pass' : 'fail';
    summary.textContent = `${pass ? 'Identical' : 'Different'}: ${(result.share * 100).toFixed(2)} % of the pixels differ by more than ${PARITY.channel}/255 (limit ${PARITY.share * 100} %); largest difference ${result.maxDelta}/255.`;
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
  document.documentElement.dataset.parity = 'done';
} catch (error) {
  console.error(error);
  list.append(Object.assign(document.createElement('p'), { className: 'fail', textContent: `Failed: ${error.message}` }));
  document.documentElement.dataset.parity = 'error';
}
window.__parity = results;
