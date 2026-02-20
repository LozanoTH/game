export class CharacterAnimationController {
  constructor({ THREE, parts }) {
    this.THREE = THREE;
    this.parts = parts;
    this.walkCycle = 0;
    this.jumpSpeedRef = 6.2;
  }

  update(dt, locomotion) {
    this.walkCycle += locomotion.speedRatio * 8.2 * dt;

    const stride = Math.sin(this.walkCycle) * 0.65 * locomotion.speedRatio;
    const counterStride = Math.sin(this.walkCycle + Math.PI) * 0.65 * locomotion.speedRatio;
    const bounce = Math.abs(Math.sin(this.walkCycle)) * 0.05 * locomotion.speedRatio;

    const airBlend = this.THREE.MathUtils.clamp(locomotion.airborneHeight * 2.6 + Math.abs(locomotion.verticalVelocity) * 0.08, 0, 1);
    const jumpDir = this.THREE.MathUtils.clamp(locomotion.verticalVelocity / this.jumpSpeedRef, -1, 1);
    const jumpPose = Math.max(0, jumpDir);
    const fallPose = Math.max(0, -jumpDir);

    const walkLegUpperL = stride;
    const walkLegUpperR = counterStride;
    const walkLegLowerL = Math.max(0, -stride) * 0.8;
    const walkLegLowerR = Math.max(0, -counterStride) * 0.8;
    const walkArmUpperL = counterStride * 0.85;
    const walkArmUpperR = stride * 0.85;
    const walkArmLowerL = Math.max(0, -counterStride) * 0.7;
    const walkArmLowerR = Math.max(0, -stride) * 0.7;

    const airLegUpper = -0.36 * jumpPose + 0.22 * fallPose;
    const airLegLower = 0.56 * jumpPose + 0.14 * fallPose;
    const airArmUpper = -0.48 * jumpPose - 0.12 * fallPose;
    const airArmLower = 0.28 * jumpPose + 0.35 * fallPose;

    this.parts.legUpperL.rotation.x = this.THREE.MathUtils.lerp(walkLegUpperL, airLegUpper, airBlend);
    this.parts.legUpperR.rotation.x = this.THREE.MathUtils.lerp(walkLegUpperR, airLegUpper, airBlend);
    this.parts.legLowerL.rotation.x = this.THREE.MathUtils.lerp(walkLegLowerL, airLegLower, airBlend);
    this.parts.legLowerR.rotation.x = this.THREE.MathUtils.lerp(walkLegLowerR, airLegLower, airBlend);
    this.parts.armUpperL.rotation.x = this.THREE.MathUtils.lerp(walkArmUpperL, airArmUpper, airBlend);
    this.parts.armUpperR.rotation.x = this.THREE.MathUtils.lerp(walkArmUpperR, airArmUpper, airBlend);
    this.parts.armLowerL.rotation.x = this.THREE.MathUtils.lerp(walkArmLowerL, airArmLower, airBlend);
    this.parts.armLowerR.rotation.x = this.THREE.MathUtils.lerp(walkArmLowerR, airArmLower, airBlend);

    this.parts.torso.position.y = 1.35 + bounce * 0.45 + airBlend * 0.04;
    this.parts.torso.rotation.x = this.THREE.MathUtils.lerp(0, -0.14 * jumpPose + 0.12 * fallPose, airBlend);
  }
}
