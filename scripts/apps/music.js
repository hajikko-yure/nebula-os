/* App: Music — generative synth player (WebAudio) */
(function (OS) {
  'use strict';
  const { el, $, $$, pad2 } = OS.util;
  const { icons, store, notify, fs, launcher } = OS;

  const SCALES = {
    minor:    [0, 2, 3, 5, 7, 8, 10],
    major:    [0, 2, 4, 5, 7, 9, 11],
    dorian:   [0, 2, 3, 5, 7, 9, 10],
    lydian:   [0, 2, 4, 6, 7, 9, 11],
    pentaton: [0, 3, 5, 7, 10]
  };
  const PROGS = {
    i:    [0, 5, 3, 4],       // degrees in scale for 4 chords
    vi:   [5, 3, 4, 0],
    desc: [0, 3, 5, 4]
  };

  const TRACKS = [
    { title: 'Glass Rain',      artist: 'Nebula Ensemble', bpm: 84,  root: 53, scale: 'minor',    prog: 'i',    dur: 212, mood: '雨音と硝子' },
    { title: 'Aurora Drift',    artist: 'Nebula Ensemble', bpm: 72,  root: 50, scale: 'lydian',   prog: 'desc', dur: 246, mood: '光の流れ' },
    { title: 'Midnight Tape',   artist: 'Analog Ghost',    bpm: 92,  root: 46, scale: 'dorian',   prog: 'vi',   dur: 198, mood: '夜のドライブ' },
    { title: 'Solar Bloom',     artist: 'Helios',          bpm: 66,  root: 55, scale: 'major',    prog: 'desc', dur: 264, mood: '朝日の光' },
    { title: 'Deep Field',      artist: 'Nebula Ensemble', bpm: 58,  root: 41, scale: 'minor',    prog: 'i',    dur: 300, mood: '宇宙の静けさ' },
    { title: 'Pixel Bloom',     artist: '8bit Garden',     bpm: 104, root: 60, scale: 'pentaton', prog: 'vi',   dur: 174, mood: 'カテゴリ：メモ' },
    { title: 'Slow Tide',       artist: 'Harbour',         bpm: 70,  root: 48, scale: 'dorian',   prog: 'desc', dur: 228, mood: '潮の音' },
    { title: 'Night Coffee',    artist: 'Analog Ghost',    bpm: 88,  root: 44, scale: 'major',    prog: 'i',    dur: 205, mood: '午前3時' }
  ];

  const fmt = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;

  /* ═════════ engine ═════════ */
  class Engine {
    constructor() {
      this.ctx = null; this.playing = false; this.track = 0;
      this.step = 0; this.nextTime = 0; this.timer = null;
      this.pos = 0; this.startedAt = 0;
      this.vol = (store.get('volume') || 70) / 100 * 0.5;
    }
    ensure() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.vol;
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 2200;
      this.filter.Q.value = 0.7;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.conv = this.ctx.createConvolver();
      this.conv.buffer = this.makeIR(2.6, 2.4);
      this.wet = this.ctx.createGain(); this.wet.gain.value = 0.32;
      this.dry = this.ctx.createGain(); this.dry.gain.value = 0.8;
      this.bus = this.ctx.createGain();
      this.bus.connect(this.filter);
      this.filter.connect(this.dry).connect(this.master);
      this.filter.connect(this.conv).connect(this.wet).connect(this.master);
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    makeIR(dur, decay) {
      const rate = this.ctx.sampleRate, len = Math.floor(rate * dur);
      const buf = this.ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }
    setVolume(v) { this.vol = (v / 100) * 0.5; if (this.master) this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.05); }

    note(midi, t, dur, type = 'triangle', gain = 0.12, detune = 0) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      o.detune.value = detune;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.bus);
      o.start(t); o.stop(t + dur + 0.05);
    }
    kick(t) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(this.bus);
      o.start(t); o.stop(t + 0.34);
    }
    hat(t, open) {
      const len = open ? 0.14 : 0.045;
      const buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * len), this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 5);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = this.ctx.createGain(); g.gain.value = 0.055;
      s.connect(f).connect(g).connect(this.bus);
      s.start(t);
    }
    noiseSweep(t, dur) {
      const len = Math.ceil(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(4200, t + dur * 0.6);
      f.frequency.exponentialRampToValueAtTime(600, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(this.bus);
      s.start(t);
    }

    start(i) {
      this.ensure();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.stop(true);
      this.track = (i ?? this.track) % TRACKS.length;
      const t = TRACKS[this.track];
      this.spb = 60 / t.bpm / 4;                 // 16th note
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
      this.startedAt = this.ctx.currentTime;
      this.pos = 0;
      this.playing = true;
      this.filter.frequency.cancelScheduledValues(this.ctx.currentTime);
      this.filter.frequency.setValueAtTime(600, this.ctx.currentTime);
      this.filter.frequency.linearRampToValueAtTime(1400 + Math.random() * 2400, this.ctx.currentTime + 6);
      this.timer = setInterval(() => this.scheduler(), 40);
      this.emit && this.emit();
    }
    stop(silent) {
      this.playing = false;
      clearInterval(this.timer);
      if (!silent) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(this.master.gain.value, t);
        this.master.gain.linearRampToValueAtTime(0, t + 0.25);
        setTimeout(() => { if (!this.playing && this.master) this.master.gain.setValueAtTime(this.vol, t); }, 400);
      }
      this.emit && this.emit();
    }
    scheduler() {
      const t = TRACKS[this.track];
      const scale = SCALES[t.scale];
      const prog = PROGS[t.prog];
      while (this.nextTime < this.ctx.currentTime + 0.18) {
        const s = this.step;
        const bar = Math.floor(s / 16);
        const chordDeg = prog[bar % prog.length];
        const chordRoot = t.root + scale[chordDeg % scale.length] + 12 * Math.floor(chordDeg / scale.length);
        const T = this.nextTime;

        // pad on bar start
        if (s % 16 === 0) {
          [0, 2, 4].forEach((iv, i) => {
            const deg = scale[(chordDeg + iv) % scale.length];
            const oct = 12 * Math.floor((chordDeg + iv) / scale.length);
            this.note(chordRoot + deg + oct - 12, T, this.spb * 15, 'sawtooth', 0.035, i * 6 - 6);
            this.note(chordRoot + deg + oct, T + 0.02, this.spb * 14, 'triangle', 0.045, -i * 5);
          });
          if (bar % 4 === 0) this.noiseSweep(T, this.spb * 16);
        }
        // arp
        if (s % 2 === 0) {
          const deg = scale[(chordDeg + [0, 2, 4, 6, 4, 2][(s / 2) % 6]) % scale.length];
          const m = chordRoot + deg + 12;
          this.note(m, T, this.spb * 1.6, 'triangle', 0.055, 0);
        }
        // bass
        if (s % 8 === 0) this.note(chordRoot - 24, T, this.spb * 6, 'sine', 0.14);
        // drums
        if (s % 8 === 0) this.kick(T);
        if (s % 8 === 4) this.hat(T, s % 16 === 12);
        if (s % 2 === 0 && s % 8 !== 4) this.hat(T, false);

        this.nextTime += this.spb;
        this.step++;
        this.pos = this.step * this.spb;
        if (this.pos >= t.dur) { this.next(1); return; }
      }
    }
    next(dir) {
      const i = (this.track + dir + TRACKS.length) % TRACKS.length;
      this.start(i);
    }
    get elapsed() { return Math.min(this.pos, TRACKS[this.track].dur); }
    get duration() { return TRACKS[this.track].dur; }
    spectrum() { this.analyser.getByteFrequencyData(this.data); return this.data; }
  }

  let engine = new Engine();

  /* ═════════ app ═════════ */
  OS.apps.register({
    id: 'music',
    name: 'ミュージック',
    icon: 'music',
    accent: ['#ff7ad9', '#8b7dff'],
    width: 720, height: 620, minWidth: 380, minHeight: 460,
    keywords: 'music player audio 音楽 プレイヤー',
    description: 'Generative Synth — WebAudio でリアルタイムに生成される音楽。',
    mount(root, win) {
      engine.emit = render;
      const art = el('div', { class: 'music-art is-spin' }, (() => { const c = document.createElement('canvas'); return c; })(), el('div', { class: 'ring' }));
      const title = el('h3', { text: TRACKS[0].title });
      const artist = el('p', { text: TRACKS[0].artist + ' — ' + TRACKS[0].mood });
      const viz = el('div', { class: 'music-viz' });
      for (let i = 0; i < 40; i++) viz.append(el('i'));
      const curT = el('span', { text: '0:00' });
      const durT = el('span', { text: '0:00' });
      const seek = el('input', { type: 'range', min: 0, max: 1000, value: 0, style: { flex: '1' } });

      const playIcon = el('span', { dataset: { icon: 'play' } });
      const playBtn = el('button', { class: 'mbtn big' }, playIcon);
      const prevBtn = el('button', { class: 'mbtn', title: '前へ' }, el('span', { dataset: { icon: 'prev' } }));
      const nextBtn = el('button', { class: 'mbtn', title: '次へ' }, el('span', { dataset: { icon: 'next' } }));
      const shufBtn = el('button', { class: 'mbtn', title: 'シャッフル' }, el('span', { dataset: { icon: 'shuffle' } }));
      const repBtn  = el('button', { class: 'mbtn', title: 'リピート' }, el('span', { dataset: { icon: 'repeat' } }));
      const volIn = el('input', { type: 'range', min: 0, max: 100, value: store.get('volume'), style: { width: '90px' } });

      const list = el('div', { class: 'music-list' });
      const main = el('div', { class: 'main' },
        art,
        el('div', { class: 'music-meta' }, title, artist),
        viz,
        el('div', { class: 'music-seek' }, curT, seek, durT),
        el('div', { class: 'music-controls' }, shufBtn, prevBtn, playBtn, nextBtn, repBtn),
        el('div', { style: { display: 'flex', justifyContent: 'center', padding: '0 0 14px' } }, volIn),
        list);

      const toolbar = el('div', { class: 'app-toolbar' },
        el('span', { class: 'app-title', text: 'Nebula Radio' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'chip', text: 'GENERATIVE' }));
      root.className = 'app music';
      root.append(toolbar, el('div', { class: 'app-body' }, main));

      /* art canvas */
      const cv = art.querySelector('canvas');
      const actx = cv.getContext('2d');
      function sizeArt() { cv.width = 380; cv.height = 380; }
      sizeArt();
      function paintArt() {
        const t = TRACKS[engine.track];
        const g = actx.createLinearGradient(0, 0, 380, 380);
        const c1 = store.get('accent'), c2 = store.get('accent2'), c3 = store.get('accent3');
        const s = engine.playing ? (engine.elapsed / engine.duration) * Math.PI * 2 : 0;
        g.addColorStop(0, c1);
        g.addColorStop(0.5, c2);
        g.addColorStop(1, c3);
        actx.fillStyle = g;
        actx.fillRect(0, 0, 380, 380);
        actx.globalCompositeOperation = 'overlay';
        for (let i = 0; i < 5; i++) {
          const a = s + i * 1.2;
          const x = 190 + Math.cos(a) * (70 + i * 16);
          const y = 190 + Math.sin(a * 1.3) * (70 + i * 16);
          const r = 60 + i * 22;
          const rg = actx.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, 'rgba(255,255,255,.30)');
          rg.addColorStop(1, 'rgba(255,255,255,0)');
          actx.fillStyle = rg;
          actx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        actx.globalCompositeOperation = 'source-over';
      }

      /* list */
      function renderList() {
        list.innerHTML = '';
        TRACKS.forEach((t, i) => {
          const row = el('button', { class: 'mtrack' + (i === engine.track ? ' is-on' : '') },
            el('span', { class: 'n', text: i === engine.track && engine.playing ? '♪' : String(i + 1) }),
            el('span', { class: 't' }, el('b', { text: t.title }), el('small', { text: t.artist })),
            el('span', { class: 'd', text: fmt(t.dur) }));
          row.addEventListener('click', () => { engine.start(i); });
          list.append(row);
        });
      }

      function render() {
        const t = TRACKS[engine.track];
        title.textContent = t.title;
        artist.textContent = t.artist + ' — ' + t.mood;
        playIcon.dataset.icon = engine.playing ? 'pause' : 'play';
        art.classList.toggle('is-spin', engine.playing);
        win.setTitle(t.title + ' — Nebula Radio');
        win.setSub(engine.playing ? '再生中' : '停止中');
        icons.paint(playBtn);
        renderList();
      }

      playBtn.addEventListener('click', () => {
        if (engine.playing) engine.stop(); else engine.start(engine.track);
        render();
      });
      prevBtn.addEventListener('click', () => { engine.next(-1); render(); });
      nextBtn.addEventListener('click', () => { engine.next(1); render(); });
      shufBtn.addEventListener('click', () => { engine.start(Math.floor(Math.random() * TRACKS.length)); render(); });
      repBtn.addEventListener('click', () => { repBtn.classList.toggle('is-on'); });
      volIn.addEventListener('input', () => { store.set('volume', +volIn.value); engine.setVolume(+volIn.value); });
      seek.addEventListener('input', () => { /* generative — seek disabled */ seek.value = 0; });

      /* visual loop */
      const bars = $$('i', viz);
      setInterval(() => {
        if (!engine.playing) { bars.forEach(b => b.style.height = '4%'); return; }
        const d = engine.spectrum();
        bars.forEach((b, i) => {
          const v = d[Math.floor(i / bars.length * d.length * 0.7)] / 255;
          b.style.height = Math.max(4, v * 100) + '%';
        });
        curT.textContent = fmt(engine.elapsed);
        durT.textContent = fmt(engine.duration);
        seek.style.setProperty('--pct', (engine.elapsed / engine.duration * 100) + '%');
        seek.value = engine.elapsed / engine.duration * 1000;
        paintArt();
      }, 70);
      paintArt();
      render();
    },
    onClose() { engine.stop(); }
  });
})(window.OS);
