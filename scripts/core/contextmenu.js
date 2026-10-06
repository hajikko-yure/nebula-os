/* Nebula OS — context menu */
(function (OS) {
  'use strict';
  const { el, $ } = OS.util;
  const { icons } = OS;

  const menu = () => $('#ctxMenu');
  let open = false;

  /**
   * items: [{label, icon, key, disabled, danger, onClick} | '-' | {type:'row', items:[{...}]} | {type:'label', text}]
   */
  function show(x, y, items) {
    const m = menu();
    m.innerHTML = '';
    m.hidden = false;
    open = true;

    items.filter(Boolean).forEach((it) => {
      if (it === '-') { m.append(el('div', { class: 'ctx-sep' })); return; }
      if (it.type === 'label') { m.append(el('div', { class: 'ctx-label', text: it.text })); return; }
      if (it.type === 'row') {
        const row = el('div', { class: 'ctx-row' });
        it.items.forEach((sub) => {
          const b = el('button', { class: sub.active ? 'is-on' : '', title: sub.label },
            sub.icon ? el('span', { dataset: { icon: sub.icon } }) : null,
            el('span', { text: sub.label }));
          icons.paint(b);
          b.addEventListener('click', () => { hide(); sub.onClick?.(); });
          row.append(b);
        });
        m.append(row);
        return;
      }
      const b = el('button', { class: 'ctx-item' + (it.disabled ? ' disabled' : '') + (it.danger ? ' danger' : '') },
        it.icon ? el('span', { dataset: { icon: it.icon } }) : null,
        el('span', { text: it.label }),
        it.key ? el('span', { class: 'ctx-key', text: it.key }) : null);
      b.addEventListener('click', () => { hide(); it.onClick?.(); });
      b.addEventListener('mouseenter', () => {
        $$sub(m).forEach(n => n.classList.remove('is-hot'));
      });
      m.append(b);
    });

    icons.paint(m);

    // Position, clamped to viewport
    m.style.left = m.style.top = '0px';
    requestAnimationFrame(() => {
      const r = m.getBoundingClientRect();
      const vw = innerWidth, vh = innerHeight, pad = 8;
      let nx = x, ny = y;
      if (nx + r.width > vw - pad) nx = Math.max(pad, x - r.width);
      if (ny + r.height > vh - pad) ny = Math.max(pad, vh - r.height - pad);
      m.style.left = nx + 'px';
      m.style.top = ny + 'px';
    });
  }

  const $$sub = (root) => root.querySelectorAll('.ctx-item');

  function hide() {
    const m = menu();
    if (!m || m.hidden) return;
    m.hidden = true;
    m.innerHTML = '';
    open = false;
  }

  addEventListener('pointerdown', (e) => {
    if (open && !menu().contains(e.target)) hide();
  }, true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); hide(); } }, true);
  addEventListener('blur', hide);
  addEventListener('resize', hide);

  OS.ctx = { show, hide, get isOpen() { return open; } };
})(window.OS);
