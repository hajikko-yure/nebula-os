/* ═══════════════════════════════════════════════════════════
   App: Browser — offline mock web
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el } = OS.util;
  const { icons, store, notify } = OS;

  const SITES = {
    'nebula://start': { title: 'Nebula スタート', render: startPage },
    'nebula://docs':  { title: 'ドキュメント',     render: docsPage },
    'nebula://about': { title: 'このシステムについて', render: aboutPage },
    'about:blank':    { title: '新しいタブ',       render: blankPage }
  };

  const QUICK = [
    ['Nebula', '#8b7dff', '#5ad6ff'],
    ['Docs',   '#5ad6ff', '#3b82f6'],
    ['News',   '#fbbf24', '#f97316'],
    ['Music',  '#ff7ad9', '#8b7dff'],
    ['Code',   '#4ade80', '#22d3ee'],
    ['Mail',   '#fb7185', '#f59e0b'],
    ['Maps',   '#a78bfa', '#60a5fa'],
    ['Chat',   '#22d3ee', '#818cf8']
  ];

  function startPage(x) {
    const s = el('div', { class: 'bpage' });
    s.append(el('div', { class: 'bpage-hero' },
      el('h1', { text: 'Nebula' }),
      el('p', { text: 'アドレス欄にサイト名または URL を入力すると、インターネット上のページをこのウィンドウ内に表示します。' })));
    const bar = el('input', { class: 'brow-quick', type: 'text', spellcheck: 'false', placeholder: 'example.com または検索キーワード' });
    bar.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') x.navigate(bar.value); });
    s.append(bar);
    const tiles = el('div', { class: 'bpage-tiles' });
    QUICK.forEach(([n, a, b]) => {
      const btn = el('button', { style: { background: `linear-gradient(150deg, ${a}, ${b})` }, title: n });
      btn.append(el('span', { dataset: { icon: 'external' } }));
      icons.paint(btn);
      btn.addEventListener('click', () => x.navigate('https://' + n.toLowerCase() + '.com'));
      tiles.append(btn);
    });
    s.append(tiles);
    const sec = el('div', { class: 'bpage-sec' }, el('h2', { text: 'Nebula OS について' }),
      el('div', { class: 'bpage-card' },
        ...[['ウィンドウ管理', 'スナップ、ゾーン、ステージングを備えたウィンドウマネージャ。'],
            ['仮想ファイル', 'ブラウザのストレージに保存されるローカル FS。'],
            ['アプリ', 'ターミナル、エディタ、計算機、音楽など 12 個のアプリ。'],
            ['プライバシー', '外部サイトは隔離された iframe 内で表示され、この OS の保存データには触れません。']]
          .map(([t, d]) => el('div', {}, el('b', { text: t }), el('p', { text: d })))));
    s.append(sec);
    return s;
  }

  function docsPage(x) {
    const s = el('div', { class: 'bpage' });
    s.append(el('div', { class: 'bpage-sec' },
      el('h2', { text: 'ドキュメント' }),
      el('div', { class: 'bpage-card' },
        ...[['Terminal', 'help, ls, cd, cat, neofetch, open, wallpaper …'],
            ['Files', '移動、複製、削除、名前変更、ドラッグ＆ドロップ。'],
            ['Settings', 'テーマ、アクセント、壁紙、Dock、音量。'],
            ['Music', 'WebAudio によるリアルタイム音楽生成。'],
            ['Weather', '週間予報と時間別予報。'],
            ['Minesweeper', '初級 / 中級 / 上級の 3 段階。']]
          .map(([t, d]) => el('div', {}, el('b', { text: t }), el('p', { text: d }))))));
    s.append(el('div', { class: 'bpage-sec' }, el('h2', { text: 'ショートカット' }),
      el('div', { class: 'bpage-card' },
        ...[['Super', 'ランチャー'], ['Alt + Tab', 'ウィンドウ切替'], ['Shift + F10', 'コンテキストメニュー'], ['Ctrl + S', '保存']]
          .map(([t, d]) => el('div', {}, el('b', { text: t }), el('p', { text: d }))))));
    return s;
  }

  function aboutPage(x) {
    const s = el('div', { class: 'bpage' });
    s.append(el('div', { class: 'bpage-hero' },
      el('h1', { text: 'Nebula OS' }),
      el('p', { text: 'Version 1.0.0 "Aurora" — ブラウザで動く疑似 OS。' })));
    s.append(el('div', { class: 'bpage-sec' }, el('h2', { text: 'システム' }),
      el('div', { class: 'bpage-card' },
        el('div', {}, el('b', { text: 'テーマ' }), el('p', { text: store.get('theme') })),
        el('div', {}, el('b', { text: 'アクセント' }), el('p', { text: store.get('accent') })),
        el('div', {}, el('b', { text: 'ディスプレイ' }), el('p', { text: `${screen.width}×${screen.height}` })))));
    return s;
  }
  function blankPage() { return el('div', { class: 'bpage' }); }

  /** Search results cannot be framed, so hand off to a real tab. */
  function searchPage(ctx, target, query) {
    const s = el('div', { class: 'bpage' });
    s.append(el('div', { class: 'bpage-hero' },
      el('h1', { text: '検索' }),
      el('p', { text: `「${query}」で検索します。` })));
    const open = el('button', { class: 'btn btn--primary', text: '検索結果を新しいタブで開く' });
    open.addEventListener('click', () => window.open(target, '_blank', 'noopener,noreferrer'));
    s.append(el('div', { class: 'bpage-sec' }, open,
      el('p', { class: 'tiny dim', style: { marginTop: '14px' }, text: '検索エンジンは iframe 表示を制限しているため、このウィンドウではなく新しいタブで開きます。' })));
    void ctx;
    return s;
  }

  function mount(root, win, url) {
    // Entries are {url,isSearch} so Back/Forward never re-frames a search result.
    let history = [{ url: url || 'nebula://start', isSearch: false }], hi = 0;

    const urlIn = el('input', { type: 'text', spellcheck: 'false', value: history[0].url });
    const view = el('div', { class: 'brow-view' });
    const back = el('button', { class: 'icon-btn', title: '戻る' }, el('span', { dataset: { icon: 'chevronLeft' } }));
    const fwd = el('button', { class: 'icon-btn', title: '進む' }, el('span', { dataset: { icon: 'chevronRight' } }));
    const rel = el('button', { class: 'icon-btn', title: '再読み込み' }, el('span', { dataset: { icon: 'refresh' } }));
    const home = el('button', { class: 'icon-btn', title: 'ホーム' }, el('span', { dataset: { icon: 'home' } }));
    const secureIco = el('span', { class: 'field-icon' });
    const urlBar = el('div', { class: 'brow-url' }, secureIco, urlIn);

    const toolbar = el('div', { class: 'app-toolbar' }, back, fwd, rel, home, urlBar,
      el('button', { class: 'icon-btn', title: 'ブックマーク' }, el('span', { dataset: { icon: 'star' } })),
      el('button', { class: 'icon-btn', title: 'メニュー' }, el('span', { dataset: { icon: 'moreV' } })));
    root.className = 'app brow';
    root.append(toolbar, el('div', { class: 'app-body' }, view));
    win.setAccent('#3b82f6');

    /** Normalise user input. Returns {url, isSearch}. */
    function resolveUrl(raw) {
      const u = String(raw || '').trim();
      if (!u) return { url: 'nebula://start', isSearch: false };
      if (/^(nebula|about|data|blob):/i.test(u)) return { url: u, isSearch: false };
      if (/^https?:\/\//i.test(u)) return { url: u, isSearch: false };
      // A bare host like "example.com" is a real address; a host with a space is not.
      if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) return { url: 'https://' + u, isSearch: false };
      return { url: 'https://duckduckgo.com/?q=' + encodeURIComponent(u), isSearch: true };
    }

    const ctx = {
      navigate(u, noHist, forceSearch) {
        const { url: target, isSearch } = resolveUrl(u);
        const search = forceSearch !== undefined ? forceSearch : isSearch;
        urlIn.value = target;
        view.innerHTML = '';

        if (SITES[target]) {
          secureIco.dataset.icon = 'lock';
          const site = SITES[target];
          view.append(site.render(ctx));
          win.setTitle(site.title + ' — Nebula Browser');
        } else if (search) {
          // Every major search engine sends `frame-ancestors`, so a framed
          // search is always blocked. Send the user to a real tab instead.
          secureIco.dataset.icon = 'search';
          view.append(searchPage(ctx, target, u));
        } else if (target.startsWith('data:') || target.startsWith('blob:')) {
          secureIco.dataset.icon = 'info';
          view.append(el('div', { class: 'bpage' },
            el('div', { class: 'bpage-hero' },
              el('h1', { text: 'この形式は表示できません' }),
              el('p', { text: '安全のため、このブラウザは data: / blob: URL の埋め込みを許可していません。' }))));
          win.setTitle('非対応 — Nebula Browser');
        } else {
          this.external(target);
        }

        if (!noHist) { history.splice(hi + 1); history.push({ url: target, isSearch: search }); hi = history.length - 1; }
        back.disabled = hi === 0; fwd.disabled = hi >= history.length - 1;
        icons.paint(toolbar);
        icons.paint(view);
      },

      /**
       * Load a real site. Sandboxed without allow-same-origin, so the framed
       * page runs in an opaque origin and cannot touch this OS's storage.
       * Many large sites send X-Frame-Options / frame-ancestors and will refuse
       * to be framed — that is the remote server's choice, not a bug here.
       */
      external(url) {
        secureIco.dataset.icon = 'globe';
        let host = '';
        try { host = new URL(url).hostname; } catch (_) {}

        const bar = el('div', { class: 'brow-frame-note' },
          el('span', { dataset: { icon: 'info' } }),
          el('span', { class: 'txt', text: '一部のサイト（Google / YouTube / X など）は iframe での表示を禁止しています。表示されない場合は「新しいタブで開く」をご利用ください。' }),
          el('button', { class: 'btn', text: '新しいタブで開く' }));
        bar.querySelector('button').addEventListener('click', () => window.open(url, '_blank', 'noopener,noreferrer'));

        const frame = el('iframe', {
          class: 'brow-frame',
          src: url,
          // No allow-same-origin: the framed document cannot read our DOM,
          // cookies or localStorage. Scripts/forms/popups are allowed so that
          // ordinary pages still work.
          sandbox: 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox',
          referrerpolicy: 'no-referrer',
          loading: 'eager',
          title: host || url
        });

        view.append(el('div', { class: 'brow-frame-wrap' }, bar, frame));
        win.setTitle((host || url) + ' — Nebula Browser');
      }
    };

    /** Re-render an existing history entry, preserving how it was resolved. */
    ctx.go = (i) => {
      const h = history[i];
      if (!h) return;
      ctx.navigate(h.url, true, h.isSearch);
    };

    urlIn.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') ctx.navigate(urlIn.value);
    });
    back.addEventListener('click', () => { if (hi > 0) { hi--; ctx.go(hi); } });
    fwd.addEventListener('click', () => { if (hi < history.length - 1) { hi++; ctx.go(hi); } });
    rel.addEventListener('click', () => ctx.go(hi));
    home.addEventListener('click', () => ctx.navigate('nebula://start'));
    toolbar.lastChild.addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      OS.ctx.show(r.left - 40, r.bottom + 8, [
        { type: 'label', text: 'Nebula Browser' },
        { label: '新規タブ', icon: 'plus', onClick: () => ctx.navigate('about:blank') },
        { label: '履歴を表示', icon: 'history', onClick: () => notify.alert('履歴', history.map(h => h.url).join('\n')) },
        { label: '現在のページを保存', icon: 'download', onClick: () => {
          try {
            OS.util.download(history[hi].url + '.url', new Blob(['[InternetShortcut]\r\nURL=' + history[hi].url + '\r\n'], { type: 'text/plain' }));
          } catch (_) { notify.alert('保存できませんでした', 'このブラウザではダウンロードがブロックされています。'); }
        } },
        '-',
        { label: 'about:blank', icon: 'window', onClick: () => ctx.navigate('about:blank') },
        { label: 'example.com を試す', icon: 'external', onClick: () => ctx.navigate('https://example.com') }
      ]);
    });

    ctx.go(0);
  }

  OS.apps.register({
    id: 'browser',
    name: 'ブラウザ',
    icon: 'globe',
    accent: ['#3b82f6', '#5ad6ff'],
    width: 900, height: 620, minWidth: 480, minHeight: 320,
    keywords: 'browser web internet ブラウザ',
    description: '外部サイトを表示できるブラウザ。',
    mount
  });
})(window.OS);
