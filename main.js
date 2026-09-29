/* ═══════════════════════════════════════════════════════════
   Nebula OS — boot, theme, session, app registry
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { $, $$, el, bus, sleep, pad2, debounce } = OS.util;
  const { icons, store, wm, notify, fs, wallpaper, launcher, dock, desktop, ctx } = OS;

  /* ═══════════ App registry ═══════════ */
  // (registry is defined in core/apps.js, which loads before the app bundles)

  /* ═══════════ Theme engine ═══════════ */
  OS.theme = {
    apply() {
      const s = store.all();
      const r = document.documentElement;
      r.dataset.theme = s.theme;
      r.dataset.glass = s.glassEffects ? 'on' : 'off';
      r.dataset.anim = s.animations ? 'on' : 'off';
      r.style.setProperty('--glass-blur', s.blur + 'px');
      r.style.setProperty('--win-radius', s.radius + 'px');
      r.style.setProperty('--dock-scale', s.dockScale);
      r.style.setProperty('--a1', s.accent);
      r.style.setProperty('--a2', s.accent2);
      r.style.setProperty('--a3', s.accent3);
      r.style.setProperty('--accent', s.accent);
      r.style.setProperty('--accent-2', s.accent2);
      r.style.setProperty('--accent-3', s.accent3);
      r.style.setProperty('--win-bg', s.theme === 'light'
        ? `color-mix(in srgb, #ffffff ${s.opacity + 14}%, transparent)`
        : `color-mix(in srgb, #0d0f1a ${s.opacity + 20}%, transparent)`);
      r.style.setProperty('--glass', s.theme === 'light'
        ? `color-mix(in srgb, #ffffff ${s.opacity + 4}%, transparent)`
        : `color-mix(in srgb, #0b0d16 ${Math.min(88, s.opacity + 10)}%, transparent)`);
      r.style.setProperty('--icon-size', s.iconSize + 'px');
      document.querySelectorAll('.dicon').forEach(n => n.style.width = s.iconSize + 'px');
    },
    setAccent(triple) {
      const [a, b, c] = triple;
      store.patch({ accent: a, accent2: b, accent3: c });
      OS.theme.apply();
      if (OS.wallpaper && ['aurora', 'nebula'].includes(store.get('wallpaper'))) OS.wallpaper.repaint();
    }
  };

  /* ═══════════ Audio ═══════════ */
  let actx = null;
  OS.audio = {
    ctx() { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); return actx; },
    blip(freq = 880, dur = 0.08, type = 'sine', gain = 0.04) {
      if (!store.get('sound')) return;
      try {
        const c = this.ctx();
        if (c.state === 'suspended') c.resume();
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = freq;
        const v = (store.get('volume') / 100) * gain;
        g.gain.setValueAtTime(v, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        o.connect(g).connect(c.destination);
        o.start(); o.stop(c.currentTime + dur);
      } catch (_) {}
    },
    open() { this.blip(660, .07); }, close() { this.blip(440, .07); }, error() { this.blip(220, .12, 'square', .03); }
  };

  /* ═══════════ Snap hint (shared) ═══════════ */
  OS.hint = {
    show(r) {
      const h = $('#snapHint');
      h.removeAttribute('data-mode');
      Object.assign(h.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      h.hidden = false;
      requestAnimationFrame(() => h.classList.add('is-on'));
    },
    hide() {
      const h = $('#snapHint');
      h.classList.remove('is-on');
      setTimeout(() => { if (!h.classList.contains('is-on')) h.hidden = true; }, 200);
    }
  };

  /* ═══════════ Session ═══════════ */
  let locked = true;
  OS.session = {
    user: () => store.get('userName'),
    isLocked: () => locked,

    lock() {
      if (locked) return;
      locked = true;
      const s = $('#lockScreen');
      s.hidden = false;
      s.classList.remove('is-unlocking');
      launcher.close();
      ctx.hide();
      this.drawLock();
      notify.lockNotify({ title: 'Nebula OS', body: 'ロックしました。クリックでロック解除。', app: OS.apps.get('settings') });
    },

    unlock() {
      if (!locked) return;
      locked = false;
      const s = $('#lockScreen');
      s.classList.add('is-unlocking');
      OS.audio.blip(1200, .12);
      setTimeout(() => { s.hidden = true; s.classList.remove('is-unlocking'); }, 620);
    },

    sleep() {
      const s = $('#lockScreen');
      locked = true;
      s.hidden = false;
      s.classList.remove('is-unlocking');
      this.drawLock();
    },

    restart() {
      const b = $('#bootScreen');
      b.hidden = false; b.classList.remove('is-done');
      this.boot(1400);
    },

    shutdown() {
      const b = $('#bootScreen');
      b.hidden = false; b.classList.remove('is-done');
      this.boot(900, () => {
        b.innerHTML = `<div class="boot-inner"><div class="boot-name">Nebula<span>OS</span></div>
          <div class="boot-status" style="opacity:.8">power off — 画面を消します</div></div>`;
        setTimeout(() => { b.classList.add('is-done'); }, 900);
        setTimeout(() => {
          b.hidden = true;
          b.innerHTML = BOOT_HTML;
          const again = el('button', { class: 'btn btn--primary', style: { marginTop: '18px' }, text: 'もう一度電源を入れる' });
          b.querySelector('.boot-inner').append(again);
          again.addEventListener('click', () => location.reload());
        }, 1800);
      });
    },

    /* boot animation */
    async boot(duration = 2200, done) {
      const fill = $('#bootFill'), st = $('#bootStatus');
      const steps = ['powering on…', 'initializing kernel…', 'mounting filesystem…', 'starting window manager…', 'loading applications…', 'ready.'];
      if (!fill) { done && done(); return; }
      fill.style.width = '0%';
      for (let i = 0; i < steps.length; i++) {
        st.textContent = steps[i];
        await sleep(duration / steps.length);
        fill.style.width = Math.round(((i + 1) / steps.length) * 100) + '%';
      }
      await sleep(240);
      $('#bootScreen').classList.add('is-done');
      setTimeout(() => { $('#bootScreen').hidden = true; }, 700);
      done && done();
    },

    drawLock() {
      const d = new Date();
      $('#lockTime').textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      $('#lockDate').textContent = d.toLocaleDateString('ja-JP', { weekday: 'long', month: 'long', day: 'numeric' });
      const ini = (store.get('userName') || 'U').trim().charAt(0).toUpperCase();
      const av = $('#lockAvatar');
      if (av) av.textContent = ini;
    }
  };

  /* ═══════════ Lock-screen wallpaper (animated) ═══════════ */
  (function lockWallpaper() {
    const cv = $('#lockCanvas');
    if (!cv) return;
    const c = cv.getContext('2d');
    let stars = null, raf = 0, t = 0;
    function size() {
      cv.width = innerWidth * 0.4; cv.height = innerHeight * 0.4;
      stars = null;
    }
    function draw() {
      const w = cv.width, h = cv.height;
      if (!stars) {
        stars = Array.from({ length: 220 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.1 + .2, p: Math.random() * 6.28, s: .5 + Math.random() * 1.8 }));
      }
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#05060f'); g.addColorStop(.6, '#0b0c22'); g.addColorStop(1, '#06070e');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'screen';
      [store.get('accent'), store.get('accent2'), store.get('accent3')].forEach((col, i) => {
        const x = (0.5 + 0.34 * Math.sin(t * (0.05 + i * .02) + i * 2)) * w;
        const y = (0.5 + 0.3 * Math.cos(t * (0.04 + i * .02) + i)) * h;
        const r = Math.min(w, h) * 0.5;
        const rg = c.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, col + '55'); rg.addColorStop(1, col + '00');
        c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2);
      });
      c.globalCompositeOperation = 'source-over';
      stars.forEach(s => {
        c.fillStyle = `rgba(255,255,255,${(0.2 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.s + s.p))).toFixed(2)})`;
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.28); c.fill();
      });
      raf = requestAnimationFrame(() => { t += 0.01; draw(); });
    }
    size(); draw();
    addEventListener('resize', size);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else draw(); });
  })();

  /* ═══════════ Global keyboard ═══════════ */
  function initKeys() {
    addEventListener('keydown', (e) => {
      if (e.key === 'F5' && (e.ctrlKey)) return;
      const meta = e.metaKey || (e.key === 'OS');
      if (meta && !e.altKey) {
        const map = {
          e: () => OS.apps.open('files'),
          t: () => OS.apps.open('terminal'),
          n: () => OS.apps.open('notepad'),
          m: () => OS.apps.open('music'),
          s: () => OS.apps.open('settings'),
          d: () => desktop.render(),
          l: () => OS.session.lock(),
          ' ': () => wm.minimizeAll()
        };
        if (map[e.key.toLowerCase()]) { e.preventDefault(); map[e.key.toLowerCase()](); return; }
      }
      if (meta && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const w = wm.getFocused();
        if (w) w.applySnap(e.key === 'ArrowLeft' ? 'l' : 'r');
        return;
      }
      if (e.key === 'F5' || (e.key === 'r' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); wm.list().forEach(w => w.close()); setTimeout(() => OS.apps.open('browser'), 100); return; }
      if (e.key === 'Escape' && OS.ctx.isOpen) return;
      // Fullscreen covers the status bar and therefore the window controls, so
      // Escape must always be able to get back out.
      if (e.key === 'Escape') {
        const w = wm.getFocused();
        if (w && w.state === 'full') { e.preventDefault(); w.toggleFullscreen(); return; }
        if (w && w.state === 'max') { e.preventDefault(); w.unmaximize(); return; }
      }
    });
  }

  /* ═══════════ Welcome ═══════════ */
  async function maybeWelcome() {
    let seen = false;
    try { seen = localStorage.getItem('nebula.welcomed') === '1'; } catch (_) {}
    if (seen) return;
    try { localStorage.setItem('nebula.welcomed', '1'); } catch (_) {}
    await sleep(500);
    notify.notify({
      title: 'Nebula OS へようこそ',
      body: '右クリックでデスクトップ設定、Super キーでランチャー。ターミナルで「neofetch」を試してください。',
      app: OS.apps.get('settings'),
      timeout: 9000
    });
  }

  /* ═══════════ Boot HTML snapshot (for shutdown screen) ═══════════ */
  const BOOT_HTML = $('#bootScreen').innerHTML;

  /* ═══════════ Init ═══════════ */
  function init() {
    OS.theme.apply();
    icons.paint(document.body);
    wallpaper.apply(store.get('wallpaper'), true);

    desktop.init();
    dock.init();
    launcher.init();
    initKeys();

    // The filesystem is a single storage blob, so a failed write would
    // otherwise silently discard work with no indication anything went wrong.
    OS.util.bus.on('fs:error', (e) => {
      console.error('filesystem save failed', e);
      OS.notify?.notify({
        title: '保存できませんでした',
        body: 'ブラウザの保存容量を超えたか、保存がブロックされています。このセッションの変更は保存されません。',
        timeout: 12000
      });
    });

    // lock screen interactions
    const lockCard = $('#lockCard');
    lockCard.addEventListener('click', () => OS.session.unlock());
    $('#lockScreen').addEventListener('click', (e) => {
      if (e.target.closest('.lock-card') || e.target.closest('.lock-notif')) return;
      OS.session.unlock();
    });

    // live lock clock
    setInterval(() => { if (OS.session.isLocked()) OS.session.drawLock(); }, 1000);
    OS.session.drawLock();

    // lock when the tab is hidden for a long time
    let hideT = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hideT = Date.now();
      else if (hideT && Date.now() - hideT > 120000 && !OS.session.isLocked()) {
        OS.session.lock();
        notify.notify({ title: '自動ロック', body: 'しばらく操作がなかったため、ロックしました。' });
      }
    });

    // boot
    OS.session.boot(2300).then(() => {
      OS.session.drawLock();
      maybeWelcome();
      // stagger a few demo windows
      setTimeout(() => { if (wm.list().length === 0) { /* keep it clean */ } }, 100);
    });

    // Note: deliberately no `beforeunload` prompt. Modern browsers suppress it
    // unless the page has a user gesture, so it only produces a console error
    // and a generic "leave site?" nag on every navigation.

    // expose a tiny console API
    window.Nebula = { OS, wm, fs, store, apps: OS.apps, backup: OS.backup };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.OS);
