'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Expand ~ and resolve absolute paths (shared with load-domain).
 * @param {string} p
 * @param {(s: string) => string|null} resolveUserPath
 */
function expandPath(p, resolveUserPath) {
  if (!p) return null;
  return resolveUserPath(p);
}

/**
 * Read a file with a soft size cap (chars).
 * @param {string} absPath
 * @param {number} maxChars
 */
function readCapped(absPath, maxChars) {
  if (!fs.existsSync(absPath)) {
    return { path: absPath, exists: false, text: '', truncated: false };
  }
  const raw = fs.readFileSync(absPath, 'utf8');
  if (raw.length <= maxChars) {
    return { path: absPath, exists: true, text: raw, truncated: false };
  }
  return {
    path: absPath,
    exists: true,
    text: `${raw.slice(0, maxChars)}\n\n…[truncated ${raw.length - maxChars} chars]`,
    truncated: true,
  };
}

/**
 * Eagerly load skill pointer docs into a budgeted bundle for agent context.
 *
 * @param {Array<object>} skillPointers
 * @param {object} options
 * @param {(s: string) => string|null} options.resolveUserPath
 * @param {number} [options.maxTotalChars=24000]
 * @param {number} [options.maxFileChars=8000]
 * @returns {{ docs: Array<object>, totalChars: number, missing: string[] }}
 */
function expandSkillPointers(skillPointers, options = {}) {
  const resolveUserPath = options.resolveUserPath;
  const maxTotalChars = options.maxTotalChars ?? 24000;
  const maxFileChars = options.maxFileChars ?? 8000;
  const docs = [];
  const missing = [];
  let totalChars = 0;

  for (const pointer of skillPointers || []) {
    const paths = [pointer.path, ...(pointer.also || [])].filter(Boolean);
    const files = [];
    for (const rel of paths) {
      if (totalChars >= maxTotalChars) break;
      const abs = expandPath(rel, resolveUserPath);
      if (!abs) continue;
      const remaining = Math.min(maxFileChars, maxTotalChars - totalChars);
      const loaded = readCapped(abs, remaining);
      if (!loaded.exists) {
        missing.push(abs);
        continue;
      }
      totalChars += loaded.text.length;
      files.push({
        path: abs,
        relativeHint: rel,
        truncated: loaded.truncated,
        text: loaded.text,
      });
    }
    if (files.length > 0) {
      docs.push({
        id: pointer.id,
        title: pointer.title || pointer.id,
        optional: !!pointer.optional,
        files,
      });
    }
    if (totalChars >= maxTotalChars) break;
  }

  return { docs, totalChars, missing };
}

/**
 * Flatten expanded docs to a single markdown blob for prompts.
 * @param {Array<object>} docs
 */
function formatExpandedDocsMarkdown(docs) {
  const parts = [];
  for (const doc of docs || []) {
    parts.push(`### Skill: ${doc.id}${doc.title ? ` — ${doc.title}` : ''}`);
    for (const f of doc.files || []) {
      parts.push(`#### ${f.relativeHint || f.path}${f.truncated ? ' (truncated)' : ''}`);
      parts.push(f.text);
    }
  }
  return parts.join('\n\n');
}

module.exports = {
  expandSkillPointers,
  formatExpandedDocsMarkdown,
  readCapped,
};
