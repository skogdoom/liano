// A frame-time readout for checking smoothness on a device (`?frames=1`, both versions),
// cheaper than the debug view (D), whose drawing costs frames of its own: its own
// requestAnimationFrame callback notes when each frame came, and a line of page text,
// updated once a second, says how many came late. A frame is late when it came more than
// 1.5 typical frame times after the one before (at least one frame missed), very late at
// more than 2.5 (two or more missed). Tap or click the readout to start counting again.

// A gap longer than this (ms) is the page hidden or the device asleep, not a frame.
const PAUSE_MS = 1000;

export class FrameStats {
  constructor(recentMs = 10000) {
    this.recentMs = recentMs;
    this.reset();
  }

  reset() {
    this.last = null;
    this.gaps = []; // [time, gap] of the frames in the last `recentMs`
    this.all = { frames: 0, late: 0, veryLate: 0, worst: 0 };
  }

  // The frame times are judged against the median gap of the recent frames (the screen's
  // refresh, whatever its rate).
  get typical() {
    if (this.gaps.length === 0) return 0;
    const sorted = this.gaps.map(([, gap]) => gap).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  // A frame at `now` (ms).
  tick(now) {
    const gap = this.last === null ? null : now - this.last;
    this.last = now;
    if (gap === null || gap > PAUSE_MS) return;
    this.gaps.push([now, gap]);
    while (now - this.gaps[0][0] > this.recentMs) this.gaps.shift();
    const typical = this.typical;
    this.all.frames++;
    if (gap > 1.5 * typical) this.all.late++;
    if (gap > 2.5 * typical) this.all.veryLate++;
    this.all.worst = Math.max(this.all.worst, gap);
  }

  // The recent frames: late, very late and the worst.
  recent() {
    const typical = this.typical;
    const gaps = this.gaps.map(([, gap]) => gap);
    return { frames: gaps.length, late: gaps.filter((g) => g > 1.5 * typical).length, veryLate: gaps.filter((g) => g > 2.5 * typical).length, worst: Math.max(0, ...gaps) };
  }

  // "60 Hz · since reset: 3600 frames, late 12 (0.3 %), very late 3, worst 51 ms ·
  // last 10 s: late 2, very late 0, worst 34 ms"
  describe() {
    const typical = this.typical;
    if (!typical) return 'frames …';
    const { frames, late, veryLate, worst } = this.all;
    const recent = this.recent();
    const share = frames ? ((100 * late) / frames).toFixed(1) : '0.0';
    return (
      `${Math.round(1000 / typical)} Hz · since reset: ${frames} frames, late ${late} (${share} %), very late ${veryLate}, worst ${worst.toFixed(0)} ms` +
      ` · last ${Math.round(this.recentMs / 1000)} s: late ${recent.late}, very late ${recent.veryLate}, worst ${recent.worst.toFixed(0)} ms`
    );
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
    cursor: 'pointer',
  });
  line.title = 'Tap to start counting again';
  // A tap here resets the counts and is kept from the game.
  line.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    stats.reset();
    line.textContent = stats.describe();
  });
  doc.body.append(line);
  const frame = (now) => {
    stats.tick(now);
    win.requestAnimationFrame(frame);
  };
  win.requestAnimationFrame(frame);
  win.setInterval(() => (line.textContent = stats.describe()), 1000);
  return stats;
}
