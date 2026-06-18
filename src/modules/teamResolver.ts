/**
 * Team Resolver — unifies team names and FIFA codes into one catalogue.
 *
 * The datasets disagree on naming: the fixture uses English names
 * ("Mexico"), the prediction files use 3-letter FIFA codes ("MEX"), and the
 * legacy Elo set uses Spanish names ("México"). This module is the single
 * place that reconciles them. FIFA code is the canonical primary key.
 */
import fs from 'node:fs';
import { files } from '../data/paths.js';
import type { Team } from '../domain/types.js';

interface RawTeam {
  name: string;
  name_normalised?: string;
  continent: string;
  flag_icon?: string;
  fifa_code: string;
  group: string;
  confed: string;
}

let catalogue: Team[] | null = null;
let byCode: Map<string, Team> | null = null;
let byName: Map<string, Team> | null = null;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function build(): void {
  const raw: RawTeam[] = JSON.parse(fs.readFileSync(files.teams, 'utf-8'));
  const elo: Record<string, { es?: string }> = JSON.parse(fs.readFileSync(files.elo, 'utf-8'));

  catalogue = raw.map((t) => ({
    code: t.fifa_code,
    name: t.name,
    nameEs: elo[t.fifa_code]?.es,
    confederation: t.confed,
    group: t.group,
    flag: t.flag_icon,
  }));

  byCode = new Map();
  byName = new Map();
  for (const t of catalogue) {
    byCode.set(t.code, t);
    byCode.set(norm(t.code), t);
    byName.set(norm(t.name), t);
    const raw0 = raw.find((r) => r.fifa_code === t.code);
    if (raw0?.name_normalised) byName.set(norm(raw0.name_normalised), t);
    if (t.nameEs) byName.set(norm(t.nameEs), t);
  }
}

function ensure(): void {
  if (!catalogue) build();
}

export function allTeams(): Team[] {
  ensure();
  return catalogue!.slice();
}

/** Resolve any identifier (FIFA code, English/Spanish/normalised name) to a Team. */
export function resolveTeam(idOrName: string): Team | undefined {
  ensure();
  if (!idOrName) return undefined;
  const direct = byCode!.get(idOrName) || byCode!.get(norm(idOrName));
  if (direct) return direct;
  return byName!.get(norm(idOrName));
}

/** Resolve to a FIFA code; throws if unknown (strict normalisation). */
export function toCode(idOrName: string): string {
  const t = resolveTeam(idOrName);
  if (!t) throw new Error(`Unknown team: "${idOrName}"`);
  return t.code;
}

export function teamByCode(code: string): Team | undefined {
  ensure();
  return byCode!.get(code) || byCode!.get(norm(code));
}
