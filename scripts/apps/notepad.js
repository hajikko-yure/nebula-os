/* ═══════════════════════════════════════════════════════════
   App: Notepad
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el, $, esc, debounce, dtf, bytes } = OS.util;
  const { icons, fs, notify, store, launcher } = OS;

  function mount(root, win, startPath) {
    let path = startPath || null;
    let dirty = false;

    const lines = el('div', { class: 'note-lines' });
    const area = el('textarea', { class: 'note-area', spellcheck: 'false', placeholder: 'ここにテキストを入力…', wrap: 'off' });
    const body = el('div', { class: 'app-body note-body' }, lines, area);

    const openBtn = el('button', { class: 'icon-btn', title: '開く (Ctrl+O)' }, el('span', { dataset: { icon: 'folderOpen' } }));
    const saveBtn = el('button', { class: 'icon-btn', title: '保存 (Ctrl+S)' }, el('span', { dataset: { icon: 'save' } }));
    const findBtn = el('button', { class: 'icon-btn', title: '検索 (Ctrl+F)' }, el('span', { dataset: { icon: 'search' } }));
    const wrapBtn = el('button', { class: 'icon-btn', title: '折り返し' }, el('span', { dataset: { icon: 'list' } }));
    const stat = el('div', { class: 'app-title', style: { fontWeight: '500', color: 'var(--txt-2)' } });

    const findIn = el('input', { type: 'text', placeholder: '検索', spellcheck: 'false' });
    const findBar = el('div', { class: 'app-toolbar', style: { minHeight: '38px', display: 'none', borderTop: '1px solid var(--stroke)' } },
      el('span', { class: 'field-icon', dataset: { icon: 'search' } }), findIn,
      el('span', { class: 'tiny dim', text: 'Enter: 次へ' }),
      el('div', { class: 'spacer' }),
      el('button', { class: 'icon-btn', title: '閉じる' }, el('span', { dataset: { icon: 'x' } })));
    findBar.querySelector('.icon-btn').addEventListener('click', () => { findBar.style.display = 'none'; area.focus(); });

    const toolbar = el('div', { class: 'app-toolbar' },
      openBtn, saveBtn, el('div', { class: 'sep' }), stat, el('div', { class: 'spacer' }), findBtn, wrapBtn);

    const status = el('div', { class: 'app-status' });
    root.className = 'app note';
    root.append(toolbar, body, findBar, status);

    /* ── logic ── */
    const syncLines = () => {
      const n = area.value.split('\n').length;
      if (lines.childElementCount === n) return;
      lines.innerHTML = '';
      for (let i = 1; i <= n; i++) lines.append(el('div', { text: String(i) }));
    };
    const syncScroll = () => { lines.scrollTop = area.scrollTop; };
    const updateStat = () => {
      const v = area.value;
      const chars = v.length;
      const words = v.trim() ? v.trim().split(/\s+/).length : 0;
      stat.textContent = `${path ? fs.baseName(path) + (dirty ? ' •' : '') : '無題'}`;
      win.setTitle(`${dirty ? '• ' : ''}${path ? fs.baseName(path) : '無題.txt'} — Notepad`);
      win.setSub(`${chars} 文字 / ${words} 語 / ${bytes(chars)}`);
      status.innerHTML = '';
      status.append(
        el('span', { text: `Ln ${area.value.slice(0, area.selectionStart).split('\n').length}, Col ${(area.selectionStart - area.value.lastIndexOf('\n', area.selectionStart - 1))}` }),
        el('span', { class: 'spacer' }),
        el('span', { text: v.split('\n').length + ' 行' }),
        el('span', { text: 'UTF-8' }),
        el('span', { text: 'LF' })
      );
      icons.paint(status);
    };

    function load(p) {
      const c = fs.read(p);
      if (c == null) return notify.notify({ title: '開けません', body: p });
      path = p; area.value = c; dirty = false;
      syncLines(); updateStat();
      launcher.pushRecent({ path: p, name: fs.baseName(p), app: 'notepad', sub: p, at: Date.now() });
    }

    function save() {
      if (!path) return saveAs();
      try {
        fs.writeFile(path, area.value, { kind: fs.extOf(path) || 'txt' });
        dirty = false; updateStat();
        notify.notify({ title: '保存しました', body: path, app: OS.apps.get('notepad'), timeout: 1800 });
      } catch (e) { notify.alert('保存に失敗しました', e.message); }
    }

    async function saveAs() {
      const v = await notify.prompt('名前を付けて保存', '保存先フォルダとファイル名', path || 'Home/Documents/untitled.txt');
      if (!v) return;
      path = v; save();
    }

    async function openDialog() {
      const v = await notify.prompt('ファイルを開く', 'パスを入力', path || 'Home/Documents/README.txt');
      if (v) { if (dirty && !await notify.confirm('未保存の変更があります', '破棄しますか？', '破棄して開く')) return; load(v); }
    }

    area.addEventListener('input', () => { dirty = true; syncLines(); updateStat(); });
    area.addEventListener('scroll', syncScroll);
    area.addEventListener('keyup', updateStat);
    area.addEventListener('click', updateStat);
    area.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Tab') { e.preventDefault(); insert('  '); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); openDialog(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); findBar.style.display = 'flex'; findIn.focus(); findIn.select(); }
    });
    function insert(t) {
      const s = area.selectionStart, e = area.selectionEnd;
      area.value = area.value.slice(0, s) + t + area.value.slice(e);
      area.selectionStart = area.selectionEnd = s + t.length;
      dirty = true; syncLines(); updateStat();
    }

    openBtn.addEventListener('click', openDialog);
    saveBtn.addEventListener('click', save);
    findBtn.addEventListener('click', () => { findBar.style.display = 'flex'; findIn.focus(); findIn.select(); });
    wrapBtn.addEventListener('click', () => {
      const on = area.getAttribute('wrap') === 'off';
      area.setAttribute('wrap', on ? 'soft' : 'off');
      area.style.whiteSpace = on ? 'pre-wrap' : 'pre';
      wrapBtn.classList.toggle('is-on', on);
    });
    wrapBtn.classList.add('is-on');
    area.setAttribute('wrap', 'soft'); area.style.whiteSpace = 'pre-wrap';

    findIn.addEventListener('input', () => {
      const q = findIn.value;
      if (!q) { area.style.background = ''; return; }
      area.focus();
    });
    findIn.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Enter') return;
      const q = findIn.value;
      if (!q) return;
      const i = area.value.indexOf(q, area.selectionEnd);
      const at = i === -1 ? area.value.indexOf(q) : i;
      if (at === -1) return notify.notify({ title: '見つかりません', body: `「${q}」`, timeout: 1600 });
      area.focus();
      area.setSelectionRange(at, at + q.length);
      const before = area.value.slice(0, at).split('\n').length;
      const lineH = parseFloat(getComputedStyle(area).lineHeight) || 20;
      area.scrollTop = Math.max(0, (before - 6) * lineH);
      syncScroll();
    });

    win.onClose(async () => { if (dirty) { /* best effort */ } });

    if (startPath) load(startPath);
    else { syncLines(); updateStat(); setTimeout(() => area.focus(), 60); }
    win.setAccent('#8b7dff');
    icons.paint(root);
  }

  OS.apps.register({
    id: 'notepad',
    name: 'Notepad',
    icon: 'fileText',
    accent: ['#8b7dff', '#5ad6ff'],
    width: 720, height: 520, minWidth: 380, minHeight: 240,
    keywords: 'notepad text editor メモ テキスト',
    description: 'テキストエディタ。ファイルシステムに読み書きできます。',
    mount
  });
})(window.OS);
