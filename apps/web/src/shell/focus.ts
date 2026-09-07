/**
 * Give keyboard and mouse back to Godot.
 *
 * Godot's web export listens for `keydown` on the canvas element, not on `document`, so the game only hears
 * keys while `#canvas` is `document.activeElement`. Clicking any React control (the debug pill, a panel button)
 * or finishing a Privy modal moves DOM focus off the canvas, and the player's WASD / E go dead until something
 * focuses it again. Godot re-focuses the canvas on its own `mousedown` — which is why `#boot` must never sit
 * over the canvas as a hit target (index.html) — and the overlay calls this after the interactions it owns.
 */
export function focusCanvas(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const focus = () => canvas.focus({ preventScroll: true });
  // Now, and again after React has committed: the button that was clicked is often unmounted by that commit
  // (panel → pill), and unmounting the focused element drops focus to <body>. Timers, not rAF — a background
  // tab gets no animation frames at all (docs/GODOT.md §5), and a Privy modal closes while the tab may be one.
  focus();
  setTimeout(focus, 0);
  setTimeout(focus, 80);
}
