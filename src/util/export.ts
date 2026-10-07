/**
 * Export helpers — full tournament state as JSON or flat CSV (criterio 7).
 */
import { loadTournament } from '../modules/tournamentLoader.js';
import { resolveBracket } from '../modules/bracketEngine.js';
import { scoreModels } from '../modules/modelScorer.js';
import { getStoredResults, currentVersionHash } from '../data/store.js';

export function buildStateExport() {
  const t = loadTournament();
  const results = getStoredResults();
  const bracket = resolveBracket();
  return {
    version: currentVersionHash(),
    exported_at: new Date().toISOString(),
    tournament: t.name,
    teams: t.teams,
    groups: t.groups,
    standings: bracket.standings,
    qualifiers: bracket.qualifiers,
    matches: t.matches.map((m) => ({
      ...m,
      official_score: results[m.matchId] ?? null,
    })),
    knockout: bracket.knockout,
    champion: bracket.champion,
    leaderboard: scoreModels(),
  };
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function matchesToCsv(): string {
  const t = loadTournament();
  const results = getStoredResults();
  const header = ['match_id', 'stage', 'round', 'group', 'date', 'venue', 'home', 'away', 'home_score', 'away_score', 'status', 'source'];
  const rows = [header.join(',')];
  for (const m of t.matches) {
    const sc = results[m.matchId] ?? m.score;
    rows.push(
      [m.matchId, m.stage, m.round, m.group ?? '', m.date ?? '', m.venue ?? '', m.home, m.away, sc?.home ?? '', sc?.away ?? '', results[m.matchId] ? 'official' : m.status, m.source ?? '']
        .map(csvCell)
        .join(','),
    );
  }
  return rows.join('\n');
}

export function leaderboardToCsv(): string {
  const board = scoreModels();
  const header = ['rank', 'model_name', 'total_evaluated', 'correct_outcomes', 'exact_scores', 'accuracy', 'brier_avg', 'bracket_points', 'champion'];
  const rows = [header.join(',')];
  for (const m of board) {
    rows.push(
      [m.rank, m.model_name, m.total_evaluated, m.correct_outcomes, m.exact_scores, m.accuracy.toFixed(4), m.brier_avg?.toFixed(4) ?? '', m.bracket_points, m.champion ?? '']
        .map(csvCell)
        .join(','),
    );
  }
  return rows.join('\n');
}
