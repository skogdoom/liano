import { Container, Graphics, Text } from 'pixi.js';
import { DEBUG_TEXT, DEBUG_TEXT_X, HEADER_Y, WorldDebug, debugHeader, debugTextY } from '../views/debug.js';

// The parts both versions share (pure: no Pixi) are in views/debug.js.
export * from '../views/debug.js';

const TEXT_STYLE = { fontFamily: DEBUG_TEXT.family, fontSize: DEBUG_TEXT.size, fill: DEBUG_TEXT.color, lineHeight: DEBUG_TEXT.lineHeight };

// Toggled with D. Draws hitboxes, the flight the monkey would take if released now,
// and the valid release steps for the gap ahead of the current swing, from the grab
// (or the run start) up to the forced release at the tip. In split screen each pane
// gets its own, with its player's text at the top of the pane.
export class DebugOverlay {
  constructor() {
    this.screenView = new Container();
    this.views = []; // a PaneDebug per pane
    this.panes = [];
    this.header = new Text({ text: '', style: TEXT_STYLE }); // the lines every pane shares
    this.header.position.set(DEBUG_TEXT_X, HEADER_Y);
    this.screenView.addChild(this.header);
    this.visible = false;
    this.#applyVisibility();
  }

  // Draws over each of `panes` (the panes of the current worlds): in their camera-scrolled
  // overlay layer, with the text in the corner of the pane.
  attach(panes) {
    while (this.views.length < panes.length) {
      const view = new PaneDebug();
      this.views.push(view);
      this.screenView.addChild(view.text);
    }
    for (const view of this.views.splice(panes.length)) {
      view.worldView.destroy();
      view.text.destroy();
    }
    this.panes = panes;
    panes.forEach((pane, i) => pane.overlay.addChild(this.views[i].worldView));
    this.#applyVisibility();
  }

  toggle() {
    this.visible = !this.visible;
    this.#applyVisibility();
  }

  // `fps` is an FpsMeter (the frame rate and times) and `sound` the SoundPlayer, for their lines.
  update(game, sound = null, fps = null) {
    if (!this.visible) return;
    this.header.text = debugHeader(game, sound, fps);
    game.worlds.forEach((world, i) => {
      const view = this.views[i];
      if (!view) return;
      const lines = view.update(world, game.worlds.length > 1 ? `P${i + 1}` : null);
      view.text.text = lines.join('\n');
      // The first pane's text goes below the header; the others' at the top of their pane.
      const layout = this.panes[i]?.layout;
      view.text.position.set(DEBUG_TEXT_X, debugTextY(i, layout));
    });
  }

  #applyVisibility() {
    this.header.visible = this.visible;
    this.screenView.visible = this.visible;
    for (const view of this.views) view.worldView.visible = this.visible;
  }
}

// One world's debug drawing (in the pane's camera-scrolled overlay layer) and its text.
class PaneDebug {
  constructor() {
    this.worldView = new Graphics();
    this.text = new Text({ text: '', style: TEXT_STYLE });
    this.model = new WorldDebug();
  }

  update(world, label = null) {
    return this.model.update(this.worldView, world, label);
  }
}
