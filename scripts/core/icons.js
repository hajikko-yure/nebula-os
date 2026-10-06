/* Nebula OS — icon registry (inline SVG + CSS mask) */
(function (OS) {
  'use strict';

  // Each entry: inner SVG markup for a 24×24 viewBox
  const P = {
    folder:      '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2a2 2 0 0 1 1.5.7l1 1.2a2 2 0 0 0 1.5.7h5.8A2.5 2.5 0 0 1 21 10v6.5A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>',
    folderOpen:  '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h3.1a2 2 0 0 1 1.5.7l1 1.2a2 2 0 0 0 1.5.7h5.9A2.5 2.5 0 0 1 21 11v.6"/><path d="M3.6 19.2 6 12.4a2 2 0 0 1 1.9-1.4h13a1 1 0 0 1 .93 1.38l-2.4 6.6a2 2 0 0 1-1.86 1.3H5.5a2 2 0 0 1-1.9-2.1z"/>',
    file:        '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5"/>',
    fileText:    '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>',
    fileCode:    '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5M10 12.5 8 14.5l2 2M14 12.5l2 2-2 2"/>',
    terminal:    '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M6.5 9.5 9 12l-2.5 2.5M12 15h5"/>',
    sliders:     '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    palette:     '<path d="M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3.2-3.2 3.2h-1.4a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 21z"/><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none"/>',
    calculator:  '<rect x="4" y="2.5" width="16" height="19" rx="3"/><path d="M8 6.5h8"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
    music:       '<path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    image:       '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m3.5 17 4.8-4.6a2 2 0 0 1 2.7 0l3.2 3 2-1.9a2 2 0 0 1 2.7 0l1.6 1.5"/>',
    globe:       '<circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6"/><path d="M12 3a15 15 0 0 1 0 18A15 15 0 0 1 12 3z"/>',
    cloudSun:    '<circle cx="7.5" cy="6.5" r="2.6"/><path d="M7.5 1.5v1.4M7.5 10.1v1.4M2.5 6.5h1.4M11.1 6.5h1.4M4 3l1 1M10 9l1 1M11 3l-1 1M5 9l-1 1"/><path d="M10.5 19.5a3.6 3.6 0 0 1 .3-7.2 5 5 0 0 1 9.4 1.3 3.4 3.4 0 0 1-.7 5.9z"/>',
    bomb:        '<circle cx="10.5" cy="14.5" r="6.5"/><path d="m15.6 10.4 2.2-2.2M18.4 7.2l1.6-1.6M17.5 3.5l1.2 1.6 1.8.7-1.4 1.3.1 1.9-1.7-.8-1.8.6.3-1.9-1.2-1.5z"/><path d="M10.5 12v5M8 14.5h5"/>',
    mail:        '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="m3.5 7.5 7.3 5.2a2 2 0 0 0 2.4 0l7.3-5.2"/>',
    clock:       '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
    timer:       '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M18.8 6.7l1.4-1.4"/>',
    search:      '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20.5 20.5-4.9-4.9"/>',
    chevronRight:'<path d="m9 5 7 7-7 7"/>',
    chevronLeft: '<path d="m15 5-7 7 7 7"/>',
    chevronDown: '<path d="m5 9 7 7 7-7"/>',
    chevronUp:   '<path d="m5 15 7-7 7 7"/>',
    x:           '<path d="M6 6l12 12M18 6 6 18"/>',
    minus:       '<path d="M5 12h14"/>',
    plus:        '<path d="M12 5v14M5 12h14"/>',
    check:       '<path d="m4.5 12.5 5 5 10-11"/>',
    play:        '<path d="M7 4.5v15l13-7.5z"/>',
    pause:       '<path d="M9 4.5v15M15 4.5v15"/>',
    next:        '<path d="M6 4.5v15l10-7.5zM18.5 5v14"/>',
    prev:        '<path d="M18 4.5v15L8 12zM5.5 5v14"/>',
    shuffle:     '<path d="M16 3.5 20.5 8 16 12.5M16 11.5 20.5 16 16 20.5M3.5 8h3.2l3 4.4M3.5 16h3.2l8.8-13M13.5 11.6l3.3 4.4h3.7"/>',
    repeat:      '<path d="M17 2.5 20.5 6 17 9.5M3.5 11.5v-2a3.5 3.5 0 0 1 3.5-3.5h13.5M7 21.5 3.5 18 7 14.5M20.5 12.5v2a3.5 3.5 0 0 1-3.5 3.5H3.5"/>',
    volume:      '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.5a8 8 0 0 1 0 11"/>',
    volumeOff:   '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="m16 10 5 5M21 10l-5 5"/>',
    wifi:        '<path d="M2.5 8.8a15 15 0 0 1 19 0M5.8 12.4a10 10 0 0 1 12.4 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.6" r="1.1" fill="currentColor" stroke="none"/>',
    power:       '<path d="M12 3.5v8"/><path d="M18 6.5a7.8 7.8 0 1 1-12 0"/>',
    user:        '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    trash:       '<path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l.8 13a1.8 1.8 0 0 0 1.8 1.6h5.8a1.8 1.8 0 0 0 1.8-1.6l.8-13"/>',
    home:        '<path d="M3.5 10.5 12 3.5l8.5 7v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M9.5 20.5v-7h5v7"/>',
    star:        '<path d="m12 3.5 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z"/>',
    grid:        '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    list:        '<path d="M8 6.5h13M8 12h13M8 17.5h13"/><circle cx="4" cy="6.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="17.5" r="1.2" fill="currentColor" stroke="none"/>',
    save:        '<path d="M5 3.5h11L20.5 8v12.5a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z"/><path d="M8 3.5v6h7v-6M7.5 21.5v-7h9v7"/>',
    copy:        '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-9a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1h1"/>',
    edit:        '<path d="M11 4.5H5.5A2.5 2.5 0 0 0 3 7v11.5A2.5 2.5 0 0 0 5.5 21H17a2.5 2.5 0 0 0 2.5-2.5V13"/><path d="M17.8 3.2a2 2 0 0 1 2.8 2.8L12 14.6l-3.5.9.9-3.5z"/>',
    sun:         '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
    moon:        '<path d="M20.5 14.2A8.8 8.8 0 0 1 9.8 3.5a8.8 8.8 0 1 0 10.7 10.7z"/>',
    monitor:     '<rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8.5 21h7M12 17v4"/>',
    layers:      '<path d="m12 2.8 9 4.7-9 4.7-9-4.7z"/><path d="m3 12.5 9 4.7 9-4.7M3 17.3l9 4.7 9-4.7"/>',
    bell:        '<path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5z"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/>',
    cpu:         '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><rect x="9.8" y="9.8" width="4.4" height="4.4" rx="1"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>',
    info:        '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>',
    lock:        '<rect x="4.5" y="10" width="15" height="11" rx="3"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>',
    unlock:      '<rect x="4.5" y="10" width="15" height="11" rx="3"/><path d="M8 10V7.5a4 4 0 0 1 7.6-1.7"/>',
    zap:         '<path d="M13.5 2.5 4 13.5h7L10.5 21.5 20 10.5h-7z"/>',
    refresh:     '<path d="M20.5 11.5a8.5 8.5 0 0 0-14.6-5L2.5 9.5"/><path d="M2.5 4.5v5h5"/><path d="M3.5 12.5a8.5 8.5 0 0 0 14.6 5l3.4-3"/><path d="M21.5 19.5v-5h-5"/>',
    download:    '<path d="M12 3.5v11M8 11l4 4 4-4M4 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-1.5"/>',
    upload:      '<path d="M12 15.5v-11M8 8l4-4 4 4M4 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-1.5"/>',
    external:    '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    maximize:    '<rect x="4" y="4" width="16" height="16" rx="2.5"/>',
    minimize:    '<path d="M5 12h14"/>',
    restore:     '<rect x="3.5" y="7.5" width="13" height="13" rx="2.5"/><path d="M7.5 4.5h11a2 2 0 0 1 2 2v11"/>',
    arrowLeft:   '<path d="M20 12H4M10 6l-6 6 6 6"/>',
    arrowRight:  '<path d="M4 12h16M14 6l6 6-6 6"/>',
    more:        '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    moreV:       '<circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none"/>',
    database:    '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
    key:         '<circle cx="8" cy="12" r="4.2"/><path d="M12.2 12H21M18 12v3.5M15 12v2.5"/>',
    code:        '<path d="m8.5 8-4.5 4 4.5 4M15.5 8l4.5 4-4.5 4M13.5 5l-3 14"/>',
    calendar:    '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    window:      '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18"/>',
    eye:         '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff:      '<path d="M4 4l16 16"/><path d="M9.6 5.7A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.5 7.9A17 17 0 0 0 2 12s3.6 6.5 10 6.5a9.7 9.7 0 0 0 3.4-.6"/>',
    send:        '<path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8z"/>',
    inbox:       '<path d="M3 13.5 5.8 5A2 2 0 0 1 7.7 3.5h8.6A2 2 0 0 1 18.2 5L21 13.5v4.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13.5h5l1 2.5h6l1-2.5h5"/>',
    cloud:       '<path d="M6.5 19.5a4 4 0 0 1 .3-8 5.5 5.5 0 0 1 10.5 1.4 3.8 3.8 0 0 1-.7 6.6z"/>',
    droplet:     '<path d="M12 2.5s6 6.4 6 10.2a6 6 0 0 1-12 0C6 8.9 12 2.5 12 2.5z"/>',
    wind:        '<path d="M3 8.5h10a3 3 0 1 0-3-3M3 15.5h13a3 3 0 1 1-3 3M3 12h16"/>',
    snowflake:   '<path d="M12 2.5v19M4 7l16 10M20 7 4 17"/><path d="M9 4.5 12 7l3-2.5M9 19.5 12 17l3 2.5"/>',
    flame:       '<path d="M12 21.5c3.6 0 6.5-2.7 6.5-6.2 0-4.6-4.3-6.4-4-11.3-3 1.4-5.2 4-5.2 6.6 0 1.2.4 2 .4 2S8 11.5 7 13.2c-.6 1-1 2-1 3 0 3 2.7 5.3 6 5.3z"/>',
    type:        '<path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6"/>',
    app:         '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M17 14v6.5M13.8 17.2h6.4"/>',
    sparkles:    '<path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18.5 15.5 19.4 18l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z"/>',
    hardDrive:   '<path d="M21 15.5H3a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 3 4.5h18A1.5 1.5 0 0 1 22.5 6v8a1.5 1.5 0 0 1-1.5 1.5z"/><path d="M6.5 9.5h.01M10.5 9.5h.01M3 12h18"/>',
    cloudOff:    '<path d="m3 3 18 18"/><path d="M7.5 7.2A5.5 5.5 0 0 1 17.3 8.9a3.8 3.8 0 0 1 2.4 5.9M6.8 19.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 .5-1.4"/>',
    pin:         '<path d="M12 21.5s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10.5" r="2.6"/>',
    compass:     '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.2-5.2 2 2-5.2z"/>',
    battery:     '<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M21.5 10.5v3"/>',
    history:     '<path d="M3.5 8.5A9 9 0 1 1 3 13"/><path d="M3 4v5h5M12 7.5V12l3 1.8"/>',
    filter:      '<path d="M3.5 5.5h17l-6.5 8v5.5l-4 2.5V13.5z"/>',
    sortAZ:      '<path d="M4 6.5h10M4 12h7M4 17.5h4M17 5v13M17 18l-2.5-2.5M17 18l2.5-2.5"/>',
    info2:       '<circle cx="12" cy="12" r="9"/><path d="M12 16.5V11"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/>'
  };

  const ATTR = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const svg  = (name, sw = 1.7) => `<svg viewBox="0 0 24 24" ${ATTR} stroke-width="${sw}" aria-hidden="true">${P[name] || P.info}</svg>`;
  const uri  = (name, sw = 2) => {
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${ATTR} stroke-width="${sw}">${P[name] || P.info}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(s).replace(/'/g, '%27')}")`;
  };

  /** Paint every [data-icon] inside root (root included) with a masked glyph. */
  function paint(root = document) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    const apply = (n) => {
      const name = n.dataset && n.dataset.icon;
      if (!name) return;
      const size = n.dataset.size;
      if (size) { n.style.width = size + 'px'; n.style.height = size + 'px'; }
      let carrier = n.querySelector(':scope > .ico-in');
      if (!carrier) {
        carrier = document.createElement('i');
        carrier.className = 'ico-in';
        carrier.setAttribute('aria-hidden', 'true');
        n.insertBefore(carrier, n.firstChild);
      }
      carrier.style.setProperty('--m', uri(name));
    };
    if (root.nodeType === 1 && root.dataset && root.dataset.icon) apply(root);
    root.querySelectorAll('[data-icon]').forEach(apply);
  }

  /** Build an inline-SVG element. */
  function node(name, cls = '') {
    const span = document.createElement('span');
    span.className = 'icon ' + cls;
    span.innerHTML = svg(name);
    return span;
  }

  const has = (name) => !!P[name];
  const names = () => Object.keys(P);

  OS.icons = { svg, uri, paint, node, has, names, paths: P };
})(window.OS);
