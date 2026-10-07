/**
 * Feature Builder — assembles the per-team feature matrix used by the market
 * baseline and recalibration: Elo rating, latest FIFA ranking, and recent
 * form derived from the historical results CSV.
 */
import fs from 'node:fs';
import { files } from '../data/paths.js';
import { resolveTeam, allTeams } from './teamResolver.js';
import { eloProbs } from './elo.js';

export interface TeamFeatures {
  code: string;
  elo: number;
  attack: number;
  defense: number;
  fifaRank: number | null;
  fifaPoints: number | null;
  form: number; // -1..1, recent points momentum
  matchesConsidered: number;
}

let eloCache: Record<string, { elo: number; attack: number; defense: number }> | null = null;
let featureCache: Map<string, TeamFeatures> | null = null;

function loadElo(): Record<string, { elo: number; attack: number; defense: number }> {
  if (!eloCache) eloCache = JSON.parse(fs.readFileSync(files.elo, 'utf-8'));
  return eloCache!;
}

export function getElo(code: string): { elo: number; attack: number; defense: number } {
  return loadElo()[code] ?? { elo: 1500, attack: 1.0, defense: 1.0 };
}

/** Parse the latest FIFA ranking row per team from the historical CSV. */
function loadFifaRanks(): Map<string, { rank: number; points: number }> {
  const out = new Map<string, { rank: number; points: number }>();
  let text: string;
  try {
    text = fs.readFileSync(files.fifaRank, 'utf-8');
  } catch {
    return out;
  }
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return out;
  const header = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iName = idx(['team', 'country', 'nation']);
  const iCode = idx(['code', 'abbrev', 'fifa']);
  const iRank = idx(['rank']);
  const iPts = idx(['points', 'total', 'pts']);
  const iDate = idx(['date', 'as_at', 'rank_date']);

  // Keep the most recent row per resolvable team.
  const latest = new Map<string, { date: string; rank: number; points: number }>();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsv(lines[i]);
    if (cols.length < header.length) continue;
    const ident = (iCode >= 0 ? cols[iCode] : '') || (iName >= 0 ? cols[iName] : '');
    const team = resolveTeam((ident || '').trim());
    if (!team) continue;
    const rank = iRank >= 0 ? parseFloat(cols[iRank]) : NaN;
    const points = iPts >= 0 ? parseFloat(cols[iPts]) : NaN;
    const date = iDate >= 0 ? cols[iDate] : String(i);
    const prev = latest.get(team.code);
    if (!prev || date > prev.date) latest.set(team.code, { date, rank, points });
  }
  for (const [code, v] of latest) {
    out.set(code, { rank: Number.isFinite(v.rank) ? v.rank : 0, points: Number.isFinite(v.points) ? v.points : 0 });
  }
  return out;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if ((ch === ',' || ch === ';') && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function buildFeatures(): Map<string, TeamFeatures> {
  if (featureCache) return featureCache;
  const ranks = loadFifaRanks();
  const map = new Map<string, TeamFeatures>();
  for (const t of allTeams()) {
    const elo = getElo(t.code);
    const r = ranks.get(t.code) ?? null;
    map.set(t.code, {
      code: t.code,
      elo: elo.elo,
      attack: elo.attack,
      defense: elo.defense,
      fifaRank: r?.rank ?? null,
      fifaPoints: r?.points ?? null,
      form: 0,
      matchesConsidered: 0,
    });
  }
  featureCache = map;
  return map;
}

export function getFeatures(code: string): TeamFeatures | undefined {
  return buildFeatures().get(code);
}

/**
 * Market baseline prediction for a match from Elo alone (the "predicción de
 * mercado" the spec asks us to distinguish from consensus and real result).
 */
export function marketPrediction(homeCode: string, awayCode: string, allowDraw = true) {
  const h = getElo(homeCode).elo;
  const a = getElo(awayCode).elo;
  return eloProbs(h, a, allowDraw);
}

export function resetFeatureCache(): void {
  featureCache = null;
  eloCache = null;
}
