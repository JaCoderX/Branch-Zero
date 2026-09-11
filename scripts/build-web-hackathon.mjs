#!/usr/bin/env node
/**
 * Build the shell for the hackathon all-in-one stack (docs/HOSTING.md §4).
 *
 *   npm run build:web:hackathon
 *
 * Same `vite build` as `npm run build:web`, with the two env values that make the stack same-origin pinned
 * here instead of in a shell one-liner (PowerShell, bash and Compose each spell that differently, and a
 * missed one silently ships a build that points at last week's desk):
 *
 *   VITE_TELLER_DESK_URL=/api   -> the shell talks to the desk through Caddy on its own origin
 *   VITE_GAME_BASE_URL=''       -> the Godot export is loaded from same-origin /game, not an R2 twin
 *
 * `process.env` wins over the repo-root .env in Vite's env loading, so whatever is in that file for the
 * Pages/R2 path (docs/HOSTING.md §3) does not leak into this build. Everything else — the Privy ids and the
 * optional GitHub client id — still comes from .env, and only `VITE_*` is ever baked: no desk secret, no
 * tunnel token, no Privy app secret (docs/SECURITY-AND-KEYS.md §4.1).
 *
 * Refuses to build without a Godot export present: in this stack the shell and the engine are one origin,
 * and `dist/game/index.wasm` missing means a splash screen that never becomes a bank.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM = path.join(ROOT, 'apps', 'web', 'public', 'game', 'index.wasm');
const DIST = path.join(ROOT, 'apps', 'web', 'dist');

if (!fs.existsSync(WASM)) {
  console.error(
    `\n✗ no Godot export at apps/web/public/game/index.wasm\n` +
      `  Run \`npm run export:web\` on a host with Godot 4.5.x first, or copy a pre-exported public/game/ here.\n` +
      `  (The export is git-ignored on purpose — 36 MiB of engine does not belong in the repo.)\n`,
  );
  process.exit(1);
}

const mib = (fs.statSync(WASM).size / 1024 / 1024).toFixed(2);
console.log(`• Godot export present: index.wasm ${mib} MiB (served same-origin from /game — no 25 MiB Pages cap here)`);

const r = spawnSync('npm', ['run', 'build:web'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_TELLER_DESK_URL: '/api', VITE_GAME_BASE_URL: '' },
});
if (r.status !== 0) process.exit(r.status ?? 1);

for (const rel of ['index.html', 'game/index.wasm', 'game/index.pck', 'game/index.js']) {
  const p = path.join(DIST, rel);
  if (!fs.existsSync(p)) {
    console.error(`\n✗ dist/${rel} is missing after the build — the stack would serve a broken front.\n`);
    process.exit(1);
  }
}
console.log(`\n✓ apps/web/dist ready for docker-compose.hackathon.yml (bind-mounted read-only at /srv)`);
