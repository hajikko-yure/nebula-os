/* App: Minesweeper */
(function (OS) {
  'use strict';
  const { el, $, $$, pad2 } = OS.util;
  const { icons, store, notify } = OS;

  const LEVELS = {
    easy:   { w: 9,  h: 9,  m: 10, label: '初級' },
    normal: { w: 16, h: 16, m: 40, label: '中級' },
    hard:   { w: 24, h: 16, m: 70, label: '上級' }
  };

  function mount(root, win) {
    let cfg = LEVELS[store.get('mineLevel')] || LEVELS.easy;
    let grid, over, started, flags, time, timer, flagsMode = false;

    const mineCnt = el('span', { text: '000' });
    const timeCnt = el('span', { text: '000' });
    const face = el('button', { class: 'mine-face', text: '🙂' });
    const dif = el('div', { class: 'dif' });
    Object.entries(LEVELS).forEach(([k, v]) => {
      const b = el('button', { class: 'dif-btn', text: v.label, dataset: { k } });
      b.addEventListener('click', () => { cfg = v; store.set('mineLevel', k); newGame(); });
      dif.append(b);
    });
    const head = el('div', { class: 'mine-head' },
      el('div', { class: 'mine-counter' }, el('span', { dataset: { icon: 'bomb' } }), mineCnt),
      face,
      el('div', { class: 'mine-counter' }, el('span', { dataset: { icon: 'clock' } }), timeCnt));
    const board = el('div', { class: 'mine-grid' });
    const msg = el('div', { class: 'mine-msg' });
    const wrap = el('div', { class: 'mine-wrap' }, board, msg, el('div', { style: { paddingBottom: '14px' } }, dif));
    const toolbar = el('div', { class: 'app-toolbar' },
      el('button', { class: 'icon-btn', id: 'mNew', title: '新しいゲーム' }, el('span', { dataset: { icon: 'refresh' } })),
      el('button', { class: 'icon-btn', id: 'mFlag', title: '旗モード (F)' }, el('span', { dataset: { icon: 'flag' } })),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tiny dim', id: 'mStat' }));
    root.className = 'app mine';
    root.append(toolbar, head, wrap);
    win.setAccent('#fb7185');

    function idx(x, y) { return y * cfg.w + x; }
    function inb(x, y) { return x >= 0 && y >= 0 && x < cfg.w && y < cfg.h; }

    function newGame() {
      clearInterval(timer); timer = null;
      over = false; started = false; flags = 0; time = 0;
      grid = Array.from({ length: cfg.w * cfg.h }, () => ({ m: false, n: 0, open: false, flag: false }));
      face.textContent = '🙂';
      msg.textContent = '';
      mineCnt.textContent = String(cfg.m).padStart(3, '0');
      timeCnt.textContent = '000';
      $$('.dif-btn', dif).forEach(b => b.classList.toggle('is-on', b.dataset.k === (store.get('mineLevel') || 'easy')));
      draw();
      win.setTitle(`マインスイーパー — ${cfg.label}`);
      win.setSub(`${cfg.w}×${cfg.h} / ${cfg.m} 爆弾`);
      toolbar.querySelector('#mStat').textContent = `爆弾 ${cfg.m}`;
    }

    function place(sx, sy) {
      let placed = 0;
      while (placed < cfg.m) {
        const x = Math.floor(Math.random() * cfg.w), y = Math.floor(Math.random() * cfg.h);
        if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) continue;
        const c = grid[idx(x, y)];
        if (c.m) continue;
        c.m = true; placed++;
      }
      for (let y = 0; y < cfg.h; y++) for (let x = 0; x < cfg.w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (inb(x + dx, y + dy) && grid[idx(x + dx, y + dy)].m) n++;
        }
        grid[idx(x, y)].n = n;
      }
    }

    function open(x, y) {
      if (!inb(x, y)) return;
      const c = grid[idx(x, y)];
      if (c.open || c.flag || over) return;
      if (!started) { started = true; place(x, y); timer = setInterval(() => { time++; timeCnt.textContent = String(Math.min(999, time)).padStart(3, '0'); }, 1000); }
      c.open = true;
      if (c.m) return lose(x, y);
      if (c.n === 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) open(x + dx, y + dy);
      checkWin();
      draw();
    }

    function toggleFlag(x, y) {
      if (!inb(x, y) || over) return;
      const c = grid[idx(x, y)];
      if (c.open) return;
      c.flag = !c.flag;
      flags += c.flag ? 1 : -1;
      mineCnt.textContent = String(Math.max(-99, cfg.m - flags)).padStart(3, '0');
      draw();
    }

    function checkWin() {
      const closed = grid.filter(c => !c.open).length;
      if (closed === cfg.m) {
        over = true; clearInterval(timer);
        grid.forEach(c => { if (c.m) c.flag = true; });
        face.textContent = '😎';
        msg.textContent = `クリア！ ${time} 秒`;
        msg.style.color = '#4ade80';
        notify.notify({ title: 'マインスイーパー クリア', body: `${cfg.label} を ${time} 秒でクリアしました！`, app: OS.apps.get('minesweeper') });
        draw();
      }
    }

    function lose(bx, by) {
      over = true; clearInterval(timer);
      face.textContent = '😵';
      msg.textContent = 'ゲームオーバー';
      msg.style.color = '#ff6b6b';
      grid.forEach(c => { if (c.m) c.open = true; });
      draw();
      $$('.mcell', board).forEach(n => {
        if (n.dataset.i == null) return;
        const c = grid[+n.dataset.i];
        if (c.m && c.flag) n.classList.add('is-wrong');
      });
    }

    function chord(x, y) {
      const c = grid[idx(x, y)];
      if (!c.open || !c.n) return;
      let f = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && inb(x + dx, y + dy) && grid[idx(x + dx, y + dy)].flag) f++;
      }
      if (f !== c.n) return;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && inb(x + dx, y + dy)) open(x + dx, y + dy);
      }
    }

    function draw() {
      board.style.gridTemplateColumns = `repeat(${cfg.w}, 28px)`;
      board.innerHTML = '';
      grid.forEach((c, i) => {
        const x = i % cfg.w, y = Math.floor(i / cfg.w);
        const n = el('div', { class: 'mcell' + (c.open ? ' is-open' : ''), dataset: { i } });
        if (c.open && c.m) { n.classList.add('is-bomb'); n.textContent = '💣'; }
        else if (c.open && c.n) { n.classList.add('c' + c.n); n.textContent = c.n; }
        else if (c.flag) { n.classList.add('is-flag'); n.textContent = '🚩'; }
        n.addEventListener('click', (e) => { if (e.shiftKey || flagsMode) toggleFlag(x, y); else open(x, y); });
        n.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); toggleFlag(x, y); });
        n.addEventListener('dblclick', () => chord(x, y));
        board.append(n);
      });
    }

    face.addEventListener('click', newGame);
    toolbar.querySelector('#mNew').addEventListener('click', newGame);
    toolbar.querySelector('#mFlag').addEventListener('click', (e) => {
      flagsMode = !flagsMode;
      e.currentTarget.classList.toggle('is-on', flagsMode);
    });
    win.root.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'f') toolbar.querySelector('#mFlag').click(); });
    win.root.tabIndex = 0;

    newGame();
    icons.paint(root);
  }

  OS.apps.register({
    id: 'minesweeper',
    name: 'マインスイーパー',
    icon: 'bomb',
    accent: ['#fb7185', '#f59e0b'],
    width: 560, height: 480, minWidth: 340, minHeight: 320,
    keywords: 'minesweeper game ゲーム マイン',
    description: '爆弾を避けて すべてのマスを開きます。',
    mount
  });
})(window.OS);
