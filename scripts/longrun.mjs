// A long-run check of the real game in headless Chromium: a bot plays perfectly (it solves each
// grab's release window) while the frame loop is fed `frameMs` of game time per frame as fast as it
// will go, with performance.now() following the game time so Pixi's time-based clean-up runs as in
// play. Every `every` game seconds it samples the heap (after a GC every GC_EVERY samples), the
// frame times (JS side; the renderer runs every RENDER_EVERY-th frame) and counts of what the game
// and Pixi hold, to see leaks and slowdowns. See PLAN.md, "Performance and hardening".
//
// Needs `playwright-core` (`npm i --no-save playwright-core`) and a Chromium (set CHROMIUM, default
// /opt/pw-browsers/chromium), and the dev server running (`npm run dev -- --port 5199`: the game's `window.__liano` hooks are dev-only).
// Usage: [KEYS=KeyG,KeyH,KeyS] [RENDER_EVERY=90] [GC_EVERY=4] node scripts/longrun.mjs <game minutes>
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
await page.goto(process.env.URL ?? 'http://localhost:5199/');
await page.waitForFunction(() => window.__liano?.game, null, { timeout: 90000 });
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await page.waitForTimeout(500);

await page.evaluate(({ keys, every }) => { window.__keys = keys; window.__renderEvery = every; }, { keys: (process.env.KEYS ?? '').split(',').filter(Boolean), every: +(process.env.RENDER_EVERY ?? 8) });
await page.evaluate(async ({ frameMs, mode }) => {
  const L = window.__liano;
  const { app, game } = L;
  const F = await import('/src/sim/feasibility.js');
  const SIM_DT = 1 / 120;
  app.ticker.stop();
  const bot = (window.__bot = { t: performance.now(), key: null, target: null, frames: [], render: [], deaths: 0, pressed: 0, renderMs: 0, frameMs });
  app.ticker.lastTime = bot.t;
  // Pixi's resource clean-up goes by performance.now(): make it follow the game's fast-forwarded time.
  const real = performance.now.bind(performance);
  performance.now = () => bot.t;
  // Time the renderer apart from the rest of the frame.
  const r = app.renderer;
  const orig = r.render.bind(r);
  bot.renderEvery = +(window.__renderEvery ?? 8); bot.n = 0;
  r.render = (...a) => { if (bot.n++ % bot.renderEvery) return; const t0 = real(); orig(...a); bot.renderMs += real() - t0; };
  const press = () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); bot.pressed++; };
  for (const code of (window.__keys ?? [])) { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); }
  if (mode !== 'solo') { window.dispatchEvent(new KeyboardEvent('keydown', { code: mode === 'shared' ? 'Digit2' : 'Digit3' })); }
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
          window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code }));
          bot.target[p] = Infinity;
        }
      }
    }
  };
  bot.pump = (n) => {
    const times = [];
    const r0 = bot.renderMs;
    for (let i = 0; i < n; i++) {
      bot.step();
      bot.t += bot.frameMs;
      const t0 = real();
      app.ticker.update(bot.t);
      times.push(real() - t0);
    }
    times.sort((a, b) => a - b);
    const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
    return { n, median: q(0.5), p95: q(0.95), p99: q(0.99), max: times[times.length - 1], mean: times.reduce((a, b) => a + b, 0) / times.length, renderMean: (bot.renderMs - r0) / Math.max(1, Math.floor(n / bot.renderEvery)) };
  };
  bot.census = () => {
    let nodes = 0; const types = {};
    const walk = (c) => { nodes++; const n = c.constructor.name; types[n] = (types[n] ?? 0) + 1; for (const ch of c.children ?? []) walk(ch); };
    walk(app.stage);
    const w = game.world;
    const v = L.views.panes[0];
    const gc = r.graphicsContext;
    return {
      nodes, types,
      lianas: w.lianas.size, obstacles: w.obstacles.size, bananas: w.bananas.size,
      taken: w.takenBananas.size, bananaGaps: w.bananaGaps.size, scored: w.scoredGapsBy[0].size,
      obstacleViews: v.obstacleViews.views.size, bananaViews: v.bananaViews.views.size,
      gpuContexts: gc?._gpuContextHash ? Object.keys(gc._gpuContextHash).length : null,
      textures: r.texture?.managedTextures?.length ?? null,
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
  console.log(JSON.stringify({ gameSec: row.gameSec, wall: row.wallSec, med: +row.median.toFixed(1), p95: +row.p95.toFixed(1), max: +row.max.toFixed(0), render: +row.renderMean.toFixed(1), heap: +row.heapUsed.toFixed(1), nodes: row.nodes, score: row.score, deaths, taken: row.taken, ov: row.obstacleViews, bv: row.bananaViews, gpu: row.gpuContexts, tex: row.textures }));
  writeFileSync(outFile, JSON.stringify(rows));
}
console.log('errors', errors);
await browser.close();
