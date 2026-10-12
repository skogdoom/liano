import { Container, Graphics } from 'pixi.js';
import { LIMBS, MonkeyPose, PALETTES, drawArm, drawDeadEyes, drawLeg, drawMonkeyEyes, drawMonkeyHead, drawMonkeyTail, drawTorso } from '../views/monkey.js';

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
    this.pose = new MonkeyPose();
  }

  // `blinking` while the monkey is invulnerable after a respawn; `alpha` as for
  // MonkeyPose.update.
  update(monkey, dt, blinking = false, alpha = 1) {
    const pose = this.pose.update(monkey, dt, blinking, alpha);
    this.view.alpha = pose.alpha;
    this.view.position.set(pose.x, pose.y);
    this.view.scale.x = pose.facing;
    this.body.rotation = pose.rotation;
    this.armBack.rotation = pose.limbs.armBack;
    this.armFront.rotation = pose.limbs.armFront;
    this.legBack.rotation = pose.limbs.legBack;
    this.legFront.rotation = pose.limbs.legFront;
    this.eyes.visible = !pose.dead;
    this.deadEyes.visible = pose.dead;
  }

  // The monkey this view last drew (a new one snaps to its pose); for the shadow, which
  // starts each run afresh.
  get monkey() {
    return this.pose.monkey;
  }

  set monkey(monkey) {
    this.pose.monkey = monkey;
  }

  get facing() {
    return this.pose.facing;
  }
}
