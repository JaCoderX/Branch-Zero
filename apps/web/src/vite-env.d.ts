/// <reference types="vite/client" />

import type { BranchZeroBridge } from '@branch-zero/shared';

interface ImportMetaEnv {
  readonly VITE_GAME_BASE_URL?: string;
  /** Short sha of public/game/index.pck — set by scripts/build-web.mjs for cache-busting. */
  readonly VITE_GAME_ASSET_BUST?: string;
  readonly VITE_TELLER_DESK_URL?: string;
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_PRIVY_SIGNER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
