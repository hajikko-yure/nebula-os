/* ═══════════════════════════════════════════════════════════
   Nebula OS — launcher / start menu
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el, $, $$, bus, debounce } = OS.util;
  const { icons, store, fs, wm } = OS;

  const root = () => $('#startMenu');
  let open = false;
  let pinned = ['files', 'terminal', 'notepad', 'browser', 'music', 'photos', 'weather', 'calculator', 'minesweeper', 'mail', 'clock', 'settings'];
  try { const s = JSON.parse(localStorage.getItem('nebula.pinned') || 'null'); if (Array.isArray(s) && s.length) pinned = s; } catch (_) {}
  const savePinned = () => { try { localStorage.setItem('nebula.pinned', JSON.stringify(pinned)); } catch (_) {} };

  let recents = [];
  try { recents = JSON.parse(localStorage.getItem('nebula.recents') || '[]'); } catch (_) {}
  const pushRecent = (entry) => {
    recents = [entry, ...recents.filter(r => r.path !== entry.path)].slice(0, 6);
    try { localStorage.setItem('nebula.recents', JSON.stringify(recents)); } catch (_) {}
  };
  OS.pushRecent = pushRecent;

  function greet() {
    const h = new Date().getHours();
    const word = h < 5 ? 'お疲れさまです' : h < 11 ? 'おはようございます' : h < 17 ? 'こんにちは' : 'こんばんは';
    const name = store.get('userName');
    $('#greetName').textContent = name;
    $('#greetSub').textContent = `${word} — Nebula OS`;
    $('#footName').textContent = name;
    $('#lockName').textContent = name;
    const ini = (name || 'U').trim().charAt(0).toUpperCase();
    ['#startAvatar', '#footAvatar', '#lockAvatar'].forEach(s => { const n = $(s); if (n) n.textContent = ini; });
  }

  /* ── grids ── */
  function tile(app) {
    const t = el('button', { class: 'app-tile', title: app.description || app.name },
      (() => { const a = el('div', { class: 'art', style: { '--at': app.accent[0], '--at2': app.accent[1] }, dataset: { icon: app.icon } }); return a; })(),
      el('span', { text: app.name })
    );
    t.addEventListener('click', () => { close(); wm.open(app); });
    t.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      OS.ctx.show(e.clientX, e.clientY, [
        { label: '開く', icon: 'external', onClick: () => { close(); wm.open(app); } },
        { label: pinned.includes(app.id) ? 'ピン留めを外す' : 'ピン留めに追加', icon: 'pin',
          onClick: () => { pinned = pinned.includes(app.id) ? pinned.filter(x => x !== app.id) : [...pinned, app.id]; savePinned(); renderPinned(); } }
      ]);
    });
    icons.paint(t);
    return t;
  }

  function renderPinned() {
    const g = $('#pinnedGrid');
    g.innerHTML = '';
    pinned.map(id => OS.apps.get(id)).filter(Boolean).forEach(a => g.append(tile(a)));
  }

  function renderAll() {
    const g = $('#allAppsGrid');
    g.innerHTML = '';
    OS.apps.all().forEach(a => g.append(tile(a)));
  }

  function renderRecents() {
    const box = $('#recentList');
    box.innerHTML = '';
    if (!recents.length) {
      box.append(el('div', { class: 'empty', style: { padding: '24px', textAlign: 'center', color: 'var(--txt-3)', fontSize: '12.5px' }, text: 'まだ項目がありません' }));
      return;
    }
    recents.forEach(r => {
      const app = OS.apps.get(r.app) || { icon: 'file', accent: ['#8b7dff', '#5ad6ff'] };
      const row = el('button', { class: 'recent-row' },
        (() => { const a = el('div', { class: 'art', style: { background: `linear-gradient(150deg,${app.accent[0]},${app.accent[1]})` }, dataset: { icon: app.icon } }); return a; })(),
        el('div', { class: 'meta' },
          el('b', { text: r.name }),
          el('small', { text: r.sub || r.path })
        ),
        el('span', { class: 'tiny dim', text: OS.util.dtf.ago(r.at) })
      );
      icons.paint(row);
      row.addEventListener('click', () => { close(); OS.files.openPath(r.path); });
      box.append(row);
    });
  }

  function renderFiles(query) {
    const box = $('#startFilesList');
    box.innerHTML = '';
    const res = query ? fs.search(query) : fs.list('Home').map(n => ({ node: n, path: 'Home/' + n.name }));
    if (!res.length) { box.append(el('div', { class: 'empty', text: '一致するファイルはありません' })); return; }
    res.slice(0, 40).forEach(({ node, path }) => {
      const row = el('button', { class: 'recent-row' },
        (() => { const a = el('div', { class: 'art', style: { background: node.type === 'dir' ? 'linear-gradient(150deg,#f0b429,#e08a2e)' : 'linear-gradient(150deg,#8b7dff,#5ad6ff)' }, dataset: { icon: node.type === 'dir' ? 'folder' : (OS.files?.iconFor(node.name) || 'file') } }); return a; })(),
        el('div', { class: 'meta' }, el('b', { text: node.name }), el('small', { text: path }))
      );
      icons.paint(row);
      row.addEventListener('click', () => { close(); OS.files.openPath(path); });
      box.append(row);
    });
  }

  /* ── search ── */
  function onSearch(q) {
    q = q.trim();
    $('#startSearchClear').hidden = !q;
    if (!q) {
      switchTab('pinned');
      renderFiles('');
      return;
    }
    // fuzzy app match
    const lq = q.toLowerCase();
    const hits = OS.apps.all().filter(a => a.name.toLowerCase().includes(lq) || a.id.includes(lq));
    const g = $('#allAppsGrid');
    g.innerHTML = '';
    hits.forEach(a => g.append(tile(a)));
    document.querySelectorAll('.start-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === 'all'));
    document.querySelectorAll('.start-panel-page').forEach(p => p.classList.toggle('is-active', p.dataset.page === 'all'));
    renderFiles(q);
  }

  function switchTab(name) {
    document.querySelectorAll('.start-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
    document.querySelectorAll('.start-panel-page').forEach(p => p.classList.toggle('is-active', p.dataset.page === name));
    if (name === 'files') renderFiles($('#startSearch').value.trim());
  }

  /* ── open/close ── */
  function show() {
    if (open) return;
    open = true;
    greet();
    renderPinned(); renderAll(); renderRecents(); renderFiles('');
    const m = root();
    m.classList.remove('is-closing');
    m.hidden = false;
    setTimeout(() => $('#startSearch').focus(), 90);
    bus.emit('launcher', true);
  }
  function close() {
    if (!open) return;
    open = false;
    const m = root();
    m.classList.add('is-closing');
    $('#startSearch').value = '';
    $('#startSearchClear').hidden = true;
    setTimeout(() => { m.hidden = true; m.classList.remove('is-closing'); }, 180);
    bus.emit('launcher', false);
  }
  function toggle() { open ? close() : show(); }

  /* ── init ── */
  function init() {
    document.querySelectorAll('.start-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    $('#startSearch').addEventListener('input', debounce(e => onSearch(e.target.value), 120));
    $('#startSearchClear').addEventListener('click', () => { $('#startSearch').value = ''; onSearch(''); });
    $('[data-close-start]').addEventListener('click', close);
    $('#pinRandom').addEventListener('click', () => {
      pinned = pinned.slice().sort(() => Math.random() - 0.5);
      savePinned(); renderPinned();
    });
    $('#btnBackup')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!OS.backup) return;
      const i = await OS.notify.sheet('バックアップ', [
        { label: '現在の状態をダウンロード', icon: 'download' },
        { label: 'バックアップから復元', icon: 'upload' },
        { label: '設定だけを復元', icon: 'palette' }
      ]);
      close();
      if (i === -1) return;
      if (i === 0) {
        try {
          const res = OS.backup.download();
          OS.notify.notify({ title: 'バックアップを作成しました', body: `${res.name}（${res.summary.files} ファイル）` });
        } catch (err) { OS.notify.alert('バックアップに失敗しました', String(err && err.message || err)); }
      } else {
        OS.apps.open('settings', { arg: 'backup' });
      }
    });
    $('#btnLock').addEventListener('click', () => { close(); OS.session.lock(); });
    $('#btnRestart').addEventListener('click', () => { close(); OS.session.restart(); });
    $('#btnPower').addEventListener('click', async (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const i = await OS.notify.sheet('電源', [
        { label: 'スリープ', icon: 'moon' },
        { label: '再起動', icon: 'refresh' },
        { label: '強制シャットダウン', icon: 'power', danger: true }
      ]);
      close();
      if (i === 0) OS.session.sleep();
      if (i === 1) OS.session.restart();
      if (i === 2) OS.session.shutdown();
    });
    $('#footUser').addEventListener('click', () => { close(); OS.apps.open('settings', { arg: 'account' }); });

    // keyboard nav inside search
    $('#startSearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = $('#allAppsGrid .app-tile') || $('#startFilesList .recent-row');
        first?.click();
      }
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });

    bus.on('fs:change', () => { if (open) { renderRecents(); renderFiles($('#startSearch').value.trim()); } });
    bus.on('settings:userName', greet);
    // Paint the saved name immediately: without this the lock screen keeps the
    // placeholder from index.html until the launcher is opened for the first time.
    greet();
  }

  OS.launcher = { init, show, close, toggle, get isOpen() { return open; }, switchTab, pushRecent, greet };
})(window.OS);
