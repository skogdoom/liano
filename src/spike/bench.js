import { Application, Container } from 'pixi.js';
import Phaser from 'phaser';
import { HIGH_BELOW_Y, SCREEN_HEIGHT, SCREEN_WIDTH, SIM_DT } from '../config.js';
import { Background } from '../render/background.js';
import { FpsMeter, SLOW_MS } from '../render/fpsMeter.js';
import { LianaView, leafLayout } from '../render/lianaView.js';
import { ObstacleViews } from '../render/obstacleViews.js';
import { createObstacle } from '../sim/generator.js';
import { Liana } from '../sim/liana.js';
import { Art, CATALOG, queueArt } from '../phaser/art.js';
import { BackdropRig, BranchRig, LianaRig, NativeBackdropRig, NativeBranchRig, NativeLianaRig } from './rigs.js';

// M1 spike (dev only, spike/bench.html): many branches with panthers and many lianas,
// animated, with the far backdrop scrolling; drawn by today's Pixi views, by the Phaser
// rigs of pre-rendered pieces or by Phaser's own Graphics. Shows the frame rate, the CPU
// time per frame, draw calls, texture memory and how long it took to start (from the
// page's navigation; and, for the pre-rendered art, loading and decoding it).
//
// ?engine=pixi|atlas|native  ?branches=24  ?lianas=24  ?dpr=1|1.5|2 (default: the
// screen's, at most 2)  ?seconds=10: after a 2 s warm-up, measures for that long and
// puts the result on `window.__bench` (and `data-bench="done"` on <html>).

const params = new URLSearchParams(location.search);
const ENGINES = ['pixi', 'atlas', 'native'];
const engine = ENGINES.includes(params.get('engine')) ? params.get('engine') : 'atlas';
const count = (name, fallback) => Math.max(0, Number.parseInt(params.get(name) ?? fallback, 10) || 0);
const BRANCHES = count('branches', 24);
const LIANAS = count('lianas', 24);
const DPR = Math.min(2, Number(params.get('dpr')) || window.devicePixelRatio || 1);
const SECONDS = Number(params.get('seconds')) || 10;
const WARM_UP = 2;
const SKY = 0x4a8060;

// The 1280 × 720 view, fitted into the window.
const cssWidth = window.innerWidth;
const cssHeight = window.innerHeight;
const fit = Math.min(cssWidth / SCREEN_WIDTH, cssHeight / SCREEN_HEIGHT);

// Low branches with a panther, laid out in a grid over the view: copies of the first
// one found, each under a gap of its own (so with its own bark lines and panther pose).
// All stay low (on a trunk).
function branches() {
  let first = null;
  for (let seed = 1; !first && seed < 200; seed++) {
    for (let gap = 1; !first && gap < 200; gap++) {
      const o = createObstacle(seed, gap);
      if (o?.type === 'branch' && o.decoration === 'panther' && o.y >= HIGH_BELOW_Y) first = o;
    }
  }
  const columns = Math.ceil(Math.sqrt(BRANCHES * 2));
  return Array.from({ length: BRANCHES }, (_, i) => ({
    ...first,
    gap: first.gap + 1000 * (i + 1),
    x: 40 + (i % columns) * ((SCREEN_WIDTH - 200) / columns),
    y: HIGH_BELOW_Y + 10 + Math.floor(i / columns) * 70,
  }));
}

// Lianas across the view, each grabbed and released in turn: swinging, then settling.
class LianaDriver {
  constructor() {
    this.lianas = Array.from({ length: LIANAS }, (_, i) => new Liana(i, 30 + ((i + 0.5) * (SCREEN_WIDTH - 60)) / Math.max(LIANAS, 1)));
    this.timers = this.lianas.map((_, i) => 0.3 + ((i * 0.37) % 2));
    this.lit = new Set();
  }

  step(dt) {
    this.lianas.forEach((liana, i) => {
      this.timers[i] -= dt;
      if (this.timers[i] <= 0) {
        if (liana.held) {
          liana.release();
          this.lit.delete(liana);
          this.timers[i] = 2;
        } else {
          liana.grab(i % 2 ? 1 : -1);
          if (i % 3 === 0) this.lit.add(liana);
          this.timers[i] = 1.5 + ((i * 0.53) % 1.5);
        }
      }
      liana.step(dt);
    });
  }
}

// Counts the draw calls of a WebGL context, per frame.
function countDrawCalls(gl) {
  const counter = { calls: 0 };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const original = gl[name];
    if (!original) continue;
    gl[name] = function (...args) {
      counter.calls++;
      return original.apply(this, args);
    };
  }
  return counter;
}

const stats = document.getElementById('stats');
const fps = new FpsMeter();
const info = { engine, branches: BRANCHES, lianas: LIANAS, dpr: DPR, errors: [], stage: 'starting' };
const samples = { cpu: [], frame: [], calls: [], slow: 0 };
const recent = { cpu: [], calls: [] }; // the last second's frames, for the live line
let measuring = null;

// Anything that goes wrong shows on the page (there is no console on a phone).
const report = (message) => {
  info.errors.push(String(message));
  show();
};
window.addEventListener('error', (event) => report(event.error?.stack ?? event.message));
window.addEventListener('unhandledrejection', (event) => report(event.reason?.stack ?? event.reason));

// Called once a frame: `cpu` ms of work (update and draw), `calls` draw calls.
function frameDone(now, cpu, calls) {
  fps.tick(now);
  const t = (now - info.startedAt) / 1000;
  if (t > WARM_UP && t < WARM_UP + SECONDS) {
    if (measuring !== null) {
      const dt = now - measuring;
      samples.frame.push(dt);
      if (dt > SLOW_MS) samples.slow++;
    }
    measuring = now;
    samples.cpu.push(cpu);
    samples.calls.push(calls);
  } else if (t >= WARM_UP + SECONDS && !window.__bench) finish();
  recent.cpu.push(cpu);
  recent.calls.push(calls);
  if (recent.cpu.length > Math.max(fps.fps, 30)) {
    recent.cpu.shift();
    recent.calls.shift();
  }
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
const percentile = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? 0;

function finish() {
  window.__bench = {
    ...info,
    fps: 1000 / mean(samples.frame),
    frameMs: mean(samples.frame),
    worstMs: Math.max(0, ...samples.frame),
    slow: samples.slow,
    cpuMs: mean(samples.cpu),
    cpuP95: percentile(samples.cpu, 0.95),
    drawCalls: mean(samples.calls),
  };
  document.documentElement.dataset.bench = 'done';
}

// The stats box, twice a second: the live numbers (means over the last second), then
// the result once measured, and any errors.
function show() {
  const lines = [`${engine}  ${BRANCHES} branches  ${LIANAS} lianas  dpr ${DPR}  canvas ${info.canvas ?? '…'}`];
  if (!info.startedAt) {
    lines.push(`${info.stage}…${info.progress === undefined ? '' : ` ${Math.round(info.progress * 100)} %`}`);
  } else {
    lines.push(
      fps.describe(),
      `cpu ${mean(recent.cpu).toFixed(2)} ms  draw calls ${Math.round(mean(recent.calls))}`,
      `textures ${info.textureMB ?? '—'} MB  max texture ${info.maxTexture}  started at ${info.loadMs} ms (art ${info.artMs ?? '—'} ms)`,
    );
    const left = WARM_UP + SECONDS - (performance.now() - info.startedAt) / 1000;
    if (window.__bench) {
      const r = window.__bench;
      lines.push(`result: ${r.fps.toFixed(1)} fps, worst ${r.worstMs.toFixed(0)} ms, slow ${r.slow}, cpu ${r.cpuMs.toFixed(2)} ms (p95 ${r.cpuP95.toFixed(2)}), ${r.drawCalls.toFixed(0)} draw calls`);
    } else lines.push(`measuring… ${Math.max(0, Math.ceil(left))} s`);
  }
  for (const error of info.errors) lines.push(`ERROR: ${error}`);
  stats.textContent = lines.join('\n');
  stats.classList.toggle('failed', info.errors.length > 0);
}
setInterval(show, 500);

function modeLinks() {
  const modes = document.getElementById('modes');
  for (const [key, values] of [['engine', ENGINES], ['dpr', ['1', '1.5', '2']]]) {
    for (const value of values) {
      const next = new URLSearchParams(params);
      next.set(key, value);
      const a = document.createElement('a');
      a.href = `?${next}`;
      a.textContent = `${key} ${value}`;
      if ((key === 'engine' ? engine : String(DPR)) === value) a.className = 'on';
      modes.append(a);
    }
    modes.append(document.createElement('br'));
  }
}

async function runPixi() {
  const app = new Application();
  await app.init({
    width: cssWidth,
    height: cssHeight,
    resolution: DPR,
    autoDensity: true,
    antialias: true,
    preference: 'webgl',
    background: SKY,
  });
  document.body.append(app.canvas);
  const counter = countDrawCalls(app.renderer.gl);
  const world = new Container();
  world.scale.set(fit);
  app.stage.addChild(world);
  const background = new Background();
  world.addChild(background.far.view);
  const obstacles = new ObstacleViews();
  const placed = branches();
  world.addChild(obstacles.view);
  const lianaView = new LianaView();
  world.addChild(lianaView.view);
  const driver = new LianaDriver();
  Object.assign(info, {
    canvas: `${app.canvas.width}×${app.canvas.height}`,
    maxTexture: app.renderer.gl.getParameter(app.renderer.gl.MAX_TEXTURE_SIZE),
    loadMs: Math.round(performance.now()),
    startedAt: performance.now(),
  });
  let accumulator = 0;
  let last = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    const begin = now;
    accumulator += Math.min((now - last) / 1000, 0.1);
    last = now;
    while (accumulator >= SIM_DT) {
      driver.step(SIM_DT);
      accumulator -= SIM_DT;
    }
    const t = (now - info.startedAt) / 1000;
    background.far.update(t * 300);
    obstacles.update(placed, t);
    lianaView.update(
      driver.lianas,
      0,
      SCREEN_WIDTH,
      [...driver.lit].map((liana) => ({ liana, tipTime: t % 1 })),
    );
    counter.calls = 0;
    app.renderer.render(app.stage);
    frameDone(now, performance.now() - begin, counter.calls);
  });
  // The ticker renders the stage itself too: render only once, ourselves.
  app.ticker.remove(app.render, app);
}

function runPhaser() {
  let counter;
  let begin = 0;
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    backgroundColor: SKY,
    banner: false,
    audio: { noAudio: true },
    fps: { smoothStep: false },
    render: { antialias: true },
    // HiDPI: the canvas has DPR pixels per CSS pixel and the camera zooms by as much.
    scale: { mode: Phaser.Scale.NONE, width: Math.round(cssWidth * DPR), height: Math.round(cssHeight * DPR), zoom: 1 / DPR },
    scene: {
      preload() {
        const loading = performance.now();
        info.stage = 'loading the art';
        this.load.on('progress', (share) => (info.progress = share));
        this.load.on('loaderror', (file) => report(`could not load ${file.key} (${file.url})`));
        this.load.once('complete', () => (info.artMs = Math.round(performance.now() - loading)));
        if (engine === 'atlas') queueArt(this.load, Art.scaleFor(fit * DPR));
      },
      create() {
        info.stage = 'building the scene';
        info.progress = undefined;
        counter = countDrawCalls(this.game.renderer.gl);
        this.cameras.main.setOrigin(0, 0).setZoom(fit * DPR);
        const placed = branches();
        const driver = new LianaDriver();
        let backdrop;
        let rigs;
        let lianaRigs;
        if (engine === 'atlas') {
          const pieces = new Art(this.cache.json.get(CATALOG), Art.scaleFor(fit * DPR));
          backdrop = new BackdropRig(this, pieces, SCREEN_WIDTH);
          rigs = placed.map((o) => new BranchRig(this, pieces, o));
          lianaRigs = driver.lianas.map((liana) => new LianaRig(this, pieces, leafLayout(liana.index)));
        } else {
          backdrop = new NativeBackdropRig(this);
          rigs = placed.map((o) => new NativeBranchRig(this, o));
          lianaRigs = driver.lianas.map((liana) => new NativeLianaRig(this, leafLayout(liana.index)));
        }
        const gl = this.game.renderer.gl;
        const textureBytes = this.textures
          .getTextureKeys()
          .map((key) => this.textures.get(key).getSourceImage())
          .reduce((sum, image) => sum + image.width * image.height * 4, 0);
        Object.assign(info, {
          canvas: `${this.game.canvas.width}×${this.game.canvas.height}`,
          maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          textureMB: (textureBytes / 2 ** 20).toFixed(1),
          loadMs: Math.round(performance.now()),
          startedAt: performance.now(),
        });
        let accumulator = 0;
        this.events.on('update', (time, delta) => {
          accumulator += Math.min(delta / 1000, 0.1);
          while (accumulator >= SIM_DT) {
            driver.step(SIM_DT);
            accumulator -= SIM_DT;
          }
          const t = (performance.now() - info.startedAt) / 1000;
          backdrop.update(t * 300);
          for (const rig of rigs) rig.update(t);
          driver.lianas.forEach((liana, i) => lianaRigs[i].update(liana, driver.lit.has(liana) && t % 1 < 0.5));
        });
      },
    },
  });
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    begin = performance.now();
    if (counter) counter.calls = 0;
  });
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    if (info.startedAt) frameDone(begin, performance.now() - begin, counter.calls);
  });
}

modeLinks();
if (engine === 'pixi') runPixi();
else runPhaser();
