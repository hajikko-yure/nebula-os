/* ═══════════════════════════════════════════════════════════
   App: Mail
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el, $, dtf } = OS.util;
  const { icons, notify } = OS;

  const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const now = Date.now();

  const MAILS = [
    {
      from: 'Aria Nakamura', addr: 'aria@nebula.dev', color: ['#8b7dff', '#5ad6ff'],
      subj: 'デザインレビューのフィードバック', at: now - 22 * MIN, unread: true,
      body: `こんにちは。

デザインレビュー、無事に終わりました。お忙しいところすみません。
来月のリリースに向けて、ウィンドウスナップの挙動を少し相談させてください。

  1. 画面上端にドラッグしたときの最大化と、左右端の半分スナップ
  2. 上下左右の 4 分割ゾーン
  3. 最大化ボタンのホバーで配置候補を表示する案

1 と 3 はこのビルドで実装済みです。スクリーンショットを添付します。
2 だけ来判断が分かれるので、意見をもらえると助かります。

——— Aria`
    },
    {
      from: 'Nebula Releases', addr: 'releases@nebula.dev', color: ['#4ade80', '#22d3ee'],
      subj: 'Nebula OS 1.0.0「Aurora」を公開しました', at: now - 3 * HOUR, unread: true,
      body: `Nebula OS 1.0.0「Aurora」を公開しました。

主なポイント
  ・12 個のアプリ（Files / Terminal / Notepad / Music / Browser など）
  ・スナップとゾーンに対応したウィンドウマネージャ
  ・8 種類の壁紙（うち 2 つはリアルタイム描画）
  ・テーマ・アクセント・ガラス効果の即時反映

先行ビルド。试してくださった全員に感謝します。`
    },
    {
      from: 'Kaito', addr: 'kaito@studio.jp', color: ['#fbbf24', '#f97316'],
      subj: 'シンセについて', at: now - 5 * HOUR, unread: false,
      body: `清水さん、お疲れさまです。

前回入れたシンセ、abilidad 的可能性が repart。

  ・コード進行を 4 パターンから選択できる
  ・ rever を本物の convolution に差し替えた
  ・ スペクトラム表示を追加

次のリリースで filter を有効にする予定なので、
数値の意見をもらえれば反映します。

——— Kaito`
    },
    {
      from: 'System', addr: 'system@nebula.local', color: ['#64748b', '#94a3b8'],
      subj: 'ストレージの最適化が完了しました', at: now - DAY, unread: false,
      body: `索引の再構築が完了しました。

使用容量: 12.4 KB / 5.00 GB
ファイル数: 9
フォルダ数: 11

このメールは自動生成されています。`
    },
    {
      from: 'Yuki', addr: 'yuki@design.jp', color: ['#ff7ad9', '#fbbf24'],
      subj: 'snap flyout について', at: now - 2 * DAY, unread: false,
      body: `デザインレビュー、楽しかった。ありがとう。

  ・ガラスのぼかしを 34px にしました
  ・ 影を 3 段階に分けました
  ・ Dock の magnification はそのままがよさそう

来週また時間を確保できたら連絡します。

——— Yuki`
    },
    {
      from: 'Sora', addr: 'sora@nebula.dev', color: ['#22d3ee', '#818cf8'],
      subj: 'Re: ファイルマネージャのドラッグ＆ドロップ', at: now - 3 * DAY, unread: false,
      body: `対応しました。

  ・フォルダへのドロップで移動
  ・パンくずリストにもドロップできる
  ・取り消しキーに対応

テストをお願いします。

——— Sora`
    },
    {
      from: 'Nexa', addr: 'nexa@nebula.dev', color: ['#a78bfa', '#f472b6'],
      subj: '次期メンテナンス予定', at: now - 5 * DAY, unread: false,
      body: `次回のメンテナンス予定です。

  ・ 20:00 — 04:00
  ・ 影響: ランチャーとオーディオ
  ・ 作業: インデックス再構築

——— Nexa`
    }
  ];

  const when = (t) => {
    const d = Date.now() - t;
    if (d < DAY) return dtf.time(new Date(t));
    if (d < 7 * DAY) return WD[new Date(t).getDay()];
    return dtf.dateS(new Date(t));
  };

  function mount(root, win) {
    let sel = 0;
    const list = el('div', { class: 'list' });
    const reader = el('div', { class: 'reader' });
    const toolbar = el('div', { class: 'app-toolbar' },
      el('button', { class: 'icon-btn', id: 'mlNew', title: '新規作成' }, el('span', { dataset: { icon: 'edit' } })),
      el('button', { class: 'icon-btn', id: 'mlRead', title: 'すべて既読にする' }, el('span', { dataset: { icon: 'check' } })),
      el('div', { class: 'sep' }),
      el('span', { class: 'app-title', text: '受信トレイ' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'chip', id: 'mlCount' }));
    root.className = 'app mail';
    root.append(toolbar, el('div', { class: 'app-body' }, list, reader));
    win.setAccent('#fb7185');

    function renderList() {
      list.innerHTML = '';
      MAILS.forEach((m, i) => {
        const it = el('button', { class: 'mitem' + (i === sel ? ' is-on' : '') },
          m.unread ? el('span', { class: 'unread' }) : null,
          el('div', { class: 'top' },
            el('span', { class: 'who', text: m.from }),
            el('span', { class: 'when', text: when(m.at) })),
          el('div', { class: 'subj', text: m.subj }),
          el('div', { class: 'prev', text: m.body.replace(/\s+/g, ' ').slice(0, 52) }));
        it.addEventListener('click', () => { sel = i; m.unread = false; render(); });
        list.append(it);
      });
      const unread = MAILS.filter(m => m.unread).length;
      toolbar.querySelector('#mlCount').textContent = unread ? `未読 ${unread}` : 'すべて既読';
    }

    function renderReader() {
      const m = MAILS[sel];
      reader.innerHTML = '';
      if (!m) {
        reader.append(el('div', { class: 'empty-state' },
          el('span', { dataset: { icon: 'inbox' } }),
          el('h3', { text: 'メールがありません' }),
          el('p', { text: '受信トレイは空です。' })));
        icons.paint(reader);
        return;
      }
      const head = el('div', { class: 'mread-head' },
        el('h3', { text: m.subj }),
        el('div', { class: 'mread-from' },
          el('div', { class: 'av', style: { background: `linear-gradient(150deg,${m.color[0]},${m.color[1]})` }, text: m.from.charAt(0) }),
          el('div', {},
            el('div', {}, el('b', { text: m.from })),
            el('div', { class: 'tiny dim', text: m.addr + ' — ' + dtf.dtS(new Date(m.at)) })),
          el('div', { class: 'spacer' }),
          el('button', { class: 'icon-btn', id: 'mRep', title: '返信' }, el('span', { dataset: { icon: 'send' } })),
          el('button', { class: 'icon-btn', id: 'mDel', title: '削除' }, el('span', { dataset: { icon: 'trash' } }))));

      const body = el('div', { class: 'mread-body' });
      m.body.split('\n').forEach(p => body.append(el('p', { text: p })));
      reader.append(head, body);

      head.querySelector('#mRep').addEventListener('click', () =>
        notify.notify({ title: '返信モード', body: 'このデモでは送信できません。', timeout: 1800 }));
      head.querySelector('#mDel').addEventListener('click', () => {
        MAILS.splice(sel, 1);
        sel = Math.max(0, sel - 1);
        render();
        notify.notify({ title: '削除しました', body: MAILS[sel]?.subj || '', timeout: 1600 });
      });

      win.setTitle(m.subj);
      win.setSub(m.from);
      icons.paint(reader);
    }

    function render() { renderList(); renderReader(); }

    toolbar.querySelector('#mlNew').addEventListener('click', async () => {
      const s = await notify.prompt('新規メール', '件名を入力', '無題');
      if (!s) return;
      MAILS.unshift({
        from: OS.session.user(), addr: 'me@nebula.local', color: ['#8b7dff', '#ff7ad9'],
        subj: s, at: Date.now(), unread: true,
        body: '（このデモでは作成のみ可能です。本文の編集は読み取り専用です。）'
      });
      sel = 0; render();
    });
    toolbar.querySelector('#mlRead').addEventListener('click', () => { MAILS.forEach(m => m.unread = false); render(); });

    render();
  }

  OS.apps.register({
    id: 'mail',
    name: 'メール',
    icon: 'mail',
    accent: ['#fb7185', '#f59e0b'],
    width: 860, height: 580, minWidth: 520, minHeight: 320,
    keywords: 'mail inbox email メール受信',
    description: '受信トレイのデモ。サンプルメールが入っています。',
    mount
  });
})(window.OS);
