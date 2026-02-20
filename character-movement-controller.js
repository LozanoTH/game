function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function shortestAngleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export class CharacterMovementController {
  constructor({ THREE, character, getGroundHeightAt = null }) {
    this.THREE = THREE;
    this.character = character;
    this.velocity = new THREE.Vector3();
    this.verticalVelocity = 0;

    this.walkSpeed = 3.6;
    this.sprintSpeed = 56.0;
    this.acceleration = 12.0;
    this.deceleration = 14.0;
    this.turnSpeed = 14.0;

    this.gravity = 18;
    this.fallGravityMult = 1.35;
    this.jumpSpeed = 6.2;
    this.getGroundHeightAt = getGroundHeightAt || (() => 0);
    this.groundSnapThreshold = 0.15;

    this.coyoteTime = 0.12;
    this.jumpBufferTime = 0.12;
    this._coyoteTimer = 0;
    this._jumpBufferTimer = 0;
  }

  update(dt, inputController, cameraYaw) {
    const input = inputController.state;

    if (inputController.consumeJumpQueued()) {
      this._jumpBufferTimer = this.jumpBufferTime;
    } else {
      this._jumpBufferTimer = Math.max(0, this._jumpBufferTimer - dt);
    }

    const currentGroundY = this.getGroundHeightAt(this.character.position.x, this.character.position.z);
    const isGrounded = this.character.position.y <= currentGroundY + this.groundSnapThreshold;
    if (isGrounded) this._coyoteTimer = this.coyoteTime;
    else this._coyoteTimer = Math.max(0, this._coyoteTimer - dt);

    if (this._jumpBufferTimer > 0 && this._coyoteTimer > 0) {
      this.verticalVelocity = this.jumpSpeed;
      this._jumpBufferTimer = 0;
      this._coyoteTimer = 0;
    }

    const keyForward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const keyRight = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const analogForward = input.moveY || 0;
    const analogRight = input.moveX || 0;
    const forwardInput = Math.abs(analogForward) > 0.01 ? analogForward : keyForward;
    const rightInput = Math.abs(analogRight) > 0.01 ? analogRight : keyRight;

    const camForward = new this.THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const camRight = new this.THREE.Vector3(-camForward.z, 0, camForward.x);
    const moveDir = camForward.multiplyScalar(forwardInput).add(camRight.multiplyScalar(rightInput));
    const hasAnalogIntent = Math.hypot(analogRight, analogForward) > 0.08;
    const sprintFromInput = input.sprint && (hasAnalogIntent || input.forward || input.back || input.left || input.right);
    const shouldSprint = sprintFromInput || (input.autoSprintW && input.forward && !input.back);

    let speedRatio = 0;
    if (moveDir.lengthSq() > 0.0001) {
      moveDir.normalize();
      const maxSpeed = shouldSprint ? this.sprintSpeed : this.walkSpeed;
      const targetVX = moveDir.x * maxSpeed;
      const targetVZ = moveDir.z * maxSpeed;
      this.velocity.x = damp(this.velocity.x, targetVX, this.acceleration, dt);
      this.velocity.z = damp(this.velocity.z, targetVZ, this.acceleration, dt);

      const targetYaw = Math.atan2(moveDir.x, moveDir.z);
      this.character.rotation.y += shortestAngleDelta(this.character.rotation.y, targetYaw) * Math.min(1, this.turnSpeed * dt);
    } else {
      this.velocity.x = damp(this.velocity.x, 0, this.deceleration, dt);
      this.velocity.z = damp(this.velocity.z, 0, this.deceleration, dt);
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    speedRatio = this.THREE.MathUtils.clamp(horizontalSpeed / this.sprintSpeed, 0, 1);

    const gravityNow = this.verticalVelocity < 0 ? this.gravity * this.fallGravityMult : this.gravity;
    this.verticalVelocity -= gravityNow * dt;

    this.character.position.x += this.velocity.x * dt;
    this.character.position.z += this.velocity.z * dt;
    this.character.position.y += this.verticalVelocity * dt;

    const nextGroundY = this.getGroundHeightAt(this.character.position.x, this.character.position.z);
    if (this.character.position.y < nextGroundY) {
      this.character.position.y = nextGroundY;
      this.verticalVelocity = 0;
    }

    return {
      speedRatio,
      isSprinting: shouldSprint && horizontalSpeed > this.walkSpeed * 0.65,
      verticalVelocity: this.verticalVelocity,
      isGrounded: this.character.position.y <= nextGroundY + this.groundSnapThreshold,
      airborneHeight: Math.max(0, this.character.position.y)
    };
  }
}
