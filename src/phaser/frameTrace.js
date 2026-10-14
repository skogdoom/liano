// Opt-in recording of the actual Phaser loop (?frames=1). No pixel reads or GPU
// synchronization: those would introduce stalls into the movement being measured.
export class FrameTrace {
  constructor(capacity = 1800) {
    this.capacity = capacity;
    this.frames = new Array(capacity);
    this.count = 0;
  }

  add(frame) {
    this.frames[this.count % this.capacity] = frame;
    this.count++;
  }

  snapshot(info = {}) {
    const size = Math.min(this.count, this.capacity);
    const start = this.count - size;
    const frames = Array.from({ length: size }, (_, i) => this.frames[(start + i) % this.capacity]);
    const percentile = (values, share) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? null;
    };
    const intervals = frames.map((f) => f.rawMs).filter((dt) => dt > 0 && dt < 1000);
    const interval = percentile(intervals, 0.5);
    // A stationary/game-over/paused pose is expected. Count unchanged poses only
    // while the world is alive, advancing and drawing the same monkey.
    let unchangedMovingPoses = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      if (b.paused || !b.alive || b.stepMs <= 0 || a.world !== b.world) continue;
      if (b.panes.length && b.panes.every((pane, p) => {
        const previous = a.panes[p];
        return previous && pane.cameraX === previous.cameraX &&
          pane.monkeyScreen?.x === previous.monkeyScreen?.x &&
          pane.monkeyScreen?.y === previous.monkeyScreen?.y &&
          pane.ropeRotation === previous.ropeRotation;
      })) unchangedMovingPoses++;
    }
    return {
      version: 1,
      info,
      summary: {
        recorded: frames.length, total: this.count,
        typicalMs: interval,
        late: intervals.filter((dt) => dt > 1.5 * interval).length,
        cpuP99Ms: percentile(frames.map((f) => f.cpuMs), 0.99),
        unchangedMovingPoses,
      },
      frames,
    };
  }
}

export function installFrameTrace(app, platform, win = window, doc = document) {
  const trace = new FrameTrace();
  const now = () => win.performance.now();
  const info = {
    userAgent: win.navigator.userAgent,
    url: `${win.location.origin}${win.location.pathname}${win.location.search}`,
    devicePixelRatio: win.devicePixelRatio,
    resolutionLimit: platform.resolutionLimit,
    context: app.renderer.gl.getContextAttributes(),
    frameClock: 'phaser-callback-phase-v2',
    monkeyMotion: 'phaser-catch-transition-v1',
    gpuTimingMeasured: false,
    presentationMeasured: false,
  };
  let begin = 0, renderBegin = 0, rawMs = 0, timestamp = 0;
  let world = null, worldId = 0;
  app.events.on('prestep', (time, delta) => {
    begin = now();
    timestamp = time;
    rawMs = delta;
  });
  app.events.on('poststep', () => { renderBegin = now(); });
  app.events.on('postrender', () => {
    const done = now();
    const frame = platform.frame;
    if (!frame || !platform.world) return;
    if (world !== platform.game.worlds[0]) {
      world = platform.game.worlds[0];
      worldId++;
    }
    const zoom = platform.camera.zoom;
    const panes = platform.world.panes.map((pane, index) => {
      const camera = platform.world.paneCameras[index];
      // View cameras have origin (0, 0) and no rotation (view.js). Include their
      // viewport and scroll so these are canvas pixels in split/letterboxed views.
      const screenPoint = (x, y) => ({
        x: camera.x + (x - camera.scrollX) * camera.zoom,
        y: camera.y + (y - camera.scrollY) * camera.zoom,
      });
      const monkey = pane.world.monkey;
      const rig = pane.monkeys[0]?.view;
      const matrix = rig?.getWorldTransformMatrix();
      const monkeyScreen = matrix ? screenPoint(matrix.tx, matrix.ty) : null;
      const rope = monkey.liana && pane.lianaSets[0]?.entries.get(monkey.liana)?.rope;
      const tip = rope?.getWorldTransformMatrix().transformPoint(0, monkey.liana.length / rope.scaleY);
      const drawTime = pane.motion.at(frame.alpha);
      const obstacles = [...pane.obstacles.rigs].filter(([o, rig]) => rig && o.x >= pane.cameraX - 600 && o.x <= pane.cameraX + pane.layout.view.width + 600).map(([o, rig]) => {
        const body = rig.body ?? rig.view;
        const matrix = body.getWorldTransformMatrix();
        return { gap: o.gap, type: o.type, moving: o.moving, simX: o.x, simY: o.y,
          drawnX: body.x, drawnY: body.y, screen: screenPoint(matrix.tx, matrix.ty) };
      });
      return {
        simTime: pane.world.time,
        drawTime, obstacles,
        obstacleBlur: pane.obstacleExposure ? { enabled: pane.obstacleExposure.config.enabled,
          maximumCSS: pane.obstacleExposure.maximumCSS, images: pane.obstacleExposure.images } : null,
        roundPixels: camera.roundPixels,
        cameraX: pane.cameraX, cameraPreviousX: pane.camera.prevX, cameraCurrentX: pane.camera.x,
        // Unwrapped layer position avoids treating a repeating seam as a jump.
        midX: -pane.cameraX * pane.backdrop.layers.find((l) => l.key === 'backdrop.mid').factor,
        foregroundX: pane.worldLayer.x,
        monkeyState: monkey.state, monkeyX: monkey.x, monkeyY: monkey.y,
        monkeyPreviousX: monkey.prevX, monkeyPreviousY: monkey.prevY,
        monkeyDrawnX: rig?.x, monkeyDrawnY: rig?.y, monkeyScreen,
        monkeyRotation: pane.monkeys[0]?.body.rotation,
        monkeyCatchOffset: { x: pane.monkeys[0]?.catchOffsetX ?? 0, y: pane.monkeys[0]?.catchOffsetY ?? 0 },
        liana: monkey.liana?.index ?? null,
        lianaAngle: monkey.liana?.angle ?? null, lianaPreviousAngle: monkey.liana?.prevAngle ?? null,
        ropeRotation: rope?.rotation ?? null,
        ropeTipScreen: tip ? screenPoint(tip.x, tip.y) : null,
      };
    });
    trace.add({
      timestamp, rawMs, stepMs: frame.frameDt * 1000, alpha: frame.alpha,
      clockIntervalMs: platform.frameClock.refresh.interval, clockDebtMs: platform.frameClock.owed,
      callbackDelayMs: begin - timestamp,
      updateMs: renderBegin - begin, renderSubmitMs: done - renderBegin, cpuMs: done - begin,
      paused: frame.paused, alive: platform.game.worlds.some((w) => w.alive),
      state: platform.game.state, mode: platform.game.mode, world: worldId, zoom,
      canvas: [app.canvas.width, app.canvas.height],
      renderPixelRatio: 1 / app.scale.zoom,
      events: frame.events.map((e) => e.type), panes,
    });
  });
  const snapshot = () => trace.snapshot({ ...info, artScale: platform.art?.scale,
    prepared: platform.prepared, capturedAt: new Date().toISOString() });
  const button = doc.createElement('button');
  button.id = 'save-frame-trace';
  button.textContent = 'Save frame trace';
  button.title = 'Save the last 1,800 Phaser frames (about 30 seconds at 60 Hz)';
  button.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:11;padding:6px 10px;font:12px system-ui;cursor:pointer';
  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const url = win.URL.createObjectURL(new Blob([JSON.stringify(snapshot())], { type: 'application/json' }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = 'liano-phaser-frame-trace.json';
    doc.body.append(link);
    link.click();
    link.remove();
    // Allow Safari's download to consume the object URL before releasing it.
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  });
  doc.body.append(button);
  // Available in production too, only when the recording was explicitly requested.
  win.__phaserFrameTrace = { snapshot };
  return trace;
}
