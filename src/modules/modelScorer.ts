/**
 * Model Scorer — evaluates every model against the official results.
 *
 * Metrics (criterio 12): outcome accuracy, exact-score rate, multiclass Brier
 * score, bracket points, and per-stage hit rate. The accuracy also feeds back
 * as ensemble weights (Level 3 recalibration).
 */
import type { LoadedModel } from './predictions.js';
import { loadAllPredictions } from './predictions.js';
import type { LeaderboardEntry, ModelScore, Outcome } from '../domain/types.js';
import { loadTournament } from './tournamentLoader.js';
import { getStoredResults } from '../data/store.js';
import { resolveBracket } from './bracketEngine.js';
import type { Weights } from './predictionAggregator.js';

function outcomeOf(home: number, away: number): Outcome {
  return home > away ? 'home' : home < away ? 'away' : 'draw';
}

/** Actual outcome per canonical matchId from stored results / fixture. */
function actualResults(): Map<string, { home: number; away: number; outcome: Outcome; stage: string }> {
  const t = loadTournament();
  const stored = getStoredResults();
  const map = new Map<string, { home: number; away: number; outcome: Outcome; stage: string }>();
  for (const m of t.matches) {
    const sc = stored[m.matchId] ? { home: stored[m.matchId].home, away: stored[m.matchId].away } : m.score;
    if (!sc) continue;
    map.set(m.matchId, { ...sc, outcome: outcomeOf(sc.home, sc.away), stage: m.stage });
  }
  return map;
}

function scoreOne(model: LoadedModel, actual: ReturnType<typeof actualResults>, qualifiers: { first: string[]; second: string[]; bestThirds: string[] }): ModelScore {
  const p = model.prediction;
  let total = 0;
  let correct = 0;
  let exact = 0;
  let brierTotal = 0;
  const stageAcc: Record<string, { correct: number; total: number }> = {};

  const evalMatch = (m: { match_id: string; home_team: string; away_team: string; predicted_result: Outcome; predicted_score: { home: number; away: number }; probs: { home: number; draw: number; away: number } }, stage: string) => {
    const a = actual.get(m.match_id);
    if (!a) return;
    total++;
    stageAcc[stage] ??= { correct: 0, total: 0 };
    stageAcc[stage].total++;
    if (m.predicted_result === a.outcome) {
      correct++;
      stageAcc[stage].correct++;
    }
    if (m.predicted_score.home === a.home && m.predicted_score.away === a.away) exact++;
    // Multiclass Brier over {home, draw, away}.
    const y = { home: a.outcome === 'home' ? 1 : 0, draw: a.outcome === 'draw' ? 1 : 0, away: a.outcome === 'away' ? 1 : 0 };
    brierTotal += (m.probs.home - y.home) ** 2 + (m.probs.draw - y.draw) ** 2 + (m.probs.away - y.away) ** 2;
  };

  for (const m of p.group_stage_matches ?? []) evalMatch(m, 'group_stage');
  const ks = p.knockout_stage;
  if (ks) {
    for (const m of ks.round_of_32 ?? []) evalMatch(m, 'round_of_32');
    for (const m of ks.round_of_16 ?? []) evalMatch(m, 'round_of_16');
    for (const m of ks.quarter_finals ?? []) evalMatch(m, 'quarter_finals');
    for (const m of ks.semi_finals ?? []) evalMatch(m, 'semi_finals');
    if (ks.third_place_match) evalMatch(ks.third_place_match, 'third_place_match');
    if (ks.final) evalMatch(ks.final, 'final');
  }

  // Bracket points: reward correct qualifiers once groups are decided.
  let bracketPoints = 0;
  if (qualifiers.first.length === 12) {
    const predFirst = new Set((p.group_qualifiers?.first_place ?? []).map((q) => q.team_code));
    const predSecond = new Set((p.group_qualifiers?.second_place ?? []).map((q) => q.team_code));
    const predThird = new Set((p.group_qualifiers?.best_third_place ?? []).map((q) => q.team_code));
    for (const c of qualifiers.first) if (predFirst.has(c)) bracketPoints += 3;
    for (const c of qualifiers.second) if (predSecond.has(c)) bracketPoints += 2;
    for (const c of qualifiers.bestThirds) if (predThird.has(c)) bracketPoints += 1;
  }

  return {
    model_name: p.model_name,
    model_id: p.model_id,
    total_evaluated: total,
    correct_outcomes: correct,
    exact_scores: exact,
    accuracy: total ? correct / total : 0,
    brier_total: brierTotal,
    brier_avg: total ? brierTotal / total : null,
    bracket_points: bracketPoints,
    champion: p.final_standings?.champion,
    runner_up: p.final_standings?.runner_up,
    third_place: p.final_standings?.third_place,
    fourth_place: p.final_standings?.fourth_place,
    stage_accuracy: stageAcc,
  };
}

export function scoreModels(): LeaderboardEntry[] {
  const actual = actualResults();
  const { qualifiers } = resolveBracket();
  const models = loadAllPredictions().filter((m) => m.valid);
  const scored = models.map((m) => scoreOne(m, actual, qualifiers));

  // Rank: more bracket points, then accuracy, then lower Brier.
  scored.sort((a, b) => {
    if (b.bracket_points !== a.bracket_points) return b.bracket_points - a.bracket_points;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return (a.brier_avg ?? 99) - (b.brier_avg ?? 99);
  });
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}

/**
 * Ensemble weights from observed performance. While no results exist, weights
 * are uniform. Once matches are scored, weight ∝ accuracy with a floor so no
 * model is fully silenced.
 */
export function performanceWeights(): Weights {
  const board = scoreModels();
  const anyEvaluated = board.some((m) => m.total_evaluated > 0);
  const weights: Weights = {};
  for (const m of board) {
    weights[m.model_name] = anyEvaluated ? 0.25 + m.accuracy : 1;
  }
  return weights;
}
