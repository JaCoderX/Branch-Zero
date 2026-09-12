/**
 * Shell boot order (docs/GODOT.md §3):
 *   1. install window.BranchZero            — must exist before the engine's first frame
 *   2. mount the React overlay
 *   3. load /game/index.js (Godot export) and start the engine on #canvas
 *
 * The Godot export lives in public/game/ (git-ignored). Produce it with `npm run export:web`.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { installBridge, onBridgeTraffic } from './bridge/branchZero';
import { Providers } from './overlay/Providers';
import { focusCanvas } from './shell/focus';

/**
 * Where the Godot export lives. Same-origin `/game/` by default (Vite dev + any static host). On Cloudflare Pages
 * the 36 MiB `index.wasm` is over the 25 MiB per-file cap, so the build points this at an alternate origin
 * (`VITE_GAME_BASE_URL=https://game.branchzero.app/<version>`, an R2 bucket with CORS) and Pages carries only the
 * shell (docs/HOSTING.md section 3). Godot's `Engine` accepts an absolute URL as `executable` and derives
 * `.wasm`, `.pck` and the audio worklets from it, so nothing in the export template changes.
 */
const GAME_DIR = String(import.meta.env.VITE_GAME_BASE_URL || '/game').replace(/\/+$/, '');
const GAME_BASE = `${GAME_DIR}/index`;

installBridge();
// Godot registering its callback is the reliable "engine is running" signal (Engine.startGame() may not settle).
onBridgeTraffic((m) => {
  if (m.type === 'event' && m.kind === 'bridge.ready') setState('running (Godot 4.5.2 web, single-threaded)');
});

const root = createRoot(document.getElementById('overlay')!);
let engineState = 'not started';
function render() {
  root.render(createElement(Providers, { engineState }));
}
function setState(s: string) {
  engineState = s;
  render();
  const boot = document.getElementById('boot');
  if (boot) {
    // Once the engine runs the splash goes away entirely (it is `pointer-events: none` regardless — an
    // invisible full-viewport div over the canvas is what broke canvas re-focus in the U4 playtest).
    boot.hidden = s.startsWith('running');
    const status = document.getElementById('boot-status');
    if (status) status.textContent = boot.hidden ? '' : splashLine(s);
    const bar = document.querySelector<HTMLElement>('#boot-bar > i');
    if (bar) {
      const pct = /^loading (\d+)%/.exec(s);
      if (pct) bar.style.width = `${pct[1]}%`;
      else if (s.startsWith('starting')) bar.style.width = '100%';
    }
  }
}
// Everyday bank words for the splash status line; errors and unknown states are shown as written.
function splashLine(s: string): string {
  if (s === 'not started' || s === 'loading engine…') return 'Opening the branch…';
  if (s === 'starting…') return 'Unlocking the doors…';
  const pct = /^loading (\d+)%/.exec(s);
  if (pct) return `Opening the branch… ${pct[1]}%`;
  const kb = /^loading (\d+) KB/.exec(s);
  if (kb) return `Opening the branch… ${Number(kb[1]).toLocaleString()} KB`;
  return s;
}
render();

// Clicking the bank gives Godot the keyboard back. Godot's own mousedown handler focuses the canvas too; this
// covers the pointerdown that lands on #game around it and anything a future overlay child lets through.
document.getElementById('game')?.addEventListener('pointerdown', () => focusCanvas());

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Fetch the engine script with cache-busting semantics and reject HTML (SPA fallback from a
 * shell-only Workers deploy). Avoids HEAD — some edges stall HEAD on large /game assets, which
 * left the splash on "loading engine…" forever.
 */
async function loadEngineScript(src: string): Promise<void> {
  const res = await fetch(src, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`no export found at ${GAME_DIR}/ — run \`npm run export:web:lean\` (Godot 4.5.2, Web-Lean)`);
  }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) {
    throw new Error(
      `got HTML instead of the engine at ${GAME_DIR}/index.js — a shell-only deploy wiped /game/; run export:web:lean + deploy:web`,
    );
  }
  const text = await res.text();
  if (/^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
    throw new Error(
      `got HTML instead of the engine at ${GAME_DIR}/index.js — a shell-only deploy wiped /game/; run export:web:lean + deploy:web`,
    );
  }
  const blob = new Blob([text], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await loadScript(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function boot() {
  setState('loading engine…');
  try {
    await loadEngineScript(`${GAME_BASE}.js`);
  } catch (e) {
    setState((e as Error).message);
    console.error(e);
    return;
  }
  if (!window.Engine) {
    setState('engine script loaded but window.Engine missing');
    return;
  }
  // Mirrors the GODOT_CONFIG Godot writes into its own index.html, with our executable path and the canvas.
  const engine = new window.Engine({
    args: [],
    canvas: document.getElementById('canvas'),
    canvasResizePolicy: 2,
    ensureCrossOriginIsolationHeaders: false, // single-threaded export: no COOP/COEP (K1/K8)
    executable: GAME_BASE,
    experimentalVK: false,
    focusCanvas: true,
    gdextensionLibs: [],
  });
  setState('starting…');
  try {
    await engine.startGame({
      onProgress: (cur, total) => {
        if (!engineState.startsWith('running')) setState(total > 0 ? `loading ${Math.round((100 * cur) / total)}%` : `loading ${Math.round(cur / 1024)} KB`);
      },
    });
    if (!engineState.startsWith('running')) setState('running (Godot 4.5.2 web, single-threaded)');
  } catch (e) {
    setState(`engine failed: ${(e as Error).message}`);
    console.error(e);
  }
}

void boot();
