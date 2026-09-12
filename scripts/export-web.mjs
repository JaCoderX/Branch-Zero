#!/usr/bin/env node
/**
 * Export apps/game with Godot 4.5.x (standard/GDScript build, NOT mono) to apps/web/public/game/.
 *
 *   npm run export:web                      # release, official 4.5.x web template ("Web" preset)
 *   npm run export:web:lean                 # release, pinned lean custom template ("Web-Lean" preset)
 *   npm run export:web -- --debug           # debug template (console messages, asserts)
 *   GODOT_BIN=path/to/Godot_v4.5.2-stable_win64_console.exe npm run export:web
 *
 * --lean selects the Profile H custom template pinned under tools/godot-web-template/ (threads OFF,
 * optimize=size_extra, 23.68 MiB index.wasm vs 36.29 MiB official). It is OPT-IN: the
 * default "Web" preset keeps custom_template empty so a clone without the zip still exports.
 * See docs/HOSTING.md and tools/godot-web-template/README.md.
 *
 * Resolution order for the binary: $GODOT_BIN → %LOCALAPPDATA%/Programs/Godot-4.5.2/*console.exe → `godot` on PATH.
 * Refuses anything that is not 4.5.x (the lab's 4.7.1-mono pin is the wrong engine for a GDScript web export).
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(ROOT, 'apps', 'game');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'public', 'game');
const PIN = fs.readFileSync(path.join(GAME, '.godot-version'), 'utf8').trim(); // e.g. 4.5.2-stable
const DEBUG = process.argv.includes('--debug');
const LEAN = process.argv.includes('--lean') || process.env.GODOT_WEB_PRESET === 'Web-Lean';
const PRESET = LEAN ? 'Web-Lean' : 'Web';

// ENG-2026-0025 Profile H — the artefact the "Web-Lean" preset pins. Rebuild recipe + sha in
// tools/godot-web-template/README.md; the path here must match export_presets.cfg [preset.1.options].
const LEAN_TEMPLATE = path.join(ROOT, 'tools', 'godot-web-template', 'godot-4.5.2-stable-web-nothreads-lean-h.zip');
const LEAN_SHA256 = '03a443b07e5e3fadc8227c7441e9fdbec1e07fc821fa97bbed94dcd7a20a5c66';

// Cloudflare Pages per-file cap, both readings (HOSTING.md §3.3).
const CAP_MIB = 26_214_400;
const CAP_MB = 25_000_000;

function candidates() {
  const list = [];
  if (process.env.GODOT_BIN) list.push(process.env.GODOT_BIN);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const dir = path.join(process.env.LOCALAPPDATA, 'Programs', `Godot-${PIN.replace('-stable', '')}`);
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) if (/console\.exe$/i.test(f)) list.push(path.join(dir, f));
      for (const f of fs.readdirSync(dir)) if (/\.exe$/i.test(f) && !/console/i.test(f)) list.push(path.join(dir, f));
    }
  }
  list.push('godot', 'godot4');
  return list;
}

function version(bin) {
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || r.stderr || '').trim().split(/\r?\n/).pop();
}

let godot;
for (const c of candidates()) {
  const v = version(c);
  if (v && v.startsWith('4.5.')) {
    godot = { bin: c, version: v };
    break;
  }
  if (v) console.warn(`skip ${c}: version ${v} is not 4.5.x`);
}
if (!godot) {
  console.error(
    `No Godot 4.5.x found. Install the official ${PIN} standard build (not mono) — see README "Godot 4.5.2" — ` +
      `or set GODOT_BIN. Export templates go to %APPDATA%/Godot/export_templates/${PIN.replace('-', '.')}/`,
  );
  process.exit(1);
}
console.log(`godot  ${godot.bin}\nver    ${godot.version}`);

if (LEAN) {
  if (DEBUG) {
    console.error('--lean has no debug counterpart: only custom_template/release is pinned (Profile H is a release build).');
    process.exit(1);
  }
  if (!fs.existsSync(LEAN_TEMPLATE)) {
    console.error(
      `Lean template missing: ${LEAN_TEMPLATE}\n` +
        'It is git-ignored (7.3 MB binary). Rebuild it with tools/godot-web-template/build-profile-h.ps1 — ' +
        'see tools/godot-web-template/README.md. Plain `npm run export:web` needs none of this.',
    );
    process.exit(1);
  }
  const got = crypto.createHash('sha256').update(fs.readFileSync(LEAN_TEMPLATE)).digest('hex');
  if (got !== LEAN_SHA256) {
    console.error(`Lean template sha256 mismatch\n  want ${LEAN_SHA256}\n  got  ${got}\n${LEAN_TEMPLATE}`);
    process.exit(1);
  }
  console.log(`lean   ${path.relative(ROOT, LEAN_TEMPLATE)}\n       sha256 ${got} (ENG-2026-0025 Profile H)`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

function run(args) {
  console.log(`\n$ godot ${args.join(' ')}`);
  const r = spawnSync(godot.bin, args, { cwd: GAME, stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) {
    console.error(`godot exited with ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

// 1) import resources (first run of a fresh checkout has no .godot/ cache)
run(['--headless', '--path', GAME, '--import']);
// 2) export the chosen preset (thread support OFF in both presets in export_presets.cfg).
//    "Web-Lean" pins custom_template/release by a path RELATIVE to apps/game, so run() must keep cwd there.
const outHtml = path.join(OUT_DIR, 'index.html');
run(['--headless', '--path', GAME, DEBUG ? '--export-debug' : '--export-release', PRESET, outHtml]);

const files = fs.readdirSync(OUT_DIR).map((f) => `${f} (${(fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0)} KB)`);
console.log(`\nexported to apps/web/public/game/ (preset ${PRESET}):\n  ${files.join('\n  ')}`);

// Pages gates on the UNCOMPRESSED wasm. The compose stack (HOSTING §4) has no such cap.
const wasm = path.join(OUT_DIR, 'index.wasm');
if (fs.existsSync(wasm)) {
  const b = fs.statSync(wasm).size;
  const verdict = (cap) => (b < cap ? `PASS (-${(cap - b).toLocaleString()})` : `FAIL (+${(b - cap).toLocaleString()})`);
  console.log(
    `\nindex.wasm  ${b.toLocaleString()} B  ${(b / 1024 / 1024).toFixed(3)} MiB` +
      `\n  < 25 MiB (${CAP_MIB.toLocaleString()})  ${verdict(CAP_MIB)}` +
      `\n  < 25 MB  (${CAP_MB.toLocaleString()})  ${verdict(CAP_MB)}`,
  );
}
console.log('\nServe: npm run dev:web  →  http://localhost:5173  (the Vite index.html is the shell; Godot\'s index.html is unused)');
