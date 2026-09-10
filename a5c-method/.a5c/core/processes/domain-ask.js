/**
 * @process domain-ask
 * @description Evidence-gated Q&A using the active domain pack (CONTEXT + skills + codebase). Loop until ask scorers all ≥ target.
 * @inputs { question: string, targetScore?: number, maxIterations?: number, domain?: string, codebasePath?: string, autoContinue?: boolean }
 * @outputs { success: boolean, answer: object, scores: array, domain: string, codebasePath: string, readyToTrust: boolean }
 */

import { createRequire } from 'module';
import { defineTask } from '@a5c-ai/babysitter-sdk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { loadDomain } = require('../lib/load-domain.js');
const {
  allScorersPass,
  failingScorers,
  validateScorerResult,
} = require('../lib/scorer-contract.js');

/**
 * Ask / how-it-works flow. Same domain pack as coding; different scorers.
 * Completion requires citations to real files under codebasePath — not memory.
 */
export async function process(inputs, ctx) {
  const question = inputs.question || inputs.goal || inputs.prompt || '';
  if (!String(question).trim()) {
    throw new Error('domain-ask requires inputs.question');
  }

  const loaded = loadDomain({
    domainId: inputs.domain || null,
    fromDir: process.cwd(),
    goal: question,
    requirements: inputs.requirements || [],
    codebasePath: inputs.codebasePath || inputs.repoPath || null,
    expandSkills: inputs.expandSkills !== false,
  });

  const targetScore = Number(inputs.targetScore ?? loaded.defaults.targetScore ?? 90);
  const maxIterations = Number(inputs.maxIterations ?? loaded.defaults.maxIterations ?? 5);
  const autoContinue = inputs.autoContinue === true || inputs.yolo === true;
  const domainContext = loaded.domainContext;
  const scorers = loaded.askScorers || [];
  const codebasePath = loaded.codebasePath;
  const modelPolicy = loaded.modelPolicy;
  const artifactsDir = join(process.cwd(), 'artifacts', 'domain-ask');

  if (!codebasePath) {
    throw new Error(
      'domain-ask requires codebasePath (domain.json, A5C_CODEBASE_PATH, PRODUCTS_REPO, or inputs.codebasePath)'
    );
  }
  if (loaded.codebase && !loaded.codebase.exists) {
    throw new Error(`codebasePath does not exist: ${codebasePath}`);
  }
  if (scorers.length === 0) {
    throw new Error('No ask scorers configured — check core/ask-scorers.json and domain ask-scorers.json');
  }

  ctx.log?.(
    'info',
    `domain-ask Domain=${loaded.domainId} codebase=${codebasePath} skills=${(domainContext.expandedSkillIds || []).join(',') || '(none)'} liveConfig=${domainContext.hasLiveConfig ? 'yes' : 'no'} askScorers=${scorers.map((s) => s.id).join(',')} target=${targetScore}`
  );

  let iteration = 0;
  let converged = false;
  const iterationResults = [];
  let lastFeedback = null;
  let answer = null;

  while (iteration < maxIterations && !converged) {
    iteration += 1;

    answer = await ctx.task(researchAnswerTask, {
      question,
      iteration,
      domainContext,
      codebasePath,
      modelPolicy,
      previousAnswer: answer,
      previousFeedback: lastFeedback,
      previousScores: iteration > 1 ? iterationResults[iteration - 2].scores : null,
    });

    const scoreRuns = await ctx.parallel.all(
      scorers.map((scorer) => () =>
        ctx.task(scoreAskTask, {
          scorer,
          question,
          answer,
          domainContext,
          codebasePath,
          iteration,
          modelPolicy,
        })
      )
    );

    const scores = scorers.map((scorer, i) => {
      const raw = scoreRuns[i] || {};
      const checked = validateScorerResult(raw);
      if (!checked.ok) {
        return {
          id: scorer.id,
          title: scorer.title,
          scope: scorer.scope || 'base',
          score: 0,
          findings: checked.errors.map((e) => ({ severity: 'error', message: e })),
          mustFix: [`Invalid scorer output for ${scorer.id}: ${checked.errors.join('; ')}`],
          summary: 'invalid scorer payload',
        };
      }
      return {
        id: scorer.id,
        title: scorer.title,
        scope: scorer.scope || 'base',
        ...checked.normalized,
      };
    });

    const passed = allScorersPass(scores, targetScore);
    const failed = failingScorers(scores, targetScore);

    iterationResults.push({
      iteration,
      answer,
      scores,
      passed,
      failedIds: failed.map((f) => f.id),
    });

    writeAskArtifacts(artifactsDir, {
      question,
      domain: loaded.domainId,
      codebasePath,
      iteration,
      answer,
      scores,
      converged: passed,
    });

    if (passed) {
      converged = true;
      break;
    }

    lastFeedback = await ctx.task(refineAskFeedbackTask, {
      question,
      answer,
      scores,
      failed,
      targetScore,
      codebasePath,
      domainContext,
      iteration,
      modelPolicy,
    });

    if (iteration < maxIterations && !autoContinue) {
      await ctx.breakpoint({
        question: `Ask iteration ${iteration}: ${failed.length} scorer(s) below ${targetScore} (${failed.map((f) => `${f.id}=${f.score}`).join(', ')}). Refine answer?`,
        title: `Ask gate failed — iteration ${iteration}`,
        context: {
          runId: ctx.runId,
          domain: loaded.domainId,
          files: [
            { path: `artifacts/domain-ask/iteration-${iteration}-answer.md`, format: 'markdown' },
            { path: `artifacts/domain-ask/iteration-${iteration}-scores.json`, format: 'code', language: 'json' },
          ],
        },
      });
    }
  }

  const finalScores = iterationResults[iterationResults.length - 1]?.scores || [];
  const result = {
    success: converged,
    converged,
    iterations: iteration,
    targetScore,
    domain: loaded.domainId,
    domainName: loaded.domain.name,
    codebasePath,
    question,
    answer,
    scores: finalScores,
    failing: failingScorers(finalScores, targetScore).map((f) => ({
      id: f.id,
      score: f.score,
      mustFix: f.mustFix,
    })),
    readyToTrust: converged,
    iterationResults,
    artifacts: {
      dir: 'artifacts/domain-ask',
      latestAnswer: 'artifacts/domain-ask/latest-answer.md',
      latestScores: 'artifacts/domain-ask/latest-scores.json',
      latestResult: 'artifacts/domain-ask/latest-result.json',
    },
    metadata: {
      processId: 'domain-ask',
      timestamp: ctx.now?.() || new Date().toISOString(),
      modelPolicy,
      expandedSkillIds: domainContext.expandedSkillIds || [],
      hasLiveConfig: !!domainContext.hasLiveConfig,
      configSourcesId: domainContext.configSources?.id || null,
    },
  };

  writeAskArtifacts(artifactsDir, {
    question,
    domain: loaded.domainId,
    codebasePath,
    iteration,
    answer,
    scores: finalScores,
    converged,
    final: true,
    result,
  });

  return result;
}

function writeAskArtifacts(dir, payload) {
  try {
    mkdirSync(dir, { recursive: true });
    const { iteration, answer, scores, question, domain, codebasePath, converged, final, result } = payload;
    const md = [
      `# Domain ask — iteration ${iteration}`,
      '',
      `**Domain:** ${domain}`,
      `**Codebase:** ${codebasePath}`,
      `**Converged:** ${converged ? 'yes' : 'no'}`,
      '',
      '## Question',
      '',
      question,
      '',
      '## Answer',
      '',
      answer?.answerMarkdown || '_(empty)_',
      '',
      '## Citations',
      '',
      ...(answer?.citations || []).map(
        (c) => `- \`${c.path}\`${c.symbol ? ` · \`${c.symbol}\`` : ''}${c.note ? ` — ${c.note}` : ''}`
      ),
      '',
      '## Config lookups',
      '',
      ...((answer?.configLookups || []).length
        ? answer.configLookups.map((l) => {
            const head = l.path || [l.connection, l.database, l.table || l.attribute].filter(Boolean).join('/');
            const summary = l.summary || l.resultSummary || '';
            return `- \`${head}\`${summary ? ` — ${summary}` : ''}${l.error ? ` _(error: ${l.error})_` : ''}`;
          })
        : ['- _(none — note if live-config scorer requires lookups)_']),
      '',
      '## Open questions',
      '',
      ...((answer?.openQuestions || []).length
        ? answer.openQuestions.map((q) => `- ${q}`)
        : ['- _(none)_']),
      '',
      `**Self-confidence:** ${answer?.confidence ?? 'n/a'}`,
    ].join('\n');

    writeFileSync(join(dir, `iteration-${iteration}-answer.md`), md, 'utf8');
    writeFileSync(join(dir, `iteration-${iteration}-scores.json`), JSON.stringify(scores, null, 2), 'utf8');
    writeFileSync(join(dir, 'latest-answer.md'), md, 'utf8');
    writeFileSync(join(dir, 'latest-scores.json'), JSON.stringify(scores, null, 2), 'utf8');
    if (final && result) {
      writeFileSync(join(dir, 'latest-result.json'), JSON.stringify(result, null, 2), 'utf8');
    }
  } catch (err) {
    // Artifact write must not kill the run
    console.warn('[domain-ask] artifact write failed:', err.message);
  }
}

export const researchAnswerTask = defineTask('research-answer', (args, taskCtx) => {
  const model = args.modelPolicy?.execute || args.modelPolicy?.plan;
  const workdir = args.codebasePath || undefined;
  const skillIds = args.domainContext?.expandedSkillIds || [];
  const configSources = args.domainContext?.configSources || null;
  const hasLiveConfig = !!args.domainContext?.hasLiveConfig;

  return {
    kind: 'agent',
    title: args.iteration === 1 ? 'Research & answer' : `Refine answer (iteration ${args.iteration})`,
    phase: args.iteration === 1 ? 'execute' : 'fix',
    workdir,
    execution: model ? { model } : undefined,
    model: model || undefined,
    agent: {
      name: 'domain-researcher',
      model: model || undefined,
      prompt: {
        role: 'senior engineer answering how-it-works questions with evidence',
        task:
          args.iteration === 1
            ? 'Answer the question using codebase + domain pack + live config (when flag-gated) — cite real sources'
            : 'Refine the previous answer using mustFix / scorer feedback until it is trustworthy',
        context: {
          question: args.question,
          codebasePath: args.codebasePath,
          domain: {
            id: args.domainContext?.id,
            name: args.domainContext?.name,
            product: args.domainContext?.product,
            contextMarkdown: args.domainContext?.contextMarkdown,
            conventions: args.domainContext?.conventions,
            skillPointers: args.domainContext?.skillPointers,
            expandedSkillIds: skillIds,
            // Budgeted skill bodies (already expanded by loadDomain)
            expandedDocsMarkdown: args.domainContext?.expandedDocsMarkdown,
            configSources,
            hasLiveConfig,
          },
          previousAnswer: args.previousAnswer,
          previousFeedback: args.previousFeedback,
          previousScores: args.previousScores,
          iteration: args.iteration,
        },
        instructions: [
          `Investigate under codebasePath: ${args.codebasePath}`,
          'Read real files before claiming how something works; use expandedDocsMarkdown + skillPointers as domain guides',
          'Use domain CONTEXT / conventions; do not contradict them without a code citation',
          'Every material claim needs a citation: { path, symbol?, note } — code paths under codebasePath and/or db:<connection>/<db>.<table>#<key>',
          hasLiveConfig
            ? 'Live config is part of the evidence chain (like code). When behavior is gated by PublisherConfigProxy / CommonConfigProvider / knownAttributes in configSources: query via multi-sql-mcp (MCP sql_execute_query or CLI in configSources.tool). Record each query in configLookups. Distinguish Java fallback vs common.config vs publisher_config overrides. Code defaults alone are insufficient for production claims.'
            : 'No configSources stores for this domain — skip DB config lookups',
          hasLiveConfig
            ? 'Follow configSources.queryRules (equality filters on attribute/name; no LIKE %x% on publisher_config). If DB unreachable, set configLookups[].error and lower confidence — do not invent rows.'
            : null,
          'If uncertain, say so explicitly and list what you checked',
          'Prefer short accurate answers over long speculative ones',
          args.previousFeedback
            ? 'Address every mustFix from previousFeedback before finishing'
            : 'Produce a first-draft answer with strong citations',
          'Return JSON: answerMarkdown, citations[], configLookups[], skillIdsUsed[], openQuestions[], confidence (0-100)',
        ].filter(Boolean),
        outputFormat:
          'JSON with answerMarkdown, citations[{path,symbol?,note}], configLookups[{path?,connection,database,table?,attribute?,sql,summary,error?}], skillIdsUsed[], openQuestions[], confidence',
      },
      outputSchema: {
        type: 'object',
        required: ['answerMarkdown', 'citations', 'confidence'],
        properties: {
          answerMarkdown: { type: 'string' },
          citations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                symbol: { type: 'string' },
                note: { type: 'string' },
              },
              required: ['path'],
            },
          },
          configLookups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                connection: { type: 'string' },
                database: { type: 'string' },
                table: { type: 'string' },
                attribute: { type: 'string' },
                sql: { type: 'string' },
                summary: { type: 'string' },
                error: { type: 'string' },
              },
            },
          },
          skillIdsUsed: { type: 'array', items: { type: 'string' } },
          openQuestions: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
    },
    io: {
      inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
      outputJsonPath: `tasks/${taskCtx.effectId}/result.json`,
    },
    labels: ['ask', 'research', `iteration-${args.iteration}`],
  };
});

export const scoreAskTask = defineTask('score-ask', (args, taskCtx) => {
  const scorer = args.scorer;
  const model = args.modelPolicy?.review;
  const prompt = scorer.prompt || {};
  const workdir = args.codebasePath || undefined;

  return {
    kind: 'agent',
    title: `Ask score: ${scorer.title || scorer.id}`,
    phase: 'review',
    workdir,
    execution: model ? { model } : undefined,
    model: model || undefined,
    agent: {
      name: `ask-scorer-${scorer.id}`,
      model: model || undefined,
      prompt: {
        role: prompt.role || 'strict answer auditor',
        task: prompt.task || `Score the answer for ${scorer.id}`,
        context: {
          scorerId: scorer.id,
          scorerTitle: scorer.title,
          skillRefs: scorer.skillRefs || [],
          checklistPaths: scorer.checklistPaths || [],
          rubric: scorer.rubric || {},
          failFast: scorer.failFast || [],
          question: args.question,
          answer: args.answer,
          codebasePath: args.codebasePath,
          domain: {
            id: args.domainContext?.id,
            contextMarkdown: args.domainContext?.contextMarkdown,
            expandedSkillIds: args.domainContext?.expandedSkillIds,
            expandedDocsMarkdown: args.domainContext?.expandedDocsMarkdown,
            configSources: args.domainContext?.configSources,
            hasLiveConfig: args.domainContext?.hasLiveConfig,
          },
          iteration: args.iteration,
        },
        instructions: [
          ...(prompt.instructions || [`Score dimension ${scorer.id}`]),
          `Verify citations against real files under codebasePath: ${args.codebasePath}`,
          'Open cited paths; if a citation is missing or contradicts the claim, failFast',
          'For live-config / evidence: require configLookups when flag-gated claims are made and domain has configSources; db: citations must match lookups',
          'Honor failFast and rubric; 90+ = safe to rely on for this dimension',
          'Return score, findings[], mustFix[], summary',
        ],
        outputFormat:
          'JSON with score (0-100), findings (array of {severity,message,path?}), mustFix (string[]), summary (string)',
      },
      outputSchema: scorer.outputSchema,
    },
    io: {
      inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
      outputJsonPath: `tasks/${taskCtx.effectId}/result.json`,
    },
    labels: ['ask', 'scorer', scorer.id, `iteration-${args.iteration}`],
  };
});

export const refineAskFeedbackTask = defineTask('refine-ask-feedback', (args, taskCtx) => {
  const model = args.modelPolicy?.review;
  return {
    kind: 'agent',
    title: `Ask refine feedback (iteration ${args.iteration})`,
    phase: 'review',
    workdir: args.codebasePath || undefined,
    execution: model ? { model } : undefined,
    model: model || undefined,
    agent: {
      name: 'ask-feedback',
      model: model || undefined,
      prompt: {
        role: 'staff engineer improving research answers',
        task: 'Turn failing ask-scorer results into concrete mustFix for the next answer draft',
        context: {
          question: args.question,
          answer: args.answer,
          scores: args.scores,
          failed: args.failed,
          targetScore: args.targetScore,
          codebasePath: args.codebasePath,
          domain: args.domainContext,
        },
        instructions: [
          'Prioritize: missing live-config lookups, missing citations, faithfulness errors, then completeness gaps',
          'mustFix must be actionable against the codebase and/or configSources (file paths and concrete SQL/attributes preferred)',
          'Do not suggest lowering the score threshold',
        ],
        outputFormat: 'JSON with mustFix (string[]), summary (string)',
      },
      outputSchema: {
        type: 'object',
        required: ['mustFix', 'summary'],
        properties: {
          mustFix: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
      },
    },
    io: {
      inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
      outputJsonPath: `tasks/${taskCtx.effectId}/result.json`,
    },
    labels: ['ask', 'feedback', `iteration-${args.iteration}`],
  };
});
