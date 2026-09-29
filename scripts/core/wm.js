/* ═══════════════════════════════════════════════════════════
   Nebula OS — window manager
   drag · resize · snap · focus · minimize · maximize · alt-tab
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el, $, clamp, drag, bus, raf } = OS.util;
  const { icons } = OS;

  const layer = () => $('#windowLayer');
  const wins = new Map();          // id -> win
  const order = [];                // stacking order, last = top
  let focused = null;
  let zTop = 100;
  let cascade = 0;

  /* Window-control glyphs (filled 12×12 masks) */
  const GLYPH = {
    min: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><rect x="1" y="5.2" width="10" height="1.6" rx=".8"/></svg>`,
    max: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M1.4 1.4h9.2v9.2H1.4z" fill="none" stroke="black" stroke-width="1.5"/></svg>`,
    restore: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><g fill="none" stroke="black" stroke-width="1.4"><path d="M1.2 3.6V1.4h9.2v9.2H8.4"/><rect x="3.4" y="3.4" width="7.4" height="7.4" rx=".6" fill="none"/></g><path d="M3.4 3.4h7.4v7.4H3.4z"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M1.4 2.2 9.8 10.6M9.8 2.2 1.4 10.6" stroke="black" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>`
  };
  const glyphURL = (k) => `url("data:image/svg+xml,${encodeURIComponent(GLYPH[k])}")`;
  const layer$ = () => layer();

  /* Work area respects the floating status bar and dock */
  function workArea() {
    const w = innerWidth, h = innerHeight;
    return { x: 0, y: 0, w, h, pad: 10, top: 56, bottom: w > 760 ? 96 : 84 };
  }

  /* ───────────────────────── Window ───────────────────────── */

  class Win {
    constructor(app, opts = {}) {
      this.id = opts.id || OS.util.uid('w');
      this.app = app;
      this.state = 'normal';       // normal | max | min | full
      this.prevRect = null;
      this.minimized = false;
      this.onCloseCbs = [];
      this.resizeCbs = [];
      this.meta = {};
      this.build(app, opts);
      wins.set(this.id, this);
      order.push(this);
      this.focus();
      this.appear();
    }

    /* ── DOM ── */
    build(app, opts) {
      const wa = workArea();
      const defW = Math.min(opts.width || app.width || 720, wa.w - 32);
      const defH = Math.min(opts.height || app.height || 480, wa.h - wa.top - wa.bottom);
      const step = 30;
      const ox = 40 + (cascade % 6) * step;
      const oy = wa.top + 24 + (cascade % 6) * step;
      cascade++;

      const w = clamp(opts.x ?? ox, 6, Math.max(6, wa.w - defW - 6));
      const h = clamp(opts.y ?? oy, wa.top, Math.max(wa.top, wa.h - defH - 10));

      this.root = el('div', {
        class: 'window',
        dataset: { app: app.id },
        style: {
          left: w + 'px', top: h + 'px',
          width: defW + 'px', height: defH + 'px',
          minWidth: (opts.minWidth || 300) + 'px',
          minHeight: (opts.minHeight || 180) + 'px',
          '--win-accent': (app.accent?.[0] || 'var(--accent)')
        },
        tabindex: '-1'
      });

      /* title bar */
      const tile = el('div', { class: 'tile', dataset: { icon: app.icon || 'window' } });
      this.bar = el('div', { class: 'win-bar' },
        el('div', { class: 'win-ico' }, tile),
        el('div', { class: 'win-title', text: app.name || 'ウィンドウ' }),
        el('div', { class: 'win-sub tiny', text: opts.sub || '' }),
        el('div', { class: 'win-tools' },
          this.tools = el('div', { class: 'win-tools' })
        )
      );
      this.titleEl = this.bar.querySelector('.win-title');
      this.subEl = this.bar.querySelector('.win-sub');
      icons.paint(tile);

      const mkBtn = (cls, label, glyph, fn) => {
        const b = el('button', { class: 'win-btn ' + cls, title: label, 'aria-label': label });
        b.style.setProperty('--wm', glyphURL(glyph));
        // The event must be forwarded: the maximize button inspects e.shiftKey.
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
        return b;
      };
      this.minBtn = mkBtn('win-min', '最小化', 'min', () => this.minimize());
      this.maxBtn = mkBtn('win-max', '最大化', 'max', (e) => {
        if (e && e.shiftKey) this.toggleFullscreen();
        else this.toggleMax();
      });
      this.maxBtn.addEventListener('pointerenter', () => this.openSnapFlyout());
      this.maxBtn.addEventListener('pointerleave', () => this.closeSnapFlyoutSoon());
      this.closeBtn = mkBtn('win-close', '閉じる', 'close', () => this.close());
      this.tools.append(this.minBtn, this.maxBtn, this.closeBtn);

      /* content */
      this.content = el('div', { class: 'win-content' });
      this.root.append(this.bar, this.content);

      /* resize handles */
      ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].forEach((d) => {
        const h = el('div', { class: 'rz rz-' + d });
        h.addEventListener('pointerdown', (e) => this.startResize(e, d));
        this.root.append(h);
      });

      /* events */
      this.root.addEventListener('pointerdown', () => this.focus(), true);
      this.bar.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.win-btn')) return;
        this.startDrag(e);
      });
      this.bar.addEventListener('dblclick', (e) => {
        if (e.target.closest('.win-btn')) return;
        this.toggleMax();
      });
      this.bar.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        OS.ctx.show(e.clientX, e.clientY, [
          { label: '最小化', icon: 'minus', onClick: () => this.minimize() },
          { label: this.state === 'max' ? '元のサイズに戻す' : '最大化', icon: 'maximize', onClick: () => this.toggleMax() },
          { label: '全画面表示', icon: 'maximize', onClick: () => this.toggleFullscreen() },
          '-',
          { label: '常に手前に表示', icon: 'pin', onClick: () => this.togglePin() },
          '-',
          { label: '閉じる', icon: 'x', key: 'Ctrl+W', danger: true, onClick: () => this.close() }
        ]);
      });

      layer().append(this.root);
      icons.paint(this.root);
    }

    appear() {
      bus.emit('wm:open', this);
      bus.emit('wm:change');
    }

    /* ── geometry ── */
    get rect() {
      const s = this.root.style;
      return { x: parseFloat(s.left) || 0, y: parseFloat(s.top) || 0, w: this.root.offsetWidth, h: this.root.offsetHeight };
    }
    setRect(r, animate = false) {
      if (animate) {
        this.root.classList.add('is-snapping');
        setTimeout(() => this.root.classList.remove('is-snapping'), 260);
      }
      const wa = workArea();
      if (r.w != null) this.root.style.width = Math.round(clamp(r.w, this.minW(), wa.w)) + 'px';
      if (r.h != null) this.root.style.height = Math.round(clamp(r.h, this.minH(), wa.h)) + 'px';
      if (r.x != null) this.root.style.left = Math.round(clamp(r.x, -this.root.offsetWidth + 90, wa.w - 70)) + 'px';
      if (r.y != null) this.root.style.top = Math.round(clamp(r.y, 0, wa.h - 40)) + 'px';
      this.emitResize();
    }
    minW() { return parseFloat(this.root.style.minWidth) || 300; }
    minH() { return parseFloat(this.root.style.minHeight) || 180; }

    emitResize() { this.resizeCbs.forEach(f => { try { f(this.rect); } catch (e) { console.error(e); } }); bus.emit('wm:resize', this); }
    onResize(fn) { this.resizeCbs.push(fn); fn(this.rect); return fn; }
    onClose(fn) { this.onCloseCbs.push(fn); return fn; }

    /* ── focus / z-order ── */
    isMinimized() { return this.root.classList.contains('is-minimized'); }
    focus() {
      if (this.isMinimized() || this.minimized) this.restore();
      if (focused === this && order[order.length - 1] === this) return;
      if (focused && focused !== this) focused.blur();
      const i = order.indexOf(this);
      if (i >= 0) order.splice(i, 1);
      order.push(this);
      focused = this;
      this.root.style.zIndex = ++zTop;
      this.root.classList.add('is-focused');
      this.root.classList.remove('is-inactive');
      order.forEach(w => { if (w !== this) { w.root.classList.add('is-inactive'); if (!w.pinned) w.root.style.zIndex = 1; } });
      // A pinned window must stay above everything, including the focused one.
      order.forEach(w => { if (w !== this && w.pinned) w.root.style.zIndex = 9999; });
      bus.emit('wm:focus', this);
      bus.emit('wm:change');
    }
    blur() {
      this.root.classList.remove('is-focused');
      this.root.classList.add('is-inactive');
    }

    /* ── drag ── */
    /* ── resize ── */
    startResize(e, dir) {
      if (e.button !== 0) return;
      if (this.state === 'full') return;
      e.stopPropagation();
      this.closeSnapFlyoutSoon();
      this.focus();

      const r = this.rect;
      const minW = this.minW(), minH = this.minH();
      const east = dir.includes('e'), west = dir.includes('w');
      const south = dir.includes('s'), north = dir.includes('n');
      // Resizing one edge moves the opposite edge, so pin the far edge.
      const right = r.x + r.w, bottom = r.y + r.h;

      this.root.classList.add('is-resizing');
      document.body.style.cursor = getComputedStyle(e.currentTarget).cursor;

      drag(e, {
        onMove: (dx, dy) => {
          let w = r.w, h = r.h, x = r.x, y = r.y;
          if (east) w = r.w + dx;
          if (south) h = r.h + dy;
          if (west) { w = r.w - dx; x = r.x + dx; }
          if (north) { h = r.h - dy; y = r.y + dy; }
          // Clamp against the minimum size first, then anchor the far edge so
          // the opposite edge never moves while dragging.
          if (west && w < minW) { w = minW; x = right - minW; }
          if (north && h < minH) { h = minH; y = bottom - minH; }
          this.setRect({ x, y, w: Math.max(w, minW), h: Math.max(h, minH) });
        },
        onEnd: () => {
          this.root.classList.remove('is-resizing');
          document.body.style.cursor = '';
          this.emitResize();
        }
      });
    }

    startDrag(e) {
      if (e.button !== 0) return;
      if (this.state === 'full') return;
      this.closeSnapFlyoutSoon();
      this.focus();

      const r = this.rect;
      let startX = e.clientX, startY = e.clientY;
      let base = { ...r };
      let wasMax = this.state === 'max';
      let moved = false;
      let snapZone = null;

      this.root.classList.add('is-dragging');
      document.body.style.cursor = 'grabbing';

      drag(e, {
        onMove: (dx, dy) => {
          if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
          if (!moved) {
            moved = true;
            if (wasMax) {
              // tear off a maximized window under the cursor
              const ratio = (startX - r.x) / r.w;
              this.unmaximize();
              base = { ...this.rect };
              base.x = startX - base.w * ratio;
              base.y = Math.max(0, startY - 21);
            }
          }
          const nx = base.x + dx, ny = base.y + dy;
          this.root.style.left = nx + 'px';
          this.root.style.top = Math.max(0, ny) + 'px';
          snapZone = this.detectSnap(nx, ny, base.w, base.h, e);
        },
        onEnd: () => {
          this.root.classList.remove('is-dragging');
          document.body.style.cursor = '';
          OS.hint?.hide();
          if (snapZone) this.applySnap(snapZone);
          this.emitResize();
        }
      });
    }

    detectSnap(x, y, w, h, e) {
      const wa = workArea();
      const T = 12, L = 14, R = wa.w - 14, B = wa.h;
      const px = e.clientX, py = e.clientY;
      if (py <= T) {
        if (px <= L + 80) return 'tl';
        if (px >= R - 80) return 'tr';
        return 'max';
      }
      if (px <= L) return py > B - 160 ? 'bl' : py < wa.h * .32 ? 'tl' : 'l';
      if (px >= R) return py > B - 160 ? 'br' : py < wa.h * .32 ? 'tr' : 'r';
      if (py >= B - 8) return 'bottom';
      return null;
    }

    snapRect(zone) {
      const wa = workArea();
      const g = 6, halfW = (wa.w - g * 3) / 2, halfH = (wa.h - wa.top - wa.bottom - g * 3) / 2;
      const top = wa.top + g;
      const left = g;
      const right = left + halfW + g * 2;
      const bottom = top + halfH + g * 2;
      const W = wa.w - g * 2, H = wa.h - wa.top - wa.bottom - g * 2;
      switch (zone) {
        // 'max' fills the work area: below the floating status bar and above the
        // dock. Using y:0 would tuck the title bar (and its window buttons)
        // under the status cluster, where they cannot be clicked.
        case 'max':  return { x: 0, y: wa.top, w: wa.w, h: wa.h - wa.top - wa.bottom };
        case 'full': return { x: 0, y: 0, w: wa.w, h: wa.h };
        case 'l':   return { x: left, y: top, w: halfW, h: H };
        case 'r':   return { x: right, y: top, w: halfW, h: H };
        case 'tl':  return { x: left, y: top, w: halfW, h: halfH };
        case 'tr':  return { x: right, y: top, w: halfW, h: halfH };
        case 'bl':  return { x: left, y: bottom, w: halfW, h: halfH };
        case 'br':  return { x: right, y: bottom, w: halfW, h: halfH };
        case 'bottom': return { x: 0, y: wa.h - 200, w: wa.w, h: 190 };
        default: return null;
      }
    }

    applySnap(zone) {
      const r = this.snapRect(zone);
      if (!r) return;
      if (zone === 'max') { this.maximize(); return; }
      this.prevRect = this.state === 'max' ? this.prevRect : { ...this.rect };
      this.state = 'normal';
      this.root.classList.remove('is-max', 'is-fullscreen');
      this.prevFull = false;
      this.root.classList.add('is-snapping');
      this.setRect(r);
      this.syncMaxBtn();
      setTimeout(() => this.root.classList.remove('is-snapping'), 280);
    }

    /* Keep the title-bar button in step with the actual state. */
    syncMaxBtn() {
      const on = this.state === 'max';
      this.maxBtn.classList.toggle('win-max', !on);
      this.maxBtn.classList.toggle('win-restore', on);
      this.maxBtn.style.setProperty('--wm', glyphURL(on ? 'restore' : 'max'));
      this.maxBtn.title = on ? '元のサイズに戻す' : '最大化';
    }

    /* ── maximize / fullscreen / minimize ── */
    toggleMax() { this.state === 'max' ? this.unmaximize() : this.maximize(); }
    maximize() {
      if (this.state === 'max') return;
      // Coming from fullscreen, keep the pre-fullscreen rect as the restore target.
      if (this.state !== 'full') this.prevRect = { ...this.rect };
      this.state = 'max';
      this.prevFull = false;
      this.root.classList.remove('is-fullscreen');
      this.root.classList.add('is-max');
      this.root.classList.add('is-snapping');
      const r = this.snapRect('max');
      this.setRect(r);
      this.syncMaxBtn();
      setTimeout(() => this.root.classList.remove('is-snapping'), 280);
      bus.emit('wm:change');
    }
    unmaximize() {
      if (this.state !== 'max') return;
      this.state = 'normal';
      this.root.classList.remove('is-max', 'is-snapping');
      if (this.prevRect) this.setRect(this.prevRect);
      this.syncMaxBtn();
      bus.emit('wm:change');
    }
    toggleFullscreen() {
      const wa = workArea();
      if (this.state === 'full') {
        this.state = this.prevFull ? 'max' : 'normal';
        this.root.classList.remove('is-fullscreen');
        this.root.classList.toggle('is-max', this.prevFull);
        this.setRect(this.prevRect || { x: 80, y: 70, w: 800, h: 520 }, true);
        this.prevFull = false;
        this.syncMaxBtn();
      } else {
        this.prevFull = this.state === 'max';
        if (this.state !== 'max') this.prevRect = { ...this.rect };
        this.state = 'full';
        this.root.classList.add('is-fullscreen');
        this.setRect({ x: 0, y: 0, w: innerWidth, h: innerHeight }, true);
      }
      bus.emit('wm:change');
    }
    minimize() {
      if (this.minimized || this.isMinimized()) return;
      this.minimized = true;
      this.root.classList.add('is-minimizing');
      bus.emit('wm:minimize', this);
      this._minTimer = setTimeout(() => {
        this._minTimer = null;
        // The window may have been restored while the animation was running.
        if (!this.minimized) return;
        this.root.classList.remove('is-minimizing');
        this.root.classList.add('is-minimized');
        this.minimized = false;
        if (focused === this) {
          const next = order.filter(w => w !== this && !w.isMinimized()).pop();
          next ? next.focus() : (focused = null, bus.emit('wm:focus', null));
        }
        bus.emit('wm:change');
      }, 240);
    }
    restore() {
      if (!this.minimized && !this.isMinimized()) return;
      clearTimeout(this._minTimer);
      this._minTimer = null;
      this.minimized = false;
      this.root.classList.remove('is-minimized', 'is-minimizing');
      bus.emit('wm:change');
    }

    /* ── snap flyout (hover the maximize button) ── */
    openSnapFlyout() {
      if (this.state === 'full') return;
      clearTimeout(this._flyT);
      this._flyT = setTimeout(() => {
        const f = $('#snapFlyout');
        const layouts = [
          { zone: 'tl', cells: 2 }, { zone: 'l', cells: 1 }, { zone: 'r', cells: 1 },
          { zone: 'tr', cells: 2 }, { zone: 'bl', cells: 2 }, { zone: 'max', cells: 1 }
        ];
        f.innerHTML = '';
        layouts.forEach((L) => {
          const z = el('div', { class: 'zone', title: 'この配置にスナップ' });
          const rows = L.zone === 'l' || L.zone === 'r' ? 1 : L.cells === 1 ? 1 : 2;
          const cols = L.zone === 'l' || L.zone === 'r' ? 1 : L.cells === 1 ? 1 : 2;
          z.style.display = 'grid';
          z.style.gridTemplateRows = `repeat(${rows},1fr)`;
          z.style.gridTemplateColumns = `repeat(${cols},1fr)`;
          for (let i = 0; i < rows * cols; i++) z.append(el('i'));
          z.addEventListener('click', () => { this.applySnap(L.zone); f.hidden = true; });
          f.append(z);
        });
        const r = this.maxBtn.getBoundingClientRect();
        f.hidden = false;
        const fr = f.getBoundingClientRect();
        f.style.left = clamp(r.left + r.width / 2 - fr.width / 2, 8, innerWidth - fr.width - 8) + 'px';
        f.style.top = (r.bottom + 8) + 'px';
      }, 420);
    }
    closeSnapFlyoutSoon() {
      clearTimeout(this._flyT);
      this._flyT = setTimeout(() => { const f = $('#snapFlyout'); if (f) f.hidden = true; }, 260);
    }

    togglePin() {
      this.pinned = !this.pinned;
      this.root.style.zIndex = this.pinned ? 9999 : (++zTop);
    }

    /* ── close ── */
    close() {
      this.onCloseCbs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
      this.root.classList.add('is-closing');
      bus.emit('wm:close', this);
      setTimeout(() => {
        this.root.remove();
        wins.delete(this.id);
        const i = order.indexOf(this);
        if (i >= 0) order.splice(i, 1);
        if (focused === this) { focused = null; order.pop()?.focus(); }
        bus.emit('wm:change');
      }, 190);
    }

    /* ── public helpers for apps ── */
    setTitle(t) { this.titleEl.textContent = t; bus.emit('wm:change'); }
    setSub(t) { this.subEl.textContent = t || ''; }
    setAccent(c) { this.root.style.setProperty('--win-accent', c); }
  }

  /* ───────────────────────── Public API ───────────────────────── */

  function open(app, opts = {}) {
    if (app.singleton) {
      const existing = Array.from(wins.values()).find(w => w.app.id === app.id);
      if (existing) { existing.focus(); if (opts.arg !== undefined) app.onArg?.(existing, opts.arg); return existing; }
    }
    const w = new Win(app, opts);
    try {
      app.mount(w.content, w, opts.arg);
    } catch (err) {
      console.error(err);
      w.content.innerHTML = `<div class="empty-state"><h3>起動できませんでした</h3><p>${OS.util.esc(err.message)}</p></div>`;
    }
    icons.paint(w.content);
    return w;
  }

  const closeAll = () => Array.from(wins.values()).forEach(w => w.close());
    const minimizeAll = () => { order.filter(w => !w.isMinimized()).forEach(w => w.minimize()); };
  const list = () => order.slice();
  const byApp = (id) => Array.from(wins.values()).filter(w => w.app.id === id);
  const getFocused = () => focused;
  const has = (id) => Array.from(wins.values()).some(w => w.app.id === id);

  function cycle(dir = 1) {
    const cand = order.filter(w => !w.root.classList.contains('is-minimized'));
    if (cand.length < 2) return;
    const idx = cand.indexOf(focused);
    cand[(idx + dir + cand.length) % cand.length]?.focus();
  }

  /* ── Alt+Tab switcher overlay ── */
  let swIdx = 0, swActive = false;
  function openSwitcher() {
    // A minimized window is not restorable by focusing it unless its class is
    // cleared, so keep it out of the list rather than showing a dead card.
    const cand = order.filter(w => !w.isMinimized()).reverse();
    if (cand.length < 1) return;
    if (cand.length === 1) { cand[0].focus(); return; }
    const box = $('#switcher'), inner = $('#switcherInner');
    inner.innerHTML = '';
    cand.forEach((w, i) => {
      const card = el('div', { class: 'sw-card' + (i === 0 ? ' is-active' : '') },
        (() => { const a = el('div', { class: 'art', style: { background: `linear-gradient(150deg,${w.app.accent?.[0] || 'var(--accent)'},${w.app.accent?.[1] || 'var(--accent-2)'})` }, dataset: { icon: w.app.icon } }); return a; })(),
        el('span', { text: w.app.name })
      );
      card.addEventListener('click', () => { swIdx = i; closeSwitcher(); });
      card.addEventListener('mouseenter', () => setSwIdx(i));
      inner.append(card);
    });
    icons.paint(inner);
    box.hidden = false;
    swActive = true; swIdx = 0;
    box._cand = cand;
  }
  function setSwIdx(i) {
    swIdx = i;
    $('#switcherInner').querySelectorAll('.sw-card').forEach((c, j) => c.classList.toggle('is-active', j === i));
  }
  function closeSwitcher(commit = true) {
    const box = $('#switcher');
    if (!swActive) return;
    swActive = false;
    box.hidden = true;
    // The window may have been closed while the switcher was open.
    if (commit && box._cand) {
      const w = box._cand[swIdx];
      if (w && w.root.isConnected) w.focus();
    }
  }
  /* ── global keyboard ── */
  let altTabbing = false;
  addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && e.altKey) {
      e.preventDefault();
      if (!altTabbing) { altTabbing = true; openSwitcher(); } else { setSwIdx((swIdx + 1) % $('#switcherInner').children.length); }
      return;
    }
    if (altTabbing && e.key === 'Escape') { e.preventDefault(); closeSwitcher(false); altTabbing = false; return; }
    if (e.key === 'Meta' || e.key === 'OS') { e.preventDefault(); OS.launcher.toggle(); }
  });
  addEventListener('keyup', (e) => {
    if (e.key === 'Alt' && altTabbing) { altTabbing = false; closeSwitcher(true); }
  });
  addEventListener('blur', () => { if (altTabbing) { altTabbing = false; closeSwitcher(false); } });

  /* viewport resize keeps windows sane */
  let rzT = null;
  addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      const wa = workArea();
      order.forEach(w => {
        if (w.state === 'full') { w.setRect({ x: 0, y: 0, w: wa.w, h: wa.h }); return; }
        if (w.state === 'max') { w.setRect(w.snapRect('max')); return; }
        const r = w.rect;
        if (r.x + r.w > wa.w - 4 || r.y + r.h > wa.h - 4) {
          w.setRect({ x: Math.min(r.x, Math.max(4, wa.w - r.w - 8)), y: Math.min(r.y, Math.max(0, wa.h - r.h - 10)) });
        }
      });
    }, 120);
  });

  OS.wm = { open, closeAll, minimizeAll, list, byApp, getFocused, has, cycle, Win, workArea, closeSwitcher, isSwitching: () => swActive };
})(window.OS);
