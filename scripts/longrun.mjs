// A long-run check of the real game in headless Chromium: a bot plays perfectly (it solves each
// grab's release window) while the frame loop is fed `frameMs` of game time per frame as fast as it
// will go, with performance.now() following the game time so Pixi's time-based clean-up runs as in
// play. Every `every` game seconds it samples the heap (after a GC every GC_EVERY samples), the
// frame times (JS side; the renderer runs every RENDER_EVERY-th frame), the GPU work of the drawn
// frames (counted at the WebGL calls) and counts of what the game and the renderer hold, to see
// leaks and slowdowns. See PLAN.md, "Performance and hardening", and PHASER_PLAN.md, M7.
//
// ENGINE=phaser runs the Phaser version (its loop stopped and stepped by hand: `game.step` on the
// drawn frames, `game.headlessStep` on the others); the default is the Pixi version.
//
// Needs `playwright-core` (`npm i --no-save playwright-core`) and a Chromium (set CHROMIUM, default
// /opt/pw-browsers/chromium), and the dev server running (`npm run dev -- --port 5199`: the game's `window.__liano` hooks are dev-only).
// Usage: [ENGINE=pixi|phaser] [KEYS=KeyG,KeyH,KeyS] [RENDER_EVERY=90] [GC_EVERY=4] node scripts/longrun.mjs <game minutes>
//        <sample every game seconds> [frameMs=33] [out.json] [mode=solo|shared|split]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [minutes = '1', every = '30', frameMs = '33', outFile = 'longrun.json', mode = 'solo'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const engine = process.env.ENGINE ?? 'pixi';
await page.goto(`${process.env.URL ?? 'http://localhost:5199/'}?engine=${engine}`);
// The Phaser version plays once its main art set is in.
await page.waitForFunction(() => window.__liano?.game && (window.__liano.engine !== 'phaser' || window.__liano.platform.world), null, { timeout: 90000 });
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await page.waitForTimeout(500);

await page.evaluate(({ keys, every }) => { window.__keys = keys; window.__renderEvery = every; }, { keys: (process.env.KEYS ?? '').split(',').filter(Boolean), every: +(process.env.RENDER_EVERY ?? 8) });
await page.evaluate(async ({ frameMs, mode }) => {
  const L = window.__liano;
  const { app, game } = L;
  const phaser = L.engine === 'phaser';
  const F = await import('/src/sim/feasibility.js');
  const SIM_DT = 1 / 120;
  const bot = (window.__bot = { t: performance.now(), key: null, target: null, frames: [], render: [], deaths: 0, pressed: 0, renderMs: 0, frameMs, draws: 0, drawn: 0 });
  if (phaser) app.loop.sleep();
  else {
    app.ticker.stop();
    app.ticker.lastTime = bot.t;
  }
  // Pixi's resource clean-up goes by performance.now(): make it follow the game's fast-forwarded time.
  const real = performance.now.bind(performance);
  performance.now = () => bot.t;
  // Time the renderer apart from the rest of the frame.
  bot.renderEvery = +(window.__renderEvery ?? 8); bot.n = 0;
  const timed = (render) => (...a) => { const t0 = real(); render(...a); bot.renderMs += real() - t0; bot.drawn++; };
  const r = app.renderer;
  if (phaser) app.scene.render = timed(app.scene.render.bind(app.scene));
  else {
    const orig = timed(r.render.bind(r));
    r.render = (...a) => { if (bot.n++ % bot.renderEvery) return; orig(...a); };
  }
  // The GPU work, at the WebGL calls: draw calls, and the textures alive.
  const gl = r.gl;
  for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    const f = gl[name]?.bind(gl);
    if (f) gl[name] = (...a) => { bot.draws++; return f(...a); };
  }
  bot.liveTextures = 0;
  const create = gl.createTexture.bind(gl);
  const remove = gl.deleteTexture.bind(gl);
  gl.createTexture = () => { bot.liveTextures++; return create(); };
  gl.deleteTexture = (t) => { if (t) bot.liveTextures--; return remove(t); };
  // A key press as the browser gives it (Phaser reads the key code).
  const KEY_CODES = { Space: 32, KeyA: 65, KeyL: 76, KeyG: 71, KeyH: 72, KeyS: 83, Digit2: 50, Digit3: 51 };
  const tap = (code) => {
    for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code.slice(-1).toLowerCase(), keyCode: KEY_CODES[code] }));
  };
  const press = () => { tap('Space'); bot.pressed++; };
  for (const code of (window.__keys ?? [])) tap(code);
  if (mode !== 'solo') tap(mode === 'shared' ? 'Digit2' : 'Digit3');
  bot.step = () => {
    const w = game.world;
    if (game.state === 'TITLE') press();
    else if (game.state === 'RESULTS') { if (game.canRestart()) { bot.deaths++; press(); } }
    else if (game.state === 'PLAYING') {
      for (let p = 0; p < game.players; p++) {
        const { world, index } = game.slot(p);
        const m = world.monkeys[index];
        if (m.state !== 'HANGING') { bot.key = bot.key ?? {}; bot.key[p] = null; continue; }
        const key = `${m.liana.index}:${m.gripFrom}`;
        bot.key ??= {};
        if (bot.key[p] !== key) {
          bot.key[p] = key;
          const liana = m.liana; const dir = liana.swingDir;
          const gap = dir > 0 ? liana.index : liana.index - 1;
          const o = world.obstacles.get(gap) ?? null;
          const run = o?.moving && dir > 0
            ? F.longestRun(F.movingValidSteps(o.inGap(0), m.gripFrom, world.time, m.holds))
            : F.longestRun(F.validReleaseSteps(o, m.gripFrom, liana.x, dir, 0, m.holds).valid);
          bot.target ??= {}; bot.target[p] = run.start + Math.floor(run.length / 2) - 1;
        }
        if (m.gripTime / SIM_DT >= bot.target[p]) {
          const roles = { solo: 'Space', shared: ['KeyA', 'KeyL'][p], split: ['KeyA', 'KeyL'][p] };
          const code = game.players === 1 ? 'Space' : roles[mode];
          tap(code);
          bot.target[p] = Infinity;
        }
      }
    }
  };
  bot.pump = (n) => {
    const times = [];
    const r0 = bot.renderMs;
    const d0 = bot.draws;
    const f0 = bot.drawn;
    for (let i = 0; i < n; i++) {
      bot.step();
      bot.t += bot.frameMs;
      const t0 = real();
      if (!phaser) app.ticker.update(bot.t);
      else if (bot.n++ % bot.renderEvery) app.headlessStep(bot.t, bot.frameMs);
      else app.step(bot.t, bot.frameMs);
      times.push(real() - t0);
    }
    times.sort((a, b) => a - b);
    const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
    const drawn = Math.max(1, bot.drawn - f0);
    return { n, median: q(0.5), p95: q(0.95), p99: q(0.99), max: times[times.length - 1], mean: times.reduce((a, b) => a + b, 0) / times.length, renderMean: (bot.renderMs - r0) / drawn, drawCalls: (bot.draws - d0) / drawn };
  };
  bot.census = () => {
    let nodes = 0; const types = {};
    const walk = (c) => { nodes++; const n = c.constructor.name; types[n] = (types[n] ?? 0) + 1; for (const ch of (phaser ? c.list : c.children) ?? []) walk(ch); };
    if (phaser) for (const scene of app.scene.getScenes(true)) for (const o of scene.children.list) walk(o);
    else walk(app.stage);
    const w = game.world;
    const counts = phaser
      ? (() => {
          const pane = L.platform.world.panes[0];
          return { obstacleViews: pane.obstacles.rigs.size, bananaViews: pane.bananas.entries.size, gpuContexts: null, textures: app.textures.getTextureKeys().length };
        })()
      : (() => {
          const v = L.views.panes[0];
          const gc = r.graphicsContext;
          return { obstacleViews: v.obstacleViews.views.size, bananaViews: v.bananaViews.views.size, gpuContexts: gc?._gpuContextHash ? Object.keys(gc._gpuContextHash).length : null, textures: r.texture?.managedTextures?.length ?? null };
        })();
    return {
      nodes, types,
      lianas: w.lianas.size, obstacles: w.obstacles.size, bananas: w.bananas.size,
      taken: w.takenBananas.size, bananaGaps: w.bananaGaps.size, scored: w.scoredGapsBy[0].size,
      ...counts,
      glTextures: bot.liveTextures,
      score: game.score, stage: game.stage, liana: w.monkey.liana?.index ?? null,
    };
  };
}, { frameMs: +frameMs, mode });

const chunkFrames = Math.round((+every * 1000) / +frameMs);
const total = Math.round((+minutes * 60 * 1000) / +frameMs);
const rows = [];
const started = Date.now();
await page.evaluate(() => window.__bot.pump(60)); // start, warm up
for (let done = 0; done < total; done += chunkFrames) {
  const stats = await page.evaluate((n) => window.__bot.pump(n), chunkFrames);
  if ((rows.length % +(process.env.GC_EVERY ?? 10)) === +(process.env.GC_EVERY ?? 10) - 1) await page.evaluate(() => window.gc());
  const heap = await page.evaluate(() => ({ used: performance.memory.usedJSHeapSize / 1048576, total: performance.memory.totalJSHeapSize / 1048576 }));
  const census = await page.evaluate(() => window.__bot.census());
  const deaths = await page.evaluate(() => window.__bot.deaths);
  const row = { gameSec: Math.round(((done + chunkFrames) * +frameMs) / 1000), wallSec: Math.round((Date.now() - started) / 1000), ...stats, heapUsed: heap.used, heapTotal: heap.total, deaths, ...census };
  rows.push(row);
  console.log(JSON.stringify({ gameSec: row.gameSec, wall: row.wallSec, med: +row.median.toFixed(1), p95: +row.p95.toFixed(1), max: +row.max.toFixed(0), render: +row.renderMean.toFixed(1), draws: +row.drawCalls.toFixed(0), heap: +row.heapUsed.toFixed(1), nodes: row.nodes, score: row.score, deaths, taken: row.taken, ov: row.obstacleViews, bv: row.bananaViews, gpu: row.gpuContexts, tex: row.textures, glTex: row.glTextures }));
  writeFileSync(outFile, JSON.stringify(rows));
}
console.log('errors', errors);
await browser.close();
