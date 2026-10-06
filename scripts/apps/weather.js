/* App: Weather (simulated forecast) */
(function (OS) {
  'use strict';
  const { el, $, pad2 } = OS.util;
  const { icons, store } = OS;

  const CITIES = [
    { name: '東京', tz: 9 }, { name: '京都', tz: 9 }, { name: '札幌', tz: 9 },
    { name: '福岡', tz: 9 }, { name: '沖縄', tz: 9 }, { name: 'London', tz: 0 },
    { name: 'New York', tz: -5 }, { name: 'San Francisco', tz: -8 }
  ];
  const COND = [
    { id: 'sun',    label: '晴れ',        icon: 'sun' },
    { id: 'cloud',  label: '晴れ時々くもり', icon: 'cloudSun' },
    { id: 'cloudy', label: 'くもり',      icon: 'cloud' },
    { id: 'rain',   label: '雨',          icon: 'droplet' },
    { id: 'storm',  label: '雷雨',        icon: 'zap' },
    { id: 'snow',   label: '雪',          icon: 'snowflake' }
  ];

  // deterministic pseudo-random by seed
  function rnd(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function forecast(city, dayOffset, hour) {
    const s = city.name.length * 7.3 + dayOffset * 13.7 + (hour == null ? 0 : hour * 2.17);
    const m = Math.floor(rnd(s) * COND.length);
    const hi = Math.round(16 + rnd(s + 1) * 14);
    const lo = hi - Math.round(4 + rnd(s + 2) * 7);
    const pop = Math.round(rnd(s + 3) * 90);
    const wind = Math.round(2 + rnd(s + 4) * 22);
    const hum = Math.round(40 + rnd(s + 5) * 50);
    const uv = Math.round(rnd(s + 6) * 10);
    return { cond: COND[m], hi, lo, pop, wind, hum, uv };
  }

  const WD = ['日', '月', '火', '水', '木', '金', '土'];

  function mount(root, win, cityName) {
    let city = CITIES.find(c => c.name === cityName) || CITIES[0];
    let unit = 'C';
    const off = Math.floor((Date.now() - new Date(city.tz * 3600e3).getTimezoneOffset() * 60000) / 86400000);

    const heroIco = el('div', { class: 'wx-ico' });
    const tempEl = el('div', { class: 'wx-temp' });
    const condEl = el('div', { class: 'wx-cond' });
    const locEl = el('div', { class: 'wx-loc' });
    const hero = el('div', { class: 'wx-hero' },
      el('div', {}, tempEl, condEl, locEl), heroIco);

    const hours = el('div', { class: 'wx-hours' });
    const days = el('div', { class: 'wx-days' });
    const stats = el('div', { class: 'wx-stats' });

    const citySel = el('select', { style: { height: '30px', padding: '0 8px', background: 'var(--sunken)', border: '1px solid var(--stroke)', borderRadius: '8px' } });
    CITIES.forEach(c => citySel.append(el('option', { value: c.name, text: c.name })));
    citySel.value = city.name;
    citySel.addEventListener('change', () => { city = CITIES.find(c => c.name === citySel.value); render(); });

    const unitSeg = el('div', { class: 'seg' },
      ...['C', 'F'].map(u => {
        const b = el('button', { text: '°' + u, class: u === unit ? 'is-active' : '' });
        b.addEventListener('click', () => { unit = u; render(); });
        return b;
      }));

    const toolbar = el('div', { class: 'app-toolbar' },
      el('span', { class: 'field-icon', dataset: { icon: 'pin' } }), citySel,
      el('div', { class: 'spacer' }), unitSeg,
      el('button', { class: 'icon-btn', id: 'wxRef', title: '更新' }, el('span', { dataset: { icon: 'refresh' } })));
    root.className = 'app wx';
    root.append(toolbar, el('div', { class: 'app-scroll' }, hero, hours,
      el('div', { class: 'start-section-title', style: { padding: '0 22px 6px' } }, el('span', { text: '10 日間' })),
      days, stats));
    win.setAccent('#5ad6ff');

    const t2 = (c) => unit === 'C' ? c : Math.round(c * 9 / 5 + 32);

    function render() {
      const now = forecast(city, off);
      tempEl.innerHTML = `${t2(now.hi)}<sup>°${unit}</sup>`;
      condEl.textContent = now.cond.label;
      locEl.textContent = `${city.name} · ${new Date(Date.now() + city.tz * 3600e3).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
      heroIco.innerHTML = '';
      heroIco.append(el('span', { dataset: { icon: now.cond.icon } }));
      icons.paint(heroIco);

      hours.innerHTML = '';
      const baseH = new Date().getHours();
      for (let i = 0; i < 12; i++) {
        const h = (baseH + i) % 24;
        const f = forecast(city, off + Math.floor(i / 6), h);
        const c = el('div', { class: 'wx-hour' },
          el('small', { text: (i === 0 ? '現在' : pad2(h) + '時') }),
          el('span', { dataset: { icon: f.cond.icon } }),
          el('b', { text: t2(f.hi) + '°' }));
        hours.append(c);
      }

      days.innerHTML = '';
      const lows = [], highs = [];
      for (let i = 0; i < 7; i++) { const f = forecast(city, off + i); lows.push(f.lo); highs.push(f.hi); }
      const mn = Math.min(...lows), mx = Math.max(...highs);
      for (let i = 0; i < 7; i++) {
        const f = forecast(city, off + i);
        const d = new Date();
        d.setDate(d.getDate() + i);
        const bar = el('div', { class: 'wx-bar' },
          el('i', { style: { left: ((f.lo - mn) / (mx - mn || 1) * 100) + '%', right: (100 - (f.hi - mn) / (mx - mn || 1) * 100) + '%' } }));
        const row = el('div', { class: 'wx-day' },
          el('span', { text: i === 0 ? '今日' : WD[d.getDay()] }),
          el('span', { dataset: { icon: f.cond.icon } }),
          bar,
          el('span', { class: 'tiny dim', text: `${t2(f.lo)}° / ${t2(f.hi)}°` }));
        days.append(row);
      }

      stats.innerHTML = '';
      [['湿度', now.hum + '%', 'droplet'], ['風速', now.wind + ' km/h', 'wind'],
       ['UV 指数', String(now.uv), 'sun'], ['降水確率', now.pop + '%', 'droplet'],
       ['日出', '05:41', 'sun'], ['日没', '18:12', 'moon']].forEach(([k, v, ic]) => {
        const s = el('div', { class: 'wx-stat' },
          el('small', { text: k }),
          el('b', { text: v }),
          el('span', { dataset: { icon: ic }, style: { display: 'none' } }));
        stats.append(s);
      });

      win.setTitle(`${city.name} ${t2(now.hi)}° — 天気`);
      win.setSub(now.cond.label);
      icons.paint(root);
    }

    toolbar.querySelector('#wxRef').addEventListener('click', render);
    render();
  }

  OS.apps.register({
    id: 'weather',
    name: '天気',
    icon: 'cloudSun',
    accent: ['#5ad6ff', '#818cf8'],
    width: 720, height: 620, minWidth: 380, minHeight: 420,
    keywords: 'weather forecast 天気 予報',
    description: '10 日間の予報と時間別の気温。',
    mount
  });
})(window.OS);
