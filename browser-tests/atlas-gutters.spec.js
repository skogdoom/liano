import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

test('cartoon atlas cells have independent extrusion margins and a transparent mist edge', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}rigs.html?art=cartoon&only=none`);
  await page.waitForFunction(() => document.documentElement.dataset.rigs === 'ready');
  const result = await page.evaluate(async () => {
    const overlaps = [], mistEdges = [];
    for (const scale of [1, 2, 4]) for (const set of ['boot', 'main']) {
      const atlas = await (await fetch(`/art/cartoon/${set}@${scale}x.json`)).json();
      for (const texture of atlas.textures) {
        const frames = texture.frames;
        // Every frame extrudes one pixel on each side. Those rectangles must
        // be disjoint even when the edge pixels are transparent.
        for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
          const a = frames[i].frame, b = frames[j].frame;
          if (a.x - 1 < b.x + b.w + 1 && b.x - 1 < a.x + a.w + 1
            && a.y - 1 < b.y + b.h + 1 && b.y - 1 < a.y + a.h + 1) {
            overlaps.push(`${texture.image}: ${frames[i].filename} / ${frames[j].filename}`);
          }
        }
        const mist = frames.find(frame => frame.filename === 'temple.haze');
        if (!mist) continue;
        const image = new Image();
        image.src = `/art/cartoon/${texture.image}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const { x, y, w } = mist.frame;
        const pixels = context.getImageData(x - 1, y - 1, w + 2, 1).data;
        let maxAlpha = 0;
        for (let i = 3; i < pixels.length; i += 4) maxAlpha = Math.max(maxAlpha, pixels[i]);
        mistEdges.push({ scale, maxAlpha });
      }
    }
    return { overlaps, mistEdges };
  });
  expect(result.overlaps).toEqual([]);
  expect(result.mistEdges).toEqual([1, 2, 4].map(scale => ({ scale, maxAlpha: 0 })));
  expect(errors).toEqual([]);
});
