#!/usr/bin/env node
/**
 * Publish the Godot web export to the alternate origin the hosted shell loads it from (docs/HOSTING.md section 3).
 *
 * Why this exists: `index.wasm` is 36.3 MiB raw, over Cloudflare Pages' 25 MiB per-file cap, so the export cannot
 * ride in the Pages build. It lives in an R2 bucket behind `https://game.branchzero.app`, versioned by content hash,
 * and the shell build receives `VITE_GAME_BASE_URL=https://game.branchzero.app/<version>`.
 *
 *   npm run export:web                                   # first: produce apps/web/public/game/*
 *   node scripts/publish-game.mjs                        # dry run: prints the version and the wrangler commands
 *   node scripts/publish-game.mjs --execute              # runs them (needs `wrangler login` or CLOUDFLARE_API_TOKEN)
 *   R2_BUCKET=branch-zero-game GAME_ORIGIN=https://game.branchzero.app node scripts/publish-game.mjs --execute
 *
 * Nothing here touches Pages, DNS or the desk. It uploads public game bytes only.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME_DIR = path.join(ROOT, 'apps', 'web', 'public', 'game');
const BUCKET = process.env.R2_BUCKET ?? 'branch-zero-game';
const ORIGIN = (process.env.GAME_ORIGIN ?? 'https://game.branchzero.app').replace(/\/+$/, '');
const EXECUTE = process.argv.includes('--execute');

const MIME = {
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
};

const files = fs.existsSync(GAME_DIR) ? fs.readdirSync(GAME_DIR).filter((f) => !f.startsWith('.')) : [];
if (!files.includes('index.wasm') || !files.includes('index.pck') || !files.includes('index.js')) {
  console.error(`no complete export in ${GAME_DIR} - run \`npm run export:web\` first`);
  process.exit(1);
}

// Version = short hash of the engine + pack bytes: a re-export with identical bytes republishes nothing new,
// and two builds never share a path, so `immutable` caching is safe.
const h = createHash('sha256');
for (const f of ['index.wasm', 'index.pck', 'index.js']) h.update(fs.readFileSync(path.join(GAME_DIR, f)));
const version = h.digest('hex').slice(0, 12);

console.log(`export  ${GAME_DIR}`);
for (const f of files) {
  const size = fs.statSync(path.join(GAME_DIR, f)).size;
  console.log(`  ${f.padEnd(34)} ${(size / 1024 / 1024).toFixed(2).padStart(8)} MiB${size > 25 * 1024 * 1024 ? '   > Pages 25 MiB cap' : ''}`);
}
console.log(`version ${version}\nbucket  ${BUCKET}\norigin  ${ORIGIN}\n`);

const cmds = files.map((f) => {
  const ext = path.extname(f).toLowerCase();
  const key = `${version}/${f}`;
  return [
    'npx', 'wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`,
    '--file', path.join(GAME_DIR, f),
    '--content-type', MIME[ext] ?? 'application/octet-stream',
    '--cache-control', 'public, max-age=31536000, immutable',
    '--remote',
  ];
});

for (const c of cmds) console.log(`$ ${c.join(' ')}`);
console.log(`\nthen set on the Pages project (build env):\n  VITE_GAME_BASE_URL=${ORIGIN}/${version}\n`);

if (!EXECUTE) {
  console.log('dry run - add --execute to upload.');
  process.exit(0);
}
for (const c of cmds) {
  const r = spawnSync(c[0], c.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`upload failed (${r.status}) - nothing else was changed`);
    process.exit(r.status ?? 1);
  }
}
console.log(`\nuploaded ${files.length} files under ${ORIGIN}/${version}/`);
