import { Container, Graphics } from 'pixi.js';
import { MonkeyState } from '../sim/monkey.js';
import { SWING_OMEGA } from '../sim/liana.js';
import { blend } from './interpolate.js';
import { PALETTES, INVULNERABLE_BLINK, LIMBS, HANG_LAG, ROTATION_EASE, DEAD_SPIN, drawArm, drawLeg, drawMonkeyTail, drawTorso, drawMonkeyHead, drawMonkeyEyes, drawDeadEyes, POSES } from '../views/monkey.js';

// The parts both versions share (pure: no Pixi) are in views/monkey.js.
export * from '../views/monkey.js';

export class MonkeyView {
  constructor(palette = PALETTES[0]) {
    this.view = new Container();
    this.body = new Container();
    this.view.addChild(this.body);

    const tail = drawMonkeyTail(new Graphics(), palette);
    const limb = (draw, at) => {
      const g = draw(new Graphics(), palette);
      g.position.set(at.x, at.y);
      return g;
    };
    this.legBack = limb(drawLeg, LIMBS.legBack);
    this.legFront = limb(drawLeg, LIMBS.legFront);
    this.armBack = limb(drawArm, LIMBS.armBack);
    this.armFront = limb(drawArm, LIMBS.armFront);

    const torso = drawTorso(new Graphics(), palette);
    const head = drawMonkeyHead(new Graphics(), palette);
    this.eyes = drawMonkeyEyes(new Graphics());
    this.deadEyes = drawDeadEyes(new Graphics());

    this.body.addChild(tail, this.legBack, this.legFront, this.armBack, torso, head, this.eyes, this.deadEyes, this.armFront);
    this.facing = 1;
    this.monkey = null;
  }

  // `blinking` while the monkey is invulnerable after a respawn. `alpha`: how far between
  // the previous sim step and the current one to draw (see interpolate.js); the shadow's
  // frames carry no previous position and are drawn as they are.
  update(monkey, dt, blinking = false, alpha = 1) {
    this.blinkTime = blinking ? (this.blinkTime ?? 0) + dt : 0;
    this.view.alpha = blinking && Math.floor(this.blinkTime * INVULNERABLE_BLINK * 2) % 2 ? 0.3 : 1;
    if (monkey !== this.monkey) {
      // New run: snap instead of easing from the previous monkey.
      this.monkey = monkey;
      this.body.rotation = this.#targetRotation(monkey);
    }
    if (alpha < 1 && monkey.prevX !== undefined) this.view.position.set(blend(monkey.prevX, monkey.x, alpha), blend(monkey.prevY, monkey.y, alpha));
    else this.view.position.set(monkey.x, monkey.y);

    if (monkey.state === MonkeyState.HANGING) this.facing = monkey.liana.swingDir;
    else if (monkey.state === MonkeyState.AIRBORNE && monkey.vx !== 0) this.facing = Math.sign(monkey.vx);
    this.view.scale.x = this.facing;

    if (monkey.state === MonkeyState.DEAD) {
      this.body.rotation += DEAD_SPIN * dt;
    } else {
      const target = this.#targetRotation(monkey);
      this.body.rotation += (target - this.body.rotation) * (1 - Math.exp(-ROTATION_EASE * dt));
    }

    const pose = POSES[monkey.state === MonkeyState.HANGING ? 'hanging' : monkey.state === MonkeyState.DEAD ? 'dead' : 'airborne'];
    this.armBack.rotation = pose.armBack;
    this.armFront.rotation = pose.armFront;
    this.legBack.rotation = pose.legBack;
    this.legFront.rotation = pose.legFront;
    this.eyes.visible = monkey.state !== MonkeyState.DEAD;
    this.deadEyes.visible = monkey.state === MonkeyState.DEAD;
  }

  // Body rotation in the mirrored (facing) frame.
  #targetRotation(monkey) {
    if (monkey.state === MonkeyState.HANGING) {
      // Align "up" with the rope, trailing slightly behind the swing.
      const { angle, angularVelocity } = monkey.liana;
      return this.facing * (-angle + (HANG_LAG * angularVelocity) / SWING_OMEGA);
    }
    if (monkey.state === MonkeyState.AIRBORNE) {
      // Tilt nose-down as the flight descends.
      return 0.5 * Math.atan2(monkey.vy, Math.abs(monkey.vx));
    }
    return this.body.rotation;
  }
}
