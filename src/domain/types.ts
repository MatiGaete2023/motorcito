/**
 * Canonical domain types for the World Cup 2026 living prediction system.
 *
 * These types are the internal "contract" the whole app speaks. Input files
 * (worldcup.json, *_prediction.json, leaderboard.json) are normalised into
 * these shapes by the Tournament Loader and Team Resolver.
 */

export type Stage =
  | 'group_stage'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'third_place_match'
  | 'final';

export type MatchStatus = 'pending' | 'live' | 'finished' | 'corrected';

export type Outcome = 'home' | 'draw' | 'away';

/** A national team in the canonical catalogue. */
export interface Team {
  /** 3-letter FIFA code, the canonical primary key (e.g. "MEX"). */
  code: string;
  /** English display name as used in the fixture file (e.g. "Mexico"). */
  name: string;
  /** Spanish name as used in the legacy Elo dataset (e.g. "México"). */
  nameEs?: string;
  confederation: string;
  group: string; // A-L
  flag?: string;
}

/** A single match in the canonical fixture. */
export interface Match {
  /** Canonical id matching the prediction schema (GS-01, R32-73, FINAL...). */
  matchId: string;
  stage: Stage;
  /** Short round label for K-factor / display (group, R32, R16, QF, SF, F, TP). */
  round: string;
  group: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  /** FIFA code of home team, or a placeholder slot id (e.g. "1A") if undecided. */
  home: string;
  away: string;
  /** Official final score once finished; null while pending. */
  score: { home: number; away: number } | null;
  status: MatchStatus;
  source: string | null; // results provider that last set the score
}

export interface Standing {
  code: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Position within the group once it can be ranked (1..4). */
  rank: number;
}

/** 1X2 probabilities. draw is 0 for knockout matches. */
export interface Probs {
  home: number;
  draw: number;
  away: number;
}

/** A single model's prediction for one match (schema match_prediction). */
export interface MatchPrediction {
  match_id: string;
  stage?: string;
  group: string | null;
  home_team: string;
  away_team: string;
  predicted_result: Outcome;
  predicted_score: { home: number; away: number };
  probs: Probs;
}

export interface GroupQualifierEntry {
  team_code: string;
  group: string;
}

export interface ModelPrediction {
  model_name: string;
  model_id?: string;
  timestamp: string;
  prompt_version: string;
  temperature: number;
  group_stage_matches: MatchPrediction[];
  group_qualifiers: {
    first_place: GroupQualifierEntry[];
    second_place: GroupQualifierEntry[];
    best_third_place: GroupQualifierEntry[];
  };
  knockout_stage: {
    round_of_32: MatchPrediction[];
    round_of_16: MatchPrediction[];
    quarter_finals: MatchPrediction[];
    semi_finals: MatchPrediction[];
    third_place_match: MatchPrediction;
    final: MatchPrediction;
  };
  final_standings: {
    champion: string;
    runner_up: string;
    third_place: string;
    fourth_place: string;
  };
  usage?: unknown;
  cost_usd?: { rationale?: number; prediction?: number; total?: number };
}

/** Consolidated (ensemble) prediction for a single match. */
export interface EnsemblePrediction {
  match_id: string;
  home_team: string;
  away_team: string;
  probs: Probs;
  predicted_result: Outcome;
  /** Expected/most-likely score from weighted model scores. */
  predicted_score: { home: number; away: number };
  /** 0..1 confidence = top probability mass. */
  confidence: number;
  /** Number of models that contributed. */
  contributors: number;
  /** Dominant source label: "consensus" | model name | "gemini". */
  source: string;
  /** Dataset/version snapshot id used. */
  dataset_version: string;
}

export interface ModelScore {
  model_name: string;
  model_id?: string;
  total_evaluated: number;
  correct_outcomes: number;
  exact_scores: number;
  accuracy: number;
  brier_total: number;
  brier_avg: number | null;
  bracket_points: number;
  champion?: string;
  runner_up?: string;
  third_place?: string;
  fourth_place?: string;
  /** Per-stage hit rate. */
  stage_accuracy?: Record<string, { correct: number; total: number }>;
}

export interface LeaderboardEntry extends ModelScore {
  rank: number;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  summary: string;
  delta: unknown;
  /** Hash of the resulting state version. */
  versionHash: string;
}
