/* Nebula OS — desktop surface (icons, selection, context menu) */
(function (OS) {
  'use strict';
  const { el, $, $$, bus, drag, clamp } = OS.util;
  const { icons, store, fs, ctx } = OS;

  const DESK = 'Home/Desktop';
  let selected = new Set();

  const SYSTEM = [
    { key: 'sys:files', name: 'マイ パソコン', icon: 'hardDrive', accent: ['#5ad6ff', '#3b82f6'], run: () => OS.apps.open('files', { arg: 'Home' }) },
    { key: 'sys:home',  name: 'ホーム',         icon: 'home',       accent: ['#8b7dff', '#5ad6ff'], run: () => OS.apps.open('files', { arg: 'Home' }) },
    { key: 'sys:term',  name: 'ターミナル',     icon: 'terminal',   accent: ['#1f2937', '#4b5563'], run: () => OS.apps.open('terminal') },
    { key: 'sys:trash', name: 'ゴミ箱',         icon: 'trash',      accent: ['#64748b', '#334155'], run: () => OS.apps.open('files', { arg: 'Home/Desktop/.Trash' }) }
  ];

  function userItems() {
    return fs.list(DESK).map(n => ({
      key: 'fs:' + n.name,
      name: n.name,
      node: n,
      icon: n.type === 'dir' ? 'folder' : OS.files?.iconFor(n.name) || 'file',
      accent: n.type === 'dir' ? ['#f0b429', '#e08a2e'] : ['#8b7dff', '#5ad6ff'],
      run: () => OS.files.openNode(DESK + '/' + n.name, n)
    }));
  }

  function items() { return [...SYSTEM, ...userItems()]; }

  /* ── render ── */
  function render() {
    const layer = $('#iconLayer');
    const scroll = layer.parentElement.scrollTop;
    layer.innerHTML = '';
    selected = new Set([...selected].filter(k => items().some(i => i.key === k)));

    for (const it of items()) {
      const node = el('div', {
        class: 'dicon' + (selected.has(it.key) ? ' is-sel' : ''),
        role: 'listitem', tabindex: '0', dataset: { key: it.key }
      },
        el('div', { class: 'dicon-art', style: { background: `linear-gradient(150deg, ${it.accent[0]}, ${it.accent[1]})` }, dataset: { icon: it.icon } }),
        el('div', { class: 'dicon-label', text: it.name })
      );
      icons.paint(node);
      node.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) select(new Set([it.key]));
        else toggle(it.key);
      });
      node.addEventListener('dblclick', () => it.run());
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter') it.run(); });
      node.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!selected.has(it.key)) select(new Set([it.key]));
        itemMenu(e, it);
      });
      layer.append(node);
    }
    layer.parentElement.scrollTop = scroll;
  }

  function select(keys) { selected = keys; $$('#iconLayer .dicon').forEach(n => n.classList.toggle('is-sel', selected.has(n.dataset.key))); }
  function toggle(k) { selected.has(k) ? selected.delete(k) : selected.add(k); select(selected); }

  /* ── marquee ── */
  function startMarquee(e) {
    if (e.button !== 0 || e.target.closest('.dicon')) return;
    if (!e.ctrlKey && !e.metaKey) select(new Set());
    const m = $('#marquee');
    const ox = e.clientX, oy = e.clientY;
    m.hidden = false;
    drag(e, {
      onMove: (dx, dy) => {
        const x = Math.min(ox, ox + dx), y = Math.min(oy, oy + dy);
        const w = Math.abs(dx), h = Math.abs(dy);
        Object.assign(m.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
        const box = m.getBoundingClientRect();
        const keys = new Set();
        $$('#iconLayer .dicon').forEach(n => {
          const r = n.getBoundingClientRect();
          const hit = r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top;
          n.classList.toggle('is-sel', hit);
          if (hit) keys.add(n.dataset.key);
        });
        selected = keys;
      },
      onEnd: () => { m.hidden = true; m.style.width = m.style.height = '0px'; }
    });
  }

  /* ── context menus ── */
  function itemMenu(e, it) {
    const isFs = it.key.startsWith('fs:');
    ctx.show(e.clientX, e.clientY, [
      { label: '開く', icon: 'external', onClick: () => it.run() },
      isFs && it.node.type === 'file' ? { label: 'エディタで開く', icon: 'edit', onClick: () => OS.apps.open('notepad', { arg: DESK + '/' + it.name }) } : null,
      '-',
      isFs ? { label: '名前を変更', icon: 'edit', key: 'F2', onClick: () => renameFlow(it) } : null,
      isFs ? { label: '複製', icon: 'copy', onClick: () => { fs.copy(DESK + '/' + it.name, DESK); render(); } } : null,
      isFs ? { label: '名前を変更…', icon: 'trash', danger: true, onClick: () => removeFlow(it) } : null,
      '-',
      { label: 'プロパティ', icon: 'info', onClick: () => propsFlow(it) }
    ].filter(Boolean));
  }

  function desktopMenu(e) {
    const wallRow = OS.wallpaper.LIST.map(w => ({
      label: w.name, active: OS.wallpaper.active === w.id,
      onClick: () => { store.set('wallpaper', w.id); OS.wallpaper.repaint(); }
    }));
    ctx.show(e.clientX, e.clientY, [
      { type: 'row', items: wallRow.slice(0, 3) },
      { type: 'row', items: wallRow.slice(3) },
      '-',
      { label: '新規フォルダ', icon: 'folder', onClick: async () => { const n = await OS.notify.prompt('新規フォルダ', 'フォルダ名を入力', '新しいフォルダ'); if (n) { fs.mkdir(DESK + '/' + n); render(); } } },
      { label: '新規テキストファイル', icon: 'fileText', onClick: async () => { const n = await OS.notify.prompt('新規ファイル', 'ファイル名を入力', 'untitled.txt'); if (n) { fs.writeFile(DESK + '/' + n, ''); render(); } } },
      { label: '設定を開く', icon: 'sliders', onClick: () => OS.apps.open('settings') },
      '-',
      { label: 'アイコンを整理', icon: 'grid', onClick: () => OS.notify.notify({ title: '整列しました', body: 'デスクトップのアイコンをグリッドに整列しました。' }) },
      { label: '更新', icon: 'refresh', onClick: () => render() },
      '-',
      { label: 'このシステムについて', icon: 'info', onClick: () => OS.apps.open('settings', { arg: 'about' }) }
    ]);
  }

  async function renameFlow(it) {
    const n = await OS.notify.prompt('名前を変更', '', it.name);
    if (n) { fs.rename(DESK + '/' + it.name, n); render(); }
  }
  async function removeFlow(it) {
      if (await OS.notify.confirm('削除しますか？', `「${it.name}」を完全に削除します。この操作は取り消せません。`, '削除')) {
      fs.remove(DESK + '/' + it.name);
      render();
    }
  }
  function propsFlow(it) {
    const n = it.node;
    if (!n) return OS.notify.alert('プロパティ', `${it.name}\n種類: システム項目`);
    OS.notify.alert('プロパティ',
      `名前: ${n.name}\n種類: ${n.type === 'dir' ? 'フォルダ' : 'ファイル'}\nサイズ: ${OS.util.bytes(fs.size(n))}\n作成: ${OS.util.dtf.dtS(n.created)}\n更新: ${OS.util.dtf.dtS(n.modified)}`);
  }

  /* ── init ── */
  function init() {
    const desk = $('#desktop');
    desk.addEventListener('pointerdown', startMarquee);
    desk.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.dicon')) return;
      e.preventDefault();
      desktopMenu(e);
    });
    bus.on('fs:change', OS.util.debounce(render, 60));
    bus.on('wm:change', () => {});
    render();
  }

  OS.desktop = { init, render, DESK, get selected() { return [...selected]; } };
})(window.OS);
