export function createInputController() {
  const state = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    autoSprintW: false,
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0
  };

  let jumpQueued = false;
  let lastWDownTime = -Infinity;
  const doubleTapWindowMs = 260;
  const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  function onKeyDown(event) {
    const code = event.code;
    if (event.repeat && (code === "KeyW" || code === "KeyA" || code === "KeyS" || code === "KeyD")) {
      return;
    }

    if (code === "Space") {
      event.preventDefault();
      jumpQueued = true;
    }

    if (code === "KeyW") {
      const now = performance.now();
      state.forward = true;
      if (now - lastWDownTime <= doubleTapWindowMs) state.autoSprintW = true;
      lastWDownTime = now;
    }
    if (code === "KeyS") state.back = true;
    if (code === "KeyA") state.left = true;
    if (code === "KeyD") state.right = true;
    if (code === "ShiftLeft" || code === "ShiftRight") state.sprint = true;
  }

  function onKeyUp(event) {
    const code = event.code;
    if (code === "KeyW") {
      state.forward = false;
      state.autoSprintW = false;
    }
    if (code === "KeyS") state.back = false;
    if (code === "KeyA") state.left = false;
    if (code === "KeyD") state.right = false;
    if (code === "ShiftLeft" || code === "ShiftRight") state.sprint = false;
  }

  function attachVirtualStick(stickEl, thumbEl, onChange) {
    if (!stickEl || !thumbEl) return () => {};

    const maxRadius = () => stickEl.clientWidth * 0.34;
    let activePointerId = null;
    let centerX = 0;
    let centerY = 0;

    function setThumb(nx, ny) {
      const px = nx * maxRadius();
      const py = ny * maxRadius();
      thumbEl.style.transform = `translate(${px}px, ${py}px)`;
      onChange(nx, ny);
    }

    function reset() {
      thumbEl.style.transform = "translate(0px, 0px)";
      onChange(0, 0);
    }

    const onPointerDown = (event) => {
      activePointerId = event.pointerId;
      const rect = stickEl.getBoundingClientRect();
      centerX = rect.left + rect.width * 0.5;
      centerY = rect.top + rect.height * 0.5;
      stickEl.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const radius = maxRadius();
      const len = Math.hypot(dx, dy);
      const scale = len > radius ? radius / len : 1;
      setThumb((dx * scale) / radius, (dy * scale) / radius);
      event.preventDefault();
    };

    const onPointerUp = (event) => {
      if (event.pointerId !== activePointerId) return;
      if (stickEl.hasPointerCapture(event.pointerId)) stickEl.releasePointerCapture(event.pointerId);
      activePointerId = null;
      reset();
      event.preventDefault();
    };

    stickEl.addEventListener("pointerdown", onPointerDown);
    stickEl.addEventListener("pointermove", onPointerMove);
    stickEl.addEventListener("pointerup", onPointerUp);
    stickEl.addEventListener("pointercancel", onPointerUp);

    return () => {
      stickEl.removeEventListener("pointerdown", onPointerDown);
      stickEl.removeEventListener("pointermove", onPointerMove);
      stickEl.removeEventListener("pointerup", onPointerUp);
      stickEl.removeEventListener("pointercancel", onPointerUp);
      reset();
    };
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  const moveStick = document.getElementById("move-stick");
  const moveThumb = document.getElementById("move-thumb");
  const lookStick = document.getElementById("look-stick");
  const lookThumb = document.getElementById("look-thumb");
  const jumpBtn = document.getElementById("jump-btn");
  const sprintBtn = document.getElementById("sprint-btn");

  const detachMoveStick = attachVirtualStick(moveStick, moveThumb, (x, y) => {
    state.moveX = x;
    state.moveY = -y;
  });
  const detachLookStick = attachVirtualStick(lookStick, lookThumb, (x, y) => {
    state.lookX = x;
    state.lookY = y;
  });

  const onJumpDown = (event) => {
    jumpQueued = true;
    event.preventDefault();
  };
  const onSprintDown = (event) => {
    state.sprint = true;
    event.preventDefault();
  };
  const onSprintUp = (event) => {
    state.sprint = false;
    event.preventDefault();
  };

  jumpBtn?.addEventListener("pointerdown", onJumpDown);
  sprintBtn?.addEventListener("pointerdown", onSprintDown);
  sprintBtn?.addEventListener("pointerup", onSprintUp);
  sprintBtn?.addEventListener("pointercancel", onSprintUp);
  sprintBtn?.addEventListener("pointerleave", onSprintUp);

  return {
    state,
    isTouchDevice,
    consumeJumpQueued() {
      const v = jumpQueued;
      jumpQueued = false;
      return v;
    },
    dispose() {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      detachMoveStick();
      detachLookStick();
      jumpBtn?.removeEventListener("pointerdown", onJumpDown);
      sprintBtn?.removeEventListener("pointerdown", onSprintDown);
      sprintBtn?.removeEventListener("pointerup", onSprintUp);
      sprintBtn?.removeEventListener("pointercancel", onSprintUp);
      sprintBtn?.removeEventListener("pointerleave", onSprintUp);
    }
  };
}
