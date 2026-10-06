/* App: Terminal */
(function (OS) {
  'use strict';
  const { el, $, esc, dtf, bytes, pad2 } = OS.util;
  const { icons, fs, store, wm } = OS;

  const BANNER = [
    '  ███  ██  █████  ██████  ██    ██ █████  ██████ ',
    '  ████ ██ ██   ██ ██   ██ ██    ██ ██   ██ ██   ██',
    '  ██ ████ ███████ ██   ██ ██    ██ ███████ ██   ██',
    '  ██  ██  ██   ██ ██   ██ ██    ██ ██   ██ ██   ██',
    '  ██      ██   ██ ██████   ██████  ██   ██ ██████ '
  ];

  function make(host, win) {
    let cwd = 'Home';
    const hist = [];
    let hi = -1;
    let busy = false;

    const out = el('div', { class: 'term-out' });
    const promptEl = el('span', { class: 'term-prompt' });
    const input = el('input', { class: 'term-input', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
    const row = el('div', { class: 'term-input-row' }, promptEl, input);
    const term = el('div', { class: 'term' }, out, row);
    host.className = 'app';
    host.append(term);
    win.setAccent('#8b7dff');
    win.setTitle('ターミナル — zsh');

    const scroll = () => { out.scrollTop = out.scrollHeight; };
    const print = (text, cls = '') => {
      const l = el('div', { class: 'term-line ' + cls });
      if (text instanceof Node) l.append(text); else l.innerHTML = text;
      out.append(l); scroll();
      return l;
    };
    const setPrompt = () => {
      const short = cwd.replace(/^Home/, '~');
      promptEl.innerHTML = `<span style="color:#5ad6ff">${esc(shellUser().toLowerCase())}@nebula</span>:<span style="color:#8b7dff">${esc(short)}</span>$`;
    };

    print(BANNER.map(l => `<span style="color:#8b7dff">${esc(l)}</span>`).join('\n'), 't-b');
    print(`<span class="t-dim">Nebula Shell 1.0.0 — ヘルプは </span><span class="t-cy">help</span><span class="t-dim"> と入力してください。</span>`);
    print('');
    setPrompt();
    setTimeout(() => input.focus(), 60);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = input.value;
        input.value = '';
        print(`${promptEl.innerHTML} ${esc(v)}`);
        hist.push(v); hi = hist.length;
        if (busy) { print('コマンドを実行中です…', 't-warn'); return; }
        run(v);
        return;
      }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi] || ''; return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) input.value = hist[++hi] || ''; else { hi = hist.length; input.value = ''; } return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const parts = input.value.split(/\s+/);
        const frag = parts[parts.length - 1] || '';
        const segs = cwd.split('/').filter(Boolean);
        const base = frag.includes('/') ? frag.split('/').slice(0, -1).join('/') : '';
        const stub = frag.includes('/') ? frag.split('/').pop() : frag;
        const node = base ? fs.nodeAt(cwd + '/' + base) : fs.nodeAt(cwd);
        if (node && node.type === 'dir') {
          const hits = node.children.filter(c => c.name.toLowerCase().startsWith(stub.toLowerCase()));
          if (hits.length === 1) {
            const rep = base ? base + '/' + hits[0].name + (hits[0].type === 'dir' ? '/' : '') : hits[0].name + (hits[0].type === 'dir' ? '/' : '');
            parts[parts.length - 1] = rep;
            input.value = parts.join(' ');
          } else if (hits.length > 1) { print(hits.map(h => h.name).join('   '), 't-dim'); }
        }
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); out.innerHTML = ''; return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'c') { print(promptEl.innerHTML + ' ' + esc(input.value) + '^C'); input.value = ''; return; }
      e.stopPropagation();
    });

    /* ── tab completion of commands ── */
    const CMDS = {
      help() {
        print(`<span class="t-acc">Nebula Shell — コマンド一覧</span>`);
        const rows = [
          ['help', 'このヘルプを表示'], ['ls [パス]', '内容を一覧表示'], ['cd [パス]', 'ディレクトリを移動'],
          ['pwd', '現在のディレクトリを表示'], ['cat <ファイル>', 'ファイル内容を表示'],
          ['mkdir <名前>', 'フォルダを作成'], ['touch <名前>', '空ファイルを作成'],
          ['rm [-r] <パス>', '削除'], ['mv <src> <dst>', '移動 / 名前変更'],
          ['echo <テキスト> [> ファイル]', '出力 / ファイルへ追記'],
          ['tree', 'ツリー表示'], ['df', 'ストレージ使用状況'], ['date', '現在時刻'],
          ['whoami', 'ログインユーザー'], ['neofetch', 'システム情報'], ['open <アプリ|パス>', 'アプリ / ファイルを開く'],
          ['apps', 'インストール済みアプリ一覧'], ['wallpaper <名前>', '壁紙を変更'],
          ['theme <dark|light>', 'テーマを切替'], ['accent <カラーコード>', 'アクセント色を変更'],
          ['notif <タイトル> [本文]', '通知を表示'], ['clear', '画面を消去'],
          ['history', 'コマンド履歴'], ['lock', 'ロック'], ['reboot', '再起動'], ['exit', '終了']
        ];
        rows.forEach(([c, d]) => print(`  <span class="t-cy">${esc(c.padEnd(30))}</span><span class="t-dim">${esc(d)}</span>`));
      },
      ls(args) {
        const target = args[0] || cwd;
        const node = fs.nodeAt(target);
        if (!node) return print(`ls: ${esc(target)}: そのようなファイルはありません`, 't-err');
        if (node.type === 'file') return print(`${node.name}  ${bytes((node.content || '').length)}`, 't-dim');
        // Sort a copy: sorting the live array mutates the tree without emitting
        // fs:change, so the rest of the OS would keep a stale order.
        const items = [...node.children].sort((a, b) => a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name));
        if (!items.length) return print('(空)', 't-dim');
        const frag = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 20px' } });
        items.forEach(c => {
          const s = el('span', {
            text: c.name + (c.type === 'dir' ? '/' : ''),
            style: { color: c.type === 'dir' ? '#5ad6ff' : '#cfe3ff' }
          });
          frag.append(s);
        });
        print(frag);
      },
      cd(args) {
        const t = args[0] || 'Home';
        let p = t;
        if (t.startsWith('/')) p = t.slice(1);
        else if (t.startsWith('~')) p = t.slice(1).replace(/^\//, '');
        else p = cwd + '/' + t;
        p = p.replace(/\/+/g, '/').replace(/\/$/, '') || 'Home';
        if (p === '~') p = 'Home';
        if (!fs.isDir(p)) return print(`cd: ${esc(t)}: ディレクトリではありません`, 't-err');
        cwd = p; setPrompt(); win.setSub(p);
      },
      pwd() { print(cwd, 't-cy'); },
      cat(args) {
        if (!args[0]) return print('cat: ファイル名を指定してください', 't-warn');
        const c = fs.read(args[0]);
        if (c == null) return print(`cat: ${esc(args[0])}: ファイルが見つかりません`, 't-err');
        print(esc(c) || '(空ファイル)');
      },
      mkdir(args) {
        if (!args[0]) return print('mkdir: 名前を指定してください', 't-warn');
        try { fs.mkdir(cwd + '/' + args[0]); print(`ディレクトリを作成しました: ${args[0]}`, 't-ok'); } catch (e) { print(e.message, 't-err'); }
      },
      touch(args) {
        if (!args[0]) return print('touch: 名前を指定してください', 't-warn');
        try { fs.writeFile(cwd + '/' + args[0], ''); print(`作成しました: ${args[0]}`, 't-ok'); } catch (e) { print(e.message, 't-err'); }
      },
      rm(args) {
        const targets = args.filter(a => a !== '-r' && a !== '-rf');
        if (!targets.length) return print('rm: パスを指定してください', 't-warn');
        targets.forEach(t => {
          const p = t.startsWith('/') || t.startsWith('~') ? t.replace(/^[/~]+/, '') : cwd + '/' + t;
          if (fs.remove(p)) print(`削除しました: ${fs.baseName(p)}`, 't-ok');
          else print(`rm: ${esc(t)}: 削除できませんでした（存在しない、または特別なパスです）`, 't-err');
        });
      },
      mv(args) {
        if (args.length < 2) return print('mv: mv <元> <先> の形式で指定してください', 't-warn');
        const src = cwd + '/' + args[0];
        const dst = args[1];
        if (fs.isDir(dst)) {
          if (fs.move(src, dst)) return print(`移動しました: ${args[0]} → ${dst}`, 't-ok');
          return print(`mv: ${esc(args[0])}: 移動できませんでした（自分自身への移動や存在しないパスは不可）`, 't-err');
        }
        if (fs.rename(src, dst)) return print(`名前を変更しました: ${dst}`, 't-ok');
        return print(`mv: ${esc(args[0])} → ${esc(dst)}: 失敗しました`, 't-err');
      },
      echo(args) {
        const gt = args.findIndex(a => a === '>' || a === '>>');
        const text = (gt > -1 ? args.slice(0, gt) : args).join(' ');
        if (gt > -1 && args[gt + 1]) {
          const f = cwd + '/' + args[gt + 1];
          const prev = args[gt] === '>>' ? (fs.read(f) || '') : '';
          try { fs.writeFile(f, prev + text + '\n'); return print(`書き込みました: ${args[gt + 1]}`, 't-ok'); }
          catch (e) { return print(e.message, 't-err'); }
        }
        print(esc(text));
      },
      tree() {
        const walk = (node, path, prefix) => {
          node.children.forEach((c, i) => {
            const last = i === node.children.length - 1;
            print(`<span class="t-dim">${esc(prefix + (last ? '└── ' : '├── '))}</span><span style="color:${c.type === 'dir' ? '#5ad6ff' : '#cfe3ff'}">${esc(c.name)}</span>`, 'term-line');
            if (c.type === 'dir') walk(c, path + '/' + c.name, prefix + (last ? '    ' : '│   '));
          });
        };
        print(`<span class="t-cy">${esc(cwd)}</span>`);
        const n = fs.nodeAt(cwd);
        if (n) walk(n, cwd, '');
      },
      df() {
        const st = fs.stats();
        const used = st.bytes, total = 5 * 1024 * 1024 * 1024;
        const pct = Math.max(1, (used / total) * 100);
        const width = 24, filled = Math.round((pct / 100) * width);
        print(`<span class="t-cy">Filesystem      Size  Used Avail Use%</span>`);
        print(`<span class="t-acc">/dev/nebula</span>    ${bytes(total)}  ${bytes(used)}  ${bytes(total - used)}  ${pct.toFixed(1)}%`);
        print(`<span class="t-dim">[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]</span>  ${st.files} files / ${st.dirs} dirs`);
      },
      date() { print(new Date().toString(), 't-cy'); },
      uptime() { print(`up ${Math.floor(performance.now() / 1000)}s, load average: 0.${Math.floor(Math.random() * 9 + 1)}, 0.${Math.floor(Math.random() * 9 + 1)}, 0.${Math.floor(Math.random() * 9 + 1)}`, 't-cy'); },
      whoami() { print(shellUser(), 't-cy'); },
      hostname() { print('nebula', 't-cy'); },
      apps() {
        OS.apps.all().forEach(a => print(`  <span class="t-cy">${esc(a.id.padEnd(14))}</span><span class="t-dim">${esc(a.name)}</span>`));
      },
      open(args) {
        if (!args[0]) return print('open: 対象を指定してください', 't-warn');
        const t = args[0];
        if (OS.apps.get(t)) { wm.open(OS.apps.get(t)); return print(`${t} を起動しました`, 't-ok'); }
        const p = t.startsWith('/') || t.startsWith('~') ? t.replace(/^[/~]+/, '') : cwd + '/' + t;
        if (fs.exists(p)) { OS.files.openPath(p); return print(`開きました: ${p}`, 't-ok'); }
        const guess = OS.apps.all().find(a => a.name === t || a.id.includes(t.toLowerCase()));
        if (guess) { wm.open(guess); return print(`${guess.name} を起動しました`, 't-ok'); }
        print(`open: ${esc(t)}: 見つかりません`, 't-err');
      },
      wallpaper(args) {
        if (!args[0]) return print('現在の壁紙: ' + store.get('wallpaper') + '  —  options: ' + OS.wallpaper.LIST.map(w => w.id).join(', '), 't-cy');
        store.set('wallpaper', args[0]); OS.wallpaper.repaint();
        print(`壁紙を変更しました: ${args[0]}`, 't-ok');
      },
      theme(args) {
        const t = args[0] || (store.get('theme') === 'dark' ? 'light' : 'dark');
        if (t !== 'dark' && t !== 'light') return print('theme: dark | light を指定してください', 't-err');
        store.set('theme', t); OS.theme.apply();
        print(`テーマを ${t} にしました`, 't-ok');
      },
      accent(args) {
        if (!args[0]) return print('現在のアクセント: ' + store.get('accent'), 't-cy');
        const c = args[0].replace(/^#/, '');
        if (!/^[0-9a-f]{6}$/i.test(c)) return print('accent: #RRGGBB の形式で指定してください', 't-err');
        OS.theme.setAccent('#' + c);
        print(`アクセント色を変更しました: #${c}`, 't-ok');
      },
      notif(args) {
        OS.notify.notify({ title: args[0] || 'テスト通知', body: args.slice(1).join(' ') });
        print('通知を表示しました', 't-ok');
      },
      clear() { out.innerHTML = ''; },
      history() { hist.forEach((h, i) => print(`  <span class="t-dim">${pad2(i + 1)}</span>  ${esc(h)}`)); },
      lock() { print('ロックしています…', 't-warn'); setTimeout(() => OS.session.lock(), 200); },
      reboot() { print('再起動しています…', 't-warn'); setTimeout(() => OS.session.restart(), 400); },
      exit() { win.close(); },
      sudo() { print('このセッションには sudo がありません。あなたは既に root です。', 't-mag'); },
      cowsay() {
        print(`<span class="t-mag"> ____________<br> &lt;  Moshe &gt;<br> -------------\br>          \\   ^__^<br>           \\  (oo)\\_______<br>              (__)\\       )\\/\<br>                  ||----w |<br>                  ||     ||</span>`);
      }
    };
    CMDS.man = CMDS.ls; CMDS.dir = CMDS.ls; CMDS.cls = CMDS.clear;
    CMDS['?'] = CMDS.help; CMDS.rmdir = CMDS.rm; CMDS.mv = CMDS.mv;
    CMDS.banner = () => print(BANNER.join('\n'), 't-b');

    function neofetch() {
      const st = fs.stats();
      const mem = (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 64).toFixed(0);
      const box = el('div', { class: 'term-neofetch' });
      const left = el('pre', { text: BANNER.join('\n') });
      const info = el('div', { class: 'info' });
      const rows = [
        `<b>${esc(shellUser())}</b>@<b>nebula</b>`,
        `<b style="color:#38bdf8">${'─'.repeat(24)}</b>`,
        `<b>OS</b>      Nebula OS 1.0.0 (browser)`,
        `<b>Author</b>  hajikkoyure`,
        `<b>Host</b>    ${esc(navigator.platform || 'web')}`,
        `<b>Kernel</b>  js ${esc(navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '—')}`,
        `<b>Shell</b>   nebula-sh 1.0.0`,
        `<b>DE</b>      Aurora Shell`,
        `<b>WM</b>      NebulaWM (snap)`,
        `<b>Theme</b>   ${esc(store.get('theme'))} / ${esc(store.get('accent'))}`,
        `<b>Icons</b>   Nebula Set`,
        `<b>Terminal</b> Nebula Terminal`,
        `<b>CPU</b>     ${esc(navigator.hardwareConcurrency || 4)} cores`,
        `<b>Memory</b>  ${mem}MiB / 2048MiB`,
        `<b>Disk</b>    ${bytes(st.bytes)} / 5.00GB (${st.files} files)`,
        `<b>Display</b> ${screen.width}×${screen.height}`
      ];
      rows.forEach(r => info.append(el('div', { html: r })));
      const swatches = el('div', { class: 'swatch-row' });
      ['#8b7dff', '#ff7ad9', '#5ad6ff', '#4ade80', '#fbbf24', '#ff6b6b', '#cfe3ff', '#1f2937', '#0d0f18', '#f5f5f7', '#ff7ad9', '#5ad6ff']
        .forEach(c => { const s = el('span', { class: 'swatch' }); s.style.background = c; swatches.append(s); });
      info.append(swatches);
      box.append(left, info);
      out.append(box); scroll();
    }

    function run(line) {
      const trimmed = line.trim();
      if (!trimmed) { setPrompt(); return; }
      const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g).map(s => s.replace(/^["']|["']$/g, ''));
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);
      if (cmd === 'neofetch') return neofetch();
      const fn = CMDS[cmd];
      if (!fn) { print(`nebula-sh: コマンドが見つかりません: ${esc(cmd)}  —  <span class="t-cy">help</span> でコマンド一覧`, 't-err'); return; }
      busy = true;
      try { Promise.resolve(fn(args)).catch(e => print(String(e), 't-err')); }
      catch (e) { print(String(e && e.message || e), 't-err'); }
      busy = false;
      setPrompt();
    }

    win.onResize(scroll);
    return { focus: () => input.focus(), get cwd() { return cwd; } };
  }

  function shellUser() { return (OS.session && OS.session.user()) || 'user'; }

  OS.apps.register({
    id: 'terminal',
    name: 'ターミナル',
    icon: 'terminal',
    accent: ['#1f2937', '#4b5563'],
    width: 760, height: 460, minWidth: 380, minHeight: 220,
    keywords: 'terminal shell console zsh ターミナル シェル',
    description: 'Nebula Shell — 仮想ファイルシステムを操作します。',
    mount: make
  });
})(window.OS);
