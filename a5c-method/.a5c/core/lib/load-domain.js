'use strict';

const fs = require('fs');
const path = require('path');
const { SCORER_OUTPUT_SCHEMA } = require('./scorer-contract');
const { expandSkillPointers, formatExpandedDocsMarkdown } = require('./expand-skills');

/**
 * Resolve the .a5c root (directory containing active-domain.json / domains/).
 * @param {string} [fromDir]
 */
function resolveA5cRoot(fromDir) {
  const start = fromDir || process.env.A5C_ROOT || process.cwd();
  let dir = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, '.a5c');
    if (fs.existsSync(path.join(candidate, 'domains'))) {
      return candidate;
    }
    if (path.basename(dir) === '.a5c' && fs.existsSync(path.join(dir, 'domains'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: this file lives at .a5c/core/lib/load-domain.js
  return path.resolve(__dirname, '..', '..');
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Expand ~ and resolve to absolute path.
 * @param {string} p
 */
function resolveUserPath(p) {
  if (!p) return null;
  let s = String(p).trim();
  if (!s) return null;
  if (s.startsWith('~/')) {
    s = path.join(process.env.HOME || process.env.USERPROFILE || '', s.slice(2));
  } else if (s === '~') {
    s = process.env.HOME || process.env.USERPROFILE || s;
  }
  return path.resolve(s);
}

/**
 * Resolve codebase root for coding + scorer verification.
 * Precedence: options.codebasePath → env A5C_CODEBASE_PATH / PRODUCTS_REPO → domain.json codebasePath
 * @param {object} domainMeta
 * @param {object} options
 */
function resolveCodebasePath(domainMeta, options = {}) {
  const raw =
    options.codebasePath ||
    process.env.A5C_CODEBASE_PATH ||
    process.env.PRODUCTS_REPO ||
    domainMeta.codebasePath ||
    null;
  const resolved = resolveUserPath(raw);
  if (!resolved) return null;
  return {
    path: resolved,
    exists: fs.existsSync(resolved),
    source: options.codebasePath
      ? 'input'
      : process.env.A5C_CODEBASE_PATH
        ? 'env:A5C_CODEBASE_PATH'
        : process.env.PRODUCTS_REPO
          ? 'env:PRODUCTS_REPO'
          : 'domain.json',
  };
}

/**
 * Optional skill pointers (optional: true) are included only when goal/requirements
 * match loadIfGoalMatches (RegExp source) or any string in when[].
 * @param {Array<object>} pointers
 * @param {string} [goalText]
 */
function filterSkillPointers(pointers, goalText) {
  const text = String(goalText || '');
  return (pointers || []).filter((p) => {
    if (!p || !p.optional) return true;
    if (!text.trim()) return false;
    if (p.loadIfGoalMatches) {
      try {
        if (new RegExp(p.loadIfGoalMatches, 'i').test(text)) return true;
      } catch {
        // ignore bad regex
      }
    }
    const triggers = Array.isArray(p.when) ? p.when : [];
    return triggers.some((t) => text.toLowerCase().includes(String(t).toLowerCase()));
  });
}

/**
 * @param {object} options
 * @param {string} [options.domainId] - override active domain
 * @param {string} [options.a5cRoot]
 * @param {string} [options.goal] - used to activate optional skill pointers
 * @param {string[]} [options.requirements]
 * @param {string} [options.codebasePath] - override domain codebase root
 */
function loadDomain(options = {}) {
  const a5cRoot = options.a5cRoot || resolveA5cRoot(options.fromDir);
  const defaults = readJson(path.join(a5cRoot, 'config', 'defaults.json'), {
    targetScore: 90,
    maxIterations: 5,
    createPr: true,
  });
  const modelPolicy = readJson(path.join(a5cRoot, 'config', 'model-policy.json'), {});
  const active = readJson(path.join(a5cRoot, 'active-domain.json'), { domain: 'example-domain' });
  const domainId = options.domainId || process.env.A5C_DOMAIN || active.domain;

  const packDir = path.join(a5cRoot, 'domains', domainId);
  if (!fs.existsSync(packDir)) {
    throw new Error(`Domain pack not found: ${domainId} (looked in ${packDir})`);
  }

  const domainMeta = readJson(path.join(packDir, 'domain.json'));
  if (!domainMeta || !domainMeta.id) {
    throw new Error(`Invalid domain.json in ${packDir}`);
  }

  const codebase = resolveCodebasePath(domainMeta, options);

  const contextFiles = domainMeta.contextFiles || ['CONTEXT.md', 'conventions.md'];
  const contextParts = {};
  const contextTextParts = [];
  for (const rel of contextFiles) {
    const full = path.join(packDir, rel);
    const text = readText(full);
    contextParts[rel] = text;
    if (text.trim()) {
      contextTextParts.push(`## ${rel}\n\n${text.trim()}`);
    }
  }

  const skillPointersFile = domainMeta.skillPointersFile || 'skill-pointers.json';
  const allSkillPointers = readJson(path.join(packDir, skillPointersFile), []);
  const goalText = [options.goal, ...(options.requirements || [])].filter(Boolean).join('\n');
  const skillPointers = filterSkillPointers(allSkillPointers, goalText);

  const baseScorers = readJson(path.join(a5cRoot, 'core', 'base-scorers.json'), []);
  const wantedBaseIds = new Set(domainMeta.baseScorers || baseScorers.map((s) => s.id));
  const selectedBase = baseScorers.filter((s) => wantedBaseIds.has(s.id));

  const scorersFile = domainMeta.scorersFile || 'scorers.json';
  const domainScorers = readJson(path.join(packDir, scorersFile), []);
  // Domain file may include only overlays; ignore any accidental base duplicates by id.
  const baseIds = new Set(selectedBase.map((s) => s.id));
  const overlays = (domainScorers || []).filter((s) => !baseIds.has(s.id));

  const scorers = [...selectedBase, ...overlays].map((s) => ({
    ...s,
    phase: s.phase || 'review',
    outputSchema: s.outputSchema || SCORER_OUTPUT_SCHEMA,
  }));

  // Ask-mode scorers: portable ask base + domain ask overlays
  const askBaseAll = readJson(path.join(a5cRoot, 'core', 'ask-scorers.json'), []);
  const wantedAskBaseIds = new Set(
    domainMeta.askBaseScorers || askBaseAll.map((s) => s.id)
  );
  const selectedAskBase = askBaseAll.filter((s) => wantedAskBaseIds.has(s.id));
  const askScorersFile = domainMeta.askScorersFile || 'ask-scorers.json';
  const domainAskScorers = readJson(path.join(packDir, askScorersFile), []) || [];
  const askBaseIds = new Set(selectedAskBase.map((s) => s.id));
  const askOverlays = domainAskScorers.filter((s) => !askBaseIds.has(s.id));
  const askScorers = [...selectedAskBase, ...askOverlays].map((s) => ({
    ...s,
    phase: s.phase || 'review',
    outputSchema: s.outputSchema || SCORER_OUTPUT_SCHEMA,
  }));

  const codebasePath = codebase?.path || null;

  const expand =
    options.expandSkills === false
      ? { docs: [], totalChars: 0, missing: [] }
      : expandSkillPointers(skillPointers, {
          resolveUserPath,
          maxTotalChars: options.maxSkillChars ?? 24000,
          maxFileChars: options.maxSkillFileChars ?? 8000,
        });

  const expandedDocsMarkdown = formatExpandedDocsMarkdown(expand.docs);

  const configSourcesFile = domainMeta.configSourcesFile || 'config-sources.json';
  const configSources = readJson(path.join(packDir, configSourcesFile), null);
  const hasLiveConfig =
    !!configSources &&
    Array.isArray(configSources.stores) &&
    configSources.stores.length > 0;

  return {
    a5cRoot,
    domainId,
    domain: domainMeta,
    modelPolicy,
    defaults,
    codebase,
    codebasePath,
    skillPointers,
    allSkillPointers,
    configSources,
    hasLiveConfig,
    contextParts,
    contextMarkdown: contextTextParts.join('\n\n'),
    scorers,
    askScorers,
    expandedSkills: expand,
    domainContext: {
      id: domainMeta.id,
      name: domainMeta.name,
      product: domainMeta.product,
      codebasePath,
      codebaseExists: codebase ? codebase.exists : false,
      codebaseSource: codebase ? codebase.source : null,
      contextMarkdown: contextTextParts.join('\n\n'),
      skillPointers,
      expandedDocsMarkdown,
      expandedSkillIds: expand.docs.map((d) => d.id),
      conventions: contextParts['conventions.md'] || '',
      configSources,
      hasLiveConfig,
    },
  };
}

module.exports = {
  resolveA5cRoot,
  loadDomain,
  filterSkillPointers,
  resolveCodebasePath,
  resolveUserPath,
};
