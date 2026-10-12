import { LIMBS, MonkeyPose } from '../../views/monkey.js';

// A monkey in the Phaser version (PHASER_PLAN.md, M5a): the pieces of one fur (p1, p2 or
// shadow) in the order the Pixi view stacks its parts, posed by the same MonkeyPose.
export class MonkeyRig {
  constructor(scene, art, fur) {
    const piece = (part, frame = 0) => art.image(scene, `monkey.${fur}.${part}`, frame);
    const limb = (part, at) => piece(part).setPosition(at.x, at.y);
    this.art = art;
    this.view = scene.make.container({}, false);
    this.body = scene.make.container({}, false);
    this.legBack = limb('leg', LIMBS.legBack);
    this.legFront = limb('leg', LIMBS.legFront);
    this.armBack = limb('arm', LIMBS.armBack);
    this.armFront = limb('arm', LIMBS.armFront);
    // Open (frame 0), or crossed after a fall (frame 1); the shadow's are see-through.
    this.eyesKey = fur === 'shadow' ? 'monkey.shadow.eyes' : 'monkey.eyes';
    this.eyes = art.image(scene, this.eyesKey);
    this.body.add([piece('tail'), this.legBack, this.legFront, this.armBack, piece('torso'), piece('head'), this.eyes, this.armFront]);
    this.view.add(this.body);
    this.pose = new MonkeyPose();
  }

  // As MonkeyPose.update.
  update(monkey, dt, blinking = false, alpha = 1) {
    const pose = this.pose.update(monkey, dt, blinking, alpha);
    this.view.setAlpha(pose.alpha).setPosition(pose.x, pose.y);
    this.view.scaleX = pose.facing;
    this.body.rotation = pose.rotation;
    this.armBack.rotation = pose.limbs.armBack;
    this.armFront.rotation = pose.limbs.armFront;
    this.legBack.rotation = pose.limbs.legBack;
    this.legFront.rotation = pose.limbs.legFront;
    this.art.setFrame(this.eyes, this.eyesKey, pose.dead ? 1 : 0);
  }

  destroy() {
    this.view.destroy();
  }
}
