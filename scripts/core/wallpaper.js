/* Nebula OS — wallpaper engine */
(function (OS) {
  'use strict';
  const { $, $$, bus, lerp, clamp } = OS.util;
  const { store } = OS;

  const LIST = [
    { id: 'aurora',   name: 'オーロラ',   kind: 'canvas', renderer: 'aurora' },
    { id: 'nebula',   name: '星雲',       kind: 'canvas', renderer: 'nebula' },
    { id: 'mesh',     name: 'メッシュ',   kind: 'css' },
    { id: 'dawn',     name: 'ドーン',     kind: 'css' },
    { id: 'grid',     name: 'グリッド',   kind: 'css' },
    { id: 'graphite', name: 'グラファイト', kind: 'css' }
  ];

  const engines = new Map();   // name -> {canvas, ctx, raf, stop, resize}
  let active = null;

  function canvasFor(name) {
    let wrap = $(`#wallpaper [data-renderer="${name}"]`);
    if (!wrap) return null;
    let cv = wrap.querySelector('canvas');
    if (!cv) { cv = document.createElement('canvas'); wrap.append(cv); }
    return { wrap, cv, ctx: cv.getContext('2d') };
  }

  function sizeCanvas(cv, scale = 0.5) {
    cv.width = Math.max(2, Math.floor(innerWidth * scale));
    cv.height = Math.max(2, Math.floor(innerHeight * scale));
    cv.style.width = '100%';
    cv.style.height = '100%';
  }

  /* ── shared helpers ── */
  function rgba(hex, a) {
    const c = OS.util.hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }
  const accents = () => [store.get('accent'), store.get('accent2'), store.get('accent3')];

  /* ── Aurora: slow drifting light ribbons ── */
  function aurora(cv, ctx, t) {
    const w = cv.width, h = cv.height;
    const [a1, a2, a3] = accents();

    // base
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#05060d');
    g.addColorStop(.5, '#080a18');
    g.addColorStop(1, '#04050b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'screen';

    // Subtle background ambient illumination
    const cols = [a1, a2, a3];
    const amb = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.65);
    amb.addColorStop(0, rgba(cols[0], 0.12));
    amb.addColorStop(0.5, rgba(cols[1], 0.05));
    amb.addColorStop(1, 'transparent');
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, w, h);

    // aurora curtains
    ctx.globalCompositeOperation = 'screen';
    for (let band = 0; band < 4; band++) {
      const col = [a3, a1, a2, a3][band];
      const baseY = h * (0.18 + band * 0.2) + Math.sin(t * 0.12 + band) * h * 0.035;
      // body
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += Math.max(2, w / 120)) {
        const n = x / w;
        const y = baseY
          + Math.sin(n * 5.2 + t * 0.5 + band * 2) * h * 0.055
          + Math.sin(n * 11.3 - t * 0.33 + band) * h * 0.028
          + Math.sin(n * 2.1 + t * 0.2) * h * 0.05;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const cg = ctx.createLinearGradient(0, baseY - h * .18, 0, h);
      cg.addColorStop(0, rgba(col, 0.0));
      cg.addColorStop(.22, rgba(col, 0.15));
      cg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = cg;
      ctx.fill();
      // bright crest
      ctx.beginPath();
      for (let x = 0; x <= w; x += Math.max(2, w / 120)) {
        const n = x / w;
        const y = baseY
          + Math.sin(n * 5.2 + t * 0.5 + band * 2) * h * 0.055
          + Math.sin(n * 11.3 - t * 0.33 + band) * h * 0.028
          + Math.sin(n * 2.1 + t * 0.2) * h * 0.05;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = rgba(col, 0.22);
      ctx.lineWidth = Math.max(1, h * 0.0022);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── Nebula: starfield + drifting clouds ── */
  let stars = null;
  function makeStars(w, h) {
    const n = Math.floor((w * h) / 900);
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 0.9 + 0.2, p: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 1.6 });
    }
    return arr;
  }

  function nebula(cv, ctx, t) {
    const w = cv.width, h = cv.height;
    if (!stars || stars.length < 10) stars = makeStars(w, h);
    const [a1, a2, a3] = accents();

    const g = ctx.createLinearGradient(0, 0, w * .4, h);
    g.addColorStop(0, '#05060e');
    g.addColorStop(.6, '#0a0818');
    g.addColorStop(1, '#04040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // dust clouds
    ctx.globalCompositeOperation = 'screen';
    const clouds = [
      { c: a1, ph: 0.0, sp: 0.035, r: 0.55 },
      { c: a2, ph: 2.1, sp: 0.028, r: 0.48 },
      { c: a3, ph: 4.3, sp: 0.042, r: 0.40 }
    ];
    clouds.forEach((cl, i) => {
      const x = (0.5 + 0.36 * Math.sin(t * cl.sp + cl.ph)) * w;
      const y = (0.5 + 0.30 * Math.cos(t * cl.sp * 1.3 + cl.ph)) * h;
      const r = cl.r * Math.min(w, h);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(cl.c, 0.20));
      rg.addColorStop(.5, rgba(cl.c, 0.06));
      rg.addColorStop(1, rgba(cl.c, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });

    // stars
    for (const s of stars) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = `rgba(255,255,255,${(0.16 + tw * 0.72).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.7 + tw * 0.5), 0, 6.2832);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const RENDERERS = { aurora, nebula };

  function ensureEngine(name) {
    if (engines.has(name)) return engines.get(name);
    const c = canvasFor(name);
    if (!c) return null;
    const eng = { ...c, running: false, raf: 0, t: Math.random() * 100, last: 0, stop() { cancelAnimationFrame(this.raf); this.running = false; } };
    engines.set(name, eng);
    return eng;
  }

  function play(name) {
    const eng = ensureEngine(name);
    if (!eng) return;
    const fn = RENDERERS[name];
    if (!fn) return;
    sizeCanvas(eng.cv);
    stars = null;
    eng.stop();
    eng.running = true;
    const loop = (now) => {
      if (!eng.running) return;
      if (now - eng.last > 30) {            // ~33 fps cap
        eng.last = now;
        eng.t += 0.016 * (name === 'aurora' ? 1 : 1);
        fn(eng.cv, eng.ctx, eng.t);
      }
      eng.raf = requestAnimationFrame(loop);
    };
    eng.raf = requestAnimationFrame(loop);
  }

  function apply(id, force) {
    const def = LIST.find(w => w.id === id) || LIST[0];
    if (!force && active === def.id) return;
    active = def.id;

    // fade all layers out, then bring the chosen one in
    $$('#wallpaper > *').forEach(n => n.classList.remove('is-active'));
    const target = def.kind === 'canvas'
      ? $(`#wallpaper [data-renderer="${def.renderer}"]`)
      : $(`#wallpaper [data-wallpaper="${def.id}"]`);

    // keep the nebula engine running underneath as texture for the aurora look
    if (def.renderer === 'aurora') { play('aurora'); }
    else if (def.renderer === 'nebula') { engines.get('aurora')?.stop(); play('nebula'); }
    else { engines.get('aurora')?.stop(); engines.get('nebula')?.stop(); }

    setTimeout(() => target?.classList.add('is-active'), 120);
    $('#wallpaper').dataset.wallpaper = def.id;
    bus.emit('wallpaper', def.id);
  }

  addEventListener('resize', () => {
    engines.forEach(e => { if (e.running) { sizeCanvas(e.cv); stars = null; } });
  });

  /* ── thumbnails for Settings ── */
  function thumb(id, node) {
    const def = LIST.find(w => w.id === id);
    const [a1, a2, a3] = accents();
    const map = {
      aurora:   `radial-gradient(60% 50% at 25% 20%, ${rgba(a1,.7)}, transparent 62%), radial-gradient(55% 50% at 78% 70%, ${rgba(a2,.55)}, transparent 62%), radial-gradient(50% 45% at 60% 15%, ${rgba(a3,.4)}, transparent 60%), #070814`,
      nebula:   `radial-gradient(45% 45% at 70% 25%, ${rgba(a2,.45)}, transparent 65%), radial-gradient(50% 50% at 25% 75%, ${rgba(a1,.4)}, transparent 65%), radial-gradient(40% 40% at 50% 50%, ${rgba(a3,.3)}, transparent 65%), #06060f`,
      mesh:     `radial-gradient(58% 46% at 12% 8%, ${rgba(a1,.55)}, transparent 62%), radial-gradient(46% 42% at 88% 14%, ${rgba(a2,.42)}, transparent 60%), radial-gradient(62% 50% at 78% 88%, ${rgba(a3,.34)}, transparent 64%), #0a0b1c`,
      dawn:     `radial-gradient(52% 44% at 18% 12%, rgba(255,190,120,.55), transparent 60%), radial-gradient(48% 46% at 82% 22%, rgba(255,120,150,.42), transparent 62%), linear-gradient(180deg,#2a1740,#8a3a52 70%,#241433)`,
      grid:     `linear-gradient(180deg,#08061a,#2b0a3e)`,
      graphite: `radial-gradient(50% 40% at 20% 10%, ${rgba(a1,.34)}, transparent 62%), linear-gradient(160deg,#eef0f8,#dfe3f2)`
    };
    node.style.background = map[def.id] || map.aurora;
    if (def.id === 'grid') {
      node.style.background += `, repeating-linear-gradient(0deg, rgba(90,214,255,.35) 0 1px, transparent 1px 12px)`;
    }
  }

  OS.wallpaper = {
    LIST, apply, thumb,
    get active() { return active; },
    repaint() { apply(store.get('wallpaper'), true); }
  };
})(window.OS);
