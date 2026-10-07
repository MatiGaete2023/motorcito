/**
 * Results Sync — pulls official results, detects state changes, and cascades
 * the recalculation (standings → bracket → model scores) via a new version.
 *
 * Idempotent (criterio 14): re-running with no new results produces no changes
 * and no new version/audit entries.
 */
import { getActiveProvider, type ResultsProvider } from './resultsProvider.js';
import { getStoredResults, upsertResult, appendVersion, appendAudit, type StoredResult } from '../data/store.js';
import { loadTournament } from './tournamentLoader.js';
import { resolveBracket } from './bracketEngine.js';
import { processMatchEloUpdate } from './eloSync.js';

export interface SyncChange {
  matchId: string;
  kind: 'new' | 'corrected';
  before: { home: number; away: number } | null;
  after: { home: number; away: number };
}

export interface SyncReport {
  provider: string;
  fetched: number;
  changes: SyncChange[];
  bracketChampion: string | null;
  versionHash: string | null;
  qualifiersChanged: boolean;
}

export async function syncResults(
  actor = 'system',
  provider: ResultsProvider = getActiveProvider(),
): Promise<SyncReport> {
  const before = getStoredResults();
  const beforeBracket = resolveBracket();
  const incoming = await provider.fetchResults();

  const changes: SyncChange[] = [];
  for (const r of incoming) {
    const prev = before[r.matchId];
    const kind: 'new' | 'corrected' = prev ? 'corrected' : 'new';
    const stored: StoredResult = {
      matchId: r.matchId,
      home: r.home,
      away: r.away,
      status: r.status,
      source: provider.name,
      updatedAt: new Date().toISOString(),
    };
    const changed = upsertResult(stored);
    if (changed) {
      changes.push({
        matchId: r.matchId,
        kind,
        before: prev ? { home: prev.home, away: prev.away } : null,
        after: { home: r.home, away: r.away },
      });
      // Feed the dynamic Elo engine so ratings react to real results.
      const m = loadTournament().matches.find((x) => x.matchId === r.matchId);
      if (m) await processMatchEloUpdate(m.home, m.away, r.home, r.away, m.round);
    }
  }

  if (changes.length === 0) {
    return {
      provider: provider.name,
      fetched: incoming.length,
      changes: [],
      bracketChampion: beforeBracket.champion,
      versionHash: null,
      qualifiersChanged: false,
    };
  }

  // Cascade: recompute the full bracket from the new results.
  const afterBracket = resolveBracket();
  const qualifiersChanged =
    JSON.stringify(beforeBracket.qualifiers) !== JSON.stringify(afterBracket.qualifiers);

  const state = {
    results: getStoredResults(),
    standings: afterBracket.standings,
    qualifiers: afterBracket.qualifiers,
    knockout: afterBracket.knockout,
  };
  const version = appendVersion(`results-sync: ${changes.length} change(s)`, state);

  appendAudit({
    actor,
    action: 'results.sync',
    summary: `${changes.length} match(es) updated from ${provider.name}; qualifiers ${qualifiersChanged ? 'CHANGED' : 'unchanged'}`,
    delta: { changes, qualifiersChanged },
    versionHash: version.versionHash,
  });

  return {
    provider: provider.name,
    fetched: incoming.length,
    changes,
    bracketChampion: afterBracket.champion,
    versionHash: version.versionHash,
    qualifiersChanged,
  };
}
