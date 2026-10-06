/* App: Settings */
(function (OS) {
  'use strict';
  const { el, $, $$, esc } = OS.util;
  const { icons, store, wm, notify, wallpaper, bus } = OS;

  const ACCENTS = [
    ['#8b7dff', '#ff7ad9', '#5ad6ff'], ['#5ad6ff', '#3b82f6', '#8b7dff'],
    ['#4ade80', '#22d3ee', '#a3e635'], ['#fbbf24', '#fb7185', '#f97316'],
    ['#f472b6', '#a78bfa', '#60a5fa'], ['#22d3ee', '#818cf8', '#2dd4bf'],
    ['#fb7185', '#f59e0b', '#ef4444'], ['#94a3b8', '#cbd5e1', '#64748b']
  ];

  const SECTIONS = [
    { id: 'appearance', name: '外観とカラー', icon: 'palette' },
    { id: 'wallpaper',  name: '壁紙',         icon: 'image' },
    { id: 'dock',       name: 'Dock とタスクバー', icon: 'grid' },
    { id: 'sound',      name: 'サウンド',     icon: 'volume' },
    { id: 'network',    name: 'ネットワーク', icon: 'wifi' },
    { id: 'power',      name: '電源',         icon: 'battery' },
    { id: 'account',    name: 'アカウント',   icon: 'user' },
    { id: 'storage',    name: 'ストレージ',   icon: 'hardDrive' },
    { id: 'backup',     name: 'バックアップ', icon: 'download' },
    { id: 'shortcuts',  name: 'ショートカット', icon: 'sliders' },
    { id: 'about',      name: 'システム情報', icon: 'info' }
  ];

  function row(title, desc, ctl) {
    return el('div', { class: 'set-row' },
      el('div', { class: 'lbl' }, el('b', { text: title }), desc ? el('small', { text: desc }) : null),
      el('div', { class: 'ctl' }, ctl));
  }
  function group(title, ...rows) {
    return el('section', { class: 'set-group' },
      title ? el('div', { class: 'start-section-title' }, el('span', { text: title })) : null,
      el('div', { class: 'set-card' }, rows));
  }
  function toggle(get, set) {
    const b = el('button', { class: 'switch' + (get() ? ' is-on' : ''), role: 'switch' });
    b.addEventListener('click', () => { const v = !get(); set(v); b.classList.toggle('is-on', v); });
    return b;
  }
  function select(options, get, set) {
    const s = el('select');
    options.forEach(([v, label]) => s.append(el('option', { value: v, text: label })));
    s.value = get();
    s.addEventListener('change', () => set(s.value));
    return s;
  }
  function slider(min, max, step, get, set, fmt) {
    const w = el('div', { style: { width: '170px' } });
    const inp = el('input', { type: 'range', min, max, step, value: get() });
    const lbl = el('div', { class: 'tiny dim', style: { textAlign: 'right' }, text: fmt(get()) });
    const upd = () => { inp.style.setProperty('--pct', ((inp.value - min) / (max - min) * 100) + '%'); lbl.textContent = fmt(+inp.value); };
    inp.addEventListener('input', () => { set(+inp.value); upd(); });
    upd();
    w.append(inp, lbl);
    return w;
  }

  function mount(root, win, startSection) {
    let section = startSection && SECTIONS.some(s => s.id === startSection) ? startSection : 'appearance';

    const side = el('div', { class: 'side' });
    const main = el('div', { class: 'main' });
    const body = el('div', { class: 'app-body' }, side, main);
    root.className = 'app set';
    root.append(body);
    win.setAccent('#5ad6ff');

    function renderSide() {
      side.innerHTML = '';
      side.append(el('div', { class: 'side-label', text: '設定' }));
      SECTIONS.forEach(s => {
        const b = el('button', { class: 'side-item' + (section === s.id ? ' is-active' : '') },
          el('span', { dataset: { icon: s.icon } }), el('span', { text: s.name }));
        b.addEventListener('click', () => { section = s.id; render(); });
        side.append(b);
      });
      icons.paint(side);
    }

    function render() {
      renderSide();
      main.innerHTML = '';
      const s = SECTIONS.find(x => x.id === section);
      main.append(el('h1', { class: 'set-h1', text: s.name }));
      main.append(el('p', { class: 'set-sub', text: sub(s.id) }));
      ({ appearance, wallpaper: wallpaperSec, dock, sound, network, power, account, storage, backup, shortcuts, about })[s.id]();
      icons.paint(main);
      win.setTitle('設定 — ' + s.name);
    }

    const sub = (id) => ({
      appearance: 'テーマ、アクセント、ガラス効果を調整します。',
      wallpaper: 'デスクトップの背景 WALLPAPER を選びます。',
      dock: 'Dock のサイズと挙動を設定します。',
      sound: 'システムサウンドと音量。',
      network: '接続状態のシミュレーション。',
      power: 'バッテリーとスリープ。',
      account: 'ユーザー名を変更できます。',
      storage: '仮想ファイルシステムの使用状況。',
      backup: 'システム全体の保存と復元。',
      shortcuts: 'キーボードショートカットの一覧。',
      about: 'Nebula OS のバージョン情報。'
    })[id];

    /* ───────── sections ───────── */
    function appearance() {
      main.append(group('テーマ',
        row('ダーク / ライト', 'システム全体の配色を切り替えます',
          el('div', { class: 'seg' },
            ...['dark', 'light'].map(t => {
              const b = el('button', { text: t === 'dark' ? 'ダーク' : 'ライト', class: store.get('theme') === t ? 'is-active' : '' });
              b.addEventListener('click', () => { store.set('theme', t); OS.theme.apply(); render(); });
              return b;
            }))),
        row('アニメーション', 'ウィンドウと UI のトランジション',
          toggle(() => store.get('animations'), v => { store.set('animations', v); OS.theme.apply(); }))
      ));

      const dots = el('div', { class: 'accent-row' });
      ACCENTS.forEach(a => {
        const d = el('button', { class: 'accent-dot' + (store.get('accent') === a[0] ? ' is-on' : '') , style: { background: `linear-gradient(140deg, ${a[0]}, ${a[1]})` }, title: a[0] });
        d.addEventListener('click', () => { OS.theme.setAccent(a); render(); });
        dots.append(d);
      });
      main.append(group('アクセントカラー', row('色', 'ボタンやアクセントに適用されます', dots)));

      main.append(group('素材',
        row('ガラスのぼかし', 'バックグラウンドのぼかし強度',
          slider(0, 60, 1, () => store.get('blur'), v => { store.set('blur', v); OS.theme.apply(); }, v => v + ' px')),
        row('ウィンドウの角丸', 'ウィンドウの角丸のサイズ',
          slider(4, 26, 1, () => store.get('radius'), v => { store.set('radius', v); OS.theme.apply(); }, v => v + ' px')),
        row('透明度', 'ウィンドウとパネルの不透明度',
          slider(20, 98, 1, () => store.get('opacity'), v => { store.set('opacity', v); OS.theme.apply(); }, v => v + ' %'))
      ));
    }

    function wallpaperSec() {
      const grid = el('div', { class: 'wall-grid' });
      wallpaper.LIST.forEach(w => {
        const item = el('button', { class: 'wall-item' + (wallpaper.active === w.id ? ' is-on' : '') },
          el('div', { class: 'wm-thumb' }), el('em', { text: w.name }));
        wallpaper.thumb(w.id, item.querySelector('.wm-thumb'));
        item.addEventListener('click', () => {
          store.set('wallpaper', w.id);
          wallpaper.repaint();
          render();
        });
        grid.append(item);
      });
      main.append(group('背景', row('壁紙', 'もう一度選ぶと適用されます', grid)));
    }

    function dock() {
      const apps = OS.apps.all();
      const list = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } });
      OS.dock.apps.forEach((id, i) => {
        const a = OS.apps.get(id);
        if (!a) return;
        const chip = el('span', { class: 'chip' }, el('span', { text: a.name }));
        const x = el('button', { class: 'icon-btn', style: { width: '20px', height: '20px' }, text: '×' });
        x.addEventListener('click', () => { OS.dock.set(OS.dock.apps.filter(v => v !== id)); render(); });
        chip.append(x);
        list.append(chip);
      });
      main.append(group('Dock アプリ',
        row('表示中のアプリ', 'クリックして Dock から削除できます', list),
        row('既定に戻す', 'すべてのアプリを Dock に戻します',
          el('button', { class: 'btn', text: 'リセット', onClick: () => { OS.dock.set(OS.dock.DEFAULT_DOCK); render(); } }))
      ));
      main.append(group('見た目と挙動',
        row('Dock のサイズ', 'アイコン全体のサイズ', slider(0.8, 1.35, 0.01, () => store.get('dockScale'), v => { store.set('dockScale', v); OS.theme.apply(); }, v => Math.round(v * 100) + ' %')),
        row('拡大効果', 'ホバーで Dock アイコンを拡大', toggle(() => store.get('dockMagnify'), v => store.set('dockMagnify', v)))
      ));
    }

    function sound() {
      main.append(group('出力',
        row('システムサウンド', 'クリック音と通知音', toggle(() => store.get('sound'), v => store.set('sound', v))),
        row('音量', 'システム全体の音量',
          slider(0, 100, 1, () => store.get('volume'), v => store.set('volume', v), v => v + ' %'))
      ));
      main.append(group('テスト',
        row('通知をテスト', '通知の表示を確認', el('button', { class: 'btn', text: '表示', onClick: () => notify.notify({ title: 'テスト通知', body: 'この通知が表示されています。' }) })),
        row('効果音をテスト', '短い効果音を再生', el('button', { class: 'btn', text: '再生', onClick: () => OS.audio.blip() }))
      ));
    }

    function network() {
      main.append(group('接続',
        row('Wi-Fi', 'Nebula 5G に接続済み',
          el('span', { class: 'chip', style: { color: '#4ade80' } }, el('span', { text: '● 接続済み' }))),
        row('経由', '自動', select([['auto', '自動'], ['ethernet', '有線'], ['vpn', 'VPN']], () => 'auto', () => {})),
        row('ファイル共有', 'ローカルネットワーク上でデバイスを表示', toggle(() => false, () => {}))
      ));
    }

    function power() {
      main.append(group('電源',
        row('スリープまでの時間', '無操作の状態', select([['5', '5 分'], ['10', '10 分'], ['30', '30 分'], ['never', 'なし']], () => '10', () => {})),
        row('起動時にロック', '自動的にロック画面を表示', toggle(() => true, () => {})),
        row('スリープ', '今すぐ画面を消します', el('button', { class: 'btn', text: 'スリープ', onClick: () => OS.session.sleep() }))
      ));
    }

    function account() {
      const input = el('input', { type: 'text', value: store.get('userName'), style: { width: '190px', height: '32px', padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--stroke)', borderRadius: '9px' } });
      input.addEventListener('change', () => { store.set('userName', input.value.trim() || 'ユーザー'); OS.launcher.greet(); });
      main.append(group('ユーザー情報',
        row('表示名', 'ロック画面とランチャーに表示されます', input)
      ));
      const card = el('div', { class: 'set-card' }, el('div', { class: 'set-row' },
        el('div', { class: 'lbl' }, el('b', { text: 'このデバイス' })),
        el('div', { class: 'ctl' }, el('button', { class: 'btn danger', text: 'すべてのデータを消去', onClick: async () => {
          if (await notify.confirm('すべてのデータを消去しますか？', '設定、ファイル、履歴が完全に削除されます。この操作は取り消せません。', '消去する')) {
            localStorage.clear(); location.reload();
          }
        } }))));
      main.append(group('リセット', el('div', { class: 'set-card' },
        el('div', { class: 'set-row' },
          el('div', { class: 'lbl' }, el('b', { text: 'すべてを初期状態に戻す' }), el('small', { text: 'テーマ、Dock、ファイルをリセットします' })),
          el('div', { class: 'ctl' }, el('button', { class: 'btn', text: 'リセット', onClick: async () => {
            if (await notify.confirm('初期化しますか？', 'すべての設定を初期状態に戻します。', '初期化')) { localStorage.clear(); location.reload(); }
          } }))))));
    }

    function storage() {
      const st = OS.fs.stats();
      const total = 5 * 1024 * 1024 * 1024;
      const pct = Math.max(0.4, (st.bytes / total) * 100);
      const bar = el('div', { style: { height: '10px', borderRadius: '99px', background: 'var(--sunken)', overflow: 'hidden', width: '100%' } },
        el('i', { style: { display: 'block', height: '100%', width: Math.min(100, pct) + '%', background: 'linear-gradient(90deg,var(--accent),var(--accent-2))' } }));
      main.append(group('容量',
        row('使用量', `${OS.util.bytes(st.bytes)} / 5.00 GB`, bar),
        row('ファイル数', `${st.files} ファイル / ${st.dirs} フォルダ`, el('span', { class: 'tiny dim' }))
      ));
      main.append(group('管理',
        row('ファイルマネージャを開く', '仮想ファイルシステムを閲覧', el('button', { class: 'btn', text: '開く', onClick: () => wm.open(OS.apps.get('files')) })),
        row('サンプルデータを再生成', 'Home フォルダを初期状態に戻します', el('button', { class: 'btn', text: '再生成', onClick: async () => {
          if (await notify.confirm('再生成しますか？', 'Home 配下のファイルが初期サンプルに置き換わります。', '再生成')) { OS.fs.reset(); notify.notify({ title: '再生成しました', body: 'ファイルシステムを初期化しました。' }); }
        } }))
      ));
    }

    function backup() {
      if (!OS.backup) {
        main.append(group('エラー', row('バックアップモジュールを読み込めません', 'backup.js の読み込みに失敗しました。', el('span', { class: 'tiny dim', text: '—' }))));
        return;
      }
      OS.backup.section(main, renderSide);
    }

    function shortcuts() {
      const keys = [
        ['Super / ⊞', 'ランチャーを開く'], ['Alt + Tab', 'ウィンドウを切り替える'],
        ['Ctrl + S', '保存（Notepad）'], ['Ctrl + O', '開く（Notepad）'],
        ['Ctrl + F', '検索（Notepad）'], ['Shift + F10', 'コンテキストメニュー'],
        ['F2', '名前を変更（ファイル）'], ['Delete', '削除（ファイル）'],
        ['Backspace', '上へ戻る（ファイル）'], ['Esc', 'メニューを閉じる'],
        ['Super + ←/→', 'ウィンドウを端にスナップ']
      ];
      const card = el('div', { class: 'set-card' });
      keys.forEach(([k, d]) => card.append(el('div', { class: 'set-row' },
        el('div', { class: 'lbl' }, el('small', { text: d })),
        el('div', { class: 'ctl' }, el('kbd', { class: 'chip', text: k })))));
      main.append(el('section', { class: 'set-group' }, card));
    }

    function about() {
      const hero = el('div', { class: 'set-card' }, el('div', { class: 'about-hero' },
        el('div', { class: 'logo', dataset: { icon: 'window' } }),
        el('div', {},
          el('h2', { text: 'Nebula OS' }),
          el('p', { text: 'Version 1.0.0 "Aurora" — ブラウザで動くデスクトップ環境。' }))));
      const info = el('dl', { class: 'kv' },
        el('dt', { text: 'バージョン' }), el('dd', { text: '1.0.0 (stable)' }),
        el('dt', { text: '作者' }), el('dd', { text: 'hajikkoyure' }),
        el('dt', { text: 'カーネル' }), el('dd', { text: 'JS ' + (navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '—') }),
        el('dt', { text: 'ウィンドウ管理' }), el('dd', { text: 'NebulaWM (snap + zones)' }),
        el('dt', { text: 'シェル' }), el('dd', { text: 'Nebula Shell 1.0.0' }),
        el('dt', { text: 'デスクトップ環境' }), el('dd', { text: 'Aurora Shell' }),
        el('dt', { text: 'テーマ' }), el('dd', { text: store.get('theme') }),
        el('dt', { text: 'アクセント' }), el('dd', { text: store.get('accent') }),
        el('dt', { text: '分解能' }), el('dd', { text: `${screen.width} × ${screen.height} @${devicePixelRatio}x` }),
        el('dt', { text: '言語' }), el('dd', { text: navigator.language })
      );
      main.append(el('section', { class: 'set-group' }, hero));
      main.append(el('section', { class: 'set-group' }, el('div', { class: 'set-card' }, el('div', { class: 'set-row' }, info))));
      main.append(group('credits',
        row('開発者', '設計・実装', el('span', { class: 'tiny dim', text: 'hajikkoyure' })),
        row('デザイン', 'すべてブラウザ標準 API のみで描画', el('span', { class: 'tiny dim', text: 'HTML · CSS · Canvas · WebAudio' })),
        row('データ', 'すべてこのブラウザの localStorage に保存されます', el('span', { class: 'tiny dim', text: '外部送信なし' }))
      ));
    }

    render();
  }

  OS.apps.register({
    id: 'settings',
    name: '設定',
    icon: 'sliders',
    accent: ['#64748b', '#94a3b8'],
    width: 900, height: 620, minWidth: 560, minHeight: 380,
    keywords: 'settings preferences theme wallpaper 設定 環境設定',
    description: 'テーマ、壁紙、音量などを設定します。',
    mount
  });
})(window.OS);
