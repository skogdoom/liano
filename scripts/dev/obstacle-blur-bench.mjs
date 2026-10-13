// Controlled native-render cost comparison, NOT physical Safari presentation.
// Start the dev server first. CHROMIUM=/usr/bin/chromium node scripts/dev/obstacle-blur-bench.mjs
// Full-frame readback waits for rendered pixels; its cost is included. This is
// benchmark-only: the game's experiment does not read pixels or synchronize GL.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const results = [];
  for (const enabled of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const url = new URL(process.env.URL ?? 'http://localhost:5174/');
    url.searchParams.set('engine', 'phaser');
    if (enabled) url.searchParams.set('obstacleblur', 'on');
    await page.goto(url.href);
    await page.waitForFunction(() => window.__liano?.platform.world);
    const metrics = await page.evaluate(async () => {
      const { Obstacle } = await import('/src/sim/obstacle.js');
      const { app, platform } = window.__liano;
      app.loop.sleep(); app.scene.getScene('ui').cameras.main.setVisible(false);
      const pane = platform.world.panes[0], gl = app.renderer.gl;
      pane.monkeyLayer.setVisible(false); pane.lianaLayer.setVisible(false);
      pane.world.bananas.clear();
      const pixels = new Uint8Array(app.canvas.width * app.canvas.height * 4);
      pane.world.obstacles.clear();
      pane.world.obstacles.set(1, new Obstacle(1, 'temple', 0, 100, null, 1, null, 3));
      pane.world.stages[0] = 8;
      let draws = 0;
      const draw = gl.drawElements;
      gl.drawElements = function (...args) { draws++; return draw.apply(this, args); };
      const samples = [];
      for (let i = 0; i < 32; i++) {
        pane.camera.x = pane.camera.prevX = -480 + 160 * Math.sin(i * 0.075);
        draws = 0;
        const start = performance.now();
        pane.update([], 1 / 60, false);
        app.renderer.preRender(); app.scene.render(app.renderer); app.renderer.postRender();
        const submitted = performance.now();
        gl.readPixels(0, 0, app.canvas.width, app.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const done = performance.now();
        if (i >= 8) samples.push({ cpu: submitted - start, readback: done - start, draws });
      }
      gl.drawElements = draw;
      const percentile = (key, p) => {
        const sorted = samples.map((s) => s[key]).sort((a, b) => a - b);
        return sorted[Math.floor((sorted.length - 1) * p)];
      };
      return { frames: samples.length, cpuMedianMs: percentile('cpu', 0.5), cpuP95Ms: percentile('cpu', 0.95),
        renderAndReadbackMedianMs: percentile('readback', 0.5), renderAndReadbackP95Ms: percentile('readback', 0.95),
        drawCalls: [...new Set(samples.map((s) => s.draws))], maximumCSS: pane.obstacleExposure?.maximumCSS ?? 0,
        programs: Object.keys(app.renderer.renderNodes.getNode('ObjectExposureBatch')?.programManager.programs ?? {}) };
    });
    if (errors.length) throw new Error(errors.join('\n'));
    results.push({ enabled, ...metrics });
    await page.close();
  }
  console.log(JSON.stringify({ renderer: 'Chromium SwiftShader', viewport: [1280, 720], devicePixelRatio: 1,
    presentationMeasured: false, fullFrameReadbackBenchmarkOnly: true, results }, null, 2));
} finally { await browser.close(); }
