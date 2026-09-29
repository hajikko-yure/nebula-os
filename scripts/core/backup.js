/* ═══════════════════════════════════════════════════════════
   Nebula OS — system backup / restore

   Produces a single JSON file containing every piece of persistent
   state (settings, the whole virtual filesystem, and UI preferences)
   and can restore it, with validation and a dry-run summary.
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el, $, download, bytes } = OS.util;
  const { store, fs, notify } = OS;

  const FORMAT = 'nebula-os-backup';
  const VERSION = 1;
  // Keys this app owns. Anything else in localStorage is left untouched.
  const OWNED = ['nebula.settings.v1', 'nebula.fs.v1', 'nebula.files.view'];

  const stamp = (d = new Date()) => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  };

  /* ── Export ─────────────────────────────────────────────── */
  function collect() {
    const raw = {};
    for (const k of OWNED) {
      try { const v = localStorage.getItem(k); if (v != null) raw[k] = v; } catch (_) {}
    }
    return {
      format: FORMAT,
      version: VERSION,
      app: 'Nebula OS',
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      keys: raw,
      // Convenience copies so a human can read the file, and so a restore can
      // work even if the key names ever change.
      settings: store.all(),
      filesystem: fs.root
    };
  }

  function summary(data) {
    const st = data.settings || {};
    let stats = { files: 0, dirs: 0, bytes: 0 };
    try { stats = countTree(data.filesystem); } catch (_) {}
    return {
      theme: st.theme || 'dark',
      accent: st.accent || '-',
      wallpaper: st.wallpaper || '-',
      userName: st.userName || '-',
      files: stats.files,
      dirs: stats.dirs,
      bytes: stats.bytes,
      exportedAt: data.exportedAt || '-'
    };
  }

  function countTree(root) {
    let files = 0, dirs = 0, total = 0;
    (function walk(n, depth) {
      if (!n || !Array.isArray(n.children) || depth > 64) return;
      for (const c of n.children) {
        if (c.type === 'dir') { dirs++; walk(c, depth + 1); }
        else { files++; total += (c.content || '').length + 128; }
      }
    })(root, 0);
    return { files, dirs, bytes: total };
  }

  /** Build the backup and hand it to the browser as a download. */
  function download_() {
    const data = collect();
    const json = JSON.stringify(data, null, 2);
    const name = `nebula-backup-${stamp()}.json`;
    download(name, json, 'application/json');
    return { name, size: json.length, summary: summary(data) };
  }

  /* ── Validate ───────────────────────────────────────────── */
  function validate(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'ファイルの内容が理解できません。' };
    if (data.format !== FORMAT) return { ok: false, error: 'Nebula OS のバックアップファイルではありません。' };
    if (typeof data.version !== 'number' || data.version > VERSION) {
      return { ok: false, error: `このバックアップは新しいバージョン（v${data.version}）で作成されています。更新後に読み込んでください。` };
    }
    const keys = data.keys;
    if (!keys || typeof keys !== 'object') return { ok: false, error: 'バックアップにデータがありません。' };

    const warnings = [];
    let fsNode = null;
    if (typeof keys['nebula.fs.v1'] === 'string') {
      try { fsNode = JSON.parse(keys['nebula.fs.v1']); }
      catch (_) { return { ok: false, error: 'ファイルシステム部分が壊れています。' }; }
      if (!validTree(fsNode, 0)) return { ok: false, error: 'ファイルシステムの構造が不正です。' };
    } else {
      warnings.push('ファイルシステムのデータが見つかりません（設定のみ復元されます）。');
    }
    let settings = null;
    if (typeof keys['nebula.settings.v1'] === 'string') {
      try { settings = JSON.parse(keys['nebula.settings.v1']); } catch (_) { warnings.push('設定部分が壊れていたため既定値を使用します。'); }
    }
    return { ok: true, warnings, fsNode, settings, summary: summary(data) };
  }

  function validTree(n, depth) {
    if (!n || typeof n !== 'object' || depth > 64) return false;
    if (typeof n.name !== 'string') return false;
    if (n.type === 'file') return typeof n.content === 'string';
    if (n.type !== 'dir' || !Array.isArray(n.children)) return false;
    return n.children.every(c => validTree(c, depth + 1));
  }

  /* ── Restore ────────────────────────────────────────────── */
  /**
   * @param {object} data parsed backup JSON
   * @param {{keepFiles?:boolean}} opts keepFiles=true restores settings only
   */
  function restore(data, opts = {}) {
    const v = validate(data);
    if (!v.ok) throw new Error(v.error);

    // Update the LIVE state, not just localStorage. Writing storage alone would
    // let a pending debounced save overwrite the restored data a moment later.
    if (v.settings) store.adopt(v.settings);
    let restoredFiles = false;
    if (!opts.keepFiles && v.fsNode) { fs.adopt(v.fsNode); restoredFiles = true; }

    for (const k of OWNED) {
      if (k === 'nebula.settings.v1' || k === 'nebula.fs.v1') continue;
      if (typeof data.keys[k] === 'string') {
        try { localStorage.setItem(k, data.keys[k]); } catch (_) {}
      }
    }
    return { warnings: v.warnings, summary: v.summary, restoredFiles };
  }

  /** Read a File chosen by the user and restore it (with confirmation). */
  async function fromFile(file, opts) {
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { throw new Error('JSON として読み込めませんでした。別のファイルを選んでください。'); }
    return restore(data, opts);
  }

  /* ── UI ─────────────────────────────────────────────────── */
  function section(main, renderSide) {
    const row = (title, desc, ctl) => el('div', { class: 'set-row' },
      el('div', { class: 'lbl' }, el('b', { text: title }), desc ? el('small', { text: desc }) : null),
      el('div', { class: 'ctl' }, ctl));

    main.append(el('section', { class: 'set-group' },
      el('div', { class: 'start-section-title' }, el('span', { text: 'バックアップ' })),
      el('div', { class: 'set-card' },
        row('現在の状態を保存', '設定・仮想ファイル・表示設定を 1 個の JSON ファイルに書き出します。',
          el('button', { class: 'btn btn--primary', text: 'ファイルをダウンロード', onClick: exportClick })),
        row('バックアップから復元', '選んだ JSON ファイルを読み込みます。現在のデータは置き換えられます。',
          el('button', { class: 'btn', text: 'ファイルを選ぶ', onClick: importClick })),
        row('設定だけを復元', 'ファイルは変更せず、テーマやアクセントなどの設定のみ戻します。',
          el('button', { class: 'btn', text: '設定のみ復元', onClick: () => importClick({ settingsOnly: true }) }))
      )));

    const info = el('div', { class: 'set-card' },
      el('div', { class: 'set-row' },
        el('div', { class: 'lbl' }, el('b', { text: '保存先' }), el('small', { text: 'このブラウザの localStorage。サイトデータを消去すると失われます。' })),
        el('div', { class: 'ctl' }, el('span', { class: 'tiny dim', id: 'bkWhere', text: '—' }))));
    main.append(el('section', { class: 'set-group' }, info));
    const where = $('#bkWhere', info);
    if (where) where.textContent = (() => {
      try { return `${navigator.userAgent.includes('Firefox') ? 'Firefox' : 'ブラウザ'} / ${location.origin || 'file://'}`; }
      catch (_) { return 'このブラウザ'; }
    })();
    void renderSide;
  }

  async function exportClick() {
    try {
      const r = download_();
      await notify.alert('バックアップを作成しました',
        `${r.name}\n\n` +
        `${r.summary.files} ファイル / ${r.summary.dirs} フォルダ（${bytes(r.summary.bytes)}）\n` +
        `テーマ: ${r.summary.theme} / ユーザー: ${r.summary.userName}\n\n` +
        `このファイルは復元にも使用できます。ブラウザの保存容量には限りがあるため、` +
        `重要なデータは必ず別途バックアップしてください。`);
    } catch (e) {
      await notify.alert('バックアップに失敗しました', String(e && e.message || e));
    }
  }

  function importClick(opts = {}) {
    const input = el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    document.body.append(input);
    let done = false;
    const finish = () => { if (!done) { done = true; input.remove(); } };
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) { finish(); return; }
      try {
        const text = await file.text();
        let data;
        try { data = JSON.parse(text); }
        catch (_) { throw new Error('JSON として読み込めませんでした。'); }
        const v = validate(data);
        if (!v.ok) throw new Error(v.error);

        const s = v.summary;
        const lines = [
          `作成日時: ${s.exportedAt}`,
          `テーマ: ${s.theme} / アクセント: ${s.accent} / 壁紙: ${s.wallpaper}`,
          `ユーザー: ${s.userName}`,
          `ファイル: ${s.files} 件 / フォルダ: ${s.dirs} 件（${bytes(s.bytes)}）`
        ];
        if (opts.settingsOnly) lines.push('', '復元対象: 設定のみ');
        if (v.warnings.length) lines.push('', ...v.warnings.map(w => '注意: ' + w));

        const ok = await notify.confirm('バックアップから復元しますか？',
          lines.join('\n') + '\n\n' + (opts.settingsOnly ? '現在のファイルはそのまま残ります。' : '現在のファイルはバックアップの内容で置き換わります。この操作は取り消せません。'),
          '復元する');
        if (!ok) { finish(); return; }
        const r = restore(data, opts);
        notify.notify({ title: '復元しました', body: opts.settingsOnly ? '設定を復元しました。再読み込みします。' : 'ファイルと設定を復元しました。再読み込みします。' });
        setTimeout(() => location.reload(), 700);
        void r;
      } catch (e) {
        await notify.alert('復元できませんでした', String(e && e.message || e));
      }
      finish();
    });
    // A cancelled picker fires no event in some browsers; clean up on refocus.
    window.addEventListener('focus', () => setTimeout(() => { if (!done && !input.files) finish(); }, 400), { once: true });
    input.click();
  }

  OS.backup = { collect, download: download_, validate, restore, fromFile, summary, FORMAT, VERSION, section };
})(window.OS);
