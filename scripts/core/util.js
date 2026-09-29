/* ═══════════════════════════════════════════════════════════
   Nebula OS — core utilities
   ═══════════════════════════════════════════════════════════ */
window.OS = window.OS || {};

(function (OS) {
  'use strict';

  /* ── DOM ── */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [p, val] of Object.entries(v)) {
          if (p.startsWith('--')) node.style.setProperty(p, val);
          else node.style[p] = val;
        }
      }
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  const frag = (...kids) => { const f = document.createDocumentFragment(); f.append(...kids.flat().filter(Boolean)); return f; };

  /* ── Numbers / strings ── */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const uid   = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const pad2  = (n) => String(n).padStart(2, '0');
  const esc   = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const bytes = (n) => {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  };

  const dtf = {
    time:  (d = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    dateS: (d = new Date()) => `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`,
    dateL: (d = new Date()) => d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
    dtS:   (d = new Date()) => `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    ago:   (ts) => {
      const s = (Date.now() - ts) / 1000;
      if (s < 60) return 'たった今';
      if (s < 3600) return `${Math.floor(s / 60)}分前`;
      if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
      return `${Math.floor(s / 86400)}日前`;
    }
  };

  /* ── Colors ── */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return { r: parseInt(f.slice(0, 2), 16), g: parseInt(f.slice(2, 4), 16), b: parseInt(f.slice(4, 6), 16) };
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const r = Math.round(lerp(A.r, B.r, t)), g = Math.round(lerp(A.g, B.g, t)), bl = Math.round(lerp(A.b, B.b, t));
    return '#' + [r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const luminance = (hex) => { const { r, g, b } = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

  /* ── Misc ── */
  const sleep  = (ms) => new Promise(r => setTimeout(r, ms));
  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const isTouch = matchMedia('(pointer: coarse)').matches;

  function download(name, content, type = 'text/plain') {
    const b = new Blob([content], { type });
    const u = URL.createObjectURL(b);
    const a = el('a', { href: u, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }

  /* ── Tiny event bus ── */
  const bus = (() => {
    const map = new Map();
    return {
      on(ev, fn) {
        if (!map.has(ev)) map.set(ev, new Set());
        map.get(ev).add(fn);
        return () => map.get(ev)?.delete(fn);
      },
      off(ev, fn) { map.get(ev)?.delete(fn); },
      emit(ev, ...args) { map.get(ev)?.forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } }); }
    };
  })();

  /* ── Pointer drag helper ── */
  function drag(startEvt, { onMove, onEnd, cursor } = {}) {
    startEvt.preventDefault?.();
    const sx = startEvt.clientX, sy = startEvt.clientY;
    const prevCursor = document.body.style.cursor;
    const prevSel = document.body.style.userSelect;
    if (cursor) document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    const move = (e) => onMove && onMove(e.clientX - sx, e.clientY - sy, e);
    let live = true;
    const cleanup = () => {
      if (!live) return false;
      live = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
      document.removeEventListener('visibilitychange', onHidden);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSel;
      return true;
    };
    const up = (e) => {
      if (!cleanup()) return;
      onEnd && onEnd((e.clientX || 0) - sx, (e.clientY || 0) - sy, e);
    };
    // A drag aborted by losing focus (Alt+Tab, window switch, pointer released
    // outside the page) must not leave listeners or text selection disabled.
    const onHidden = () => { if (document.hidden) up({ clientX: sx, clientY: sy }); };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    document.addEventListener('visibilitychange', onHidden);
  }

  OS.util = { $, $$, el, frag, clamp, lerp, uid, pad2, esc, bytes, dtf, hexToRgb, mix, luminance, sleep, debounce, raf, clone, isMac, isTouch, download, drag, bus };
})(window.OS);
