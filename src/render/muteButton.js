import { Container, Graphics } from 'pixi.js';
import { MUTE_HIT, inside } from '../controls.js';
import { MUTE_ICON, drawSpeaker, drawSpeakerCross, drawSpeakerWaves } from '../views/buttons.js';

// The parts both versions share (pure: no Pixi) are in views/buttons.js.
export { drawSpeaker, drawSpeakerCross, drawSpeakerWaves } from '../views/buttons.js';

// Speaker icon in the top-left corner; tap or click it (or press M) to mute.
export class MuteButton {
  constructor() {
    this.view = new Container();
    this.view.position.set(MUTE_ICON.x, MUTE_ICON.y);
    const speaker = drawSpeaker(new Graphics());
    this.waves = drawSpeakerWaves(new Graphics());
    this.cross = drawSpeakerCross(new Graphics());
    this.view.addChild(speaker, this.waves, this.cross);
    this.update(false);
  }

  contains(x, y) {
    return inside(MUTE_HIT, { x, y });
  }

  update(muted) {
    this.waves.visible = !muted;
    this.cross.visible = muted;
  }
}
