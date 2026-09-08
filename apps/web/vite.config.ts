import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev server for the shell. Deliberately NO Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy headers:
 * the Godot export is single-threaded (K1) so it does not need SharedArrayBuffer, and COEP `require-corp`
 * would break the Privy iframe later (K8).
 *
 * Proxies keep the browser same-origin. There is one per Teller Desk process, because a desk pins its chain at
 * boot (docs/SEPOLIA-LIVE.md §2) — the browser picks a *desk*, which is how Live/Dev is chosen:
 *
 *   /api      -> Live Teller Desk    (:8787, CHAIN_ID=11155111 Sepolia)  — product default
 *   /dev-api  -> Dev Teller Desk     (:8788, --dev / CHAIN_ID=1337)      — Developer Mode, operator only
 *   /arc-api  -> Arc Teller Desk     (:8789, CHAIN_ID=5042002)           — U6, DEFERRED
 *   /rpc      -> Remote EVM JSON-RPC (127.0.0.1:8545) for the U0 lab read probes (`chainInfo`/`accountInfo`)
 *
 * `/rpc` stays pointed at the lab chain on purpose: it serves the two K1 fixture probes and nothing the game
 * uses. Everything the bank displays about "which chain am I on" comes from the desk's `/session`, so a Live
 * player never sees 1337 anywhere.
 */
export default defineConfig({
  plugins: [react()],
  // VITE_* values live in the repo-root .env alongside the server's secrets, so there is one file to fill.
  envDir: '../..',
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      // intentionally empty: no COOP/COEP (see docs/GODOT.md §1, PLAN C3)
    },
    proxy: {
      '/api': { target: process.env.TELLER_DESK_URL ?? 'http://127.0.0.1:8787', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/dev-api': { target: process.env.DEV_TELLER_DESK_URL ?? 'http://127.0.0.1:8788', changeOrigin: true, rewrite: (p) => p.replace(/^\/dev-api/, '') },
      '/arc-api': { target: process.env.ARC_TELLER_DESK_URL ?? 'http://127.0.0.1:8789', changeOrigin: true, rewrite: (p) => p.replace(/^\/arc-api/, '') },
      '/rpc': { target: process.env.REMOTE_EVM_RPC_URL ?? 'http://127.0.0.1:8545', changeOrigin: true, rewrite: () => '/' },
    },
    fs: {
      // allow importing infra/deployments/*.json (addresses only) from the monorepo root
      allow: ['../..'],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
