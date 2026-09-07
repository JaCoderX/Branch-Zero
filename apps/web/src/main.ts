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

const GAME_BASE = '/game/index';

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
    // Once the engine runs the status div goes away entirely (it is `pointer-events: none` regardless — an
    // invisible full-viewport div over the canvas is what broke canvas re-focus in the U4 playtest).
    boot.hidden = s.startsWith('running');
    boot.textContent = boot.hidden ? '' : `Branch Zero — ${s}`;
  }
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

async function boot() {
  setState('loading engine…');
  const head = await fetch(`${GAME_BASE}.js`, { method: 'HEAD' }).catch(() => undefined);
  if (!head || !head.ok) {
    setState('no export found at /game/ — run `npm run export:web` (Godot 4.5.2, Web preset, threads off)');
    return;
  }
  await loadScript(`${GAME_BASE}.js`);
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
