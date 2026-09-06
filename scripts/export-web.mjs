#!/usr/bin/env node
/**
 * Export apps/game with Godot 4.5.x (standard/GDScript build, NOT mono) to apps/web/public/game/.
 *
 *   npm run export:web                      # release
 *   npm run export:web -- --debug           # debug template (console messages, asserts)
 *   GODOT_BIN=path/to/Godot_v4.5.2-stable_win64_console.exe npm run export:web
 *
 * Resolution order for the binary: $GODOT_BIN → %LOCALAPPDATA%/Programs/Godot-4.5.2/*console.exe → `godot` on PATH.
 * Refuses anything that is not 4.5.x (the lab's 4.7.1-mono pin is the wrong engine for a GDScript web export).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(ROOT, 'apps', 'game');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'public', 'game');
const PIN = fs.readFileSync(path.join(GAME, '.godot-version'), 'utf8').trim(); // e.g. 4.5.2-stable
const DEBUG = process.argv.includes('--debug');

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
// 2) export the Web preset (thread support OFF in export_presets.cfg)
const outHtml = path.join(OUT_DIR, 'index.html');
run(['--headless', '--path', GAME, DEBUG ? '--export-debug' : '--export-release', 'Web', outHtml]);

const files = fs.readdirSync(OUT_DIR).map((f) => `${f} (${(fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0)} KB)`);
console.log(`\nexported to apps/web/public/game/:\n  ${files.join('\n  ')}`);
console.log('\nServe: npm run dev:web  →  http://localhost:5173  (the Vite index.html is the shell; Godot\'s index.html is unused)');
