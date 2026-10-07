/**
 * Tournament Loader — builds the internal model of the tournament.
 *
 * Sources:
 *  - worldcup.json: 104-match fixture with dates, venues, real scores, and the
 *    official knockout slot template (e.g. "2A", "1E", "3A/B/C/D/F", "W74").
 *  - a reference prediction file: canonical group-stage match_ids + home/away
 *    orientation (GS-01..GS-72), which all benchmark models share.
 *
 * Output: a list of canonical Match objects keyed by matchId.
 */
import fs from 'node:fs';
import { files, PREDICTIONS_DIR } from '../data/paths.js';
import path from 'node:path';
import { resolveTeam, allTeams } from './teamResolver.js';
import type { Match, Stage, Team } from '../domain/types.js';

interface RawFixtureMatch {
  round: string;
  num?: number;
  date?: string;
  time?: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
  score?: { ft: [number, number]; ht?: [number, number] };
}

interface RawGroup {
  name: string;
  teams: string[];
}

export interface KnockoutTemplateMatch {
  matchId: string;
  stage: Stage;
  round: string;
  num: number;
  /** Slot label as given by the fixture, e.g. "2A", "3A/B/C/D/F", "W74", "L101". */
  slot1: string;
  slot2: string;
  date: string | null;
  time: string | null;
  venue: string | null;
}

export interface TournamentModel {
  name: string;
  teams: Team[];
  groups: { name: string; letter: string; teams: string[] }[];
  /** Canonical matches (group stage fully resolved; knockout with slots). */
  matches: Match[];
  /** Knockout template (slot feeders) used by the Bracket Engine. */
  knockoutTemplate: KnockoutTemplateMatch[];
}

const KNOCKOUT_ROUNDS: Record<string, { stage: Stage; round: string }> = {
  'Round of 32': { stage: 'round_of_32', round: 'R32' },
  'Round of 16': { stage: 'round_of_16', round: 'R16' },
  'Quarter-final': { stage: 'quarter_finals', round: 'QF' },
  'Semi-final': { stage: 'semi_finals', round: 'SF' },
  'Match for third place': { stage: 'third_place_match', round: 'TP' },
  Final: { stage: 'final', round: 'F' },
};

function knockoutMatchId(num: number): string {
  if (num >= 73 && num <= 88) return `R32-${num}`;
  if (num >= 89 && num <= 96) return `R16-${num}`;
  if (num >= 97 && num <= 100) return `QF-${num}`;
  if (num >= 101 && num <= 102) return `SF-${num}`;
  if (num === 103) return 'THIRD';
  if (num === 104) return 'FINAL';
  return `KO-${num}`;
}

let cached: TournamentModel | null = null;

export function loadTournament(force = false): TournamentModel {
  if (cached && !force) return cached;

  const fixture = JSON.parse(fs.readFileSync(files.worldcup, 'utf-8')) as {
    name: string;
    matches: RawFixtureMatch[];
  };
  const groupsRaw = JSON.parse(fs.readFileSync(files.groups, 'utf-8')) as {
    groups: RawGroup[];
  };

  // Canonical group-stage fixture (ids + orientation) from a reference model.
  const refFile = path.join(PREDICTIONS_DIR, 'Claude-Fable-5_prediction.json');
  const ref = JSON.parse(fs.readFileSync(refFile, 'utf-8'));
  const refGroup: {
    match_id: string;
    group: string;
    home_team: string;
    away_team: string;
  }[] = ref.group_stage_matches;

  // Index fixture group matches by group + unordered code pair to attach
  // dates/venues/scores onto the canonical (prediction-oriented) matches.
  const fixtureGroup = new Map<string, RawFixtureMatch>();
  for (const m of fixture.matches) {
    if (!m.group) continue;
    const g = m.group.replace('Group ', '');
    const c1 = resolveTeam(m.team1)?.code;
    const c2 = resolveTeam(m.team2)?.code;
    if (!c1 || !c2) continue;
    fixtureGroup.set(`${g}|${[c1, c2].sort().join('-')}`, m);
  }

  const matches: Match[] = [];

  for (const rm of refGroup) {
    const key = `${rm.group}|${[rm.home_team, rm.away_team].sort().join('-')}`;
    const fx = fixtureGroup.get(key);
    let score: { home: number; away: number } | null = null;
    if (fx?.score?.ft) {
      // Reorient fixture score to the canonical home/away orientation.
      const fxHome = resolveTeam(fx.team1)?.code;
      const [a, b] = fx.score.ft;
      score =
        fxHome === rm.home_team ? { home: a, away: b } : { home: b, away: a };
    }
    matches.push({
      matchId: rm.match_id,
      stage: 'group_stage',
      round: 'group',
      group: rm.group,
      date: fx?.date ?? null,
      time: fx?.time ?? null,
      venue: fx?.ground ?? null,
      home: rm.home_team,
      away: rm.away_team,
      score,
      status: score ? 'finished' : 'pending',
      source: score ? 'fixture' : null,
    });
  }

  // Knockout template from the fixture slot definitions.
  const knockoutTemplate: KnockoutTemplateMatch[] = [];
  for (const m of fixture.matches) {
    const meta = KNOCKOUT_ROUNDS[m.round];
    if (!meta || m.num == null) continue;
    const matchId = knockoutMatchId(m.num);
    knockoutTemplate.push({
      matchId,
      stage: meta.stage,
      round: meta.round,
      num: m.num,
      slot1: m.team1,
      slot2: m.team2,
      date: m.date ?? null,
      time: m.time ?? null,
      venue: m.ground ?? null,
    });
    matches.push({
      matchId,
      stage: meta.stage,
      round: meta.round,
      group: null,
      date: m.date ?? null,
      time: m.time ?? null,
      venue: m.ground ?? null,
      home: m.team1, // slot placeholder until resolved by the Bracket Engine
      away: m.team2,
      score: m.score?.ft ? { home: m.score.ft[0], away: m.score.ft[1] } : null,
      status: m.score?.ft ? 'finished' : 'pending',
      source: m.score?.ft ? 'fixture' : null,
    });
  }

  knockoutTemplate.sort((a, b) => a.num - b.num);

  cached = {
    name: fixture.name,
    teams: allTeams(),
    groups: groupsRaw.groups.map((g) => ({
      name: g.name,
      letter: g.name.replace('Group ', ''),
      teams: g.teams.map((t) => resolveTeam(t)?.code ?? t),
    })),
    matches,
    knockoutTemplate,
  };
  return cached;
}

export function getMatch(matchId: string): Match | undefined {
  return loadTournament().matches.find((m) => m.matchId === matchId);
}
