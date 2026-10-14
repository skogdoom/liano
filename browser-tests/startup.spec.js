import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

async function ready(page) {
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  return errors;
}

test('Phaser prepares sounds and rigs before play; score, tally and life changes upload no textures', async ({ page }) => {
  const errors = await ready(page);
  const result = await page.evaluate(() => {
    const { app, platform, sound, game } = window.__liano;
    app.loop.sleep();
    const hud = app.scene.getScene('ui').hud;
    const countAtlases = () => Object.keys(app.textures.list).filter((key) => key.startsWith('hud.glyphs.')).length;
    const originalAtlases = countAtlases();
    for (const scale of [1.1, 1.2, 1.5, 1]) hud.resize(platform.layout, platform.camera.zoom * scale);
    const retainedAtlases = countAtlases();
    let uploads = 0, rasterizations = 0;
    const gl = app.renderer.gl, texImage = gl.texImage2D, texSub = gl.texSubImage2D;
    const proto = CanvasRenderingContext2D.prototype, fill = proto.fillText, stroke = proto.strokeText;
    gl.texImage2D = function (...args) { uploads++; return texImage.apply(this, args); };
    gl.texSubImage2D = function (...args) { uploads++; return texSub.apply(this, args); };
    proto.fillText = function (...args) { rasterizations++; return fill.apply(this, args); };
    proto.strokeText = function (...args) { rasterizations++; return stroke.apply(this, args); };
    try {
      game.toggleLives();
      game.press('start');
      for (const score of [0, 9, 10, 1234, 98765]) {
        game.score = score;
        game.world.bananasTaken[0] = score;
        game.world.lives[0] = score % 8 + 1;
        hud.update(game);
      }
      // Submit the glyphs too, including those just created for a longer score.
      app.renderer.preRender();
      app.scene.render(app.renderer);
      app.renderer.postRender();
      return { uploads, rasterizations, text: hud.solo.text, unlocked: sound.unlocked, prepared: platform.prepared, originalAtlases, retainedAtlases };
    } finally {
      gl.texImage2D = texImage; gl.texSubImage2D = texSub;
      proto.fillText = fill; proto.strokeText = stroke;
    }
  });
  expect(result.uploads).toBe(0);
  expect(result.rasterizations).toBe(0);
  expect(result.text).toContain('98765');
  expect(result.unlocked).toBe(false);
  expect(result.prepared.sounds).toBe(15);
  expect(result.prepared.rigs).toBe(37);
  expect(result.prepared.soundBytes).toBeLessThan(4_000_000);
  expect(result.retainedAtlases).toBe(result.originalAtlases);
  expect(errors).toEqual([]);
});

test('cached Phaser audio matches synthesis, including overlapping sounds at both common output rates', async ({ page }) => {
  const errors = await ready(page);
  const results = await page.evaluate(async () => {
    const { SoundPlayer } = await import('/src/audio/player.js');
    const { SoundCache } = await import('/src/audio/cache.js');
    const { BONG_PITCH, bong, crash, lifeUp, pling } = await import('/src/audio/recipes.js');
    const all = [...Object.keys(BONG_PITCH).map((type) => [bong(type)]), [crash()], [pling()], [lifeUp()], [bong('temple'), lifeUp(), pling()]];
    const out = [];
    for (const rate of [44100, 48000]) {
      const cache = new SoundCache(new OfflineAudioContext(1, 1, rate));
      await cache.prepare();
      for (const recipes of all) {
        const length = Math.ceil(Math.max(...recipes.map((r) => r.duration)) * rate) + 128;
        const render = async (cached) => {
          const ctx = new OfflineAudioContext(1, length, rate);
          const player = new SoundPlayer({ createContext: () => ctx, noiseFor: () => cache.noise, bufferFor: (r) => cached ? cache.get(r) : null });
          player.unlock();
          recipes.forEach((r) => player.play(r));
          return (await ctx.startRendering()).getChannelData(0);
        };
        const a = await render(false), b = await render(true);
        let error = 0, peak = 0;
        for (let i = 0; i < a.length; i++) {
          error = Math.max(error, Math.abs(a[i] - b[i]));
          peak = Math.max(peak, Math.abs(a[i]));
        }
        out.push({ rate, names: recipes.map((r) => r.name).join('+'), error, peak });
      }
    }
    return out;
  });
  expect(results).toHaveLength(32);
  for (const result of results) {
    expect(result.peak, JSON.stringify(result)).toBeGreaterThan(0.01);
    expect(result.error, JSON.stringify(result)).toBeLessThan(1e-6);
  }
  console.log('cached audio largest sample error:', Math.max(...results.map((r) => r.error)));
  expect(errors).toEqual([]);
});
