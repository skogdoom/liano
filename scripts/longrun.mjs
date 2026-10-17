// A long-run check of the real game in headless Chromium: a bot plays perfectly (it solves each
// grab's release window) while the frame loop is fed `frameMs` of game time per frame as fast as it
// will go, with performance.now() following the game time so resource timing runs as in
// play. Every `every` game seconds it samples the heap (after a GC every GC_EVERY samples), the
// frame times (JS side; the renderer runs every RENDER_EVERY-th frame), the GPU work of the drawn
// frames (counted at the WebGL calls) and counts of what the game and the renderer hold, to see
// leaks and slowdowns. See docs/plans/architecture.md, "Performance and hardening", and
// the M7 report in docs/plans/history/phaser-migration.md.
//
// The game loop is stopped and stepped by hand: `game.step` on drawn frames,
// `game.headlessStep` on the others.
//
// HITCHES=1 times every frame (use RENDER_EVERY=1) and, at the end, sets those that built the
// view of an obstacle seen for the first time against the others. MOTION=1 counts the drawn
// frames, during play, in which neither the camera nor player 1's monkey moved on screen (with
// frameMs 1000/90, 1000/144: a screen of that rate).
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
// The Phaser version plays once its main art set is in.
await page.waitForFunction(() => window.__liano?.platform.world, null, { timeout: 90000 });
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await page.waitForTimeout(500);

await page.evaluate(({ keys, every }) => { window.__keys = keys; window.__renderEvery = every; }, { keys: (process.env.KEYS ?? '').split(',').filter(Boolean), every: +(process.env.RENDER_EVERY ?? 8) });
await page.evaluate(async ({ frameMs, mode, hitches, motion }) => {
  const L = window.__liano;
  const { app, game } = L;
  const F = await import('/src/sim/feasibility.js');
  const SIM_DT = 1 / 120;
  const bot = (window.__bot = { t: performance.now(), key: null, target: null, frames: [], render: [], deaths: 0, pressed: 0, renderMs: 0, frameMs, draws: 0, drawn: 0, hitches, motion });
  // What the first pane draws: its obstacles' views, the camera, player 1's monkey.
  const pane = () => L.platform.world.panes[0];
  const obstacleViews = () => pane().obstacles.rigs;
  const drawnAt = () => {
    const p = pane();
    const monkey = p.monkeys[0]?.view;
    return [p.worldLayer.x, monkey?.x ?? 0, monkey?.y ?? 0];
  };
  bot.seen = new Set();
  bot.frameLog = []; // HITCHES: [ms, a new obstacle view]
  bot.still = 0; bot.moving = 0; bot.last = null; // MOTION
  app.loop.sleep();
  // Make resource timing follow the game's fast-forwarded time.
  const real = performance.now.bind(performance);
  performance.now = () => bot.t;
  // Time the renderer apart from the rest of the frame.
  bot.renderEvery = +(window.__renderEvery ?? 8); bot.n = 0;
  const timed = (render) => (...a) => { const t0 = real(); render(...a); bot.renderMs += real() - t0; bot.drawn++; };
  const r = app.renderer;
  app.scene.render = timed(app.scene.render.bind(app.scene));
  // The GPU work, at the WebGL calls: draw calls, and the textures alive.
  const gl = r.gl;
  for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    const f = gl[name]?.bind(gl);
    // HITCHES: the draw calls are counted but not made, so software GL cannot swamp the timing.
    if (f) gl[name] = (...a) => { bot.draws++; return hitches ? undefined : f(...a); };
  }
  bot.liveTextures = 0;
  const create = gl.createTexture.bind(gl);
  const remove = gl.deleteTexture.bind(gl);
  gl.createTexture = () => { bot.liveTextures++; return create(); };
  gl.deleteTexture = (t) => { if (t) bot.liveTextures--; return remove(t); };
  // HITCHES: the texture uploads in a frame (a text redrawn, a texture made).
  bot.uploads = 0;
  for (const name of ['texImage2D', 'texSubImage2D']) {
    const f = gl[name].bind(gl);
    gl[name] = (...a) => { bot.uploads++; return f(...a); };
  }
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
  // HITCHES: each frame yields to the event loop, so the obstacle worker delivers as in play.
  const yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 0));
  bot.pump = async (n) => {
    const times = [];
    const r0 = bot.renderMs;
    const d0 = bot.draws;
    const f0 = bot.drawn;
    for (let i = 0; i < n; i++) {
      if (bot.hitches) await yieldFrame();
      bot.step();
      bot.t += bot.frameMs;
      const hanging = game.world.monkey.state === 'HANGING';
      const u0 = bot.uploads;
      const t0 = real();
      if (bot.n++ % bot.renderEvery) app.headlessStep(bot.t, bot.frameMs);
      else app.step(bot.t, bot.frameMs);
      const ms = real() - t0;
      times.push(ms);
      if (bot.hitches) {
        let fresh = false;
        for (const o of obstacleViews().keys()) if (!bot.seen.has(o)) { bot.seen.add(o); fresh = true; }
        const grabbed = game.world.monkey.state === 'HANGING' && !hanging;
        bot.frameLog.push([ms, fresh, grabbed, bot.uploads - u0]);
      }
      if (bot.motion && game.state === 'PLAYING' && game.world.monkey.state !== 'DEAD') {
        const at = drawnAt();
        if (bot.last && at.every((v, k) => v === bot.last[k])) bot.still++; else bot.moving++;
        bot.last = at;
      } else bot.last = null;
    }
    times.sort((a, b) => a - b);
    const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
    const drawn = Math.max(1, bot.drawn - f0);
    return { n, median: q(0.5), p95: q(0.95), p99: q(0.99), max: times[times.length - 1], mean: times.reduce((a, b) => a + b, 0) / times.length, renderMean: (bot.renderMs - r0) / drawn, drawCalls: (bot.draws - d0) / drawn };
  };
  bot.census = () => {
    let nodes = 0; const types = {};
    const walk = (c) => { nodes++; const n = c.constructor.name; types[n] = (types[n] ?? 0) + 1; for (const ch of c.list ?? []) walk(ch); };
    for (const scene of app.scene.getScenes(true)) for (const o of scene.children.list) walk(o);
    const w = game.world;
    const p = pane();
    const counts = { obstacleViews: p.obstacles.rigs.size, bananaViews: p.bananas.entries.size,
      textures: app.textures.getTextureKeys().length };
    return {
      nodes, types,
      lianas: w.lianas.size, obstacles: w.obstacles.size, bananas: w.bananas.size,
      taken: w.takenBananas.size, bananaGaps: w.bananaGaps.size, scored: w.scoredGapsBy[0].size,
      ...counts,
      glTextures: bot.liveTextures,
      score: game.score, stage: game.stage, liana: w.monkey.liana?.index ?? null,
    };
  };
}, { frameMs: +frameMs, mode, hitches: !!process.env.HITCHES, motion: !!process.env.MOTION });

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
const summary = await page.evaluate(() => {
  const bot = window.__bot;
  const out = {};
  if (bot.hitches) {
    const stats = (list) => {
      const t = list.map(([ms]) => ms).sort((a, b) => a - b);
      const q = (p) => +(t[Math.min(t.length - 1, Math.floor(p * t.length))] ?? 0).toFixed(1);
      return { frames: t.length, median: q(0.5), p99: q(0.99), max: q(1), over8: t.filter((ms) => ms > 8).length, over16: t.filter((ms) => ms > 16).length };
    };
    out.newView = stats(bot.frameLog.filter(([, fresh]) => fresh));
    out.others = stats(bot.frameLog.filter(([, fresh]) => !fresh));
    out.grab = stats(bot.frameLog.filter(([, , grabbed]) => grabbed));
    out.upload = stats(bot.frameLog.filter(([, , , uploads]) => uploads > 0));
    out.plain = stats(bot.frameLog.filter(([, fresh, grabbed, uploads]) => !fresh && !grabbed && !uploads));
    // Frames just after a grab (the next 1..8), in case the cost lands there.
    const after = [];
    bot.frameLog.forEach(([, , grabbed], i) => { if (grabbed) for (let k = 1; k <= 8; k++) if (bot.frameLog[i + k]) after.push(bot.frameLog[i + k]); });
    out.afterGrab = stats(after);
    out.uploadsAtGrab = bot.frameLog.filter(([, , grabbed]) => grabbed).reduce((a, [, , , u]) => a + u, 0);
  }
  if (bot.motion) out.motion = { still: bot.still, moving: bot.moving, share: +(bot.still / Math.max(1, bot.still + bot.moving)).toFixed(4) };
  return out;
});
if (Object.keys(summary).length) console.log('summary', JSON.stringify(summary));
console.log('errors', errors);
await browser.close();
