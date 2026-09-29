/* ═══════════════════════════════════════════════════════════
   Nebula OS — settings store
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { bus } = OS.util;
  const KEY = 'nebula.settings.v1';

  const DEFAULTS = {
    theme: 'dark',            // dark | light
    accent: '#8b7dff',
    accent2: '#ff7ad9',
    accent3: '#5ad6ff',
    wallpaper: 'aurora',
    blur: 34,                 // px
    opacity: 62,              // %
    radius: 16,
    dockScale: 1,
    animations: true,
    glassEffects: true,
    dockAutohide: false,
    dockMagnify: true,
    wallpaperSync: true,
    userName: 'ユーザー',
    sound: true,
    volume: 70,
    iconSize: 96,
    doubleClickToOpen: true,
    showHidden: false,
    reduceTransparency: false
  };

  let state = { ...DEFAULTS };

  /**
   * Only accept a stored value that matches the default's type, and for numbers
   * clamp into the default's plausible range. A hand-edited or corrupted blob
   * must not be able to inject arbitrary values into the UI.
   */
  function coerce(key, v) {
    const d = DEFAULTS[key];
    if (typeof d === 'boolean') return typeof v === 'boolean' ? v : d;
    if (typeof d === 'number') {
      if (typeof v !== 'number' || !isFinite(v)) return d;
      return Math.max(0, Math.min(1000, v));
    }
    if (typeof d === 'string') {
      if (typeof v !== 'string') return d;
      // Colours must look like colours; they are interpolated into CSS.
      if (key.startsWith('accent') && !/^#[0-9a-fA-F]{3,8}$/.test(v)) return d;
      if (key === 'theme' && v !== 'dark' && v !== 'light') return d;
      if (key === 'wallpaper' && !/^[a-z0-9-]{1,32}$/i.test(v)) return d;
      return v.length > 256 ? d : v;
    }
    return d;
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const k of Object.keys(DEFAULTS)) {
          if (k in parsed) state[k] = coerce(k, parsed[k]);
        }
      }
    }
  } catch (_) { /* private mode or corrupt blob — run with defaults */ }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
    }, 160);
  }
  function flush() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  function get(k) { return state[k]; }
  function all() { return { ...state }; }

  function set(k, v) {
    if (k in DEFAULTS) v = coerce(k, v);
    if (state[k] === v) return;
    const prev = state[k];
    state[k] = v;
    persist();
    bus.emit('settings', k, v, prev);
    bus.emit('settings:' + k, v, prev);
  }
  function patch(obj) { for (const [k, v] of Object.entries(obj)) set(k, v); }

  function reset() {
    const prev = { ...state };
    state = { ...DEFAULTS };
    persist();
    // Emit per-key events so subscribers (taskbar volume, launcher greeting)
    // actually re-render instead of keeping stale values.
    for (const k of Object.keys(DEFAULTS)) bus.emit('settings:' + k, state[k], prev[k]);
    bus.emit('settings', '*', null, null);
  }

  /**
   * Replace the live settings (used by backup restore). Cancels the pending
   * debounced write so the pre-restore values cannot be flushed back over.
   */
  function adopt(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('設定の形式が不正です。');
    const prev = { ...state };
    state = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) if (k in obj) state[k] = coerce(k, obj[k]);
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
    for (const k of Object.keys(DEFAULTS)) bus.emit('settings:' + k, state[k], prev[k]);
    bus.emit('settings', '*', null, null);
    return { ...state };
  }

  OS.store = { get, set, all, patch, reset, flush, adopt, DEFAULTS };
})(window.OS);
