export class ThirdPersonCameraController {
  constructor({ THREE, camera, target, domElement }) {
    this.THREE = THREE;
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;

    this.baseDistance = 8.8;
    this.sprintDistance = 10.0;
    this.distance = this.baseDistance;
    this.pitch = 0.22;
    this.yaw = 0;
    this.minPitch = -0.15;
    this.maxPitch = 1.0;
    this.lookHeight = 1.45;
    this.minCameraHeight = 1.2;
    this._bobPhase = 0;
    this._roll = 0;

    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._arrow = { left: false, right: false, up: false, down: false };
    this.keyRotateSpeed = 1.7;
    this.touchLookSpeed = 2.2;

    this._onPointerDown = (event) => {
      if (event.pointerType === "touch") return;
      this._dragging = true;
      this._lastX = event.clientX;
      this._lastY = event.clientY;
      this.domElement.setPointerCapture(event.pointerId);
    };

    this._onPointerMove = (event) => {
      if (event.pointerType === "touch") return;
      if (!this._dragging) return;
      const dx = event.clientX - this._lastX;
      const dy = event.clientY - this._lastY;
      this._lastX = event.clientX;
      this._lastY = event.clientY;

      const sensitivity = 0.005;
      this.yaw -= dx * sensitivity;
      this.pitch -= dy * sensitivity;
      this.pitch = this.THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
    };

    this._onPointerUp = (event) => {
      if (event.pointerType === "touch") return;
      this._dragging = false;
      if (this.domElement.hasPointerCapture(event.pointerId)) {
        this.domElement.releasePointerCapture(event.pointerId);
      }
    };

    this._onKeyDown = (event) => {
      if (event.code === "ArrowLeft") { this._arrow.left = true; event.preventDefault(); }
      if (event.code === "ArrowRight") { this._arrow.right = true; event.preventDefault(); }
      if (event.code === "ArrowUp") { this._arrow.up = true; event.preventDefault(); }
      if (event.code === "ArrowDown") { this._arrow.down = true; event.preventDefault(); }
    };

    this._onKeyUp = (event) => {
      if (event.code === "ArrowLeft") this._arrow.left = false;
      if (event.code === "ArrowRight") this._arrow.right = false;
      if (event.code === "ArrowUp") this._arrow.up = false;
      if (event.code === "ArrowDown") this._arrow.down = false;
    };

    domElement.addEventListener("pointerdown", this._onPointerDown);
    domElement.addEventListener("pointermove", this._onPointerMove);
    domElement.addEventListener("pointerup", this._onPointerUp);
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
  }

  update(dt, locomotion = null, inputState = null) {
    const yawInput = (this._arrow.right ? 1 : 0) - (this._arrow.left ? 1 : 0);
    const pitchInput = (this._arrow.down ? 1 : 0) - (this._arrow.up ? 1 : 0);
    if (yawInput !== 0) this.yaw -= yawInput * this.keyRotateSpeed * dt;
    if (pitchInput !== 0) this.pitch += pitchInput * this.keyRotateSpeed * dt;
    if (inputState) {
      this.yaw -= (inputState.lookX || 0) * this.touchLookSpeed * dt;
      this.pitch -= (inputState.lookY || 0) * this.touchLookSpeed * dt;
    }
    this.pitch = this.THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);

    const zoomTarget = locomotion?.isSprinting ? this.sprintDistance : this.baseDistance;
    this.distance += (zoomTarget - this.distance) * (1 - Math.exp(-6 * dt));

    const speedRatio = locomotion?.speedRatio ?? 0;
    const grounded = locomotion?.isGrounded ?? true;
    if (grounded && speedRatio > 0.03) {
      const bobRate = (locomotion?.isSprinting ? 13.5 : 10.0);
      this._bobPhase += dt * bobRate * (0.45 + speedRatio);
    }
    const bobAmount = grounded ? speedRatio : 0;
    const bobSide = Math.sin(this._bobPhase * 0.95) * 0.1 * bobAmount;
    const bobUp = Math.abs(Math.sin(this._bobPhase * 1.9)) * 0.045 * bobAmount;
    const rollTarget = Math.sin(this._bobPhase * 0.95) * 0.02 * bobAmount;

    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const offsetX = Math.sin(this.yaw) * this.distance * cosPitch;
    const offsetZ = Math.cos(this.yaw) * this.distance * cosPitch;
    const offsetY = 2.0 + sinPitch * this.distance;

    const targetY = Math.max(this.minCameraHeight, this.target.position.y + offsetY);
    const desired = new this.THREE.Vector3(
      this.target.position.x + offsetX + bobSide,
      targetY + bobUp,
      this.target.position.z + offsetZ
    );

    this.camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + this.lookHeight,
      this.target.position.z
    );

    // Balanceo lateral tipo mecedora al caminar/correr.
    this._roll += (rollTarget - this._roll) * (1 - Math.exp(-10 * dt));
    this.camera.rotation.z += this._roll;
  }

  dispose() {
    this.domElement.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement.removeEventListener("pointermove", this._onPointerMove);
    this.domElement.removeEventListener("pointerup", this._onPointerUp);
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
  }
}
