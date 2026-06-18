/**
 * Results providers — the "fuente de verdad" for what happened on the pitch.
 *
 * The exact external API is an open decision for the next developer, so this is
 * a pluggable interface. Two implementations ship:
 *  - LocalFixtureProvider: reads real scores embedded in worldcup.json. Zero
 *    config, used by default so the system is runnable out of the box.
 *  - ExternalHttpProvider: GETs a JSON results feed from RESULTS_API_URL.
 */
import { loadTournament } from './tournamentLoader.js';
import { resolveTeam } from './teamResolver.js';

export interface RawResult {
  matchId: string;
  home: number;
  away: number;
  status: 'finished' | 'corrected';
}

export interface ResultsProvider {
  readonly name: string;
  fetchResults(): Promise<RawResult[]>;
}

export class LocalFixtureProvider implements ResultsProvider {
  readonly name = 'local-fixture';
  async fetchResults(): Promise<RawResult[]> {
    return loadTournament()
      .matches.filter((m) => m.score && m.status === 'finished')
      .map((m) => ({ matchId: m.matchId, home: m.score!.home, away: m.score!.away, status: 'finished' as const }));
  }
}

/**
 * Generic HTTP provider. Expects an array of objects with either a canonical
 * `match_id` or `home_team`/`away_team` identifiers plus `home`/`away` goals.
 * Adjust the mapping to match the chosen real API.
 */
export class ExternalHttpProvider implements ResultsProvider {
  readonly name = 'external-http';
  constructor(private url: string, private apiKey?: string) {}

  async fetchResults(): Promise<RawResult[]> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) headers['authorization'] = `Bearer ${this.apiKey}`;
    const res = await fetch(this.url, { headers });
    if (!res.ok) throw new Error(`results API ${res.status} ${res.statusText}`);
    const data = (await res.json()) as unknown[];
    const t = loadTournament();
    const out: RawResult[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const matchId = (row.match_id as string) || mapByTeams(row, t.matches);
      if (!matchId) continue;
      const home = Number((row.home as number) ?? (row.home_score as number));
      const away = Number((row.away as number) ?? (row.away_score as number));
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      const status = (row.status as string) === 'corrected' ? 'corrected' : 'finished';
      out.push({ matchId, home, away, status });
    }
    return out;
  }
}

function mapByTeams(row: Record<string, unknown>, matches: { matchId: string; group: string | null; home: string; away: string }[]): string | null {
  const h = resolveTeam(String(row.home_team ?? ''))?.code;
  const a = resolveTeam(String(row.away_team ?? ''))?.code;
  if (!h || !a) return null;
  const found = matches.find(
    (m) => (m.home === h && m.away === a) || (m.home === a && m.away === h),
  );
  return found?.matchId ?? null;
}

export function getActiveProvider(): ResultsProvider {
  const url = process.env.RESULTS_API_URL;
  if (url) return new ExternalHttpProvider(url, process.env.RESULTS_API_KEY);
  return new LocalFixtureProvider();
}
