/* ═══════════════════════════════════════════════════════════
   App: Files
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el, $, $$, bus, dtf, bytes, esc } = OS.util;
  const { icons, fs, ctx, wm, notify, store } = OS;

  const EXT_ICON = {
    txt: 'fileText', md: 'fileText', log: 'fileText',
    js: 'fileCode', ts: 'fileCode', json: 'fileCode', html: 'fileCode', css: 'fileCode', conf: 'fileCode',
    csv: 'grid', pdf: 'file', png: 'image', jpg: 'image', svg: 'image', webp: 'image',
    mp3: 'music', wav: 'music', flac: 'music',
    zip: 'hardDrive', tar: 'hardDrive', gz: 'hardDrive'
  };
  const iconFor = (name) => (EXT_ICON[(fs.extOf(name))] || (fs.extOf(name) ? 'file' : 'fileText'));

  const PLACES = [
    { name: 'ホーム', path: 'Home', icon: 'home' },
    { name: 'デスクトップ', path: 'Home/Desktop', icon: 'monitor' },
    { name: 'ドキュメント', path: 'Home/Documents', icon: 'fileText' },
    { name: 'ダウンロード', path: 'Home/Downloads', icon: 'download' },
    { name: '画像', path: 'Home/Pictures', icon: 'image' },
    { name: '音楽', path: 'Home/Music', icon: 'music' },
    { name: 'プロジェクト', path: 'Home/Projects', icon: 'code' }
  ];

  const FILE_APP = {
    txt: 'notepad', md: 'notepad', log: 'notepad', json: 'notepad',
    js: 'notepad', ts: 'notepad', html: 'notepad', css: 'notepad', conf: 'notepad', csv: 'notepad'
  };

  function openPath(p) {
    const n = fs.nodeAt(p);
    if (!n) return notify.notify({ title: '見つかりません', body: p });
    if (n.type === 'dir') return OS.apps.open('files', { arg: p });
    return openFile(p, n);
  }
  function openFile(p, n) {
    const ext = fs.extOf(n.name);
    if (ext === 'png' || ext === 'jpg' || ext === 'svg') return OS.apps.open('photos', { arg: p });
    if (ext === 'mp3' || ext === 'wav') return OS.apps.open('music', { arg: p });
    if (ext === 'csv') return OS.apps.open('notepad', { arg: p });
    return OS.apps.open('notepad', { arg: p });
  }
  const openNode = (p, n) => (n.type === 'dir' ? OS.apps.open('files', { arg: p }) : openFile(p, n));

  /* ═════════════ app definition ═════════════ */
  const app = {
    id: 'files',
    name: 'ファイル',
    icon: 'folder',
    accent: ['#5ad6ff', '#3b82f6'],
    width: 880, height: 560, minWidth: 520, minHeight: 320,
    keywords: 'file folder explorer ファイル フォルダ',
    description: 'ファイルとフォルダを管理します。',
    mount(root, win, startPath) {
      let cwd = startPath || 'Home';
      if (!fs.isDir(cwd)) cwd = 'Home';
      const hist = [cwd];
      let hi = 0;
      // Storage can be unavailable (private mode / blocked cookies); the window
      // must still open with the default view.
      let view = 'grid';
      try { view = localStorage.getItem('nebula.files.view') || 'grid'; } catch (_) {}
      let sel = new Set();
      let query = '';

      /* ── skeleton ── */
      const side = el('div', { class: 'side' });
      const crumbs = el('div', { class: 'crumbs' });
      const backBtn = el('button', { class: 'icon-btn', title: '戻る' }, el('span', { dataset: { icon: 'chevronLeft' } }));
      const fwdBtn  = el('button', { class: 'icon-btn', title: '進む' }, el('span', { dataset: { icon: 'chevronRight' } }));
      const upBtn   = el('button', { class: 'icon-btn', title: '上へ' }, el('span', { dataset: { icon: 'chevronUp' } }));
      const newBtn  = el('button', { class: 'icon-btn', title: '新規フォルダ' }, el('span', { dataset: { icon: 'folder' } }));
      const viewBtn = el('button', { class: 'icon-btn', title: '表示形式' }, el('span', { dataset: { icon: view === 'grid' ? 'grid' : 'list' } }));
      const searchIn = el('input', { type: 'text', placeholder: 'このフォルダ内を検索', spellcheck: 'false' });
      const searchWrap = el('div', { class: 'field', style: { height: '30px', width: '190px' } },
        el('span', { class: 'field-icon', dataset: { icon: 'search' } }), searchIn);

      const toolbar = el('div', { class: 'app-toolbar' }, backBtn, fwdBtn, upBtn,
        el('div', { class: 'sep' }), crumbs, el('div', { class: 'sep' }), searchWrap, newBtn, viewBtn);

      const body = el('div', { class: 'app-body' }, side, el('div', { class: 'main' }));
      const status = el('div', { class: 'app-status' });
      root.className = 'app files';
      root.append(toolbar, body, status);

      const main = body.querySelector('.main');

      /* ── sidebar ── */
      function renderSide() {
        side.innerHTML = '';
        side.append(el('div', { class: 'side-label', text: '場所' }));
        PLACES.forEach(p => {
          if (!fs.isDir(p.path)) return;
          const b = el('button', { class: 'side-item' + (cwd === p.path ? ' is-active' : '') },
            el('span', { dataset: { icon: p.icon } }), el('span', { text: p.name }));
          b.addEventListener('click', () => go(p.path));
          side.append(b);
        });
        side.append(el('div', { class: 'side-label', text: 'システム' }));
        [['Nebula PC', 'database', 'Home'], ['メディア', 'layers', 'Home/Media'], ['コード', 'code', 'Home/Projects']]
          .forEach(([n, i, p]) => {
            if (!fs.isDir(p)) return;
            const b = el('button', { class: 'side-item' + (cwd === p ? ' is-active' : '') },
              el('span', { dataset: { icon: i } }), el('span', { text: n }));
            b.addEventListener('click', () => go(p));
            side.append(b);
          });
        const st = fs.stats();
        side.append(el('div', { class: 'side-label', text: '容量' }));
        side.append(el('div', { class: 'side-item', style: { cursor: 'default' } },
          el('span', { dataset: { icon: 'hardDrive' } }),
          el('span', { text: `${st.files} ファイル` }),
          el('span', { class: 'cnt', text: bytes(st.bytes) })));
        icons.paint(side);
      }

      /* ── breadcrumbs ── */
      function renderCrumbs() {
        crumbs.innerHTML = '';
        const segs = cwd ? cwd.split('/') : [];
        let acc = '';
        segs.forEach((s, i) => {
          acc = acc ? acc + '/' + s : s;
          const p = acc;
          if (i) crumbs.append(el('span', { class: 'crumb-sep' }, el('span', { dataset: { icon: 'chevronRight' } })));
          const b = el('button', { class: 'crumb' },
            el('span', { dataset: { icon: i === 0 ? 'home' : 'folder' } }),
            el('span', { text: s }));
          b.addEventListener('click', () => go(p));
          crumbs.append(b);
        });
        icons.paint(crumbs);
      }

      /* ── listing ── */
      function visible() {
        let list = fs.list(cwd);
        if (query) list = list.filter(n => n.name.toLowerCase().includes(query.toLowerCase()));
        return list;
      }

      function render() {
        renderSide(); renderCrumbs();
        sel = new Set([...sel].filter(k => visible().some(n => n.name === k)));
        main.innerHTML = '';
        const list = visible();

        if (!list.length) {
          main.append(el('div', { class: 'empty-state' },
            el('span', { dataset: { icon: query ? 'search' : 'folderOpen' } }),
            el('h3', { text: query ? '一致する項目がありません' : 'このフォルダは空です' }),
            el('p', { text: query ? '検索語を変えて試してください。' : '新規フォルダボタンでフォルダを作成できます。' })));
          icons.paint(main);
        } else if (view === 'grid') {
          const g = el('div', { class: 'fgrid' });
          list.forEach(n => g.append(gridItem(n)));
          main.append(g);
        } else {
          const l = el('div', { class: 'flist' });
          const head = el('div', { class: 'frow frow-head' },
            el('span'), el('span', { text: '名前' }), el('span', { text: '更新日時' }),
            el('span', { text: '種類' }), el('span', { text: 'サイズ' }));
          l.append(head);
          list.forEach(n => l.append(listRow(n)));
          main.append(l);
        }

        const selCount = sel.size;
        status.innerHTML = '';
        status.append(
          el('span', { text: `${list.length} 個の項目${selCount ? ` — ${selCount} 個を選択` : ''}` }),
          el('span', { class: 'spacer' }),
          el('span', { text: cwd || '/' })
        );
        icons.paint(status);
        backBtn.disabled = hi === 0; fwdBtn.disabled = hi >= hist.length - 1;
        win.setSub(cwd || '/');
        win.setTitle('ファイル — ' + (fs.baseName(cwd) || 'ホーム'));
        win.setAccent('#5ad6ff');
        icons.paint(main);
      }

      function art(n) {
        const col = n.type === 'dir' ? 'linear-gradient(150deg,#f5c04a,#e08a2e)' : 'linear-gradient(150deg,#8b7dff,#5ad6ff)';
        return el('div', { class: 'fart', style: { background: col }, dataset: { icon: n.type === 'dir' ? 'folder' : iconFor(n.name) } });
      }

      function wireCommon(node, n) {
        node.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (e.ctrlKey || e.metaKey) { sel.has(n.name) ? sel.delete(n.name) : sel.add(n.name); render(); }
          else if (!sel.has(n.name)) { sel = new Set([n.name]); render(); }
        });
        node.addEventListener('dblclick', () => { if (n.type === 'dir') go(cwd + '/' + n.name); else openFile(cwd + '/' + n.name, n); });
        node.addEventListener('contextmenu', (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!sel.has(n.name)) { sel = new Set([n.name]); render(); }
          ctx.show(e.clientX, e.clientY, [
            { label: n.type === 'dir' ? '開く' : '開く', icon: 'external', onClick: () => n.type === 'dir' ? go(cwd + '/' + n.name) : openFile(cwd + '/' + n.name, n) },
            { label: 'Notepad で開く', icon: 'edit', onClick: () => OS.apps.open('notepad', { arg: cwd + '/' + n.name }) },
            '-',
            { label: 'コピー', icon: 'copy', onClick: () => { fs.copy(cwd + '/' + n.name, cwd); render(); } },
            { label: '名前を変更…', icon: 'edit', onClick: () => rename(n) },
            { label: '削除', icon: 'trash', danger: true, onClick: () => removeSel() },
            '-',
            { label: 'プロパティ', icon: 'info', onClick: () => notify.alert('プロパティ', `${n.name}\n種類: ${n.type === 'dir' ? 'フォルダ' : (fs.extOf(n.name) || 'ファイル')}\nサイズ: ${bytes(fs.size(n))}\n更新: ${dtf.dtS(n.modified)}`) }
          ]);
        });
        node.draggable = true;
        node.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/nebula-path', cwd + '/' + n.name); e.dataTransfer.effectAllowed = 'move'; });
        node.addEventListener('dragover', (e) => { if (n.type === 'dir') { e.preventDefault(); node.classList.add('drop-hint'); } });
        node.addEventListener('dragleave', () => node.classList.remove('drop-hint'));
        node.addEventListener('drop', (e) => {
          node.classList.remove('drop-hint');
          const src = e.dataTransfer.getData('text/nebula-path');
          if (src && n.type === 'dir') { if (fs.move(src, cwd + '/' + n.name)) { render(); notify.notify({ title: '移動しました', body: `${fs.baseName(src)} → ${n.name}` }); } }
        });
      }

      function gridItem(n) {
        const it = el('div', { class: 'fitem' + (sel.has(n.name) ? ' is-sel' : '') },
          art(n), el('b', { text: n.name }));
        wireCommon(it, n);
        return it;
      }

      function listRow(n) {
        const it = el('div', { class: 'frow' + (sel.has(n.name) ? ' is-sel' : '') },
          art(n),
          el('span', { class: 'nm', text: n.name }),
          el('span', { class: 'mt', text: dtf.dtS(n.modified) }),
          el('span', { class: 'kd', text: n.type === 'dir' ? 'フォルダ' : (fs.extOf(n.name) || 'ファイル') }),
          el('span', { class: 'sz', text: n.type === 'dir' ? '—' : bytes((n.content || '').length) }));
        wireCommon(it, n);
        return it;
      }

      /* ── actions ── */
      async function rename(n) {
        const v = await notify.prompt('名前を変更', '', n.name);
        if (v && v !== n.name) { fs.rename(cwd + '/' + n.name, v); render(); }
      }
      async function removeSel() {
        if (!sel.size) return;
        const names = [...sel];
        if (await notify.confirm('削除しますか？', `${names.length} 個の項目を削除します。`, '削除')) {
          names.forEach(n => fs.remove(cwd + '/' + n));
          sel.clear(); render();
        }
      }
      async function newFolder() {
        const v = await notify.prompt('新規フォルダ', 'フォルダ名を入力', '新しいフォルダ');
        if (v) { fs.mkdir(cwd + '/' + v); render(); }
      }

      function go(p, noHist) {
        if (!fs.isDir(p)) return;
        cwd = p; sel.clear(); query = ''; searchIn.value = '';
        if (!noHist) {
          hist.splice(hi + 1);
          hist.push(p); hi = hist.length - 1;
        }
        render();
      }

      /* ── events ── */
      backBtn.addEventListener('click', () => { if (hi > 0) { hi--; go(hist[hi], true); } });
      fwdBtn.addEventListener('click', () => { if (hi < hist.length - 1) { hi++; go(hist[hi], true); } });
      upBtn.addEventListener('click', () => { const p = fs.parentPath(cwd); if (p) go(p); });
      newBtn.addEventListener('click', newFolder);
      viewBtn.addEventListener('click', () => {
        view = view === 'grid' ? 'list' : 'grid';
        try { localStorage.setItem('nebula.files.view', view); } catch (_) {}
        viewBtn.firstChild.dataset.icon = view === 'grid' ? 'grid' : 'list';
        icons.paint(viewBtn);
        render();
      });
      searchIn.addEventListener('input', OS.util.debounce(() => { query = searchIn.value; render(); }, 140));
      main.addEventListener('pointerdown', (e) => { if (!e.target.closest('.fitem,.frow')) { sel.clear(); render(); } });
      main.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.fitem,.frow')) return;
        e.preventDefault();
        ctx.show(e.clientX, e.clientY, [
          { label: '新規フォルダ', icon: 'folder', onClick: newFolder },
          { label: '新規テキストファイル', icon: 'fileText', onClick: async () => { const v = await notify.prompt('新規ファイル', '', 'untitled.txt'); if (v) { fs.writeFile(cwd + '/' + v, ''); render(); } } },
          '-',
          { label: view === 'grid' ? 'リスト表示' : 'アイコン表示', icon: view === 'grid' ? 'list' : 'grid', onClick: () => viewBtn.click() },
          { label: '更新', icon: 'refresh', onClick: render }
        ]);
      });
      main.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/nebula-path')) e.preventDefault(); });
      main.addEventListener('drop', (e) => {
        const src = e.dataTransfer.getData('text/nebula-path');
        if (src && fs.isDir(cwd)) { fs.move(src, cwd); render(); }
      });

      const off = bus.on('fs:change', OS.util.debounce(render, 60));
      win.onClose(off);

      // keyboard
      win.root.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); }
        if (e.key === 'F2') { e.preventDefault(); if (sel.size === 1) rename(visible().find(n => n.name === [...sel][0])); }
        if (e.key === 'Enter' && sel.size === 1) { const n = visible().find(x => x.name === [...sel][0]); if (n) n.type === 'dir' ? go(cwd + '/' + n.name) : openFile(cwd + '/' + n.name, n); }
        if (e.key === 'Backspace' && !e.ctrlKey) { e.preventDefault(); const p = fs.parentPath(cwd); if (p) go(p); }
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sel = new Set(visible().map(n => n.name)); render(); }
      });
      win.root.tabIndex = 0;

      render();
    },
    onArg(win, p) { /* open a new window for the target path */ }
  };

  /* ═════════════ shared helpers exposed on OS ═════════════ */
  OS.files = { iconFor, openPath, openFile, openNode, PLACES };
  OS.apps = OS.apps || {};
  OS.apps.register(app);
})(window.OS);
