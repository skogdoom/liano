// Unlike background-motion.mjs, drive Phaser's TimeStep and complete Game.step:
// real driver -> scene updates -> native render-node vertices -> WebGL submission.
// This checks submitted poses, not whether a physical display presented them.
// Start the dev server first. CHROMIUM=/usr/bin/chromium node scripts/dev/full-frame-motion.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = new URL(process.env.URL ?? 'http://localhost:5174/');
  url.searchParams.set('engine', 'phaser');
  await page.goto(url.href);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const result = await page.evaluate(() => {
    const { app, platform } = window.__liano;
    app.loop.sleep();
    const pane = platform.world.panes[0];
    const node = app.renderer.renderNodes.getNode('TransformerImage');
    const original = node.run;
    const keys = ['backdrop.mid', 'backdrop.floor', 'monkey.p1.torso'];
    let sampled = {};
    node.run = function (...args) {
      const result = original.apply(this, args);
      const key = args[1].artKey;
      if (keys.includes(key) && sampled[key] === undefined) sampled[key] = Array.from(this.quad);
      return result;
    };
    try {
      const rows = [];
      const start = app.loop.lastTime;
      // Safari-style rounded timestamps, including the actual renderer each frame.
      for (let i = 0; i < 360; i++) {
        sampled = {};
        app.loop.step(start + Math.round((i + 1) * 1000 / 60));
        const m = platform.game.world.monkey, l = m.liana, alpha = platform.frame.alpha;
        const monkey = pane.monkeys[0].view, rope = pane.lianaSets[0].entries.get(l).rope;
        rows.push({ stepMs: platform.frame.frameDt * 1000,
          positionError: Math.max(Math.abs(monkey.x - (m.prevX + (m.x - m.prevX) * alpha)), Math.abs(monkey.y - (m.prevY + (m.y - m.prevY) * alpha))),
          angleError: Math.abs(rope.rotation + l.prevAngle + (l.angle - l.prevAngle) * alpha),
          quads: sampled,
        });
      }
      const steady = rows.slice(60);
      const repeat = Object.fromEntries(keys.map((key) => [key, steady.slice(1).filter((row, i) => JSON.stringify(row.quads[key]) === JSON.stringify(steady[i].quads[key])).length]));
      const positionError = Math.max(...rows.map((r) => r.positionError));
      const angleError = Math.max(...rows.map((r) => r.angleError));
      if (positionError > 1e-9 || angleError > 1e-9 || Object.values(repeat).some(Boolean)) throw new Error('A full-loop rendered pose repeated or diverged from interpolation');
      if (rows.some((row) => keys.some((key) => !row.quads[key]))) throw new Error('A render-node vertex sample was missing');
      return { frames: rows.length, hz: 60, roundedTimestamps: true, repeatedSubmittedQuads: repeat,
        maxPositionInterpolationError: positionError, maxRopeInterpolationError: angleError,
        steadyStepRangeMs: [Math.min(...steady.map((r) => r.stepMs)), Math.max(...steady.map((r) => r.stepMs))],
        presentationMeasured: false,
      };
    } finally { node.run = original; }
  });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
