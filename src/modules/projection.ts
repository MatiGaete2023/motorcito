/**
 * Bracket projection — a non-persisted "what-if" that fills every unplayed
 * match with the Elo baseline so the bracket fully resolves. Official results
 * always take precedence; only missing matches are projected. This powers the
 * dashboard's projected standings/bracket ("clasificación proyectada").
 */
import { loadTournament } from './tournamentLoader.js';
import { getStoredResults } from '../data/store.js';
import { getElo } from './featureBuilder.js';
import { eloProbs } from './elo.js';
import { computeStandings, bestThirds, resolveBracket, type ResultsMap, type BracketResult } from './bracketEngine.js';

function projectedScore(home: string, away: string, allowDraw: boolean) {
  const probs = eloProbs(getElo(home).elo, getElo(away).elo, allowDraw);
  const gap = Math.abs(getElo(home).elo + 60 - getElo(away).elo);
  if (probs.home >= probs.away && (!allowDraw || probs.home >= probs.draw)) return { home: 2, away: gap < 150 ? 1 : 0 };
  if (probs.away >= probs.home && (!allowDraw || probs.away >= probs.draw)) return { home: gap < 150 ? 1 : 0, away: 2 };
  return { home: 1, away: 1 };
}

export interface ProjectedBracket extends BracketResult {
  projected_matches: string[]; // matchIds filled by the model
  official_matches: string[]; // matchIds backed by real results
}

export function projectBracket(): ProjectedBracket {
  const t = loadTournament();
  const official = getStoredResults();
  const merged: ResultsMap = {};
  const projectedIds: string[] = [];
  const officialIds: string[] = [];

  // Group matches: keep official, project the rest.
  for (const m of t.matches) {
    if (m.stage !== 'group_stage') continue;
    if (official[m.matchId]) {
      merged[m.matchId] = official[m.matchId];
      officialIds.push(m.matchId);
    } else if (m.score) {
      merged[m.matchId] = m.score;
      officialIds.push(m.matchId);
    } else {
      merged[m.matchId] = projectedScore(m.home, m.away, true);
      projectedIds.push(m.matchId);
    }
  }

  // Knockout: iterate so projected winners propagate forward.
  for (let pass = 0; pass < 8; pass++) {
    const rb = resolveBracket(merged);
    let progressed = false;
    for (const k of rb.knockout) {
      if (merged[k.matchId] || !k.home || !k.away) continue;
      if (official[k.matchId]) {
        merged[k.matchId] = official[k.matchId];
        officialIds.push(k.matchId);
      } else {
        merged[k.matchId] = projectedScore(k.home, k.away, false);
        projectedIds.push(k.matchId);
      }
      progressed = true;
    }
    if (!progressed) break;
  }

  const base = resolveBracket(merged);
  return { ...base, projected_matches: projectedIds, official_matches: officialIds };
}

export { computeStandings, bestThirds };
