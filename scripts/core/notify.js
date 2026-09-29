/* ═══════════════════════════════════════════════════════════
   Nebula OS — toasts, modals, dialogs
   ═══════════════════════════════════════════════════════════ */
(function (OS) {
  'use strict';
  const { el, $, $$, dtf, uid } = OS.util;
  const { icons } = OS;

  const layer = () => $('#notifLayer');

  function art(app, cls = 'art') {
    const d = el('div', {
      class: cls,
      style: { background: `linear-gradient(150deg, ${app?.accent?.[0] || 'var(--accent)'}, ${app?.accent?.[1] || 'var(--accent-2)'})` }
    }, el('span', { dataset: { icon: app?.icon || 'info' } }));
    icons.paint(d);
    return d;
  }

  /**
   * @param {{title:string, body?:string, app?:object, timeout?:number, onClick?:Function, actions?:Array}} o
   */
  function notify(o) {
    const app = o.app || { icon: 'bell', accent: ['#8b7dff', '#5ad6ff'] };
    const node = el('div', { class: 'notif', role: 'status' });
    node.append(art(app, 'art n-art'));
    const body = el('div', { class: 'n-body' },
      el('div', { class: 'n-title', text: o.title || app.name || '通知' }),
      o.body ? el('div', { class: 'n-text', text: o.body }) : null,
      el('div', { class: 'n-time', text: o.time || dtf.time() })
    );
    node.append(body);
    if (o.onClick) node.addEventListener('click', () => { o.onClick(); close(); });

    layer().append(node);
    const t = setTimeout(close, o.timeout ?? 4200);
    node.addEventListener('mouseenter', () => clearTimeout(t));
    function close() {
      clearTimeout(t);
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 240);
    }
    node.close = close;
    return node;
  }

  /* ── Lock-screen notif (persists on the lock view) ── */
  function lockNotify(o) {
    const box = $('#lockNotifs');
    if (!box) return;
    const app = o.app || { icon: 'bell', accent: ['#8b7dff', '#5ad6ff'] };
    const n = el('div', { class: 'lock-notif' }, art(app),
      el('div', {}, el('b', { text: o.title || '' }), el('small', { text: o.body || '' })));
    box.append(n);
    setTimeout(() => { n.style.transition = 'opacity .4s, transform .4s'; n.style.opacity = '0'; n.style.transform = 'translateX(20px)'; setTimeout(() => n.remove(), 420); }, 6000);
  }

  /* ── Modal: alert / confirm / prompt ── */
  function modal({ title, body, input, okLabel = 'OK', cancelLabel = 'キャンセル', danger = false }) {
    return new Promise((resolve) => {
      const wrap = el('div', { class: 'modal-layer' });
      const inputEl = input != null ? el('input', { type: 'text', value: input, spellcheck: 'false' }) : null;
      const ok = el('button', { class: 'btn ' + (danger ? '' : 'btn--primary'), text: okLabel });
      const cancel = el('button', { class: 'btn', text: cancelLabel });

      const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        el('h3', { text: title || '' }),
        body ? el('p', { text: body }) : null,
        inputEl,
        el('div', { class: 'modal-acts' }, cancel, ok)
      );
      wrap.append(box);
      document.body.append(wrap);

      const done = (v) => { document.removeEventListener('keydown', key, true); wrap.remove(); resolve(v); };
      const key = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
        if (e.key === 'Enter' && (inputEl || document.activeElement?.tagName !== 'BUTTON')) { e.stopPropagation(); done(inputEl ? inputEl.value : true); }
      };
      document.addEventListener('keydown', key, true);
      ok.addEventListener('click', () => done(inputEl ? inputEl.value : true));
      cancel.addEventListener('click', () => done(null));
      wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) done(null); });
      setTimeout(() => { (inputEl || ok).focus(); if (inputEl) inputEl.select(); }, 40);
    });
  }

  const alert   = (title, body) => modal({ title, body, okLabel: '閉じる', cancelLabel: '' }).then(() => { });
  const confirm = (title, body, ok = 'OK') => modal({ title, body, okLabel: ok, danger: true }).then(v => v != null);
  const prompt  = (title, body, def = '') => modal({ title, body, input: def, okLabel: '決定' });

  /* ── Custom action sheet (context-menu style, centered) ── */
  function sheet(title, items) {
    return new Promise((resolve) => {
      const wrap = el('div', { class: 'modal-layer' });
      const box = el('div', { class: 'ctxmenu', style: { minWidth: '260px' } },
        title ? el('div', { class: 'ctx-label', text: title }) : null);
      items.forEach((it, i) => {
        if (it === '-') { box.append(el('div', { class: 'ctx-sep' })); return; }
        const b = el('button', { class: 'ctx-item' + (it.danger ? ' danger' : '') },
          it.icon ? el('span', { dataset: { icon: it.icon } }) : null,
          el('span', { text: it.label }));
        icons.paint(b);
        b.addEventListener('click', () => { wrap.remove(); resolve(i); });
        box.append(b);
      });
      wrap.append(box);
      wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) { wrap.remove(); resolve(-1); } });
      document.body.append(wrap);
      icons.paint(box);
    });
  }

  OS.notify = { notify, lockNotify, alert, confirm, prompt, sheet, modal };
})(window.OS);
