// FORCH.i ORACLE — Persistent Elo Update Engine
// SINGLE SOURCE OF TRUTH for Elo ratings and K-factors.
// Updates team Elo ratings after each real match result.
// Ratings are persisted to KV store and merged with static ELO_RATINGS at read time.
//
// Formula: Elo_new = Elo_old + K × (actual - expected) × goalDiffMultiplier
// K escalates by stage: 40 (group) → 60 (R32/R16) → 70 (QF/SF) → 80 (Final)

import { ELO_RATINGS, type EloEntry } from './teams';
import type { IDataLayer } from './data-layer/interface';

// ═══════════════════════════════════════════════════════════════
// K-FACTOR BY STAGE — SINGLE SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════

export type MatchRound = 'group' | 'R32' | 'R16' | 'QF' | 'SF' | 'F' | 'TP';

/** K-factor for each tournament stage. Higher K = more reactive to results. */
export const K_FACTORS: Record<MatchRound, number> = {
  group: 40,   // Group stage: standard weight
  R32: 60,     // Round of 32: knockout begins, higher stakes
  R16: 60,     // Octavos: same as R32
  QF: 70,      // Cuartos: quarter-finals, very high stakes
  SF: 70,      // Semifinals: same as QF
  F: 80,       // Final: maximum weight — single match decides champion
  TP: 40,      // Third place: exhibition match, standard weight
};

/** Get K-factor for a given match round */
export function getKFactor(round: MatchRound): number {
  return K_FACTORS[round] ?? 40;
}

// ═══════════════════════════════════════════════════════════════
// ELO CALCULATION
// ═══════════════════════════════════════════════════════════════

/** Expected score from Elo difference */
function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Calculate new Elo ratings for both teams after a match.
 *
 * @param homeElo Current Elo of home team
 * @param awayElo Current Elo of away team
 * @param homeScore Actual home goals (90 min + ET if applicable)
 * @param awayScore Actual away goals (90 min + ET if applicable)
 * @param round Match round (determines K-factor)
 * @returns Updated Elo ratings for both teams
 */
export function calculateEloUpdate(
  homeElo: number,
  awayElo: number,
  homeScore: number,
  awayScore: number,
  round: MatchRound = 'group',
): { newHomeElo: number; newAwayElo: number; homeDelta: number; awayDelta: number } {
  const K = getKFactor(round);

  // Actual result: 1 = win, 0.5 = draw, 0 = loss
  const homeActual = homeScore > awayScore ? 1 : homeScore < awayScore ? 0 : 0.5;
  const awayActual = 1 - homeActual;

  // Expected scores
  const homeExpected = expectedScore(homeElo, awayElo);
  const awayExpected = expectedScore(awayElo, homeElo);

  // Goal difference multiplier (margin of victory bonus)
  // Max 1.5x for 5+ goal margin
  const goalDiff = Math.abs(homeScore - awayScore);
  const multiplier = goalDiff <= 1 ? 1 : Math.min(1.5, 1 + (goalDiff - 1) * 0.1);

  // Calculate deltas
  const homeDelta = Math.round(K * multiplier * (homeActual - homeExpected));
  const awayDelta = Math.round(K * multiplier * (awayActual - awayExpected));

  return {
    newHomeElo: homeElo + homeDelta,
    newAwayElo: awayElo + awayDelta,
    homeDelta,
    awayDelta,
  };
}

// ═══════════════════════════════════════════════════════════════
// ELO LOOKUP — Checks overrides first, then static ratings
// ═══════════════════════════════════════════════════════════════

/**
 * Get current Elo for a team, checking overrides first, then falling back to static ratings.
 * This is the SINGLE ENTRY POINT for all Elo lookups in the application.
 */
export async function getCurrentElo(
  teamName: string,
  db: IDataLayer,
): Promise<EloEntry> {
  // Check for persistent override
  const override = await db.getKeyValue(`eloOverride:${teamName}`);
  if (override && typeof override.value === 'object' && override.value !== null) {
    const val = override.value as Partial<EloEntry>;
    return {
      elo: val.elo ?? ELO_RATINGS[teamName]?.elo ?? 1500,
      attack: val.attack ?? ELO_RATINGS[teamName]?.attack ?? 1.0,
      defense: val.defense ?? ELO_RATINGS[teamName]?.defense ?? 1.0,
    };
  }

  // Fallback to static ratings
  return ELO_RATINGS[teamName] || { elo: 1500, attack: 1.0, defense: 1.0 };
}

// ═══════════════════════════════════════════════════════════════
// ELO PERSISTENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Persist Elo overrides for a team after a match.
 * Also adjusts attack/defense based on the match outcome.
 */
export async function persistEloUpdate(
  teamName: string,
  newElo: number,
  goalsScored: number,
  goalsConceded: number,
  db: IDataLayer,
): Promise<void> {
  const current = await getCurrentElo(teamName, db);

  // Adjust attack/defense ratings based on this match
  // Smooth moving average: 90% old + 10% new observation
  const totalGoals = goalsScored + goalsConceded;
  const newAttack = current.attack * 0.9 + (totalGoals > 0 ? (goalsScored / totalGoals) * 3 : 1.5) * 0.1;
  const newDefense = current.defense * 0.9 + (totalGoals > 0 ? (goalsConceded / totalGoals) * 3 : 1.5) * 0.1;

  await db.setKeyValue(`eloOverride:${teamName}`, {
    elo: newElo,
    attack: Math.max(0.3, Math.min(4.0, newAttack)),
    defense: Math.max(0.3, Math.min(4.0, newDefense)),
    updatedAt: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════
// PROCESS MATCH — Single entry point for post-match Elo updates
// ═══════════════════════════════════════════════════════════════

/**
 * Process a match result and update both teams' Elo ratings.
 * This is called from /api/match-result after recording the score.
 */
export async function processMatchEloUpdate(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  round: MatchRound,
  db: IDataLayer,
): Promise<{
  homeEloBefore: number;
  awayEloBefore: number;
  homeEloAfter: number;
  awayEloAfter: number;
  homeDelta: number;
  awayDelta: number;
  kFactor: number;
}> {
  const homeCurrent = await getCurrentElo(homeTeam, db);
  const awayCurrent = await getCurrentElo(awayTeam, db);

  const { newHomeElo, newAwayElo, homeDelta, awayDelta } = calculateEloUpdate(
    homeCurrent.elo,
    awayCurrent.elo,
    homeScore,
    awayScore,
    round,
  );

  // Persist both teams
  await persistEloUpdate(homeTeam, newHomeElo, homeScore, awayScore, db);
  await persistEloUpdate(awayTeam, newAwayElo, awayScore, homeScore, db);

  const kFactor = getKFactor(round);
  console.log(`[elo-update] ${homeTeam}: ${homeCurrent.elo} → ${newHomeElo} (${homeDelta >= 0 ? '+' : ''}${homeDelta}) K=${kFactor}`);
  console.log(`[elo-update] ${awayTeam}: ${awayCurrent.elo} → ${newAwayElo} (${awayDelta >= 0 ? '+' : ''}${awayDelta}) K=${kFactor}`);

  return {
    homeEloBefore: homeCurrent.elo,
    awayEloBefore: awayCurrent.elo,
    homeEloAfter: newHomeElo,
    awayEloAfter: newAwayElo,
    homeDelta,
    awayDelta,
    kFactor,
  };
}
