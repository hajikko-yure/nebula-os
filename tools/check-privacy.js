#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   check-privacy — guard against publishing local machine data.

   Scans every file git is about to track for identifiers that
   belong to the machine the code was written on: the local user
   name, absolute home paths, MAC / WAN / LAN addresses, and
   private network ranges.

   Run before every push:
       node tools/check-privacy.js
       git add -A && node tools/check-privacy.js && git commit

   Exit code 0 = clean, 1 = found something.
   ══════════════════════════════════════════════════════════════ */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* Files that are allowed to be absent from the scan (the checker itself
   necessarily contains the very patterns it looks for). */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.cache']);
const SKIP_FILES = new Set(['tools/check-privacy.js']);

/* Local folder names to treat as a leak. Kept empty on purpose so the repo
   does not advertise the directory it was written in — add your own if needed. */
const EXTRA_DIR_NAMES = [];

const CHECKS = [
  // --- local identity ---
  { name: 'absolute Windows user path', re: /[A-Za-z]:[\\/]+Users[\\/]+[A-Za-z0-9._-]+/gi, fix: 'Replace with a relative path or a placeholder like <user>.' },
  { name: 'absolute macOS/Linux user path', re: /\/Users\/[A-Za-z0-9._-]+/g, fix: 'Replace with a relative path or a placeholder.' },
  { name: 'home directory reference', re: /%USERPROFILE%|\$HOME|~\/Library/gi, fix: 'Remove the local home reference.' },
  { name: 'local temp path', re: /AppData[\\/]+Local[\\/]+Temp|nebula-cdp-/gi, fix: 'Remove the machine-local temp path.' },
  /* Add any project-specific folder name you want excluded, e.g. 'my-private-repo'. */
  { name: 'local project folder name', re: new RegExp('[\\\\/](' + (EXTRA_DIR_NAMES.join('|') || '(?!)') + ')[\\\\/]', 'gi'), fix: 'Remove the local project folder name.' },
  { name: 'agent/tooling path', re: /\.config[\\/]+(kilo|claude|codex)|\.opencode[\\/]/gi, fix: 'Remove tooling-specific paths.' },

  // --- network identity ---
  { name: 'MAC address', re: /\b(?:[0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}\b/g, fix: 'Remove the MAC address.' },
  { name: 'private LAN address', re: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g, fix: 'Remove the private address.' },
  { name: 'public IPv4 address', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, isAddress: true, skip: v => /^(0\.0\.0\.0|127\.0\.0\.1|255\.255\.255\.255)$/.test(v), fix: 'Remove the IP address (0.0.0.0 / 127.0.0.1 are fine).' },
  { name: 'IPv6 address', re: /\b(?:[0-9A-Fa-f]{1,4}:){4,7}[0-9A-Fa-f]{1,4}\b/g, isAddress: true, fix: 'Remove the IPv6 address.' },

  // --- other secrets worth excluding ---
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, fix: 'Never commit a private key.' },
  { name: 'generic secret assignment', re: /\b(api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*["'][^"']{8,}["']/gi, fix: 'Move the secret to an env var.' },
  { name: 'cloud access key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, fix: 'Rotate and remove the key.' }
];

/** Every file git would track. */
function trackedFiles() {
  let out = [];
  try {
    out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/).filter(Boolean);
  } catch (_) {
    out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/).filter(Boolean);
  }
  return out.filter(f => {
    const norm = f.replace(/\\/g, '/');
    if (SKIP_FILES.has(norm)) return false;
    return !SKIP_DIRS.has(norm.split('/')[0]);
  });
}

/**
 * An IPv4-shaped run that is really SVG path data.
 * Path data packs decimals together and separates them with '-' / '+' / command
 * letters ("l3.5.9.9-3.5z"), so a genuine address is always a standalone token
 * bounded by quotes, whitespace, or punctuation.
 */
function looksLikeSvgNumber(matched, line, index) {
  const before = line[index - 1] || '';
  const after = line[index + matched.length] || '';
  if (/[0-9A-Za-z._+\-]/.test(before)) return true;
  if (/[0-9A-Za-z._+\-]/.test(after)) return true;
  // Octets must be valid decimal groups.
  return !matched.split('.').every(o => Number(o) <= 255);
}

let findings = 0;
const files = trackedFiles();
if (!files.length) {
  console.log('No files to scan. Run `git add -A` first, or run inside the repository.');
  process.exit(0);
}

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  // Only scan text; binary assets cannot leak a user name.
  const buf = fs.readFileSync(abs);
  if (buf.includes(0)) continue;

  const lines = buf.toString('utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const c of CHECKS) {
      const re = new RegExp(c.re.source, c.re.flags.includes('g') ? c.re.flags : c.re.flags + 'g');
      const found = [];
      let m;
      while ((m = re.exec(line)) !== null) {
        if (c.skip && c.skip(m[0])) continue;
        if (c.isAddress && looksLikeSvgNumber(m[0], line, m.index)) continue;
        found.push(m[0]);
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      if (!found.length) continue;
      findings++;
      console.log(`\n[${c.name}] ${rel}:${i + 1}`);
      console.log(`  matched: ${[...new Set(found)].slice(0, 4).join('  ')}`);
      console.log(`  ${line.trim().slice(0, 140)}`);
      console.log(`  -> ${c.fix}`);
    }
  });
}

console.log('\n' + '─'.repeat(60));
if (findings) {
  console.log(`✗ ${findings} potential leak(s) across ${files.length} files.`);
  console.log('  Remove the values above before committing or pushing.');
  process.exit(1);
}
console.log(`✓ clean — ${files.length} files scanned, nothing machine-specific found.`);
