import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev server for the shell. Deliberately NO Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy headers:
 * the Godot export is single-threaded (K1) so it does not need SharedArrayBuffer, and COEP `require-corp`
 * would break the Privy iframe later (K8).
 *
 * Proxies keep the browser same-origin:
 *   /api  -> Teller Desk (apps/teller-desk, :8787)
 *   /arc-api -> Arc Teller Desk (:8788)
 *   /rpc  -> Remote EVM JSON-RPC (127.0.0.1:8545) for read-only bridge calls in dev
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
      '/arc-api': { target: process.env.ARC_TELLER_DESK_URL ?? 'http://127.0.0.1:8788', changeOrigin: true, rewrite: (p) => p.replace(/^\/arc-api/, '') },
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
