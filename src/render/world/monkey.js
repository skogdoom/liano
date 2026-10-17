import { ARM, LIMBS, MonkeyPose } from '../../views/monkey.js';
import { MonkeyState } from '../../sim/monkey.js';
import { makeContainer } from './build.js';

// A monkey in the Phaser version (docs/plans/history/phaser-migration.md, M5a): the pieces of
// one fur (p1, p2 or shadow), posed by MonkeyPose. Painted bodies can cover the limb roots.
export class MonkeyRig {
  constructor(scene, art, fur) {
    const piece = (part, frame = 0) => art.image(scene, `monkey.${fur}.${part}`, frame);
    const limb = (part, at) => piece(part).setPosition(at.x, at.y);
    this.art = art;
    this.view = makeContainer(scene);
    this.body = makeContainer(scene);
    this.legBack = limb('leg', LIMBS.legBack);
    this.legFront = limb('leg', LIMBS.legFront);
    // The painted foot has an opposing big toe. Pair it with its mirror so
    // both big toes face inward; reflection keeps the hip and foot endpoints.
    if (art.catalog.presentation?.monkeyMirrorFrontLeg) this.legFront.scaleX *= -1;
    this.armBack = limb('arm', LIMBS.armBack);
    this.armFront = limb('arm', LIMBS.armFront);
    this.armFrontUnit = this.armFront.scaleY;
    // Open (frame 0), or crossed after a fall (frame 1); the shadow's are see-through.
    this.eyesKey = fur === 'shadow' ? 'monkey.shadow.eyes' : 'monkey.eyes';
    this.eyes = art.image(scene, this.eyesKey);
    const face = [piece('head'), this.eyes];
    const torso = piece('torso');
    // Fur on the torso covers the turning shoulder/hip roots. Keep the face
    // foremost even when the gripping arm reaches across it. Classic retains
    // its original foreground arm and all poses keep the same grip geometry.
    const front = art.catalog.presentation?.monkeyLimbsBehindBody
      ? [this.armFront, torso, ...face] : [torso, ...face, this.armFront];
    this.body.add([piece('tail'), this.legBack, this.legFront, this.armBack, ...front]);
    this.view.add(this.body);
    this.pose = new MonkeyPose();
  }

  // As MonkeyPose.update.
  update(monkey, dt, blinking = false, alpha = 1) {
    const pose = this.pose.update(monkey, dt, blinking, alpha);
    this.catchOffsetX = monkey.catchOffsetX ?? 0;
    this.catchOffsetY = monkey.catchOffsetY ?? 0;
    this.view.setAlpha(pose.alpha).setPosition(pose.x, pose.y);
    this.view.scaleX = pose.facing;
    this.body.rotation = pose.rotation;
    this.armBack.rotation = pose.limbs.armBack;
    this.armFront.rotation = pose.limbs.armFront;
    this.armFront.scaleY = this.armFrontUnit;
    if (monkey.state === MonkeyState.HANGING && (this.catchOffsetX || this.catchOffsetY)) {
      // Keep the gripping hand at its native position while the body approaches
      // the rope. Convert the root correction into the mirrored body's frame.
      const dx = -this.catchOffsetX * pose.facing, dy = -this.catchOffsetY;
      const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation);
      const x = -Math.sin(pose.limbs.armFront) * ARM.length + dx * c + dy * s;
      const y = Math.cos(pose.limbs.armFront) * ARM.length - dx * s + dy * c;
      this.armFront.rotation = Math.atan2(-x, y);
      this.armFront.scaleY *= Math.hypot(x, y) / ARM.length;
    }
    this.legBack.rotation = pose.limbs.legBack;
    this.legFront.rotation = pose.limbs.legFront;
    this.art.setFrame(this.eyes, this.eyesKey, pose.dead ? 1 : 0);
  }

  destroy() {
    this.view.destroy();
  }
}
