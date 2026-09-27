import { Container, Graphics } from 'pixi.js';
import { MonkeyState } from '../sim/monkey.js';
import { SWING_OMEGA } from '../sim/liana.js';

// The body and head fit inside the MONKEY_RADIUS hitbox circle; only the limbs, ears
// and tail reach outside it. Local +y is down, and the monkey faces +x (mirrored when
// travelling left).

// Fur per player: player 1 brown, player 2 ginger.
export const PALETTES = [
  { fur: 0x6e4322, furDark: 0x4a2c14, skin: 0xe0ad74 },
  { fur: 0xb8672a, furDark: 0x7f3f14, skin: 0xf0c890 },
];
const INVULNERABLE_BLINK = 10; // Hz
const EYE = 0x1c1008;

// Where the gripping hand holds the liana, above the head along the rope.
const GRIP_HAND = { x: 0, y: -25 };
const SHOULDER = { x: 7, y: -1 };
const ARM_LENGTH = 21;
const LEG_LENGTH = 12;
// Body tilt behind the swing, per unit of angular speed (fraction of full speed).
const HANG_LAG = 0.15;
const ROTATION_EASE = 14; // 1/s
const DEAD_SPIN = 7; // rad/s

// A limb drawn pointing down (+y) from its pivot; rotation swings it around.
function limb(length, width, color, endColor) {
  return new Graphics()
    .moveTo(0, 0)
    .lineTo(0, length)
    .stroke({ width, color, cap: 'round' })
    .circle(0, length, width * 0.7)
    .fill(endColor);
}

// Rotation that points a downward limb from `from` towards `to`.
function aim(from, to) {
  return Math.atan2(-(to.x - from.x), to.y - from.y);
}

const POSES = {
  // Front arm grips the rope above the head, back arm and legs hang loose.
  hanging: { armBack: 0.35, armFront: aim(SHOULDER, GRIP_HAND), legBack: 0.12, legFront: -0.12 },
  // Arms and legs spread.
  airborne: { armBack: 2.1, armFront: -2.1, legBack: 0.6, legFront: -0.6 },
  dead: { armBack: 2.7, armFront: -2.7, legBack: 0.9, legFront: -0.9 },
};

export class MonkeyView {
  constructor({ fur: FUR, furDark: FUR_DARK, skin: SKIN } = PALETTES[0]) {
    this.view = new Container();
    this.body = new Container();
    this.view.addChild(this.body);

    const tail = new Graphics()
      .moveTo(-8, 14)
      .bezierCurveTo(-24, 24, -34, 6, -26, -5)
      .bezierCurveTo(-21, -12, -12, -8, -16, -2)
      .stroke({ width: 4, color: FUR_DARK, cap: 'round' });

    this.legBack = limb(LEG_LENGTH, 6, FUR, FUR_DARK);
    this.legBack.position.set(-6, 15);
    this.legFront = limb(LEG_LENGTH, 6, FUR, FUR_DARK);
    this.legFront.position.set(6, 15);
    this.armBack = limb(ARM_LENGTH, 5, FUR, SKIN);
    this.armBack.position.set(-SHOULDER.x, SHOULDER.y);
    this.armFront = limb(ARM_LENGTH, 5, FUR, SKIN);
    this.armFront.position.set(SHOULDER.x, SHOULDER.y);

    const torso = new Graphics().ellipse(0, 6, 13, 14).fill(FUR).ellipse(0, 9, 8, 9).fill(SKIN);
    const head = new Graphics()
      .circle(-11, -14, 5)
      .fill(FUR)
      .circle(11, -14, 5)
      .fill(FUR)
      .circle(-11, -14, 2.5)
      .fill(SKIN)
      .circle(11, -14, 2.5)
      .fill(SKIN)
      .circle(0, -10, 11)
      .fill(FUR)
      .ellipse(0, -8, 8, 7)
      .fill(SKIN)
      .ellipse(0, -4.5, 4.5, 3)
      .fill(0xf0c894)
      .circle(-1.3, -5.5, 0.8)
      .fill(EYE)
      .circle(1.3, -5.5, 0.8)
      .fill(EYE);
    this.eyes = new Graphics().circle(-3.5, -11, 1.8).fill(EYE).circle(3.5, -11, 1.8).fill(EYE);
    this.deadEyes = new Graphics()
      .moveTo(-5.5, -13)
      .lineTo(-1.5, -9)
      .moveTo(-1.5, -13)
      .lineTo(-5.5, -9)
      .moveTo(1.5, -13)
      .lineTo(5.5, -9)
      .moveTo(5.5, -13)
      .lineTo(1.5, -9)
      .stroke({ width: 1.6, color: EYE, cap: 'round' });

    this.body.addChild(tail, this.legBack, this.legFront, this.armBack, torso, head, this.eyes, this.deadEyes, this.armFront);
    this.facing = 1;
    this.monkey = null;
  }

  // `blinking` while the monkey is invulnerable after a respawn.
  update(monkey, dt, blinking = false) {
    this.blinkTime = blinking ? (this.blinkTime ?? 0) + dt : 0;
    this.view.alpha = blinking && Math.floor(this.blinkTime * INVULNERABLE_BLINK * 2) % 2 ? 0.3 : 1;
    if (monkey !== this.monkey) {
      // New run: snap instead of easing from the previous monkey.
      this.monkey = monkey;
      this.body.rotation = this.#targetRotation(monkey);
    }
    this.view.position.set(monkey.x, monkey.y);

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
