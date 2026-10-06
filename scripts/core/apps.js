/* Nebula OS — application registry */
(function (OS) {
  'use strict';
  const { bus } = OS.util;
  const registry = new Map();

  OS.apps = {
    register(app) {
      registry.set(app.id, app);
      bus.emit('apps:changed');
    },
    get: (id) => registry.get(id),
    has: (id) => registry.has(id),
    all: () => [...registry.values()],
    search(q) {
      const s = q.toLowerCase().trim();
      if (!s) return [];
      return [...registry.values()].filter(a =>
        a.name.toLowerCase().includes(s) ||
        a.id.includes(s) ||
        (a.keywords || '').toLowerCase().includes(s));
    },
    open(id, opts) {
      const a = registry.get(id);
      if (!a) { console.warn('unknown app', id); return null; }
      return OS.wm.open(a, opts);
    }
  };
})(window.OS);
