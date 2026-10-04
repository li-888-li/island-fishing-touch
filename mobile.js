(() => {
  const controls = document.getElementById('tw-touch');
  const unsupported = document.getElementById('tw-unsupported');
  const touchMode = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
  if (touchMode) document.documentElement.classList.add('tw-touch-mode');

  if (!navigator.gpu) {
    unsupported.hidden = false;
    return;
  }
  if (!touchMode) return;
  controls.hidden = false;

  const keyNames = {
    KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
    KeyE: 'e', KeyR: 'r', KeyI: 'i', KeyH: 'h', KeyC: 'c', KeyV: 'v', KeyL: 'l',
    Space: ' ', ShiftLeft: 'Shift',
  };
  const held = new Set();
  const emitKey = (code, down) => {
    if (down === held.has(code)) return;
    if (down) held.add(code);
    else held.delete(code);
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {
      code, key: keyNames[code] ?? code, bubbles: true, cancelable: true,
    }));
  };
  const resumeAudio = () => window.__app?.audio?.resume?.();

  const stick = controls.querySelector('.tw-stick');
  const thumb = controls.querySelector('.tw-stick-thumb');
  let stickPointer = null;
  function moveStick(event) {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / radius));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / radius));
    const length = Math.max(1, Math.hypot(x, y));
    thumb.style.transform = `translate(calc(-50% + ${x / length * radius}px), calc(-50% + ${y / length * radius}px))`;
    emitKey('KeyW', y < -0.28);
    emitKey('KeyS', y > 0.28);
    emitKey('KeyA', x < -0.28);
    emitKey('KeyD', x > 0.28);
  }
  function releaseStick(event) {
    if (event && event.pointerId !== stickPointer) return;
    stickPointer = null;
    thumb.style.transform = 'translate(-50%, -50%)';
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) emitKey(code, false);
  }
  stick.addEventListener('pointerdown', event => {
    if (stickPointer !== null) return;
    event.preventDefault();
    event.stopPropagation();
    resumeAudio();
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  stick.addEventListener('pointermove', event => {
    if (event.pointerId === stickPointer) moveStick(event);
  });
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);
  stick.addEventListener('lostpointercapture', releaseStick);

  const look = controls.querySelector('.tw-look');
  let lookPointer = null;
  let lastX = 0;
  let lastY = 0;
  look.addEventListener('pointerdown', event => {
    if (lookPointer !== null) return;
    event.preventDefault();
    resumeAudio();
    lookPointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    look.setPointerCapture(event.pointerId);
  });
  look.addEventListener('pointermove', event => {
    if (event.pointerId !== lookPointer) return;
    const input = window.__app?.input;
    if (input) {
      input.look.x += (event.clientX - lastX) * 1.1;
      input.look.y += (event.clientY - lastY) * 1.1;
    }
    lastX = event.clientX;
    lastY = event.clientY;
  });
  const releaseLook = event => {
    if (event.pointerId === lookPointer) lookPointer = null;
  };
  look.addEventListener('pointerup', releaseLook);
  look.addEventListener('pointercancel', releaseLook);
  look.addEventListener('lostpointercapture', releaseLook);

  for (const button of controls.querySelectorAll('button[data-key], button[data-mouse]')) {
    let activePointer = null;
    const setDown = down => {
      button.classList.toggle('is-held', down);
      const code = button.dataset.key;
      if (code) emitKey(code, down);
      const input = window.__app?.input;
      if (input && button.dataset.mouse) {
        if (button.dataset.mouse === 'left') input.mouseDown = down;
        else input.rightDown = down;
      }
    };
    button.addEventListener('pointerdown', event => {
      if (activePointer !== null) return;
      event.preventDefault();
      event.stopPropagation();
      resumeAudio();
      activePointer = event.pointerId;
      button.setPointerCapture(event.pointerId);
      setDown(true);
    });
    const release = event => {
      if (event.pointerId !== activePointer) return;
      activePointer = null;
      setDown(false);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  document.getElementById('tw-quality').addEventListener('click', () => {
    const query = new URLSearchParams(location.search);
    const lite = query.get('quality') === 'lite';
    query.set('quality', lite ? 'high' : 'lite');
    query.set('scale', lite ? '1' : '0.65');
    for (const flag of ['noClouds', 'noHaze', 'noCaustics', 'noSim']) {
      if (lite) query.delete(flag);
      else query.set(flag, '');
    }
    location.search = query.toString();
  });
  const more = document.getElementById('tw-more');
  const extra = document.getElementById('tw-extra');
  more.addEventListener('click', () => {
    extra.hidden = !extra.hidden;
    more.setAttribute('aria-expanded', String(!extra.hidden));
  });

  const releaseAll = () => {
    releaseStick();
    lookPointer = null;
    for (const code of [...held]) emitKey(code, false);
    if (window.__app?.input) {
      window.__app.input.mouseDown = false;
      window.__app.input.rightDown = false;
    }
    controls.querySelectorAll('.is-held').forEach(button => button.classList.remove('is-held'));
  };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
})();
