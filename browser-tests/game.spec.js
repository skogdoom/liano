import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors, started } from './helpers.js';

// M3: the game runs in the Phaser version, with Phaser's input and sound (on the dev
// server, for the `window.__liano` hooks).

// Opens the Phaser version and waits until it takes presses.
async function phaser(page) {
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
  await started(page, errors);
  await page.waitForFunction(() => window.__liano.input && window.__liano.pause.acceptsInput());
  return errors;
}

const state = (page) => page.evaluate(() => window.__liano.game.state);

// Space starting a run, Esc back to the title and the modes' 16:9 frame are checked for
// each art pack in art-packs.spec.js.

test('the Phaser version counts each key press once, two in one frame too', async ({ page }) => {
  const errors = await phaser(page);
  await page.keyboard.press('Space');
  await expect.poll(() => state(page)).toBe('PLAYING');
  // Two P presses in one go (one frame): paused and resumed, so running.
  await page.evaluate(() => {
    for (let i = 0; i < 2; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', keyCode: 80 }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyP', key: 'p', keyCode: 80 }));
    }
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.__liano.pause.paused)).toBe(false);
  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => window.__liano.pause.reason)).toBe('manual');
  expect(errors).toEqual([]);
});

test('the Phaser version starts a run on a tap, but not on a tap on the mute button, which mutes', async ({ page }) => {
  const errors = await phaser(page);
  const at = (x, y) =>
    page.evaluate(([x, y]) => {
      const { layout } = window.__liano;
      return [layout.x + (layout.insets.left + x * layout.ui) * layout.scale, layout.y + (layout.insets.top + y * layout.ui) * layout.scale];
    }, [x, y]);
  const [mx, my] = await at(45, 45);
  await page.mouse.click(mx, my);
  await expect.poll(() => page.evaluate(() => window.__liano.sound.muted)).toBe(true);
  expect(await state(page)).toBe('TITLE');
  const [x, y] = await at(600, 400);
  await page.mouse.click(x, y);
  await expect.poll(() => state(page)).toBe('PLAYING');
  expect(errors).toEqual([]);
});

test('the Phaser version clips each split-screen pane: the lower one draws nothing over the upper one', async ({ page }) => {
  const errors = await phaser(page);
  await page.keyboard.press('Digit3');
  await expect.poll(() => page.evaluate(() => window.__liano.game.worlds.length)).toBe(2);
  await page.keyboard.press('Space');
  await expect.poll(() => state(page)).toBe('PLAYING');
  // The two worlds start alike, so the panes show the same picture (but for the monkeys'
  // furs). Unclipped, the lower pane's backdrop (which reaches far above its band for
  // taller views) covered the upper pane with its sky and trees.
  const shares = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const { app, camera, layout } = window.__liano;
        const half = (layout.view.height / 2) * camera.zoom;
        app.renderer.snapshot((image) => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          resolve(
            // Rows below the title's text, which is over the upper pane only.
            [0.55, 0.7, 0.85].map((f) => {
              const y = Math.floor(camera.y + f * half);
              const a = context.getImageData(0, y, canvas.width, 1).data;
              const b = context.getImageData(0, Math.floor(y + half), canvas.width, 1).data;
              let same = 0;
              for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) <= 8) same++;
              return same / (a.length / 4);
            }),
          );
        });
      }),
  );
  for (const share of shares) expect(share).toBeGreaterThan(0.95);
  expect(errors).toEqual([]);
});

test('the Phaser version shows the debug view on D, over each pane in split screen', async ({ page }) => {
  const errors = await phaser(page);
  await page.keyboard.press('Digit3');
  await expect.poll(() => page.evaluate(() => window.__liano.game.worlds.length)).toBe(2);
  await page.keyboard.press('KeyD');
  const debug = () =>
    page.evaluate(() => {
      const { debug } = window.__liano.app.scene.getScene('ui');
      return {
        visible: debug.view.visible,
        panes: debug.views.length,
        // What each pane's Graphics draws, and its numbers.
        drawn: debug.views.map((v) => v.g.visible && v.g.commandBuffer.length > 0),
        texts: debug.views.map((v) => v.text.text.split('\n')[0]),
      };
    });
  await expect.poll(debug).toMatchObject({ visible: true, panes: 2, drawn: [true, true] });
  const { texts } = await debug();
  expect(texts[0]).toMatch(/^P1 /);
  expect(texts[1]).toMatch(/^P2 /);
  await page.keyboard.press('KeyD');
  await expect.poll(() => page.evaluate(() => window.__liano.app.scene.getScene('ui').debug.view.visible)).toBe(false);
  expect(errors).toEqual([]);
});

// Starts a run, lets go and drops the monkey below the band: the run ends.
async function fall(page) {
  await page.keyboard.press('Space');
  await expect.poll(() => state(page)).toBe('PLAYING');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.world.monkey.state)).toBe('AIRBORNE');
  await page.evaluate(() => (window.__liano.game.world.monkey.y = 5000));
}

for (const reduced of [false, true]) {
  test(`the Phaser version ends a run with the results, ${reduced ? 'without' : 'with'} the death shake, and plays again on Space`, async ({ page }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = await phaser(page);
    await fall(page);
    await expect.poll(() => state(page)).toBe('RESULTS');
    await expect.poll(() => page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.gameOver.visible)).toBe(true);
    // The death shakes the pane, unless the player asks for reduced motion.
    const amplitude = await page.evaluate(() => window.__liano.platform.world.panes[0].shake.amplitude);
    expect(amplitude > 0).toBe(!reduced);
    expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.gameOverTitle.text.text)).toBe('GAME OVER');
    await expect.poll(() => page.evaluate(() => window.__liano.game.canRestart())).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => state(page)).toBe('PLAYING');
    await expect.poll(() => page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.gameOver.visible)).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('the Phaser version starts its sound at the first gesture, plays on Phaser’s context, and mutes on M', async ({ page }) => {
  const errors = await phaser(page);
  expect(await page.evaluate(() => window.__liano.sound.status)).toBe('locked');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.sound.status)).toBe('running');
  // Through Phaser's context.
  expect(await page.evaluate(() => window.__liano.sound.ctx === window.__liano.app.sound.context)).toBe(true);
  // The game's sounds for its events are unit tested (driver, sounds); here one plays.
  expect(await page.evaluate(async () => window.__liano.sound.play((await import('/src/audio/recipes.js')).crash()))).toBe(true);
  await page.keyboard.press('KeyM');
  await expect.poll(() => page.evaluate(() => window.__liano.sound.muted)).toBe(true);
  // Muted, Phaser must leave the context suspended rather than resume it every frame.
  // (Phaser's own `mute` reads its mute node's value, which a suspended context does not
  // update: the player's state is what counts.)
  await expect.poll(() => page.evaluate(() => window.__liano.sound.ctx.state)).toBe('suspended');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__liano.sound.ctx.state)).toBe('suspended');
  await page.keyboard.press('KeyM');
  await expect.poll(() => page.evaluate(() => window.__liano.sound.ctx.state)).toBe('running');
  expect(errors).toEqual([]);
});

// Chromium's offline rendering is not bit for bit repeatable: two renders of the same
// graph differ by up to 6e-8 (a 24-bit step). "The same" is within 1e-6, far below a
// 16-bit step (3e-5).
const SAME_WITHIN = 1e-6;

test('every sound renders the same, sample for sample, through the sound manager as through the synthesized recipes', async ({ page }) => {
  const errors = await phaser(page);
  const results = await page.evaluate(async () => {
    // The seeded noise below replaces global randomness. Pause live game work
    // so Phaser cannot generate duplicate texture keys between seed resets.
    window.__liano.app.loop.sleep();
    const { SoundPlayer } = await import('/src/audio/player.js');
    const { createPhaserSoundPlayer } = await import('/src/audio/manager.js');
    const recipes = await import('/src/audio/recipes.js');
    const all = [...Object.keys(recipes.BONG_PITCH).map((type) => recipes.bong(type)), recipes.crash(), recipes.pling(), recipes.lifeUp()];
    const RATE = 44100;
    // The noise is random: the same seed for both renders.
    const seeded = () => {
      let s = 1;
      Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    };
    const random = Math.random;
    // Phaser's own manager, moved onto each offline context (its game sound stops).
    const manager = window.__liano.app.sound;
    const out = [];
    for (const recipe of all) {
      const length = Math.ceil(recipe.duration * RATE) + 128;
      seeded();
      const recipeCtx = new OfflineAudioContext(1, length, RATE);
      const reference = new SoundPlayer({ createContext: () => recipeCtx });
      reference.unlock();
      reference.play(recipe);
      const a = (await recipeCtx.startRendering()).getChannelData(0);
      seeded();
      const phaserCtx = new OfflineAudioContext(1, length, RATE);
      // Phaser closes the context it leaves; an offline one has no close().
      manager.context.close ??= () => Promise.resolve();
      manager.setAudioContext(phaserCtx);
      const player = createPhaserSoundPlayer(manager);
      player.unlock();
      player.play(recipe);
      const b = (await phaserCtx.startRendering()).getChannelData(0);
      let largest = 0;
      let peak = 0;
      for (let i = 0; i < a.length; i++) {
        largest = Math.max(largest, Math.abs(a[i] - b[i]));
        peak = Math.max(peak, Math.abs(a[i]));
      }
      out.push({ name: recipe.name, samples: a.length, largest, peak });
    }
    Math.random = random;
    return out;
  });
  console.log('offline renders:', JSON.stringify(results));
  expect(results.length).toBe(15);
  for (const r of results) {
    expect(r.peak, r.name).toBeGreaterThan(0.01); // it made a sound
    expect(r.largest, r.name).toBeLessThan(SAME_WITHIN);
  }
  expect(errors).toEqual([]);
});

// A batch takes one texture (render/shaders.js), so each kind of batch (images,
// ropes) has one shader, the cheapest, compiled before the title: an obstacle first
// showing compiles nothing in play, which stalled Safari.
test('the Phaser version draws every batch of a kind with one shader', async ({ page }) => {
  const errors = await phaser(page);
  await page.keyboard.press('Space');
  await expect.poll(() => state(page)).toBe('PLAYING');
  await page.waitForTimeout(500);
  const keys = await page.evaluate(() => {
    const nodes = window.__liano.app.renderer.renderNodes._nodes;
    return ['BatchHandlerQuad', 'BatchHandlerStrip'].map((name) => Object.keys(nodes[name]?.programManager.programs ?? {}));
  });
  for (const programs of keys) {
    expect(programs).toHaveLength(1);
    expect(programs[0]).toContain('_1TexCount_');
  }
  // The default backdrop now shares the image shader; no tile shader is needed.
  expect(await page.evaluate(() => Object.keys(window.__liano.app.renderer.renderNodes._nodes.BatchHandlerTileSprite?.programManager.programs ?? {}))).toHaveLength(0);
  expect(errors).toEqual([]);
});
