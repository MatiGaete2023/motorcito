/**
 * Gemini adapter — generates a prediction via the external Gemini API when
 * GEMINI_API_KEY is configured, otherwise falls back to the local Elo batch
 * predictor so /api/models/{id}/run always works (criterio 3).
 *
 * Whatever the source, the result is validated against the schema before it is
 * accepted, then imported into the model pool like any other model.
 */
import { generateBatchPrediction } from './batchPredictor.js';
import { importPrediction } from './predictions.js';
import { appendAudit, currentVersionHash } from '../data/store.js';
import type { ModelPrediction } from '../domain/types.js';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface RunOptions {
  modelName?: string;
  actor?: string;
}

/** Try the real Gemini API; return null on any failure so callers can fall back. */
async function callGemini(modelName: string): Promise<ModelPrediction | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const prompt =
      'Generate a FIFA World Cup 2026 prediction as JSON strictly matching the WorldCupBench predictions schema (group_stage_matches, group_qualifiers, knockout_stage, final_standings). Use 3-letter FIFA codes. Respond with JSON only.';
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as ModelPrediction;
    parsed.model_name = modelName;
    parsed.model_id = parsed.model_id || 'google/gemini-2.0-flash';
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Run a prediction for `modelName`. Uses Gemini if available, else the local
 * batch predictor. Validates, imports, and audits the run.
 */
export async function runPrediction(opts: RunOptions = {}): Promise<{ prediction: ModelPrediction; source: 'gemini' | 'local-batch' }> {
  const modelName = opts.modelName ?? 'Gemini-Live';
  const actor = opts.actor ?? 'api';

  let source: 'gemini' | 'local-batch' = 'gemini';
  let candidate = await callGemini(modelName);
  if (!candidate) {
    source = 'local-batch';
    candidate = generateBatchPrediction(modelName, 'local/elo-baseline');
  }

  const prediction = importPrediction(candidate); // throws if schema-invalid
  appendAudit({
    actor,
    action: 'model.run',
    summary: `New prediction generated for ${modelName} via ${source}`,
    delta: { model: modelName, source, timestamp: prediction.timestamp },
    versionHash: currentVersionHash(),
  });
  return { prediction, source };
}
