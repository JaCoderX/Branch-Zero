import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const INFRA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO_ROOT = path.resolve(INFRA_DIR, '..');
export const BUILD_DIR = path.join(INFRA_DIR, 'build');
export const ARTIFACTS_DIR = path.join(BUILD_DIR, 'artifacts');
export const DEPLOYMENTS_DIR = path.join(INFRA_DIR, 'deployments');

/** Load repo-root `.env` (git-ignored) if present. Uses Node's built-in loader; never logs values. */
export function loadEnv(): void {
  for (const p of [path.join(REPO_ROOT, '.env'), path.join(INFRA_DIR, '.env')]) {
    if (fs.existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {
        /* ignore malformed lines */
      }
    }
  }
}

export function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing env ${name} (see .env.example)`);
  }
  return v;
}

export function redact(v: string): string {
  return v.length <= 10 ? '***' : `${v.slice(0, 6)}…${v.slice(-4)}`;
}
