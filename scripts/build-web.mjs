#!/usr/bin/env node
/**
 * Production shell build (Workers & Pages / any static host).
 *
 * Refuses to ship without apps/web/public/game/index.wasm so a Cloudflare Workers Build
 * (`npm run build:web` on a clean git clone) cannot deploy a splash-only bank and wipe a
 * good lean export already on the CDN (docs/HOSTING.md §3).
 *
 * Local Godot-less iteration: use `npm run dev:web` (no this gate). Export first with
 * `npm run export:web:lean` (or `export:web`) before any production build.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM = path.join(ROOT, 'apps', 'web', 'public', 'game', 'index.wasm');
const DIST_GAME = path.join(ROOT, 'apps', 'web', 'dist', 'game');

if (!fs.existsSync(WASM)) {
  console.error(
    `\n✗ no Godot export at apps/web/public/game/index.wasm\n` +
      `  Run \`npm run export:web:lean\` on a Godot 4.5.2 host first (or \`export:web\`).\n` +
      `  Cloudflare Git Builds cannot compile Godot — a build without /game/ would replace the\n` +
      `  live bank with an endless splash. Prefer local \`npm run deploy:web\` after export.\n`,
  );
  process.exit(1);
}

const bytes = fs.statSync(WASM).size;
const mib = (bytes / (1024 * 1024)).toFixed(3);
console.log(`• Godot export present: index.wasm ${bytes} B (${mib} MiB)`);

const r = spawnSync('npm', ['-w', 'apps/web', 'run', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});
if (r.status !== 0) process.exit(r.status ?? 1);

for (const rel of ['index.js', 'index.wasm', 'index.pck']) {
  const p = path.join(DIST_GAME, rel);
  if (!fs.existsSync(p)) {
    console.error(`\n✗ dist/game/${rel} missing after vite build — refusing to leave a broken dist.\n`);
    process.exit(1);
  }
}
console.log(`✓ apps/web/dist includes /game/ (safe to wrangler deploy)`);
