/* Nebula OS — dock + status cluster */
(function (OS) {
  'use strict';
  const { el, $, $$, bus, pad2, clamp } = OS.util;
  const { icons, store, wm, ctx } = OS;

  const DEFAULT_DOCK = ['files', 'terminal', 'notepad', 'browser', 'music', 'photos', 'weather', 'calculator', 'mail', 'settings'];

  let dockApps = DEFAULT_DOCK.slice();
  try { const s = JSON.parse(localStorage.getItem('nebula.dock') || 'null'); if (Array.isArray(s) && s.length) dockApps = s; } catch (_) {}

  const saveDock = () => { try { localStorage.setItem('nebula.dock', JSON.stringify(dockApps)); } catch (_) {} };

  /* ─────────────────── Dock ─────────────────── */
  function render() {
    const inner = $('#dockInner');
    inner.innerHTML = '';

    const runningIds = new Set(wm.list().map(w => w.app.id));
    const ids = [...dockApps];
    // append running-but-not-pinned apps
    wm.list().forEach(w => { if (!ids.includes(w.app.id)) ids.push(w.app.id); });

    ids.forEach((id, idx) => {
      const app = OS.apps.get(id);
      if (!app) return;
      const wins = wm.byApp(id);
      const isRun = wins.length > 0;
      const isFocused = wins.some(w => w === wm.getFocused());

      const item = el('button', {
        class: 'dock-item' + (isRun ? ' is-running' : '') + (isFocused ? ' is-focused-app' : ''),
        style: { '--di-bg': `linear-gradient(150deg, ${app.accent[0]}, ${app.accent[1]})` },
        dataset: { icon: app.icon, app: id },
        title: app.name,
        'aria-label': app.name
      });
      if (wins.length > 1) item.append(el('span', { class: 'stack-count', text: String(wins.length) }));
      item.append(el('span', { class: 'run-dot' }));
      item.append(el('span', { class: 'dock-tip', text: app.name }));

      item.addEventListener('click', () => activate(app, item));
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ctx.show(e.clientX, e.clientY, [
          { label: '新規ウィンドウを開く', icon: 'plus', onClick: () => { bounce(item); wm.open(app); } },
          wins.length > 1 ? { label: 'すべて閉じる', icon: 'x', danger: true, onClick: () => wins.forEach(w => w.close()) } : null,
          '-',
          { label: dockApps.includes(id) ? 'Dock から外す' : 'Dock に追加', icon: 'pin',
            onClick: () => { dockApps = dockApps.includes(id) ? dockApps.filter(x => x !== id) : [...dockApps, id]; saveDock(); render(); } },
          { label: 'プロパティ', icon: 'info', onClick: () => OS.notify.alert(app.name, app.description || '') }
        ].filter(Boolean));
      });

      inner.append(item);
      if (idx === 3) inner.append(el('div', { class: 'dock-sep' }));
      icons.paint(item);
    });
  }

  function bounce(item) {
    item.classList.remove('is-bouncing');
    void item.offsetWidth;
    item.classList.add('is-bouncing');
  }

  function activate(app, item) {
    const wins = wm.byApp(app.id);
    if (!wins.length) { bounce(item); wm.open(app); return; }
    const focusedWin = wins.find(w => w === wm.getFocused());
    if (focusedWin) { focusedWin.minimize(); return; }
    const min = wins.filter(w => w.root.classList.contains('is-minimized'));
    (min[0] || wins[wins.length - 1]).focus();
  }

  /* ─────────────────── Status cluster ─────────────────── */
  let battery = 78, charging = true;

  function tickClock() {
    const d = new Date();
    $('#clockTime').textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    $('#clockDate').textContent = `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  }

  function tickBattery() {
    const wrap = $('#statusBattery');
    battery = clamp(battery + (charging ? 0.12 : -0.09), 6, 100);
    if (battery >= 100) charging = false;
    if (battery <= 8) charging = true;
    $('#batteryFill').style.width = battery + '%';
    $('#batteryText').textContent = Math.round(battery) + '%';
    wrap.classList.toggle('is-charging', charging);
    wrap.classList.toggle('is-low', battery < 20 && !charging);
  }

  function initStatus() {
    tickClock();
    tickBattery();
    setInterval(tickClock, 1000);
    setInterval(tickBattery, 4000);

    $('#statusWifi').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      ctx.show(r.left - 40, r.bottom + 8, [
        { type: 'label', text: 'ネットワーク' },
        { label: 'Nebula 5G', icon: 'wifi', onClick: () => {} },
        { label: 'Nebula-Guest', icon: 'wifi', onClick: () => {} },
        '-',
        { label: 'ネットワーク設定', icon: 'sliders', onClick: () => OS.apps.open('settings', { arg: 'network' }) }
      ]);
    });

    $('#statusVolume').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      ctx.show(r.left - 60, r.bottom + 8, [
        { type: 'label', text: '音量' },
        { type: 'row', items: [
          { label: 'ミュート', icon: 'volumeOff', active: store.get('volume') === 0, onClick: () => setVolume(0) },
          { label: '音', icon: 'volume', active: store.get('volume') > 0, onClick: () => setVolume(70) }
        ] },
        { label: `出力: Nebula Speakers`, icon: 'volume', onClick: () => {} },
        '-',
        { label: 'サウンド設定', icon: 'sliders', onClick: () => OS.apps.open('settings', { arg: 'sound' }) }
      ]);
    });

    $('#statusBattery').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      ctx.show(r.left - 100, r.bottom + 8, [
        { type: 'label', text: '電源' },
        { label: Math.round(battery) + '% ' + (charging ? '— 充電中' : '— バッテリー'), icon: charging ? 'zap' : 'battery' },
        '-',
        { label: '電源設定', icon: 'sliders', onClick: () => OS.apps.open('settings', { arg: 'power' }) }
      ]);
    });

    $('#statusClock').addEventListener('click', () => OS.apps.open('clock'));

    $('#showDesktop').addEventListener('click', (e) => {
      e.stopPropagation();
      const wins = wm.list();
      const anyVisible = wins.some(w => !w.isMinimized());
      if (anyVisible) { wm.minimizeAll(); return; }
      // Restore everything, then focus the topmost so the stacking order is sane.
      wins.forEach(w => w.restore());
      wins[wins.length - 1]?.focus();
    });
  }

  function setVolume(v) {
    store.set('volume', v);
    $('#volumeLevel').textContent = v === 0 ? '' : v + '%';
    const slider = OS.settingsModalVolume;
    if (slider) slider.value = v;
  }

  function init() {
    render();
    initStatus();
    bus.on('wm:change', render);
    bus.on('apps:changed', render);
    bus.on('settings:volume', (v) => $('#volumeLevel').textContent = v === 0 ? '' : v + '%');
    $('#volumeLevel').textContent = store.get('volume') + '%';
  }

  OS.dock = { init, render, get apps() { return dockApps; }, set(list) { dockApps = list; saveDock(); render(); }, DEFAULT_DOCK };
})(window.OS);
