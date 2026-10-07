/**
 * Dynamic Elo persistence — wraps the pure Elo engine with stored overrides so
 * ratings evolve as real results arrive (Level 3 recalibration of team strength).
 * Static seed ratings come from elo_ratings.json; overrides live in STATE_DIR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { STATE_DIR } from '../data/paths.js';
import { getElo } from './featureBuilder.js';
import { calculateEloUpdate, type MatchRound } from './elo.js';

const ELO_FILE = path.join(STATE_DIR, 'elo-overrides.json');

interface EloOverride {
  elo: number;
  updatedAt: string;
}

function readOverrides(): Record<string, EloOverride> {
  try {
    if (fs.existsSync(ELO_FILE)) return JSON.parse(fs.readFileSync(ELO_FILE, 'utf-8'));
  } catch {
    /* ignore */
  }
  return {};
}

function writeOverrides(o: Record<string, EloOverride>): void {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(ELO_FILE, JSON.stringify(o, null, 2), 'utf-8');
}

export function currentElo(code: string): number {
  const ov = readOverrides()[code];
  return ov ? ov.elo : getElo(code).elo;
}

const ROUND_TO_K: Record<string, MatchRound> = {
  group: 'group',
  R32: 'R32',
  R16: 'R16',
  QF: 'QF',
  SF: 'SF',
  F: 'F',
  TP: 'TP',
};

export async function processMatchEloUpdate(
  homeCode: string,
  awayCode: string,
  homeScore: number,
  awayScore: number,
  round: string,
): Promise<{ home: number; away: number }> {
  const homeElo = currentElo(homeCode);
  const awayElo = currentElo(awayCode);
  const { newHomeElo, newAwayElo } = calculateEloUpdate(
    homeElo,
    awayElo,
    homeScore,
    awayScore,
    ROUND_TO_K[round] ?? 'group',
  );
  const o = readOverrides();
  const now = new Date().toISOString();
  o[homeCode] = { elo: newHomeElo, updatedAt: now };
  o[awayCode] = { elo: newAwayElo, updatedAt: now };
  writeOverrides(o);
  return { home: newHomeElo, away: newAwayElo };
}
