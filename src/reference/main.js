import Phaser from 'phaser';
import manifest from '../../browser-tests/references/manifest.json';
import { compareImages, passes, solidPixels } from '../visualDiff.js';
import { WORLD_SCENARIOS } from './worldScenarios.js';
import { UI_SCENARIOS } from './uiScenarios.js';

// Dev-only visual checks against Phaser images saved before the Pixi removal.
// These fixtures have fixed seeds, times and poses, independent of callback timing.
const scenarios = new Map([...WORLD_SCENARIOS, ...UI_SCENARIOS].map((s) => [s.id, s]));

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function draw(scenario) {
  const { width, height } = scenario;
  const parent = document.createElement('div');
  parent.className = 'offscreen';
  document.body.append(parent);
  let game;
  try {
    return await new Promise((resolve, reject) => {
      game = new Phaser.Game({
        type: Phaser.WEBGL, parent, width, height,
        backgroundColor: scenario.background ?? 0x000000,
        banner: false, audio: { noAudio: true },
        render: { antialias: true, preserveDrawingBuffer: true },
        scene: {
          preload() { scenario.preload?.(this, 1); },
          create() {
            try {
              const [x, y] = scenario.scroll ?? [0, 0];
              this.cameras.main.setOrigin(0, 0).setZoom(1).setScroll(x, y);
              scenario.draw(this, 1);
              this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
                const canvas = canvasOf(width, height);
                canvas.getContext('2d').drawImage(this.game.canvas, 0, 0);
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
  const figure = document.createElement('figure');
  figure.append(canvas, Object.assign(document.createElement('figcaption'), { textContent: caption }));
  return figure;
}

const results = [];
const only = new URLSearchParams(location.search).get('only');
try {
  for (const reference of manifest.references.filter((r) => !only || r.id === only)) {
    const scenario = scenarios.get(reference.id);
    if (!scenario) throw new Error(`Missing fixture: ${reference.id}`);
    const { width, height } = reference;
    if (scenario.width !== width || scenario.height !== height) throw new Error(`Changed fixture size: ${reference.id}`);
    const current = await draw(scenario);
    const image = new Image();
    image.src = `/browser-tests/references/${reference.id}.png`;
    await image.decode();
    const saved = canvasOf(width, height);
    const context = saved.getContext('2d');
    context.drawImage(image, 0, 0);
    const comparison = compareImages(context.getImageData(0, 0, width, height).data,
      current.getContext('2d').getImageData(0, 0, width, height).data);
    const solid = solidPixels(comparison, width);
    const result = { id: reference.id, pixels: comparison.pixels, share: comparison.share, solid,
      pass: passes({ ...comparison, solid }) };
    results.push(result);
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = `${reference.id}: ${result.pass ? 'matches' : 'changed'}`;
    const diff = canvasOf(width, height);
    diff.getContext('2d').putImageData(new ImageData(comparison.diff, width, height), 0, 0);
    section.append(heading, figure(saved, 'Saved reference'), figure(current, 'Current'), figure(diff, 'Difference'));
    document.getElementById('references').append(section);
  }
  if (!results.length) throw new Error('No matching reference');
  document.documentElement.dataset.references = 'done';
} catch (error) {
  console.error(error);
  document.getElementById('references').textContent = error.message;
  document.documentElement.dataset.references = 'error';
}
window.__references = results;
