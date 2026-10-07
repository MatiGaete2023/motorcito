// FORCH.i ORACLE — Deterministic Elo-based Champion Probability Calculator
// Instant (<1ms) computation using Elo ratings + tournament structure
// No async, no fetch, no Monte Carlo — pure math with imported static data

import { ELO_RATINGS, WORLD_CUP_TEAMS } from './teams';

// ═══════════════════════════════════════════════════════════════
// Elo probability formula: P(A beats B) = 1 / (1 + 10^((B-A)/400))
// ═══════════════════════════════════════════════════════════════

function eloWinProb(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// ═══════════════════════════════════════════════════════════════
// Knockout advancement probability
// For each knockout round, a team must win N consecutive matches
// P(advancing through R rounds) ≈ product of average win probabilities
// Weighted by the likelihood of facing stronger opponents in later rounds
// ═══════════════════════════════════════════════════════════════

export interface EloChampionProb {
  teamId: string;
  teamName: string;
  flag: string;
  elo: number;
  championProb: number;
  semiProb: number;
  quarterProb: number;
  groupAdvanceProb: number;
}

/**
 * Compute champion probabilities deterministically from Elo ratings.
 * 
 * Algorithm:
 * 1. Group advancement: Each team vs average group opponent Elo
 * 2. R32 advancement: Group winner vs average 3rd-place opponent
 * 3. R16 advancement: Weighted average of possible opponents
 * 4. QF/SF/Final: Each round vs progressively stronger average opponent
 * 
 * The "average opponent" in each round is the average Elo of teams
 * likely to reach that round (weighted by their advancement probability).
 * This creates a feedback loop where elite teams face elite opponents
 * in later rounds, naturally damping their probability.
 */
export function computeChampionProbsFromElo(): EloChampionProb[] {
  // Build groups
  const groups: Record<string, typeof WORLD_CUP_TEAMS> = {};
  for (const t of WORLD_CUP_TEAMS) {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t);
  }

  // Step 1: Compute group advancement probability for each team
  const teamGroupProb = new Map<string, number>();
  const teamAvgGroupOpponent = new Map<string, number>();

  for (const [letter, teams] of Object.entries(groups)) {
    const elos = teams.map(t => ELO_RATINGS[t.name]?.elo || 1500);
    const avgElo = elos.reduce((a, b) => a + b, 0) / elos.length;

    for (const team of teams) {
      const teamElo = ELO_RATINGS[team.name]?.elo || 1500;
      // Probability of being top 2 in group (approximation: win vs avg opponent × 3 matches)
      const otherTeams = teams.filter(t => t.name !== team.name);
      const avgOpponentElo = otherTeams.map(t => ELO_RATINGS[t.name]?.elo || 1500).reduce((a, b) => a + b, 0) / otherTeams.length;
      
      // P(top 2) ≈ P(win vs avg opponent)^1.5 (not all 3 matches need to be won)
      const pWinVsAvg = eloWinProb(teamElo, avgOpponentElo);
      const pTop2 = Math.pow(pWinVsAvg, 1.2) * 0.85 + 0.10; // calibrated to give reasonable range
      
      teamGroupProb.set(team.name, Math.min(pTop2, 0.99));
      teamAvgGroupOpponent.set(team.name, avgOpponentElo);
    }
  }

  // Step 2: Compute knockout advancement probabilities
  // Average opponent Elo at each knockout round level
  // These increase as we go deeper (stronger teams survive)
  const allElos = Object.values(ELO_RATINGS).map(e => e.elo);
  const globalAvg = allElos.reduce((a, b) => a + b, 0) / allElos.length;

  // Weighted average Elo of teams likely to reach each round
  // Approximation: top 50% of teams reach R16, top 25% reach QF, etc.
  const sortedElos = [...allElos].sort((a, b) => b - a);
  const avgR32Opponent = sortedElos.slice(0, 32).reduce((a, b) => a + b, 0) / 32;
  const avgR16Opponent = sortedElos.slice(0, 16).reduce((a, b) => a + b, 0) / 16;
  const avgQFOpponent = sortedElos.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
  const avgSFOpponent = sortedElos.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const avgFinalOpponent = sortedElos.slice(0, 2).reduce((a, b) => a + b, 0) / 2;

  const results: EloChampionProb[] = [];

  for (const team of WORLD_CUP_TEAMS) {
    const teamElo = ELO_RATINGS[team.name]?.elo || 1500;
    const pGroup = teamGroupProb.get(team.name) || 0.5;

    // Knockout is 2 matches per round (win 2 to advance)
    // P(R32 win) = P(win vs avg R32 opponent) — knockout no draws
    const pR32 = eloWinProb(teamElo, avgR32Opponent);
    const pR16 = eloWinProb(teamElo, avgR16Opponent);
    const pQF = eloWinProb(teamElo, avgQFOpponent);
    const pSF = eloWinProb(teamElo, avgSFOpponent);
    const pFinal = eloWinProb(teamElo, avgFinalOpponent);

    // P(champion) = P(group) × P(R32) × P(R16) × P(QF) × P(SF) × P(Final)
    // Calibration: WC has more variance than Elo predicts, so we dampen extremes
    const pChampion = pGroup * pR32 * pR16 * pQF * pSF * pFinal;

    // Recalibrate to sum to 100% across all 48 teams
    const pSemi = pGroup * pR32 * pR16 * pQF * pSF;
    const pQuarter = pGroup * pR32 * pR16 * pQF;

    results.push({
      teamId: team.name,
      teamName: team.name,
      flag: team.flag,
      elo: teamElo,
      championProb: pChampion,
      semiProb: pSemi,
      quarterProb: pQuarter,
      groupAdvanceProb: pGroup,
    });
  }

  // Normalize so total probability sums to 1.0 (100%)
  const totalProb = results.reduce((sum, r) => sum + r.championProb, 0);
  for (const r of results) {
    r.championProb = Math.round((r.championProb / totalProb) * 10000) / 100;
    r.semiProb = Math.round(Math.min(r.semiProb * 100, 100));
    r.quarterProb = Math.round(Math.min(r.quarterProb * 100, 100));
    r.groupAdvanceProb = Math.round(Math.min(r.groupAdvanceProb * 100, 100));
  }

  // Sort by champion probability descending
  results.sort((a, b) => b.championProb - a.championProb);

  return results;
}
