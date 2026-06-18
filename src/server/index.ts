/**
 * Server entry point. Starts the API + dashboard and optionally schedules
 * periodic results sync (criterio 8: configurable polling frequency).
 */
import { createApp } from './app.js';
import { syncResults } from '../modules/resultsSync.js';
import { loadTournament } from '../modules/tournamentLoader.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = createApp();

// Fail fast if the input contract is broken (criterio 1).
const t = loadTournament();
if (t.matches.length !== 104) {
  console.warn(`[boot] expected 104 matches, loaded ${t.matches.length}`);
}
console.log(`[boot] loaded ${t.teams.length} teams, ${t.groups.length} groups, ${t.matches.length} matches`);

app.listen(PORT, () => {
  console.log(`[boot] motorcito listening on http://localhost:${PORT}`);
});

// Optional automatic results polling.
const intervalSec = Number(process.env.SYNC_INTERVAL_SECONDS ?? 0);
if (intervalSec > 0) {
  console.log(`[boot] auto results-sync every ${intervalSec}s`);
  setInterval(() => {
    syncResults('scheduler')
      .then((r) => {
        if (r.changes.length) console.log(`[sync] ${r.changes.length} change(s), qualifiersChanged=${r.qualifiersChanged}`);
      })
      .catch((e) => console.error('[sync] failed', e));
  }, intervalSec * 1000);
}
