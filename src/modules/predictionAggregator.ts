/**
 * Prediction Aggregator — Level 2 of the predictive engine.
 *
 * Combines the individual model predictions (and any Gemini run, which is just
 * another model in the pool) into a per-match consensus using a weighted
 * average. Weights default to uniform but are tuned by observed performance
 * (the Model Scorer feeds accuracy-based weights here — Level 3 recalibration).
 *
 * Method choice (one of the "decisiones abiertas"): weighted soft-voting on the
 * 1X2 probability vectors. Simple, robust, and easy to audit.
 */
import type { EnsemblePrediction, ModelPrediction, Outcome, Probs } from '../domain/types.js';
import { marketPrediction } from './featureBuilder.js';

export type Weights = Record<string, number>;

function argmax(p: Probs): Outcome {
  if (p.home >= p.draw && p.home >= p.away) return 'home';
  if (p.away >= p.draw && p.away >= p.home) return 'away';
  return 'draw';
}

function normalize(p: Probs): Probs {
  const s = p.home + p.draw + p.away || 1;
  return { home: p.home / s, draw: p.draw / s, away: p.away / s };
}

export function weightFor(weights: Weights, model: string): number {
  const w = weights[model];
  return w == null || !Number.isFinite(w) || w <= 0 ? 1 : w;
}

/**
 * Consensus over the 72 group-stage matches. All models share the same
 * match_id/home/away here, so probabilities align cleanly.
 */
export function ensembleGroupStage(
  models: ModelPrediction[],
  weights: Weights,
  datasetVersion: string,
): EnsemblePrediction[] {
  const byMatch = new Map<
    string,
    { home_team: string; away_team: string; probs: Probs; score: { h: number; a: number }; wsum: number; n: number; top: { model: string; w: number } }
  >();

  for (const model of models) {
    const w = weightFor(weights, model.model_name);
    for (const m of model.group_stage_matches) {
      const p = normalize(m.probs);
      const cur = byMatch.get(m.match_id) ?? {
        home_team: m.home_team,
        away_team: m.away_team,
        probs: { home: 0, draw: 0, away: 0 },
        score: { h: 0, a: 0 },
        wsum: 0,
        n: 0,
        top: { model: model.model_name, w: 0 },
      };
      cur.probs.home += p.home * w;
      cur.probs.draw += p.draw * w;
      cur.probs.away += p.away * w;
      cur.score.h += m.predicted_score.home * w;
      cur.score.a += m.predicted_score.away * w;
      cur.wsum += w;
      cur.n += 1;
      if (w > cur.top.w) cur.top = { model: model.model_name, w };
      byMatch.set(m.match_id, cur);
    }
  }

  const out: EnsemblePrediction[] = [];
  for (const [match_id, c] of byMatch) {
    const probs = normalize({
      home: c.probs.home / c.wsum,
      draw: c.probs.draw / c.wsum,
      away: c.probs.away / c.wsum,
    });
    const predicted_result = argmax(probs);
    out.push({
      match_id,
      home_team: c.home_team,
      away_team: c.away_team,
      probs,
      predicted_result,
      predicted_score: {
        home: Math.round(c.score.h / c.wsum),
        away: Math.round(c.score.a / c.wsum),
      },
      confidence: Math.max(probs.home, probs.draw, probs.away),
      contributors: c.n,
      source: 'consensus',
      dataset_version: datasetVersion,
    });
  }
  out.sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }));
  return out;
}

export interface ChampionConsensus {
  champion: { code: string; prob: number }[];
  runner_up: { code: string; prob: number }[];
  top_final_four: { code: string; prob: number }[];
}

/** Weighted vote tally over the models' final_standings. */
export function championConsensus(models: ModelPrediction[], weights: Weights): ChampionConsensus {
  const champ = new Map<string, number>();
  const runner = new Map<string, number>();
  const four = new Map<string, number>();
  let total = 0;
  for (const m of models) {
    const w = weightFor(weights, m.model_name);
    total += w;
    const fs = m.final_standings;
    champ.set(fs.champion, (champ.get(fs.champion) ?? 0) + w);
    runner.set(fs.runner_up, (runner.get(fs.runner_up) ?? 0) + w);
    for (const c of [fs.champion, fs.runner_up, fs.third_place, fs.fourth_place]) {
      four.set(c, (four.get(c) ?? 0) + w);
    }
  }
  const rank = (map: Map<string, number>, denom: number) =>
    [...map.entries()]
      .map(([code, v]) => ({ code, prob: v / denom }))
      .sort((a, b) => b.prob - a.prob);
  return {
    champion: rank(champ, total),
    runner_up: rank(runner, total),
    top_final_four: rank(four, total * 4),
  };
}

/**
 * Market vs consensus: returns the Elo-baseline ("mercado") prediction for a
 * group-stage match so the UI can distinguish the three signals the spec
 * requires (market / consensus / real).
 */
export function marketForMatch(homeCode: string, awayCode: string, allowDraw = true): Probs {
  return marketPrediction(homeCode, awayCode, allowDraw);
}
