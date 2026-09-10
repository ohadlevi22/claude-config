'use strict';

/**
 * Shared scorer output contract for the PR score convergence loop.
 * Every scorer (base or domain, agent or shell-mapped) must produce this shape.
 */

const SCORER_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['score', 'findings', 'mustFix'],
  properties: {
    score: { type: 'number', minimum: 0, maximum: 100 },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['info', 'warn', 'error'] },
          message: { type: 'string' },
          path: { type: 'string' },
        },
      },
    },
    mustFix: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
};

/**
 * @param {unknown} result
 * @returns {{ ok: boolean, errors: string[], normalized: object|null }}
 */
function validateScorerResult(result) {
  const errors = [];
  if (!result || typeof result !== 'object') {
    return { ok: false, errors: ['result must be an object'], normalized: null };
  }

  const score = Number(result.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    errors.push('score must be a number between 0 and 100');
  }

  if (!Array.isArray(result.findings)) {
    errors.push('findings must be an array');
  }

  if (!Array.isArray(result.mustFix)) {
    errors.push('mustFix must be an array of strings');
  }

  if (errors.length > 0) {
    return { ok: false, errors, normalized: null };
  }

  return {
    ok: true,
    errors: [],
    normalized: {
      score,
      findings: result.findings,
      mustFix: result.mustFix.map(String),
      summary: result.summary != null ? String(result.summary) : '',
    },
  };
}

/**
 * @param {Array<{ id: string, score: number }>} scorerResults
 * @param {number} targetScore
 */
function allScorersPass(scorerResults, targetScore) {
  const target = Number(targetScore);
  return (scorerResults || []).every((r) => Number(r.score) >= target);
}

/**
 * @param {Array<{ id: string, score: number, mustFix?: string[] }>} scorerResults
 * @param {number} targetScore
 */
function failingScorers(scorerResults, targetScore) {
  const target = Number(targetScore);
  return (scorerResults || []).filter((r) => Number(r.score) < target);
}

module.exports = {
  SCORER_OUTPUT_SCHEMA,
  validateScorerResult,
  allScorersPass,
  failingScorers,
};
