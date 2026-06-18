/**
 * Versioned persistence + audit log.
 *
 * Design goals from the spec:
 *  - never overwrite a prediction/result without keeping the previous state
 *  - every run gets a version id; any past tournament state is reconstructable
 *  - all changes are auditable (who/when/what/why + version hash)
 *  - results sync is idempotent
 *
 * Implementation: append-only JSON files under STATE_DIR. Cheap, dependency
 * free, and easy for the next developer to swap for a real DB.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { STATE_DIR } from './paths.js';
import type { AuditEntry } from '../domain/types.js';

function ensureDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    ensureDir();
    const p = path.join(STATE_DIR, file);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    /* fall through to fallback */
  }
  return fallback;
}

function writeJson<T>(file: string, data: T): void {
  ensureDir();
  fs.writeFileSync(path.join(STATE_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

export function hashState(state: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0, 16);
}

// ───────────────────────────── Results ─────────────────────────────
// Official scores keyed by canonical matchId. The results provider writes
// here; the bracket/standings engines read from here.

export interface StoredResult {
  matchId: string;
  home: number;
  away: number;
  status: 'finished' | 'corrected';
  source: string;
  updatedAt: string;
}

const RESULTS_FILE = 'results.json';

export function getStoredResults(): Record<string, StoredResult> {
  return readJson<Record<string, StoredResult>>(RESULTS_FILE, {});
}

/**
 * Idempotent upsert: returns true only when something actually changed
 * (new result, or a correction with a different score/status).
 */
export function upsertResult(r: StoredResult): boolean {
  const all = getStoredResults();
  const prev = all[r.matchId];
  if (prev && prev.home === r.home && prev.away === r.away && prev.status === r.status) {
    return false;
  }
  all[r.matchId] = r;
  writeJson(RESULTS_FILE, all);
  return true;
}

export function clearResults(): void {
  writeJson(RESULTS_FILE, {});
}

// ──────────────────────── Imported predictions ────────────────────────
// Beyond the 10 benchmark files on disk, models can be added at runtime
// (e.g. a fresh Gemini run). Stored separately so source files stay pristine.

const RUNTIME_PRED_FILE = 'runtime-predictions.json';

export function getRuntimePredictions(): Record<string, unknown> {
  return readJson<Record<string, unknown>>(RUNTIME_PRED_FILE, {});
}

export function saveRuntimePrediction(modelName: string, prediction: unknown): void {
  const all = getRuntimePredictions();
  all[modelName] = prediction;
  writeJson(RUNTIME_PRED_FILE, all);
}

// ───────────────────────── Version snapshots ─────────────────────────
// Each meaningful state change appends an immutable snapshot so any past
// tournament state can be reconstructed (criterio 13).

export interface VersionSnapshot {
  versionHash: string;
  createdAt: string;
  reason: string;
  state: unknown;
}

const VERSIONS_FILE = 'versions.json';

export function getVersions(): VersionSnapshot[] {
  return readJson<VersionSnapshot[]>(VERSIONS_FILE, []);
}

export function appendVersion(reason: string, state: unknown): VersionSnapshot {
  const versions = getVersions();
  const snap: VersionSnapshot = {
    versionHash: hashState(state),
    createdAt: new Date().toISOString(),
    reason,
    state,
  };
  versions.push(snap);
  writeJson(VERSIONS_FILE, versions);
  return snap;
}

export function getVersion(hash: string): VersionSnapshot | undefined {
  return getVersions().find((v) => v.versionHash === hash);
}

export function currentVersionHash(): string {
  const v = getVersions();
  return v.length ? v[v.length - 1].versionHash : 'genesis';
}

// ───────────────────────────── Audit log ─────────────────────────────

const AUDIT_FILE = 'audit.json';

export function getAudit(): AuditEntry[] {
  return readJson<AuditEntry[]>(AUDIT_FILE, []);
}

export function appendAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
  const log = getAudit();
  const full: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  log.push(full);
  writeJson(AUDIT_FILE, log);
  return full;
}
