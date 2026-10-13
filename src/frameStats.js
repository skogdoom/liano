// A frame-time readout for checking smoothness on a device (`?frames=1`, both versions),
// cheaper than the debug view (D), whose drawing costs frames of its own: its own
// requestAnimationFrame callback notes when each frame came, and a line of page text,
// updated once a second, says how many came late. A frame is late when it came more than
// 1.5 typical frame times after the one before (at least one frame missed), very late at
// more than 2.5 (two or more missed). For the frames on time it also says how far apart
// the browser said they came (the spread of their times, which the game evens out, see
// frameClock.js), and how long the game's work in a frame took: the readout's callback
// runs after the game's, so the time from the frame's start to it is the game's (script
// and drawing calls, not the GPU). And it lists the last few late frames with what
// happened in the frame before and in the late one: the game's events, the obstacles
// whose views were built (both noted by the game through `globalThis.__frameNote`) and
// the textures uploaded to the GPU (with their sizes). Tap or click the readout to start
// counting again.

// A gap longer than this (ms) is the page hidden or the device asleep, not a frame.
const PAUSE_MS = 1000;
// Late frames listed.
const LATE_LISTED = 4;

export class FrameStats {
  constructor(recentMs = 10000) {
    this.recentMs = recentMs;
    this.reset();
  }

  reset() {
    this.last = null;
    this.gaps = []; // [time, gap, work] of the frames in the last `recentMs`
    this.all = { frames: 0, late: 0, veryLate: 0, worst: 0 };
    this.notes = []; // noted since the last frame
    this.lastNotes = []; // noted in the frame before
    this.lastWork = 0;
    this.lateFrames = []; // { gap, work, before, notes } of the last few late frames
  }

  // Something that happened in this frame (see the top).
  note(label) {
    if (this.notes.length < 20) this.notes.push(label);
  }

  // The frame times are judged against the median gap of the recent frames (the screen's
  // refresh, whatever its rate).
  get typical() {
    if (this.gaps.length === 0) return 0;
    const sorted = this.gaps.map(([, gap]) => gap).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  // A frame starting at `now` (ms), the game's work in it having taken `work` ms.
  tick(now, work = 0) {
    const gap = this.last === null ? null : now - this.last;
    this.last = now;
    const notes = this.notes;
    const before = this.lastNotes;
    const lastWork = this.lastWork;
    this.notes = [];
    this.lastNotes = notes;
    this.lastWork = work;
    if (gap === null || gap > PAUSE_MS) return;
    this.gaps.push([now, gap, work]);
    while (now - this.gaps[0][0] > this.recentMs) this.gaps.shift();
    const typical = this.typical;
    this.all.frames++;
    if (gap > 1.5 * typical) {
      this.all.late++;
      this.lateFrames.push({ gap, work: lastWork, before: summarize(before), notes: summarize(notes) });
      if (this.lateFrames.length > LATE_LISTED) this.lateFrames.shift();
    }
    if (gap > 2.5 * typical) this.all.veryLate++;
    this.all.worst = Math.max(this.all.worst, gap);
  }

  // The recent frames: late, very late and the worst; the times of those on time, 5th to
  // 95th percentile; the game's work, median, 99th percentile and longest.
  recent() {
    const typical = this.typical;
    const gaps = this.gaps.map(([, gap]) => gap);
    const q = (list, p) => list[Math.min(list.length - 1, Math.floor(p * list.length))] ?? 0;
    const onTime = gaps.filter((g) => g > 0.5 * typical && g <= 1.5 * typical).sort((a, b) => a - b);
    const work = this.gaps.map(([, , w]) => w).sort((a, b) => a - b);
    return {
      frames: gaps.length,
      late: gaps.filter((g) => g > 1.5 * typical).length,
      veryLate: gaps.filter((g) => g > 2.5 * typical).length,
      worst: Math.max(0, ...gaps),
      onTime: [q(onTime, 0.05), q(onTime, 0.95)],
      work: [q(work, 0.5), q(work, 0.99), work.at(-1) ?? 0],
    };
  }

  // "60 Hz · since reset: 3600 frames, late 12 (0.3 %), very late 3, worst 51 ms ·
  // last 10 s: late 2, very late 0, worst 34 ms, on time 16–17 ms, work 1/4/9 ms"
  describe() {
    const typical = this.typical;
    if (!typical) return 'frames …';
    const { frames, late, veryLate, worst } = this.all;
    const recent = this.recent();
    const share = frames ? ((100 * late) / frames).toFixed(1) : '0.0';
    return (
      `${Math.round(1000 / typical)} Hz · since reset: ${frames} frames, late ${late} (${share} %), very late ${veryLate}, worst ${worst.toFixed(0)} ms` +
      ` · last ${Math.round(this.recentMs / 1000)} s: late ${recent.late}, very late ${recent.veryLate}, worst ${recent.worst.toFixed(0)} ms` +
      `, on time ${recent.onTime.map((g) => g.toFixed(0)).join('–')} ms, work ${recent.work.map((w) => w.toFixed(0)).join('/')} ms` +
      this.lateFrames.map((f) => `\nlate ${f.gap.toFixed(0)} ms (work before ${f.work.toFixed(0)} ms): before [${f.before}] then [${f.notes}]`).join('')
    );
  }
}

// "grab, upload 2× 300×60": the labels, repeats counted.
function summarize(labels) {
  const counts = new Map();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, n]) => (n > 1 ? `${n}× ${label}` : label)).join(', ');
}

// Notes the textures `gl` uploads.
function noteUploads(gl) {
  for (const name of ['texImage2D', 'texSubImage2D']) {
    const upload = gl[name].bind(gl);
    gl[name] = (...args) => {
      const source = args.find((a) => a && typeof a === 'object' && 'width' in a);
      // A canvas or image, or a size and the pixels: (…, width, height, …) after the level
      // and format for texImage2D, after the level and x, y for texSubImage2D.
      const [w, h] = source ? [source.width, source.height] : name === 'texImage2D' ? [args[3], args[4]] : [args[4], args[5]];
      globalThis.__frameNote?.(`upload ${w}×${h}`);
      return upload(...args);
    };
  }
}

// Shows the readout at the bottom left of the page.
export function showFrameStats(doc = document, win = window) {
  const stats = new FrameStats();
  const line = doc.createElement('div');
  line.id = 'frame-stats';
  Object.assign(line.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    zIndex: '10',
    padding: '4px 8px',
    font: '12px/1.4 ui-monospace, Menlo, monospace',
    color: '#fff',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '4px',
    pointerEvents: 'auto',
    whiteSpace: 'pre-line',
    maxWidth: 'calc(100vw - 32px)',
    cursor: 'pointer',
  });
  line.title = 'Tap to start counting again';
  line.textContent = stats.describe();
  // A tap here resets the counts and is kept from the game.
  line.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    stats.reset();
    line.textContent = stats.describe();
  });
  doc.body.append(line);
  globalThis.__frameNote = (label) => stats.note(label);
  // The game's canvas's context: asking for the kind it has returns it.
  const canvas = doc.querySelector('canvas');
  const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
  if (gl) noteUploads(gl);
  const frame = (now) => {
    stats.tick(now, performance.now() - now);
    win.requestAnimationFrame(frame);
  };
  win.requestAnimationFrame(frame);
  win.setInterval(() => (line.textContent = stats.describe()), 1000);
  return stats;
}
