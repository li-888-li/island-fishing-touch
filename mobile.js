(() => {
  const controls = document.getElementById('tw-touch');
  const unsupported = document.getElementById('tw-unsupported');
  const touchMode = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
  if (touchMode) document.documentElement.classList.add('tw-touch-mode');

  if (touchMode) {
    setTimeout(() => {
      const loader = document.getElementById('loader');
      const progress = loader?.querySelector('progress');
      if (!loader || loader.hidden || !progress || Number(progress.value) !== 0.02) return;
      const hint = document.createElement('p');
      hint.className = 'tw-gpu-hint';
      hint.textContent = '长时间停在 2%：手机正在连接图形设备。请更新浏览器和系统；若仍无法进入，可能是这台设备暂不支持所需的 WebGPU 功能。';
      loader.querySelector('.sd-loading')?.appendChild(hint);
    }, 20000);
  }

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

  const graphicsMessages = [];
  function showGraphicsError(message) {
    let notice = document.getElementById('tw-graphics-error');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'tw-graphics-error';
      notice.className = 'tw-graphics-error';
      notice.setAttribute('role', 'alert');
      const title = document.createElement('strong');
      title.textContent = '手机图形设备出现错误';
      const detail = document.createElement('p');
      const reload = document.createElement('button');
      reload.type = 'button';
      reload.textContent = '重新加载';
      reload.addEventListener('click', () => location.reload());
      notice.append(title, detail, reload);
      document.body.appendChild(notice);
    }
    const detail = String(message || '请将此画面截图发给我排查。').slice(0, 180);
    if (!graphicsMessages.includes(detail) && graphicsMessages.length < 3) graphicsMessages.push(detail);
    notice.querySelector('p').textContent = graphicsMessages.join('\n\n');
  }
  window.addEventListener('tw-gpu-error', event => showGraphicsError(event.detail));

  let normalGraphics = null;
  function setCompatibility(app, enabled) {
    const post = app.post;
    if (!normalGraphics) normalGraphics = {
      aaMode: post.aaMode,
      exposure: post.autoExposure.enabled.value,
      shutter: post.motionBlur.shutter.value,
      bloom: post.params.bloom.value,
    };
    post.aaMode = enabled ? 'none' : normalGraphics.aaMode;
    post.autoExposure.enabled.value = enabled ? 0 : normalGraphics.exposure;
    post.motionBlur.shutter.value = enabled ? 0 : normalGraphics.shutter;
    post.params.bloom.value = enabled ? 0 : normalGraphics.bloom;
    post.taau._needsRestart = true;
    document.getElementById('tw-render-recover').textContent = enabled ? '恢复正常' : '修复画面';
  }

  let gpuChecks = 0;
  const gpuWatch = setInterval(() => {
    const app = window.__app;
    const device = app?.gpu?.device;
    if (!device) {
      if (++gpuChecks > 360) clearInterval(gpuWatch);
      return;
    }
    clearInterval(gpuWatch);
    if (app.post?.params?.sharpen) app.post.params.sharpen.value = 0.55;
    if (new URLSearchParams(location.search).has('compat')) setCompatibility(app, true);
    device.addEventListener?.('uncapturederror', event => {
      showGraphicsError(event.error?.message || 'WebGPU 画面错误');
    });
    device.lost.then(info => showGraphicsError(info.message || '图形设备已停止工作'));
  }, 250);

  function attachPrompt() {
    const prompt = document.querySelector('.sd-prompt');
    if (!prompt) return false;
    prompt.setAttribute('role', 'button');
    prompt.setAttribute('aria-label', '点按互动');
    prompt.tabIndex = 0;
    prompt.addEventListener('pointerdown', event => {
      const label = prompt.querySelector('kbd')?.textContent?.trim();
      const code = label === '点按' || label === 'E' ? 'KeyE' : label === '空格' || label === 'Space' ? 'Space' : null;
      if (!code) return;
      event.preventDefault();
      event.stopPropagation();
      resumeAudio();
      emitKey(code, true);
      emitKey(code, false);
    });
    return true;
  }
  if (!attachPrompt()) {
    const promptWatch = new MutationObserver(() => {
      if (attachPrompt()) promptWatch.disconnect();
    });
    promptWatch.observe(document.body, { childList: true, subtree: true });
  }

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

  const qualityButton = document.getElementById('tw-quality');
  qualityButton.addEventListener('click', () => {
    const query = new URLSearchParams(location.search);
    const current = Number(query.get('scale')) || window.__app?.post?.scale || 0.65;
    const next = [0.65, 0.85, 1].find(value => value > current + 0.01) ?? 0.65;
    query.set('scale', String(next));
    const app = window.__app;
    if (app?.setRenderScale) {
      try {
        app.setRenderScale(next);
        history.replaceState(null, '', `${location.pathname}?${query.toString()}${location.hash}`);
        qualityButton.setAttribute('aria-label', `当前画质 ${Math.round(next * 100)}%，点按继续切换`);
        qualityButton.textContent = `${Math.round(next * 100)}%`;
        setTimeout(() => { qualityButton.textContent = '画质'; }, 1600);
      } catch (error) {
        showGraphicsError(error.message);
      }
    } else location.search = query.toString();
  });
  document.getElementById('tw-render-recover').addEventListener('click', () => {
    const query = new URLSearchParams(location.search);
    const enabled = !query.has('compat');
    if (enabled) query.set('compat', '1');
    else query.delete('compat');
    const app = window.__app;
    if (app?.post) {
      setCompatibility(app, enabled);
      history.replaceState(null, '', `${location.pathname}?${query.toString()}${location.hash}`);
    } else location.search = query.toString();
  });
  const more = document.getElementById('tw-more');
  const extra = document.getElementById('tw-extra');
  const landscapeMenu = matchMedia('(max-height: 500px) and (min-aspect-ratio: 4/3)');
  function syncLandscapeMenu() {
    document.documentElement.classList.toggle('tw-landscape-menu-open', landscapeMenu.matches && !extra.hidden);
  }
  more.addEventListener('click', () => {
    extra.hidden = !extra.hidden;
    more.setAttribute('aria-expanded', String(!extra.hidden));
    syncLandscapeMenu();
  });
  landscapeMenu.addEventListener?.('change', syncLandscapeMenu);
  document.addEventListener('click', event => {
    if (!landscapeMenu.matches || !event.target.closest('.sd-nav button, .sd-top button')) return;
    extra.hidden = true;
    more.setAttribute('aria-expanded', 'false');
    syncLandscapeMenu();
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
