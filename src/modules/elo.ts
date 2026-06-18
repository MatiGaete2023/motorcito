/**
 * Elo rating engine — ported from the legacy elo-update.ts into a pure,
 * reusable module (criterio: "Debe convertirse en módulo reusable").
 *
 * No storage dependency: callers pass in current ratings and persist the
 * returned values however they like. Keyed by FIFA code.
 */

export type MatchRound = 'group' | 'R32' | 'R16' | 'QF' | 'SF' | 'F' | 'TP';

/** K-factor escalates by stage — higher stakes react faster. */
export const K_FACTORS: Record<MatchRound, number> = {
  group: 40,
  R32: 60,
  R16: 60,
  QF: 70,
  SF: 70,
  F: 80,
  TP: 40,
};

export function getKFactor(round: MatchRound): number {
  return K_FACTORS[round] ?? 40;
}

/** Expected score (win probability) for A vs B from Elo difference. */
export function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

export interface EloUpdate {
  newHomeElo: number;
  newAwayElo: number;
  homeDelta: number;
  awayDelta: number;
}

export function calculateEloUpdate(
  homeElo: number,
  awayElo: number,
  homeScore: number,
  awayScore: number,
  round: MatchRound = 'group',
): EloUpdate {
  const K = getKFactor(round);
  const homeActual = homeScore > awayScore ? 1 : homeScore < awayScore ? 0 : 0.5;
  const awayActual = 1 - homeActual;
  const homeExpected = expectedScore(homeElo, awayElo);
  const awayExpected = expectedScore(awayElo, homeElo);

  const goalDiff = Math.abs(homeScore - awayScore);
  const multiplier = goalDiff <= 1 ? 1 : Math.min(1.5, 1 + (goalDiff - 1) * 0.1);

  const homeDelta = Math.round(K * multiplier * (homeActual - homeExpected));
  const awayDelta = Math.round(K * multiplier * (awayActual - awayExpected));

  return {
    newHomeElo: homeElo + homeDelta,
    newAwayElo: awayElo + awayDelta,
    homeDelta,
    awayDelta,
  };
}

/**
 * Derive 1X2 probabilities from two Elo ratings. Draw probability grows when
 * the teams are evenly matched. Used for the "market" baseline prediction.
 */
export function eloProbs(
  homeElo: number,
  awayElo: number,
  allowDraw = true,
): { home: number; draw: number; away: number } {
  const pHomeNoDraw = expectedScore(homeElo + 60 /* home advantage */, awayElo);
  if (!allowDraw) {
    return { home: pHomeNoDraw, draw: 0, away: 1 - pHomeNoDraw };
  }
  // Draw share peaks (~0.30) when teams are equal, shrinks with Elo gap.
  const gap = Math.abs(homeElo + 60 - awayElo);
  const draw = 0.3 * Math.exp(-gap / 400);
  const remaining = 1 - draw;
  const home = pHomeNoDraw * remaining;
  const away = remaining - home;
  return { home, draw, away };
}
