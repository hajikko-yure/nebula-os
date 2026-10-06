/* App: Clock — world clock, stopwatch, timer */
(function (OS) {
  'use strict';
  const { el, $, pad2, clamp } = OS.util;
  const { icons, store, notify } = OS;

  const ZONES = [
    ['東京', 9], ['London', 0], ['New York', -5], ['Paris', 1], ['Dubai', 4], ['Sydney', 10]
  ];

  function mount(root, win) {
    let tab = 'clock';
    const tabs = el('div', { class: 'pill-tabs' },
      ...[['clock', '時計', 'clock'], ['world', '世界時計', 'globe'], ['stop', 'ストップウォッチ', 'timer'], ['timer', 'タイマー', 'clock']]
        .map(([k, label, ic]) => {
          const b = el('button', { class: 'ghost-btn', dataset: { k } }, el('span', { dataset: { icon: ic } }), el('span', { text: label }));
          b.addEventListener('click', () => { tab = k; render(); });
          return b;
        }));
    const content = el('div', { class: 'app-scroll' });
    const toolbar = el('div', { class: 'app-toolbar' }, tabs);
    root.className = 'app clk';
    root.append(toolbar, el('div', { class: 'app-body' }, el('div', { class: 'clk-face', id: 'clkFace' }, content)));
    win.setAccent('#a78bfa');

    /* state */
    let sw = { run: false, t0: 0, acc: 0, laps: [] };
    let tm = { run: false, total: 300, left: 300, endAt: 0 };
    const T = () => content;

    function analog(date) {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 200 200');
      svg.setAttribute('class', 'clk-analog');
      const mk = (tag, attrs) => { const n = document.createElementNS(svgNS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
      svg.append(mk('circle', { cx: 100, cy: 100, r: 94, fill: 'none', stroke: 'var(--stroke-2)', 'stroke-width': 2 }));
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const big = i % 5 === 0;
        const r1 = big ? 80 : 86, r2 = 92;
        svg.append(mk('line', {
          x1: 100 + Math.sin(a) * r1, y1: 100 - Math.cos(a) * r1,
          x2: 100 + Math.sin(a) * r2, y2: 100 - Math.cos(a) * r2,
          stroke: big ? 'var(--txt-1)' : 'var(--stroke-2)', 'stroke-width': big ? 2.4 : 1, 'stroke-linecap': 'round'
        }));
      }
      const s = date.getSeconds() + date.getMilliseconds() / 1000;
      const m = date.getMinutes() + s / 60;
      const h = (date.getHours() % 12) + m / 60;
      const hand = (len, w, ang, color) => mk('line', {
        x1: 100, y1: 100, x2: 100 + Math.sin(ang * Math.PI / 6) * len, y2: 100 - Math.cos(ang * Math.PI / 6) * len,
        stroke: color, 'stroke-width': w, 'stroke-linecap': 'round'
      });
      svg.append(hand(46, 5, h, 'var(--txt-0)'));
      svg.append(hand(70, 3.4, m, 'var(--txt-0)'));
      svg.append(hand(78, 1.6, s, 'var(--accent)'));
      svg.append(mk('circle', { cx: 100, cy: 100, r: 5, fill: 'var(--accent)' }));
      return svg;
    }

    function render() {
      tabs.querySelectorAll('.ghost-btn').forEach(b => b.classList.toggle('is-on', b.dataset.k === tab));
      content.innerHTML = '';
      if (tab === 'clock') {
        const d = new Date();
        content.append(el('div', { class: 'clk-time', id: 'cTime', text: `${pad2(d.getHours())}:${pad2(d.getSeconds())}` }));
        content.append(el('div', { class: 'clk-date', text: d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) }));
        content.append(analog(d));
      } else if (tab === 'world') {
        const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', width: '100%', padding: '18px' } });
        ZONES.forEach(([n, tz]) => {
          const d = new Date(Date.now() + tz * 3600e3);
          grid.append(el('div', { class: 'wx-stat' },
            el('small', { text: n }),
            el('b', { style: { fontSize: '26px' }, text: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` }),
            el('small', { text: 'UTC' + (tz >= 0 ? '+' : '') + tz })));
        });
        content.append(grid);
      } else if (tab === 'stop') {
        const disp = el('div', { class: 'clk-digits', id: 'swDisp', text: '0:00.00' });
        const laps = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '14px', minWidth: '200px' } });
        const start = el('button', { class: 'btn btn--primary', text: sw.run ? '停止' : (sw.acc ? '再開' : '開始') });
        const lap = el('button', { class: 'btn', text: 'ラップ' });
        const reset = el('button', { class: 'btn', text: 'リセット' });
        start.addEventListener('click', () => {
          if (sw.run) { sw.acc += Date.now() - sw.t0; sw.run = false; }
          else { sw.t0 = Date.now(); sw.run = true; }
          render();
        });
        lap.addEventListener('click', () => { if (sw.run) { sw.laps.unshift(sw.acc + Date.now() - sw.t0); render(); } });
        reset.addEventListener('click', () => { sw = { run: false, t0: 0, acc: 0, laps: [] }; render(); });
        content.append(disp, el('div', { style: { display: 'flex', gap: '8px', marginTop: '16px' } }, start, lap, reset), laps);
        sw.laps.forEach((l, i) => laps.append(el('div', { class: 'chip', style: { justifyContent: 'space-between', borderRadius: '8px', height: '26px' } },
          el('span', { text: 'Lap ' + (sw.laps.length - i) }), el('span', { text: fmtLap(l) }))));
      } else {
        const R = 74, C = 2 * Math.PI * R;
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ring.setAttribute('viewBox', '0 0 168 168');
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        Object.entries({ cx: 84, cy: 84, r: R, fill: 'none', stroke: 'var(--sunken)', 'stroke-width': 9 }).forEach(([k, v]) => bg.setAttribute(k, v));
        const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        Object.entries({ cx: 84, cy: 84, r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': 0 }).forEach(([k, v]) => fg.setAttribute(k, v));
        ring.append(bg, fg);
        const wrapR = el('div', { class: 'timer-ring' }, ring, el('div', { class: 'tr-txt', id: 'tmTxt', text: '5:00' }));
        const chips = el('div', { class: 'chips-row' },
          ...[60, 180, 300, 600, 900, 1800].map(s => {
            const b = el('button', { class: 'timer-chip', text: s >= 60 ? s / 60 + '分' : s + '秒' });
            b.addEventListener('click', () => { tm.total = s; tm.left = s; tm.run = false; render(); });
            return b;
          }));
        const go = el('button', { class: 'btn btn--primary', text: tm.run ? '一時停止' : (tm.left < tm.total ? '再開' : '開始') });
        const rst = el('button', { class: 'btn', text: 'リセット' });
        go.addEventListener('click', () => {
          if (tm.run) { tm.left = Math.max(0, tm.endAt - Date.now()) / 1000; tm.run = false; }
          else { tm.endAt = Date.now() + tm.left * 1000; tm.run = true; }
          render();
        });
        rst.addEventListener('click', () => { tm.run = false; tm.left = tm.total; render(); });
        content.append(wrapR, el('div', { style: { display: 'flex', gap: '8px', marginTop: '18px' } }, go, rst), chips);
        content.dataset.timer = '1';
      }
      icons.paint(content);
      tick();
    }

    const fmtLap = (ms) => `${Math.floor(ms / 60000)}:${pad2(Math.floor(ms / 1000) % 60)}.${pad2(Math.floor(ms / 10) % 100)}`;

    function tick() {
      const d = new Date();
      const t = $('#cTime');
      if (t) t.textContent = `${pad2(d.getHours())}:${pad2(d.getSeconds())}`;
      const swd = $('#swDisp');
      if (swd) {
        const ms = sw.acc + (sw.run ? Date.now() - sw.t0 : 0);
        swd.textContent = fmtLap(ms);
      }
      const tmt = $('#tmTxt');
      if (tmt) {
        let left = tm.run ? Math.max(0, (tm.endAt - Date.now()) / 1000) : tm.left;
        if (tm.run && left <= 0) {
          tm.run = false; tm.left = 0;
        notify.notify({ title: 'タイマー終了', body: '設定した時間が経過しました。', app: OS.apps.get('clock') });
          render();
        }
        tmt.textContent = `${Math.floor(left / 60)}:${pad2(Math.floor(left % 60))}`;
        const fg = content.querySelector('.timer-ring circle:last-child');
        if (fg) fg.setAttribute('stroke-dashoffset', String(2 * Math.PI * 74 * (1 - left / tm.total)));
      }
    }
    const iv = setInterval(tick, 100);
    win.onClose(() => clearInterval(iv));
    render();
  }

  OS.apps.register({
    id: 'clock',
    name: '時計',
    icon: 'clock',
    accent: ['#a78bfa', '#818cf8'],
    width: 460, height: 560, minWidth: 320, minHeight: 360,
    keywords: 'clock timer stopwatch 時計 タイマー',
    description: '世界時計・ストップウォッチ・タイマー。',
    mount
  });
})(window.OS);
