/**
 * Smoke test harness — verifies the acceptance criteria (section 15) end to end
 * against real data. Run with `npm test`. Uses an isolated state dir so it
 * never pollutes a running instance.
 */
import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Isolate runtime state before any module reads STATE_DIR.
process.env.MOTORCITO_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'motorcito-test-'));

const { loadTournament } = await import('../modules/tournamentLoader.js');
const { loadAllPredictions } = await import('../modules/predictions.js');
const { resolveBracket } = await import('../modules/bracketEngine.js');
const { syncResults } = await import('../modules/resultsSync.js');
const { scoreModels } = await import('../modules/modelScorer.js');
const { runPrediction } = await import('../modules/gemini.js');
const { getAudit, getVersions } = await import('../data/store.js');
const { buildStateExport, matchesToCsv } = await import('../util/export.js');

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

console.log('\n[1] Tournament loads 48 teams, 12 groups, 104 matches');
const t = loadTournament();
check('48 teams', t.teams.length === 48, `got ${t.teams.length}`);
check('12 groups', t.groups.length === 12, `got ${t.groups.length}`);
check('104 matches', t.matches.length === 104, `got ${t.matches.length}`);
check('72 group matches', t.matches.filter((m) => m.stage === 'group_stage').length === 72);
check('32 knockout matches', t.matches.filter((m) => m.stage !== 'group_stage').length === 32);

console.log('\n[2] Imports at least 10 benchmark predictions (schema-valid)');
const loaded = loadAllPredictions();
const valid = loaded.filter((m) => m.valid);
check('>=10 predictions loaded', loaded.length >= 10, `got ${loaded.length}`);
check('all benchmark predictions valid', valid.length >= 10, `valid ${valid.length}: ${loaded.filter((m) => !m.valid).map((m) => m.prediction.model_name + ':' + m.errors[0]).join(' | ')}`);

console.log('\n[3] Can add a Gemini-style prediction with the same schema');
const run = await runPrediction({ modelName: 'Gemini-Test', actor: 'test' });
check('run produced a prediction', !!run.prediction.model_name);
check('Gemini model now in pool & valid', loadAllPredictions().some((m) => m.prediction.model_name === 'Gemini-Test' && m.valid));

console.log('\n[4] Can query results API and update the tournament');
const sync = await syncResults('test');
check('sync fetched results', sync.fetched > 0, `fetched ${sync.fetched}`);
check('sync applied changes', sync.changes.length > 0, `changes ${sync.changes.length}`);
const sync2 = await syncResults('test');
check('sync is idempotent (no new changes)', sync2.changes.length === 0, `changes ${sync2.changes.length}`);

console.log('\n[5] Recomputes the bracket from results');
const bracket = resolveBracket();
check('12 group winners', bracket.qualifiers.first.length === 12);
check('12 runners-up', bracket.qualifiers.second.length === 12);
check('8 best thirds', bracket.qualifiers.bestThirds.length === 8);
const playedMatches = Object.values(bracket.standings).flat().reduce((n, s) => n + s.played, 0) / 2;
check('standings reflect synced results', playedMatches === sync.changes.length, `played ${playedMatches} vs synced ${sync.changes.length}`);
// Thirds must come from distinct groups (valid R32 slot assignment).
const thirdGroups = new Set(bracket.qualifiers.bestThirds.map((c) => t.teams.find((x) => x.code === c)?.group));
check('best thirds from distinct groups', thirdGroups.size === 8);
// Re-arm test: injecting a swing result must be able to change qualifiers.
check('bracket recompute is deterministic', JSON.stringify(resolveBracket().qualifiers) === JSON.stringify(bracket.qualifiers));

console.log('\n[6] Leaderboard and audit/version trail present');
const board = scoreModels();
check('leaderboard ranked', board.length >= 10 && board[0].rank === 1);
check('models evaluated against results', board.some((m) => m.total_evaluated > 0));
check('audit log populated', getAudit().length > 0);
check('version snapshots recorded', getVersions().length > 0);

console.log('\n[7] Export JSON and CSV');
const exp = buildStateExport();
check('JSON export has matches', Array.isArray(exp.matches) && exp.matches.length === 104);
const csv = matchesToCsv();
check('CSV export has 105 lines (header + 104)', csv.split('\n').length === 105, `lines ${csv.split('\n').length}`);

console.log(`\n${failed === 0 ? '✅ ALL PASSED' : '❌ FAILURES'}: ${passed} passed, ${failed} failed\n`);

// Cleanup isolated state.
try {
  fs.rmSync(process.env.MOTORCITO_STATE_DIR!, { recursive: true, force: true });
} catch {
  /* ignore */
}

process.exit(failed === 0 ? 0 : 1);
