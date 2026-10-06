/* App: Calculator */
(function (OS) {
  'use strict';
  const { el, $, $$, esc } = OS.util;
  const { icons, store, notify } = OS;

  function mount(root, win) {
    let expr = '', val = '0', last = null, fresh = true;

    const exprEl = el('div', { class: 'calc-expr' });
    const valEl = el('div', { class: 'calc-val', text: '0' });
    const out = el('div', { class: 'calc-out' }, exprEl, valEl);
    const hist = el('div', { class: 'calc-history' });
    const pad = el('div', { class: 'calc-pad' });

    const KEYS = [
      ['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'],
      ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
      ['4', ''], ['5', ''], ['6', ''], ['−', 'op'],
      ['1', ''], ['2', ''], ['3', ''], ['+', 'op'],
      ['0', 'wide'], ['.', ''], ['=', 'eq']
    ];

    const glyph = { '÷': '/', '×': '*', '−': '-' };

    function compute(a, op, b) {
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? NaN : a / b;
        default: return b;
      }
    }
    const fmt = (n) => {
      if (!isFinite(n)) return 'エラー';
      const r = Math.round(n * 1e10) / 1e10;
      if (Math.abs(r) >= 1e12 || (Math.abs(r) < 1e-6 && r !== 0)) return r.toExponential(6);
      return String(r);
    };

    function show() {
      valEl.textContent = val;
      exprEl.textContent = expr;
      win.setSub(val === '0' && !expr ? '' : val);
    }

    function press(k) {
      if (/^[0-9]$/.test(k)) {
        if (fresh) { val = k === '0' ? '0' : k; fresh = false; }
        else val = val === '0' ? k : val + k;
      } else if (k === '.') {
        if (fresh) { val = '0.'; fresh = false; }
        else if (!val.includes('.')) val += '.';
      } else if (k === 'AC') {
        expr = ''; val = '0'; last = null; fresh = true; hist.textContent = '';
      } else if (k === '±') {
        val = val.startsWith('-') ? val.slice(1) : (val === '0' ? val : '-' + val);
      } else if (k === '%') {
        val = fmt(parseFloat(val) / 100);
      } else if (['+', '-', '*', '/'].includes(k)) {
        if (expr && last && !fresh) {
          const r = compute(parseFloat(last), last, parseFloat(val));
          val = fmt(r);
        }
        last = val; expr = val + ' ' + k; fresh = true;
      } else if (k === '=') {
        if (!last) return;
        const op = expr.split(' ')[1];
        const a = parseFloat(last), b = parseFloat(val);
        const r = compute(a, op, b);
        hist.textContent = `${fmt(a)} ${op} ${fmt(b)} =`;
        expr = ''; val = fmt(r); last = null; fresh = true;
      }
      show();
    }

    KEYS.forEach(([label, cls]) => {
      const b = el('button', { class: 'ckey ' + cls, text: label, dataset: { k: label } });
      b.addEventListener('click', () => { press(label); beep(); });
      pad.append(b);
    });

    const onKey = (e) => {
      const k = e.key;
      if (/^[0-9.]$/.test(k)) press(k);
      else if (k === '+') press('+');
      else if (k === '-') press('-');
      else if (k === '*') press('*');
      else if (k === '/') { e.preventDefault(); press('/'); }
      else if (k === 'Enter' || k === '=') press('=');
      else if (k === 'Backspace') { val = val.length > 1 ? val.slice(0, -1) : '0'; show(); }
      else if (k === 'Escape') press('AC');
      else return;
      beep();
    };
    win.root.addEventListener('keydown', onKey);
    win.root.tabIndex = 0;

    /* tiny click feedback */
    let ctxAudio = null;
    function beep() {
      if (!store.get('sound')) return;
      try {
        ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
        const o = ctxAudio.createOscillator(), g = ctxAudio.createGain();
        o.type = 'sine'; o.frequency.value = 640;
        g.gain.setValueAtTime(0.03, ctxAudio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctxAudio.currentTime + 0.06);
        o.connect(g).connect(ctxAudio.destination);
        o.start(); o.stop(ctxAudio.currentTime + 0.06);
      } catch (_) {}
    }

    root.className = 'app calc';
    root.append(out, hist, pad);
    win.setAccent('#fbbf24');
    win.setTitle('計算機');
    icons.paint(root);
    setTimeout(() => win.root.focus(), 60);
  }

  OS.apps.register({
    id: 'calculator',
    name: '計算機',
    icon: 'calculator',
    accent: ['#fbbf24', '#f97316'],
    width: 320, height: 480, minWidth: 260, minHeight: 380,
    keywords: 'calculator 計算機 電卓',
    description: 'キーボード入力にも対応した計算機。',
    mount
  });
})(window.OS);
