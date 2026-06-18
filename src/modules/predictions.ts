/**
 * Loads the benchmark model predictions (10 files on disk) plus any runtime
 * predictions added later (e.g. a fresh Gemini run). Every prediction is
 * validated against the schema before being exposed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PREDICTIONS_DIR } from '../data/paths.js';
import { getRuntimePredictions, saveRuntimePrediction } from '../data/store.js';
import { validatePrediction } from './schemaValidator.js';
import type { ModelPrediction } from '../domain/types.js';

export interface LoadedModel {
  prediction: ModelPrediction;
  origin: 'benchmark' | 'runtime';
  valid: boolean;
  errors: string[];
}

export function loadAllPredictions(): LoadedModel[] {
  const out: LoadedModel[] = [];

  // Benchmark files on disk.
  const fileNames = fs
    .readdirSync(PREDICTIONS_DIR)
    .filter((f) => f.endsWith('_prediction.json'));
  for (const f of fileNames) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(PREDICTIONS_DIR, f), 'utf-8'));
      const v = validatePrediction(raw);
      out.push({ prediction: raw, origin: 'benchmark', valid: v.valid, errors: v.errors });
    } catch (e) {
      out.push({
        prediction: { model_name: f } as ModelPrediction,
        origin: 'benchmark',
        valid: false,
        errors: [String(e)],
      });
    }
  }

  // Runtime additions (Gemini etc.). These override a benchmark file of the
  // same model_name so the freshest run wins.
  const runtime = getRuntimePredictions();
  for (const [name, raw] of Object.entries(runtime)) {
    const v = validatePrediction(raw);
    const existing = out.findIndex((m) => m.prediction.model_name === name);
    const entry: LoadedModel = {
      prediction: raw as ModelPrediction,
      origin: 'runtime',
      valid: v.valid,
      errors: v.errors,
    };
    if (existing >= 0) out[existing] = entry;
    else out.push(entry);
  }

  return out;
}

/** Only the predictions that pass validation are usable by the engine. */
export function loadValidPredictions(): ModelPrediction[] {
  return loadAllPredictions()
    .filter((m) => m.valid)
    .map((m) => m.prediction);
}

/**
 * Import/store a new prediction at runtime. Throws on schema failure so a bad
 * payload can never be persisted (criterio 14: no silent errors).
 */
export function importPrediction(raw: unknown): ModelPrediction {
  const v = validatePrediction(raw);
  if (!v.valid) {
    throw new Error(`Invalid prediction: ${v.errors.join('; ')}`);
  }
  const pred = raw as ModelPrediction;
  saveRuntimePrediction(pred.model_name, pred);
  return pred;
}
