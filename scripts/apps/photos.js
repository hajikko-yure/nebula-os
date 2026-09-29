/* ═══════════════════════════════════════════════════════════
   App: Photos — procedurally generated artwork
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el, $, $$, dtf } = OS.util;
  const { icons, store, notify, fs } = OS;

  const PIECES = [
    { name: 'オーロラ drift',  gen: auroraArt,   hue: [0, 360] },
    { name: '虹色の波',        gen: waveArt,     hue: [180, 320] },
    { name: '幾何光',          gen: geoArt,      hue: [200, 280] },
    { name: 'ソフトフォーカス',  gen: softArt,     hue: [0, 360] },
    { name: 'ナイトシティ',    gen: cityArt,     hue: [230, 300] },
    { name: '砂漠の波',        gen: duneArt,     hue: [20, 50] },
    { name: '联系起来',        gen: flowArt,     hue: [140, 200] },
    { name: 'グリッド・スタック',  gen: gridArt,     hue: [260, 320] }
  ];
  const H = s => s.charCodeAt(0);

  function canvas(w = 480, h = 360) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const rgb = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;

  function auroraArt(x, w, h, seed) {

    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#05060e'); g.addColorStop(1, '#0b0f22');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const cx = w * (.2 + .6 * Math.abs(Math.sin(seed + i)));
      const cy = h * (.25 + .5 * Math.abs(Math.cos(seed * 1.3 + i)));
      const r = Math.min(w, h) * (.35 + i * .07);
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, rgb(seed * 57 + i * 70, 80, 58, .55));
      rg.addColorStop(1, rgb(seed * 57 + i * 70, 80, 50, 0));
      x.fillStyle = rg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(255,255,255,${.1 + Math.random() * .5})`;
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * 1.1, 0, 6.28); x.fill();
    }
  }
  function waveArt(x, w, h, seed) {

    x.fillStyle = '#0a0a12'; x.fillRect(0, 0, w, h);
    const n = 7;
    for (let i = 0; i < n; i++) {
      x.beginPath();
      for (let px = 0; px <= w; px += 4) {
        const t = px / w;
        const y = h * (.5 + .34 * Math.sin(t * 6.2 + seed + i * .7) * Math.cos(t * 2.1 + i));
        px ? x.lineTo(px, y) : x.moveTo(px, y);
      }
      x.strokeStyle = rgb(seed * 40 + i * 28, 78, 58, .75);
      x.lineWidth = 1.4 + i * .25;
      x.stroke();
    }
  }
  function geoArt(x, w, h, seed) {

    x.fillStyle = '#0d0d16'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      x.save();
      x.translate(w / 2, h / 2);
      x.rotate(seed + i * .3);
      const r = 30 + i * 9;
      x.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        x[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      x.closePath();
      x.fillStyle = rgb(seed * 90 + i * 14, 70, 40 + (i % 5) * 6, .3);
      x.fill();
      x.strokeStyle = rgb(seed * 90 + i * 14, 85, 65, .55);
      x.lineWidth = 1; x.stroke();
      x.restore();
    }
  }
  function softArt(x, w, h, seed) {

    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, rgb(seed * 77, 70, 62));
    g.addColorStop(1, rgb(seed * 77 + 90, 65, 44));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 9; i++) {
      const cx = Math.random() * w, cy = Math.random() * h, r = 60 + Math.random() * 160;
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, `hsla(0,0%,100%,.22)`); rg.addColorStop(1, 'hsla(0,0%,100%,0)');
      x.fillStyle = rg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    x.globalCompositeOperation = 'source-over';
  }
  function cityArt(x, w, h, seed) {

    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0a1a'); g.addColorStop(.55, '#1a1030'); g.addColorStop(1, '#3a1230');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = rgb(seed * 40 + 300, 70, 60, .9);
    x.beginPath(); x.arc(w * .72, h * .3, 26, 0, 6.28); x.fill();
    let px = 0;
    while (px < w) {
      const bw = 20 + Math.random() * 44, bh = h * (.18 + Math.random() * .55);
      x.fillStyle = 'rgba(8,8,20,.92)';
      x.fillRect(px, h - bh, bw, bh);
      for (let wy = h - bh + 8; wy < h - 8; wy += 12) {
        for (let wx = px + 5; wx < px + bw - 6; wx += 10) {
          if (Math.random() > .45) {
            x.fillStyle = rgb(40 + Math.random() * 30, 90, 65, .8);
            x.fillRect(wx, wy, 4, 6);
          }
        }
      }
      px += bw + 4;
    }
  }
  function duneArt(x, w, h, seed) {

    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgb(seed * 30 + 25, 80, 66));
    g.addColorStop(1, rgb(seed * 30 + 10, 70, 38));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = rgb(45, 95, 72, .55);
    x.beginPath(); x.arc(w * .5, h * .3, 40, 0, 6.28); x.fill();
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      x.moveTo(0, h);
      for (let px = 0; px <= w; px += 6) {
        const t = px / w;
        x.lineTo(px, h * (.6 + i * .09) + Math.sin(t * 3 + seed + i) * 22);
      }
      x.lineTo(w, h); x.closePath();
      x.fillStyle = rgb(seed * 20 + 20 + i * 6, 62, 52 - i * 6, .85);
      x.fill();
    }
  }
  function flowArt(x, w, h, seed) {

    x.fillStyle = '#08120f'; x.fillRect(0, 0, w, h);
    x.lineWidth = 1.2;
    for (let i = 0; i < 160; i++) {
      const t = i / 160;
      x.beginPath();
      for (let s = 0; s <= 1; s += .02) {
        const px = s * w;
        const py = h * t + Math.sin(s * 9 + seed * 6 + t * 8) * 18 * Math.sin(s * Math.PI);
        s ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.strokeStyle = rgb(seed * 50 + t * 140, 70, 45 + t * 22, .7);
      x.stroke();
    }
  }
  function gridArt(x, w, h, seed) {

    x.fillStyle = '#08060f'; x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h * .35, 0, w / 2, h * .35, w * .5);
    g.addColorStop(0, rgb(seed * 60 + 290, 80, 50, .8));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(120,220,255,.30)'; x.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const p = (i / 20) * w;
      x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.stroke();
      x.beginPath(); x.moveTo(0, p); x.lineTo(w, p); x.stroke();
    }
    x.fillStyle = 'rgba(10,8,20,.9)';
    x.fillRect(0, h * .68, w, h * .32);
    x.strokeStyle = 'rgba(255,90,200,.7)';
    for (let i = 0; i < 12; i++) {
      const yy = h * .68 + Math.pow(i / 12, 2) * h * .32;
      x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke();
    }
  }

  function makeArtwork(seed) {
    const p = PIECES[seed % PIECES.length];
    const c = canvas(480, 360);
    p.gen(c.getContext('2d'), c.width, c.height, seed * 1.7 + 1);
    return { canvas: c, name: p.name };
  }

  function mount(root, win, arg) {
    let seed0 = 0;
    const grid = el('div', { class: 'photo-grid' });
    const toolbar = el('div', { class: 'app-toolbar' },
      el('span', { class: 'app-title', text: 'ギャラリー' }),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn--sm', id: 'pNew' }, el('span', { dataset: { icon: 'sparkles' } }), el('span', { text: '新作を生成' })),
      el('button', { class: 'icon-btn', id: 'pShuffle', title: 'シャッフル' }, el('span', { dataset: { icon: 'shuffle' } })));
    root.className = 'app photos';
    root.append(toolbar, el('div', { class: 'app-body' }, grid));

    function build(start) {
      grid.innerHTML = '';
      for (let i = 0; i < 12; i++) {
        const s = start + i;
        const art = makeArtwork(s);
        const fig = el('figure', { class: 'pitem' }, art.canvas, el('figcaption', { text: art.name }));
        fig.addEventListener('click', () => view(art, s));
        grid.append(fig);
      }
    }
    build(seed0);

    function view(art, s) {
      const big = canvas(960, 720);
      const c = big.getContext('2d');
      c.drawImage(art.canvas, 0, 0, 960, 720);
      const ov = el('div', { class: 'photo-view' }, big,
        el('div', { class: 'pv-bar' },
          el('button', { class: 'mbtn', text: '‹' }),
          el('span', { class: 'pv-title', text: art.name }),
          el('button', { class: 'mbtn', text: '›' }),
          el('div', { style: { width: '1px', height: '18px', background: 'rgba(255,255,255,.2)', margin: '0 4px' } }),
          el('button', { class: 'mbtn', title: 'PNG として保存' }, el('span', { dataset: { icon: 'download' } })),
          el('button', { class: 'mbtn', title: '閉じる' }, el('span', { dataset: { icon: 'x' } }))));
      const btns = $$('.mbtn', ov);
      btns[0].addEventListener('click', () => { ov.remove(); view(makeArtwork(s - 1), s - 1); });
      btns[1].addEventListener('click', () => { ov.remove(); view(makeArtwork(s + 1), s + 1); });
      btns[3].addEventListener('click', () => { big.toBlob(b => OS.util.download(`nebula-${s}.png`, b)); });
      btns[4].addEventListener('click', () => ov.remove());
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
      root.append(ov);
      icons.paint(ov);
    }

    toolbar.querySelector('#pNew').addEventListener('click', () => { seed0 = Math.floor(Math.random() * 500); build(seed0); });
    toolbar.querySelector('#pShuffle').addEventListener('click', () => { seed0 += 12; build(seed0); });

    win.setAccent('#ff7ad9');
    win.setTitle('写真');
  }

  OS.apps.register({
    id: 'photos',
    name: '写真',
    icon: 'image',
    accent: ['#ff7ad9', '#fbbf24'],
    width: 820, height: 580, minWidth: 420, minHeight: 340,
    keywords: 'photos images gallery 写真 画像',
    description: 'プロシージャル生成されたアートワークのギャラリー。',
    mount
  });
})(window.OS);
