/**
 * Strict prediction-schema validation (criterio 14: "validación estricta").
 *
 * Validates a candidate prediction against predictions_schema.json (draft-07)
 * before it is ever stored or published. Used both for the 10 benchmark files
 * and for any new run (e.g. Gemini).
 */
import fs from 'node:fs';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { files } from '../data/paths.js';

let validateFn: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (validateFn) return validateFn;
  const schema = JSON.parse(fs.readFileSync(files.schema, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  validateFn = ajv.compile(schema);
  return validateFn;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePrediction(candidate: unknown): ValidationResult {
  const validate = getValidator();
  const ok = validate(candidate) as boolean;
  if (ok) {
    // Extra semantic checks the JSON schema can't easily express.
    const warnings = semanticChecks(candidate as Record<string, unknown>);
    return { valid: warnings.length === 0, errors: warnings };
  }
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || '(root)'} ${e.message ?? ''}`.trim(),
  );
  return { valid: false, errors };
}

/** Probabilities must sum to ~1.0 (±0.02) per the schema description. */
function semanticChecks(p: Record<string, unknown>): string[] {
  const errs: string[] = [];
  const all: Record<string, unknown>[] = [];
  const gsm = p.group_stage_matches as Record<string, unknown>[] | undefined;
  if (Array.isArray(gsm)) all.push(...gsm);
  const ks = p.knockout_stage as Record<string, unknown> | undefined;
  if (ks) {
    for (const key of ['round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals']) {
      const arr = ks[key] as Record<string, unknown>[] | undefined;
      if (Array.isArray(arr)) all.push(...arr);
    }
    if (ks.third_place_match) all.push(ks.third_place_match as Record<string, unknown>);
    if (ks.final) all.push(ks.final as Record<string, unknown>);
  }
  for (const m of all) {
    const probs = m.probs as { home: number; draw: number; away: number } | undefined;
    if (!probs) continue;
    const sum = probs.home + probs.draw + probs.away;
    if (Math.abs(sum - 1) > 0.02) {
      errs.push(`match ${String(m.match_id)}: probs sum to ${sum.toFixed(3)} (expected 1.0 ±0.02)`);
    }
  }
  return errs;
}
