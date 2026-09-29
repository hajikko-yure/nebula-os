/* ═══════════════════════════════════════════════════════════
   Nebula OS — virtual file system (persisted in localStorage)
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { bus, uid } = OS.util;
  const KEY = 'nebula.fs.v1';

  /* node: { id, name, type:'dir'|'file', children?:[node], content?:string, kind, created, modified, hidden } */

  function dir(name, children = [], extra = {}) {
    return { id: uid('d'), name, type: 'dir', children, created: Date.now(), modified: Date.now(), ...extra };
  }
  function file(name, content = '', kind = 'txt', extra = {}) {
    return { id: uid('f'), name, type: 'file', content, kind, created: Date.now(), modified: Date.now(), ...extra };
  }

  function seed() {
    const readme = file('README.txt',
`Welcome to Nebula OS
====================

You are running a complete desktop environment inside a browser tab.
Everything here is real: a window manager, a virtual file system,
a shell, and a dozen applications.

Try this first
--------------
  1. Double-click the Terminal icon and run  neofetch
  2. Right-click the desktop to change the wallpaper
  3. Drag a window to the top edge to snap it
  4. Press  Super  to open the launcher
  5. Press  Alt+Tab  to switch windows
  6. Open Settings -> Appearance and make it yours

Your files live in this browser. Nothing is uploaded anywhere.
`, 'txt');

    const poem = file('notes.txt',
`things worth remembering
------------------------
- small steps, taken daily
- a good tool disappears while you use it
- rest is part of the work
- ship it, then make it better
`, 'txt');

    const snippet = file('hello.js',
`// Nebula OS app manifest example
export const app = {
  id: 'hello',
  title: 'Hello',
  icon: 'sparkles',
  accent: ['#8b7dff', '#ff7ad9'],
  width: 420,
  height: 300,
  mount(root, win) {
    root.innerHTML = '<h1>Hello, Nebula.</h1>';
  }
};
`, 'js');

    const budget = file('budget.csv',
`month,category,planned,actual
2026-01,housing,120000,120000
2026-01,food,38000,41250
2026-01,transport,9000,7400
2026-02,housing,120000,120000
2026-02,food,38000,0
`, 'csv');

    const track = file('lofi-loop.json',
`{ "bpm": 84, "key": "F#m", "mood": "rain on glass", "length": "3:12" }
`, 'json');

    const dotfiles = dir('.config', [
      file('appearance.json', '{ "theme": "dark", "wallpaper": "aurora" }\n', 'json'),
      file('hotkeys.conf', 'super=launcher\nalt+tab=switcher\nsuper+e=files\nsuper+t=terminal\n', 'txt')
    ]);

    const projects = [
      dir('nebula', [snippet, file('README.md', '# Nebula\n\nThe OS itself.\n', 'md')]),
      dir('sketches', [file('gradient.js', '// gradient experiments\n', 'js')])
    ];

    const media = [
      file('wallpaper-notes.txt', 'aurora → canvas noise field, 3 octaves\n', 'txt'),
      file('palette.json', '{\n  "accent": "#8b7dff",\n  "pink": "#ff7ad9",\n  "cyan": "#5ad6ff"\n}\n', 'json')
    ];

    return dir('Home', [
      dir('Desktop', []),
      dir('Documents', [readme, poem, budget, dotfiles]),
      dir('Pictures', []),
      dir('Music', [track]),
      dir('Downloads', []),
      dir('Projects', projects),
      dir('Media', media)
    ]);
  }

  let root = null;
  try {
    const raw = localStorage.getItem(KEY);
    root = raw ? JSON.parse(raw) : seed();
    if (!validNode(root)) root = seed();
  } catch (_) { root = seed(); }

  /** Reject blobs that parse as JSON but are not a usable tree. */
  function validNode(n, depth = 0) {
    if (!n || typeof n !== 'object' || depth > 64) return false;
    if (typeof n.name !== 'string') return false;
    if (n.type === 'file') return typeof n.content === 'string';
    if (n.type !== 'dir' || !Array.isArray(n.children)) return false;
    return n.children.every(c => validNode(c, depth + 1));
  }

  let saveTimer = null;
  let saveError = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(root));
        if (saveError) { saveError = null; bus.emit('fs:saved'); }
      } catch (e) {
        // The whole filesystem is one blob, so a failed write silently rolls
        // back every change since the last successful save. Tell someone.
        if (!saveError) { saveError = e; bus.emit('fs:error', e); }
      }
    }, 200);
  }
  const changed = () => { persist(); bus.emit('fs:change'); };

  /* ── Path helpers ── */
  const norm = (p) => {
    if (!p) return [];
    return String(p).split('/').filter(s => s && s !== '.' && s !== '..');
  };
  const join = (...parts) => norm(parts.join('/')).join('/');
  const parentPath = (p) => { const s = norm(p); s.pop(); return s.join('/'); };
  const baseName  = (p) => norm(p).pop() || '';
  const extOf     = (n) => { const m = /\.([a-z0-9]+)$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
  const stemOf    = (n) => (n || '').replace(/\.[^.]+$/, '');

  /** Canonical path of a node, relative to the root (used for identity tests). */
  function pathOf(node) {
    if (!node || node === root) return '';
    const segs = [];
    let cur = node, guard = 0;
    while (cur && cur !== root && guard++ < 512) {
      const p = parentOf(cur);
      if (!p) return null;
      segs.unshift(cur.name);
      cur = p;
    }
    return cur === root ? segs.join('/') : null;
  }
  function parentOf(node) {
    let found = null;
    (function walk(n) {
      if (found || !n || !Array.isArray(n.children)) return;
      if (n.children.includes(node)) { found = n; return; }
      for (const c of n.children) walk(c);
    })(root);
    return found;
  }
  /** True when `anc` is the same node as, or an ancestor of, `node`. */
  function contains(anc, node) {
    let cur = node, guard = 0;
    while (cur && guard++ < 512) {
      if (cur === anc) return true;
      cur = parentOf(cur);
    }
    return false;
  }

  function nodeAt(p) {
    const segs = norm(p);
    // the root node is itself "Home", so an explicit leading "Home" is optional
    let start = 0;
    if (segs.length && root && segs[0].toLowerCase() === String(root.name).toLowerCase()) start = 1;
    let cur = root;
    for (let i = start; i < segs.length; i++) {
      if (!cur || cur.type !== 'dir' || !Array.isArray(cur.children)) return null;
      const next = cur.children.find(c => c.name.toLowerCase() === segs[i].toLowerCase());
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  const exists = (p) => !!nodeAt(p);
  const isDir  = (p) => nodeAt(p)?.type === 'dir';

  function list(p) {
    const n = nodeAt(p);
    if (!n || n.type !== 'dir' || !Array.isArray(n.children)) return [];
    return n.children.slice().sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ja', { numeric: true });
    });
  }

  function uniqueName(parentPath, name) {
    const parent = nodeAt(parentPath);
    if (!parent) return name;
    const has = (n) => parent.children.some(c => c.name.toLowerCase() === n.toLowerCase());
    if (!has(name)) return name;
    const ext = name.includes('.') && !name.startsWith('.') ? '.' + name.split('.').pop() : '';
    const stem = ext ? name.slice(0, -ext.length) : name;
    let i = 2;
    while (has(`${stem} ${i}${ext}`)) i++;
    return `${stem} ${i}${ext}`;
  }

  function mkdir(p, opts = {}) {
    const pp = parentPath(p) || '';
    const parent = nodeAt(pp);
    if (!parent || parent.type !== 'dir') throw new Error('親フォルダがありません: ' + pp);
    const name = uniqueName(pp, baseName(p) || '新しいフォルダ');
    const node = dir(name, [], opts);
    parent.children.push(node);
    parent.modified = Date.now();
    changed();
    return node;
  }

  function writeFile(p, content, opts = {}) {
    const pp = parentPath(p) || '';
    const parent = nodeAt(pp);
    if (!parent || parent.type !== 'dir') throw new Error('親フォルダがありません: ' + pp);
    const existing = nodeAt(p);
    if (existing && existing.type === 'dir') throw new Error('フォルダには書き込めません: ' + baseName(p));
    const name = existing ? existing.name : uniqueName(pp, baseName(p));
    if (existing) {
      existing.content = content;
      existing.modified = Date.now();
      if (opts.kind) existing.kind = opts.kind;
      changed();
      return existing;
    }
    const node = file(name, content, opts.kind || extOf(name) || 'txt', opts);
    parent.children.push(node);
    parent.modified = Date.now();
    changed();
    return node;
  }

  function read(p) {
    const n = nodeAt(p);
    return n && n.type === 'file' ? n.content : null;
  }

  function remove(p) {
    const pp = parentPath(p);
    const parent = nodeAt(pp);
    if (!parent || !parent.children) return false;
    const i = parent.children.findIndex(c => c.name.toLowerCase() === baseName(p).toLowerCase());
    if (i < 0) return false;
    parent.children.splice(i, 1);
    parent.modified = Date.now();
    changed();
    return true;
  }

  function rename(p, newName) {
    const n = nodeAt(p);
    const pp = parentPath(p);
    if (!n) return null;
    const target = nodeAt(pp);
    if (!target) return null;
    // A name containing a separator or an empty name would produce a node that
    // no path can ever address again.
    newName = String(newName == null ? '' : newName).trim();
    if (!newName || newName.includes('/') || newName === '.' || newName === '..') return null;
    if (n === root) return null;
    if (target.children.some(c => c !== n && c.name.toLowerCase() === newName.toLowerCase())) {
      newName = uniqueName(pp, newName);
    }
    n.name = newName;
    n.modified = Date.now();
    changed();
    return n;
  }

  function move(from, toDir) {
    const n = nodeAt(from);
    const dest = nodeAt(toDir);
    if (!n || !dest || dest.type !== 'dir') return false;
    if (n === root) return false;                            // never move the root itself
    // Compare nodes, not path strings: "Documents" and "Home/Documents" are the
    // same node, and a raw string check would let it be moved into itself.
    if (contains(n, dest)) return false;                     // no cycles
    if (parentOf(n) === dest) return false;                  // already here
    const holder = parentOf(n);
    if (!holder) return false;
    holder.children.splice(holder.children.indexOf(n), 1);
    n.name = uniqueName(toDir, n.name);
    dest.children.push(n);
    dest.modified = Date.now();
    changed();
    return true;
  }

  function copy(from, toDir) {
    const n = nodeAt(from);
    const dest = nodeAt(toDir);
    if (!n || !dest || dest.type !== 'dir') return false;
    if (contains(n, dest)) return false;                     // no copying into itself
    // Deep clone, then re-id every descendant so ids stay unique.
    const clone = JSON.parse(JSON.stringify(n));
    (function reid(node, isRoot) {
      node.id = uid(node.type === 'dir' ? 'd' : 'f');
      if (Array.isArray(node.children)) node.children.forEach(c => reid(c, false));
    })(clone, true);
    clone.name = uniqueName(toDir, clone.name);
    dest.children.push(clone);
    dest.modified = Date.now();
    changed();
    return true;
  }

  /** Depth-first search returning [{node, path}] */
  function search(query, from = '') {
    const q = String(query == null ? '' : query).toLowerCase().trim();
    const out = [];
    if (!q) return out;
    // `from` is a starting hint, but results are labelled with the real path so
    // they always resolve through openPath().
    const startNode = from ? nodeAt(from) : root;
    if (!startNode || startNode.type !== 'dir') return out;
    // Label results with their real path so they always resolve via openPath().
    const base = startNode === root ? '' : (pathOf(startNode) || '');
    (function walk(n, path) {
      if (!n || !Array.isArray(n.children)) return;
      for (const c of n.children) {
        const cp = path ? path + '/' + c.name : c.name;
        if (c.name.toLowerCase().includes(q)) out.push({ node: c, path: cp });
        if (c.type === 'dir') walk(c, cp);
      }
    })(startNode, base);
    return out.slice(0, 60);
  }

  function size(n) {
    if (!n) return 0;
    if (n.type === 'file') return (n.content || '').length + 128;
    if (!Array.isArray(n.children)) return 0;
    return n.children.reduce((s, c) => s + size(c), 0);
  }

  function stats() {
    let files = 0, dirs = 0, bytesTotal = 0;
    (function walk(n) {
      if (!n || !Array.isArray(n.children)) return;
      for (const c of n.children) {
        if (c.type === 'dir') { dirs++; walk(c); } else { files++; bytesTotal += size(c); }
      }
    })(root);
    return { files, dirs, bytes: bytesTotal };
  }

  function uniqueNameSafe(p) { return uniqueName(parentPath(p), baseName(p)); }

  /**
   * Replace the live tree (used by backup restore). This must go through the
   * in-memory root, not just localStorage: a pending debounced save would
   * otherwise write the old tree back over the restored one.
   */
  function adopt(node) {
    if (!validNode(node)) throw new Error('ファイルシステムの構造が不正です。');
    clearTimeout(saveTimer);
    saveTimer = null;
    root = node;
    saveError = null;
    try { localStorage.setItem(KEY, JSON.stringify(root)); } catch (_) {}
    bus.emit('fs:change');
    bus.emit('fs:replaced');
    return root;
  }

  // A pending debounced write would otherwise be lost on reload.
  function flush() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(KEY, JSON.stringify(root)); saveError = null; } catch (_) {}
  }
  addEventListener('pagehide', flush);
  addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  OS.fs = {
    get root() { return root; },
    get saveError() { return saveError; },
    norm, join, parentPath, baseName, extOf, stemOf, pathOf, contains,
    nodeAt, exists, isDir, list, mkdir, writeFile, read, remove, rename, move, copy, search, size, stats,
    dir, file, uniqueName: uniqueNameSafe, persist, flush, adopt, validNode,
    reset() { root = seed(); changed(); }
  };
})(window.OS);
