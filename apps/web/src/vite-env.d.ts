/// <reference types="vite/client" />

import type { BranchZeroBridge } from '@branch-zero/shared';

declare global {
  interface Window {
    BranchZero: BranchZeroBridge;
    /** Godot's engine loader global, defined by /game/index.js once the export exists. */
    Engine?: new (config: Record<string, unknown>) => {
      startGame(opts?: { onProgress?: (current: number, total: number) => void }): Promise<void>;
    };
  }
}

export {};
