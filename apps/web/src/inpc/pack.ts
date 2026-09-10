/**
 * iNPC context — loaded ONLY from the docs/game-knowledge/ allowlist (see its README). The robot has no tools
 * or repo access at runtime, so these files + the live snapshot are its whole world.
 * Coding agents: see root AGENTS.md; never import missions/, OWED, SECURITY or other operator docs here.
 *
 * Provenance: curated from docs/GAME-DESIGN.md §4 and docs/NPCS.md Ask-why lines; adapted from the GameLab
 * ENG-2026-0019 fixture that proved 16/16 grounding on Inkling Small (ENG-2026-0020). Product-owned:
 * nothing is read from GameLab at runtime.
 *
 * These files contain NO facts about any individual player. Those come only from the snapshot (`./snapshot.ts`).
 */
import systemRulesRaw from '../../../../docs/game-knowledge/system-rules.md?raw';
import teachingPackRaw from '../../../../docs/game-knowledge/teaching-pack.md?raw';
import bloxchainAccountRaw from '../../../../docs/game-knowledge/bloxchain-account.md?raw';

export const SYSTEM_RULES = systemRulesRaw.trim();
export const TEACHING_PACK = teachingPackRaw.trim();
export const TECH_PRIMER = bloxchainAccountRaw.trim();
