/**
 * Bracket Engine — resolves group classification and knockout cross-overs from
 * actual results, and re-arms the whole bracket whenever a qualifier changes.
 *
 * Inputs: the canonical fixture (group matches + knockout slot template) and
 * the official results (stored results override fixture scores).
 *
 * Output: group standings (with tie-breakers) and a fully-resolved bracket
 * where every "1A" / "3A/B/C/D/F" / "W74" slot points to a concrete team.
 */
import type { Match, Standing } from '../domain/types.js';
import { loadTournament, type KnockoutTemplateMatch } from './tournamentLoader.js';
import { getStoredResults } from '../data/store.js';
import { getElo } from './featureBuilder.js';

export interface ResolvedKnockout {
  matchId: string;
  round: string;
  stage: string;
  home: string | null; // FIFA code once resolved, else null
  away: string | null;
  slot1: string;
  slot2: string;
  score: { home: number; away: number } | null;
  winner: string | null;
  loser: string | null;
  status: 'pending' | 'finished';
}

export interface BracketResult {
  standings: Record<string, Standing[]>; // keyed by group letter
  qualifiers: { first: string[]; second: string[]; bestThirds: string[] };
  knockout: ResolvedKnockout[];
  /** Resolved champion once the Final has a result. */
  champion: string | null;
}

/** Minimal results shape the engine needs (StoredResult is a superset). */
export type ResultsMap = Record<string, { home: number; away: number; status?: string }>;

/** Effective score for a match: stored official result wins over fixture. */
function effectiveScore(m: Match, results: ResultsMap): { home: number; away: number } | null {
  const r = results[m.matchId];
  if (r) return { home: r.home, away: r.away };
  return m.score;
}

// ───────────────────────── Group standings ─────────────────────────

function emptyStanding(code: string, group: string): Standing {
  return {
    code,
    group,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    rank: 0,
  };
}

export function computeStandings(results: ResultsMap = getStoredResults()): Record<string, Standing[]> {
  const t = loadTournament();
  const byGroup: Record<string, Map<string, Standing>> = {};

  for (const g of t.groups) {
    byGroup[g.letter] = new Map(g.teams.map((c) => [c, emptyStanding(c, g.letter)]));
  }

  // Head-to-head accumulator: group -> "A|B" -> points/gd per team.
  for (const m of t.matches) {
    if (m.stage !== 'group_stage' || !m.group) continue;
    const score = effectiveScore(m, results);
    if (!score) continue;
    const g = byGroup[m.group];
    if (!g) continue;
    const home = g.get(m.home);
    const away = g.get(m.away);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;
    if (score.home > score.away) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else if (score.home < score.away) {
      away.won++;
      home.lost++;
      away.points += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  const out: Record<string, Standing[]> = {};
  for (const [letter, map] of Object.entries(byGroup)) {
    const list = [...map.values()];
    for (const s of list) s.goalDifference = s.goalsFor - s.goalsAgainst;
    list.sort(compareStandings(letter, results));
    list.forEach((s, i) => (s.rank = i + 1));
    out[letter] = list;
  }
  return out;
}

/** FIFA tie-breakers: points → GD → GF → head-to-head points → Elo (stable). */
function compareStandings(group: string, results: ResultsMap) {
  const t = loadTournament();
  const h2h = (a: string, b: string): number => {
    // Points between the two teams across their group meetings.
    let pa = 0;
    let pb = 0;
    for (const m of t.matches) {
      if (m.stage !== 'group_stage' || m.group !== group) continue;
      const pair = new Set([m.home, m.away]);
      if (!pair.has(a) || !pair.has(b)) continue;
      const sc = results[m.matchId] ? { home: results[m.matchId].home, away: results[m.matchId].away } : m.score;
      if (!sc) continue;
      const aHome = m.home === a;
      const aGoals = aHome ? sc.home : sc.away;
      const bGoals = aHome ? sc.away : sc.home;
      if (aGoals > bGoals) pa += 3;
      else if (aGoals < bGoals) pb += 3;
      else {
        pa += 1;
        pb += 1;
      }
    }
    return pb - pa;
  };
  return (x: Standing, y: Standing): number => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.goalDifference !== x.goalDifference) return y.goalDifference - x.goalDifference;
    if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
    const h = h2h(x.code, y.code);
    if (h !== 0) return h;
    return getElo(y.code).elo - getElo(x.code).elo;
  };
}

/** Rank the 12 third-placed teams and take the best 8 (FIFA 2026 format). */
export function bestThirds(standings: Record<string, Standing[]>): Standing[] {
  const thirds = Object.values(standings)
    .map((g) => g[2])
    .filter(Boolean);
  thirds.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.goalDifference !== x.goalDifference) return y.goalDifference - x.goalDifference;
    if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
    return getElo(y.code).elo - getElo(x.code).elo;
  });
  return thirds.slice(0, 8);
}

// ───────────────────────── Knockout resolution ─────────────────────────

function winnerOf(k: ResolvedKnockout): string | null {
  return k.winner;
}

/**
 * Assign the 8 qualifying thirds to the 8 "3X/Y/Z" slots, honouring each
 * slot's allowed groups (bipartite matching with backtracking). Deterministic.
 */
function assignThirds(
  thirdSlots: { matchId: string; side: 'home' | 'away'; allowed: string[] }[],
  thirds: Standing[],
): Map<string, string> {
  const assignment = new Map<string, string>(); // "matchId:side" -> teamCode
  const used = new Set<string>();
  // Order slots by fewest allowed options first to make matching succeed.
  const slots = [...thirdSlots].sort((a, b) => a.allowed.length - b.allowed.length);

  const solve = (i: number): boolean => {
    if (i >= slots.length) return true;
    const slot = slots[i];
    for (const third of thirds) {
      if (used.has(third.code)) continue;
      if (!slot.allowed.includes(third.group)) continue;
      used.add(third.code);
      assignment.set(`${slot.matchId}:${slot.side}`, third.code);
      if (solve(i + 1)) return true;
      used.delete(third.code);
      assignment.delete(`${slot.matchId}:${slot.side}`);
    }
    return false;
  };
  solve(0);
  return assignment;
}

function parseSlot(slot: string): { type: 'group'; pos: number; group: string } | { type: 'third'; allowed: string[] } | { type: 'winner' | 'loser'; num: number } | null {
  const mGroup = /^([12])([A-L])$/.exec(slot);
  if (mGroup) return { type: 'group', pos: Number(mGroup[1]), group: mGroup[2] };
  const mThird = /^3([A-L/]+)$/.exec(slot);
  if (mThird) return { type: 'third', allowed: mThird[1].split('/') };
  const mW = /^W(\d+)$/.exec(slot);
  if (mW) return { type: 'winner', num: Number(mW[1]) };
  const mL = /^L(\d+)$/.exec(slot);
  if (mL) return { type: 'loser', num: Number(mL[1]) };
  return null;
}

export function resolveBracket(results: ResultsMap = getStoredResults()): BracketResult {
  const t = loadTournament();
  const standings = computeStandings(results);
  const thirds = bestThirds(standings);

  const qualifiers = {
    first: Object.values(standings).map((g) => g[0].code),
    second: Object.values(standings).map((g) => g[1].code),
    bestThirds: thirds.map((s) => s.code),
  };

  const template = t.knockoutTemplate;
  const byNum = new Map<number, KnockoutTemplateMatch>();
  for (const k of template) byNum.set(k.num, k);

  // Collect third slots first to run the matching once.
  const thirdSlots: { matchId: string; side: 'home' | 'away'; allowed: string[] }[] = [];
  for (const k of template) {
    for (const [slot, side] of [[k.slot1, 'home'], [k.slot2, 'away']] as const) {
      const parsed = parseSlot(slot);
      if (parsed?.type === 'third') thirdSlots.push({ matchId: k.matchId, side, allowed: parsed.allowed });
    }
  }
  const thirdAssign = assignThirds(thirdSlots, thirds);

  const resolved = new Map<string, ResolvedKnockout>();
  const fixtureScoreByNum = new Map<number, { home: number; away: number }>();
  for (const m of t.matches) {
    if (m.round === 'group') continue;
    const k = template.find((x) => x.matchId === m.matchId);
    if (k && m.score) fixtureScoreByNum.set(k.num, m.score);
  }

  const resolveSide = (slot: string, matchId: string, side: 'home' | 'away'): string | null => {
    const parsed = parseSlot(slot);
    if (!parsed) return null;
    if (parsed.type === 'group') {
      const g = standings[parsed.group];
      if (!g || g.length < parsed.pos) return null;
      const cand = g[parsed.pos - 1];
      // Only treat as resolved once the group is actually decided.
      return groupDecided(parsed.group, results) ? cand.code : null;
    }
    if (parsed.type === 'third') {
      return thirdAssign.get(`${matchId}:${side}`) ?? null;
    }
    if (parsed.type === 'winner') {
      const feeder = resolved.get(byNum.get(parsed.num)!.matchId);
      return feeder ? feeder.winner : null;
    }
    if (parsed.type === 'loser') {
      const feeder = resolved.get(byNum.get(parsed.num)!.matchId);
      return feeder ? feeder.loser : null;
    }
    return null;
  };

  // Process in fixture order so feeders are resolved before their consumers.
  for (const k of template) {
    const home = resolveSide(k.slot1, k.matchId, 'home');
    const away = resolveSide(k.slot2, k.matchId, 'away');

    let score = results[k.matchId]
      ? { home: results[k.matchId].home, away: results[k.matchId].away }
      : fixtureScoreByNum.get(k.num) ?? null;

    let winner: string | null = null;
    let loser: string | null = null;
    let status: 'pending' | 'finished' = 'pending';
    if (score && home && away) {
      status = 'finished';
      if (score.home > score.away) {
        winner = home;
        loser = away;
      } else if (score.away > score.home) {
        winner = away;
        loser = home;
      } else {
        // Knockout cannot end level: decide by Elo (documented fallback).
        winner = getElo(home).elo >= getElo(away).elo ? home : away;
        loser = winner === home ? away : home;
      }
    }

    resolved.set(k.matchId, {
      matchId: k.matchId,
      round: k.round,
      stage: k.stage,
      home,
      away,
      slot1: k.slot1,
      slot2: k.slot2,
      score: status === 'finished' ? score : null,
      winner,
      loser,
      status,
    });
  }

  const final = resolved.get('FINAL');
  return {
    standings,
    qualifiers,
    knockout: [...resolved.values()].sort((a, b) => a.matchId.localeCompare(b.matchId, undefined, { numeric: true })),
    champion: final ? winnerOf(final) : null,
  };
}

/** A group is decided once all 6 of its matches are finished. */
function groupDecided(group: string, results: ResultsMap): boolean {
  const t = loadTournament();
  const matches = t.matches.filter((m) => m.stage === 'group_stage' && m.group === group);
  return matches.every((m) => results[m.matchId] || m.score);
}
