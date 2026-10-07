import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (two levels up from src/data). */
export const ROOT = path.resolve(__dirname, '..', '..');

/** Source datasets treated as the input contract (read-only at runtime). */
export const DATA_DIR = path.join(ROOT, 'data');
export const PREDICTIONS_DIR = path.join(DATA_DIR, 'predictions');
export const SOURCE_DIR = path.join(DATA_DIR, 'source');

/** Mutable runtime state (results, versions, audit). Git-ignored. */
export const STATE_DIR = process.env.MOTORCITO_STATE_DIR
  ? path.resolve(process.env.MOTORCITO_STATE_DIR)
  : path.join(ROOT, '.motorcito-data');

export const files = {
  worldcup: path.join(DATA_DIR, 'worldcup.json'),
  groups: path.join(DATA_DIR, 'worldcup.groups.json'),
  teams: path.join(DATA_DIR, 'worldcup.teams.json'),
  stadiums: path.join(DATA_DIR, 'worldcup.stadiums.json'),
  elo: path.join(DATA_DIR, 'elo_ratings.json'),
  schema: path.join(DATA_DIR, 'predictions_schema.json'),
  leaderboard: path.join(DATA_DIR, 'leaderboard.json'),
  fifaRank: path.join(SOURCE_DIR, 'fifa_mens_rank.csv'),
  history: path.join(SOURCE_DIR, 'resultados_selecciones_48_2016-2026-06-10.csv'),
};
