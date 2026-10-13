import { RecordingGraphics } from '../art/recorder.js';
import { DEBUG_TEXT, DEBUG_TEXT_X, HEADER_Y, WorldDebug, debugHeader, debugTextY } from '../views/debug.js';
import { replay } from './graphics.js';

// The debug view (D) in the Phaser version, as the Pixi DebugOverlay (views/debug.js has
// what both share): per pane its hitboxes, flight and release window, drawn with Phaser
// Graphics in the pane's camera-scrolled overlay layer (dev only: no art for it), and the
// text in the corner of the pane; the shared lines at the top.
const css = (color) => `#${color.toString(16).padStart(6, '0')}`;
const STYLE = { fontFamily: DEBUG_TEXT.family, fontSize: `${DEBUG_TEXT.size}px`, color: css(DEBUG_TEXT.color) };
// A text in the debug style, its lines DEBUG_TEXT.lineHeight apart (Phaser adds its line
// spacing to the font's own height).
const debugText = (scene, x, y) => {
  const text = scene.make.text({ x, y, text: '', style: STYLE }, false);
  return text.setLineSpacing(DEBUG_TEXT.lineHeight - text.style.metrics.fontSize);
};

export class DebugOverlay {
  constructor(scene) {
    this.scene = scene;
    this.view = scene.add.container(0, 0);
    this.header = debugText(scene, DEBUG_TEXT_X, HEADER_Y);
    this.view.add(this.header);
    this.views = []; // per pane: { g, text, model, recorder }
    this.panes = [];
    this.visible = false;
    this.zoom = 1;
    this.#applyVisibility();
  }

  // Inside the safe area; text drawn at `zoom` device pixels per unit.
  resize(layout, zoom) {
    this.view.setPosition(layout.insets.left, layout.insets.top);
    this.zoom = zoom;
    for (const text of [this.header, ...this.views.map((v) => v.text)]) text.setResolution(zoom);
  }

  // Draws over each of `panes` (WorldPanes, in their overlay layer).
  attach(panes) {
    for (const view of this.views) {
      view.g.destroy();
      view.text.destroy();
    }
    this.views = panes.map((pane) => {
      const g = pane.phaser.make.graphics({}, false);
      pane.overlay.add(g);
      const text = debugText(this.scene, DEBUG_TEXT_X, 0).setResolution(this.zoom);
      this.view.add(text);
      return { g, text, model: new WorldDebug(), recorder: new RecordingGraphics() };
    });
    this.panes = panes;
    this.#applyVisibility();
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    this.#applyVisibility();
  }

  // `fps` is an FpsMeter and `sound` the sound player, for their lines.
  update(game, sound = null, fps = null) {
    if (!this.visible) return;
    this.header.setText(debugHeader(game, sound, fps));
    game.worlds.forEach((world, i) => {
      const view = this.views[i];
      if (!view) return;
      const lines = view.model.update(view.recorder, world, game.worlds.length > 1 ? `P${i + 1}` : null);
      replay(view.g, view.recorder.instructions);
      view.text.setText(lines.join('\n')).setY(debugTextY(i, this.panes[i]?.layout));
    });
  }

  #applyVisibility() {
    this.view.setVisible(this.visible);
    for (const view of this.views) view.g.setVisible(this.visible);
  }
}
