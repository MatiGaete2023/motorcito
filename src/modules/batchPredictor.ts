/**
 * Local batch predictor — generates a full schema-valid prediction from the
 * Elo features alone, without any external API. Used as the offline fallback
 * for /api/models/{id}/run and as the "market" baseline model in the pool.
 *
 * It simulates the whole tournament: group results → standings → knockout
 * cross-overs → champion, reusing the Bracket Engine to keep bracket logic in
 * one place.
 */
import type { MatchPrediction, ModelPrediction, Outcome } from '../domain/types.js';
import { loadTournament } from './tournamentLoader.js';
import { getElo } from './featureBuilder.js';
import { eloProbs } from './elo.js';
import { computeStandings, bestThirds, resolveBracket, type ResultsMap } from './bracketEngine.js';

function predictScore(homeCode: string, awayCode: string, allowDraw: boolean) {
  const hElo = getElo(homeCode).elo;
  const aElo = getElo(awayCode).elo;
  const probs = eloProbs(hElo, aElo, allowDraw);
  const result: Outcome =
    probs.home >= probs.away && (!allowDraw || probs.home >= probs.draw)
      ? 'home'
      : probs.away >= probs.home && (!allowDraw || probs.away >= probs.draw)
        ? 'away'
        : 'draw';
  const gap = Math.abs(hElo + 60 - aElo);
  let score: { home: number; away: number };
  if (result === 'home') score = { home: 2, away: gap < 150 ? 1 : 0 };
  else if (result === 'away') score = { home: gap < 150 ? 1 : 0, away: 2 };
  else score = { home: 1, away: 1 };
  return { probs, result, score };
}

export function generateBatchPrediction(modelName: string, modelId = 'local/elo-baseline'): ModelPrediction {
  const t = loadTournament();
  const sim: ResultsMap = {};

  // 1) Group stage.
  const groupPreds: MatchPrediction[] = [];
  for (const m of t.matches) {
    if (m.stage !== 'group_stage') continue;
    const { probs, result, score } = predictScore(m.home, m.away, true);
    sim[m.matchId] = { home: score.home, away: score.away };
    groupPreds.push({
      match_id: m.matchId,
      stage: 'group_stage',
      group: m.group,
      home_team: m.home,
      away_team: m.away,
      predicted_result: result,
      predicted_score: score,
      probs,
    });
  }

  // 2) Standings & qualifiers from the simulated group results.
  const standings = computeStandings(sim);
  const letters = Object.keys(standings).sort();
  const first_place = letters.map((g) => ({ team_code: standings[g][0].code, group: g }));
  const second_place = letters.map((g) => ({ team_code: standings[g][1].code, group: g }));
  const best_third_place = bestThirds(standings).map((s) => ({ team_code: s.code, group: s.group }));

  // 3) Knockout: resolve round by round, predicting each match as it becomes
  //    playable, then feeding the score back so winners propagate.
  const koPredById = new Map<string, MatchPrediction>();
  for (let pass = 0; pass < 8; pass++) {
    const rb = resolveBracket(sim);
    let progressed = false;
    for (const k of rb.knockout) {
      if (sim[k.matchId] || !k.home || !k.away) continue;
      const { probs, result, score } = predictScore(k.home, k.away, false);
      sim[k.matchId] = { home: score.home, away: score.away };
      koPredById.set(k.matchId, {
        match_id: k.matchId,
        stage: k.stage,
        group: null,
        home_team: k.home,
        away_team: k.away,
        predicted_result: result,
        predicted_score: score,
        probs,
      });
      progressed = true;
    }
    if (!progressed) break;
  }

  const finalRb = resolveBracket(sim);
  const get = (id: string) => koPredById.get(id)!;
  const byRound = (round: string) => finalRb.knockout.filter((k) => k.round === round).map((k) => get(k.matchId));

  const finalMatch = get('FINAL');
  const thirdMatch = get('THIRD');
  const championIsHome = finalMatch.predicted_result === 'home';
  const final_standings = {
    champion: championIsHome ? finalMatch.home_team : finalMatch.away_team,
    runner_up: championIsHome ? finalMatch.away_team : finalMatch.home_team,
    third_place: thirdMatch.predicted_result === 'home' ? thirdMatch.home_team : thirdMatch.away_team,
    fourth_place: thirdMatch.predicted_result === 'home' ? thirdMatch.away_team : thirdMatch.home_team,
  };

  return {
    model_name: modelName,
    model_id: modelId,
    timestamp: new Date().toISOString(),
    prompt_version: 'batch-1.0',
    temperature: 0,
    group_stage_matches: groupPreds,
    group_qualifiers: { first_place, second_place, best_third_place },
    knockout_stage: {
      round_of_32: byRound('R32'),
      round_of_16: byRound('R16'),
      quarter_finals: byRound('QF'),
      semi_finals: byRound('SF'),
      third_place_match: thirdMatch,
      final: finalMatch,
    },
    final_standings,
  };
}
