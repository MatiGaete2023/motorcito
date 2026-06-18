/**
 * Express app exposing the internal API (section 9 of the spec) plus the
 * static dashboard. Every mutating endpoint writes an audit entry.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { ROOT } from '../data/paths.js';
import { loadTournament, getMatch } from '../modules/tournamentLoader.js';
import { resolveBracket } from '../modules/bracketEngine.js';
import { loadAllPredictions, loadValidPredictions } from '../modules/predictions.js';
import { ensembleGroupStage, championConsensus, marketForMatch } from '../modules/predictionAggregator.js';
import { scoreModels, performanceWeights } from '../modules/modelScorer.js';
import { syncResults } from '../modules/resultsSync.js';
import { runPrediction } from '../modules/gemini.js';
import { getAudit, getVersions, getVersion, currentVersionHash, getStoredResults } from '../data/store.js';
import { buildStateExport, matchesToCsv, leaderboardToCsv } from '../util/export.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const ok = (res: Response, data: unknown) => res.json(data);
  const wrap = (fn: (req: Request, res: Response) => unknown) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };

  // ── /api/tournament ──
  app.get('/api/tournament', wrap((_req, res) => {
    const t = loadTournament();
    ok(res, {
      name: t.name,
      version: currentVersionHash(),
      counts: { teams: t.teams.length, groups: t.groups.length, matches: t.matches.length },
      groups: t.groups,
      teams: t.teams,
    });
  }));

  // ── /api/groups ──
  app.get('/api/groups', wrap((_req, res) => {
    const bracket = resolveBracket();
    ok(res, {
      standings: bracket.standings,
      qualifiers: bracket.qualifiers,
      tiebreakers: 'points → goal difference → goals for → head-to-head → Elo',
    });
  }));

  // ── /api/matches & /api/matches/{id} ──
  app.get('/api/matches', wrap((_req, res) => {
    const t = loadTournament();
    const results = getStoredResults();
    ok(res, t.matches.map((m) => ({ ...m, official_score: results[m.matchId] ?? null })));
  }));

  app.get('/api/matches/:id', wrap((req, res) => {
    const m = getMatch(req.params.id);
    if (!m) return res.status(404).json({ error: `match ${req.params.id} not found` });
    const results = getStoredResults();
    const weights = performanceWeights();
    const ensemble = ensembleGroupStage(loadValidPredictions(), weights, currentVersionHash())
      .find((e) => e.match_id === m.matchId);
    const allowDraw = m.stage === 'group_stage';
    const market = marketForMatch(m.home, m.away, allowDraw); // Elo baseline ("mercado")
    ok(res, {
      match: m,
      official_result: results[m.matchId] ?? null,
      consensus: ensemble ?? null,
      market,
      per_model: loadValidPredictions()
        .map((p) => {
          const gm = p.group_stage_matches.find((x) => x.match_id === m.matchId);
          return gm ? { model: p.model_name, probs: gm.probs, predicted_score: gm.predicted_score, result: gm.predicted_result } : null;
        })
        .filter(Boolean),
    });
  }));

  // ── /api/predictions/ensemble ──
  app.get('/api/predictions/ensemble', wrap((_req, res) => {
    const weights = performanceWeights();
    const models = loadValidPredictions();
    ok(res, {
      version: currentVersionHash(),
      method: 'weighted soft-voting (performance-weighted)',
      weights,
      group_stage: ensembleGroupStage(models, weights, currentVersionHash()),
      tournament: championConsensus(models, weights),
    });
  }));

  // ── /api/models & /api/models/{id}/run ──
  app.get('/api/models', wrap((_req, res) => {
    const loaded = loadAllPredictions();
    ok(res, {
      version: currentVersionHash(),
      total: loaded.length,
      models: scoreModels(),
      validation: loaded.map((m) => ({ model: m.prediction.model_name, origin: m.origin, valid: m.valid, errors: m.errors })),
    });
  }));

  app.post('/api/models/:id/run', wrap(async (req, res) => {
    const modelName = (req.body?.model_name as string) || req.params.id;
    const { prediction, source } = await runPrediction({ modelName, actor: req.body?.actor ?? 'api' });
    ok(res, { source, model_name: prediction.model_name, timestamp: prediction.timestamp });
  }));

  // Import a ready-made prediction (e.g. a Gemini run produced elsewhere).
  app.post('/api/predictions/import', wrap(async (req, res) => {
    const { importPrediction } = await import('../modules/predictions.js');
    try {
      const pred = importPrediction(req.body);
      res.json({ imported: pred.model_name });
    } catch (e) {
      res.status(400).json({ error: String((e as Error).message) });
    }
  }));

  // ── /api/results/sync (backend only) ──
  app.post('/api/results/sync', wrap(async (req, res) => {
    const report = await syncResults(req.body?.actor ?? 'api');
    ok(res, report);
  }));

  // ── /api/bracket ──  (official + projected scenario)
  app.get('/api/bracket', wrap(async (req, res) => {
    const b = resolveBracket();
    if (String(req.query.projected ?? 'true') === 'false') {
      return ok(res, { version: currentVersionHash(), mode: 'official', champion: b.champion, qualifiers: b.qualifiers, knockout: b.knockout });
    }
    const { projectBracket } = await import('../modules/projection.js');
    const p = projectBracket();
    ok(res, {
      version: currentVersionHash(),
      mode: 'projected',
      official: { champion: b.champion, qualifiers: b.qualifiers, knockout: b.knockout },
      projected: { champion: p.champion, qualifiers: p.qualifiers, knockout: p.knockout, projected_matches: p.projected_matches, official_matches: p.official_matches },
    });
  }));

  // Projected group standings (live classification).
  app.get('/api/groups/projected', wrap(async (_req, res) => {
    const { projectBracket } = await import('../modules/projection.js');
    const p = projectBracket();
    ok(res, { standings: p.standings, qualifiers: p.qualifiers, projected_matches: p.projected_matches });
  }));

  // ── /api/audit ──
  app.get('/api/audit', wrap((_req, res) => {
    ok(res, { entries: getAudit().slice().reverse(), versions: getVersions().map((v) => ({ versionHash: v.versionHash, createdAt: v.createdAt, reason: v.reason })) });
  }));

  app.get('/api/versions/:hash', wrap((req, res) => {
    const v = getVersion(req.params.hash);
    if (!v) return res.status(404).json({ error: 'version not found' });
    ok(res, v);
  }));

  // ── Export (criterio 7) ──
  app.get('/api/export', wrap((req, res) => {
    const fmt = String(req.query.format ?? 'json').toLowerCase();
    const what = String(req.query.what ?? 'state').toLowerCase();
    if (fmt === 'csv') {
      res.type('text/csv');
      res.setHeader('content-disposition', `attachment; filename="${what}.csv"`);
      return res.send(what === 'leaderboard' ? leaderboardToCsv() : matchesToCsv());
    }
    res.json(buildStateExport());
  }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: currentVersionHash() }));

  // Static dashboard.
  app.use('/', express.static(path.join(ROOT, 'public')));

  // Error handler — surface errors, never swallow them (criterio 14).
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api-error]', err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
