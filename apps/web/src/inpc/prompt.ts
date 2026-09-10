import { SYSTEM_RULES, TEACHING_PACK, TECH_PRIMER } from './pack';
import type { ChatMessage, InpcSnapshot } from './types';

/**
 * `[system, …history, user]` — the shape OpenRouter gets. The system half is rules + teaching pack + technology
 * primer + the fresh snapshot, all from the docs/game-knowledge allowlist; the robot has nothing else.
 */
export function buildMessages(snapshot: InpcSnapshot, history: ChatMessage[], user: string): ChatMessage[] {
  const system = [
    SYSTEM_RULES,
    '',
    '# TEACHING PACK (general bank knowledge)',
    TEACHING_PACK,
    '',
    '# TECHNOLOGY PRIMER (use for "Ask why" depth; bank words first)',
    TECH_PRIMER,
    '',
    '# PLAYER SNAPSHOT (the only player-specific truth)',
    JSON.stringify(snapshot, null, 2),
  ].join('\n');
  return [{ role: 'system', content: system }, ...history.filter((m) => m.role !== 'system'), { role: 'user', content: user }];
}
