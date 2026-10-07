/**
 * worldcup-bench-types.ts
 * TypeScript types matching the WorldCupBench prediction schema v2.1.
 */

export interface PredictionMatch {
  match_id: string;
  stage: string;
  group: string | null;
  home_team: string;
  away_team: string;
  predicted_result: 'home' | 'draw' | 'away';
  predicted_score: { home: number; away: number };
  probs: { home: number; draw: number; away: number };
}

export interface GroupQualifierEntry {
  team_code: string;
  group: string;
}

export interface GroupQualifiers {
  first_place: GroupQualifierEntry[];
  second_place: GroupQualifierEntry[];
  best_third_place: GroupQualifierEntry[];
}

export interface KnockoutStage {
  round_of_32: PredictionMatch[];
  round_of_16: PredictionMatch[];
  quarter_finals: PredictionMatch[];
  semi_finals: PredictionMatch[];
  third_place_match: PredictionMatch;
  final: PredictionMatch;
}

export interface FinalStandings {
  champion: string;
  runner_up: string;
  third_place: string;
  fourth_place: string;
}

export interface UsageInfo {
  rationale: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  prediction: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  total: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface CostInfo {
  rationale: number;
  prediction: number;
  total: number;
}

export interface ModelPrediction {
  model_name: string;
  model_id: string;
  timestamp: string;
  prompt_version: string;
  temperature: number;
  group_stage_matches: PredictionMatch[];
  group_qualifiers: GroupQualifiers;
  knockout_stage: KnockoutStage;
  final_standings: FinalStandings;
  usage?: UsageInfo;
  cost_usd?: CostInfo;
}
