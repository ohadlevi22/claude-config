/**
 * @process pr-score-convergence
 * @description Domain-pluggable dual-model PR score loop: implement → PR → scorers → all ≥ target → human CR
 * @inputs { goal: string, targetScore?: number, maxIterations?: number, domain?: string, requirements?: string[], createPr?: boolean, pr?: object }
 * @outputs { success: boolean, converged: boolean, iterations: number, scores: object, pr: object, domain: string }
 */

import { createRequire } from 'module';
import { defineTask } from '@a5c-ai/babysitter-sdk';

const require = createRequire(import.meta.url);
const { loadDomain } = require('../lib/load-domain.js');
const { allScorersPass, failingScorers } = require('../lib/scorer-contract.js');

/**
 * Portable PR score convergence.
 * Domain packs supply CONTEXT + scorers; this process never hard-codes product knowledge.
 */
export async function process(inputs, ctx) {
  const goal = inputs.goal || inputs.feature || 'Implement the requested change';
  const requirements = inputs.requirements || [];

  const loaded = loadDomain({
    domainId: inputs.domain || null,
    fromDir: process.cwd(),
    goal,
    requirements,
    codebasePath: inputs.codebasePath || inputs.repoPath || null,
  });

  const targetScore = Number(inputs.targetScore ?? loaded.defaults.targetScore ?? 90);
  const maxIterations = Number(inputs.maxIterations ?? loaded.defaults.maxIterations ?? 5);
  const createPr = inputs.createPr ?? loaded.defaults.createPr ?? true;
  const domainContext = loaded.domainContext;
  const scorers = loaded.scorers;
  const codebasePath = loaded.codebasePath;

  if (!codebasePath) {
    ctx.log?.('warn', 'No codebasePath configured — set domain.json codebasePath or A5C_CODEBASE_PATH / PRODUCTS_REPO');
  } else if (loaded.codebase && !loaded.codebase.exists) {
    ctx.log?.('warn', `codebasePath does not exist: ${codebasePath}`);
  }

  ctx.log?.(
    'info',
    `Domain=${loaded.domainId} codebase=${codebasePath || '(none)'} scorers=${scorers.map((s) => s.id).join(',')} skills=${loaded.skillPointers.map((s) => s.id).join(',')} target=${targetScore}`
  );

  let iteration = 0;
  let converged = false;
  const iterationResults = [];
  let lastMustFix = [];
  let prInfo = inputs.pr || null;

  while (iteration < maxIterations && !converged) {
    iteration += 1;
    const phase = iteration === 1 ? 'execute' : 'fix';

    const impl = await ctx.task(implementOrFixTask, {
      goal,
      requirements,
      iteration,
      phase,
      modelPolicy: loaded.modelPolicy,
      domainContext,
      codebasePath,
      previousMustFix: lastMustFix,
      previousScores: iteration > 1 ? iterationResults[iteration - 2].scores : null,
    });

    prInfo = await ctx.task(ensurePrTask, {
      createPr,
      pr: prInfo,
      goal,
      iteration,
      impl,
      codebasePath,
    });

    const scoreRuns = await ctx.parallel.all(
      scorers.map((scorer) => () =>
        ctx.task(runScorerTask, {
          scorer,
          goal,
          requirements,
          domainContext,
          codebasePath,
          pr: prInfo,
          iteration,
          modelPolicy: loaded.modelPolicy,
          impl,
        })
      )
    );

    const scores = scorers.map((scorer, i) => ({
      id: scorer.id,
      title: scorer.title,
      scope: scorer.scope || (scorer.id.startsWith('dd-') ? 'domain' : 'base'),
      ...(scoreRuns[i] || { score: 0, findings: [], mustFix: ['scorer returned no result'] }),
    }));

    const passed = allScorersPass(scores, targetScore);
    const failed = failingScorers(scores, targetScore);

    iterationResults.push({
      iteration,
      phase,
      impl,
      pr: prInfo,
      scores,
      passed,
      failedIds: failed.map((f) => f.id),
    });

    if (passed) {
      converged = true;
      break;
    }

    const review = await ctx.task(reviewFeedbackTask, {
      goal,
      domainContext,
      codebasePath,
      scores,
      failed,
      targetScore,
      iteration,
      modelPolicy: loaded.modelPolicy,
      pr: prInfo,
    });

    lastMustFix = review.mustFix || failed.flatMap((f) => f.mustFix || []);

    if (iteration < maxIterations) {
      await ctx.breakpoint({
        question: `Iteration ${iteration}: ${failed.length} scorer(s) below ${targetScore} (${failed.map((f) => `${f.id}=${f.score}`).join(', ')}). Continue fix iteration ${iteration + 1}?`,
        title: `Score gate failed — iteration ${iteration}`,
        context: {
          runId: ctx.runId,
          domain: loaded.domainId,
          files: [{ path: `artifacts/iteration-${iteration}-scores.json`, format: 'code', language: 'json' }],
        },
      });
    }
  }

  const finalScores = iterationResults[iterationResults.length - 1]?.scores || [];

  return {
    success: converged,
    converged,
    iterations: iteration,
    targetScore,
    domain: loaded.domainId,
    domainName: loaded.domain.name,
    codebasePath,
    scores: finalScores,
    failing: failingScorers(finalScores, targetScore).map((f) => ({
      id: f.id,
      score: f.score,
      mustFix: f.mustFix,
    })),
    pr: prInfo,
    iterationResults,
    readyForHumanReview: converged,
    artifacts: {
      scoresHistory: 'artifacts/scores-history.json',
      finalScores: 'artifacts/final-scores.json',
    },
    metadata: {
      processId: 'pr-score-convergence',
      timestamp: ctx.now?.() || new Date().toISOString(),
      modelPolicy: loaded.modelPolicy,
    },
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const implementOrFixTask = defineTask('implement-or-fix', (args, taskCtx) => {
  const model =
    args.phase === 'fix'
      ? args.modelPolicy?.fix || args.modelPolicy?.execute
      : args.modelPolicy?.execute;
  const workdir = args.codebasePath || undefined;

  return {
    kind: 'agent',
    title: args.phase === 'fix' ? `Fix (iteration ${args.iteration})` : `Implement (iteration ${args.iteration})`,
    phase: args.phase,
    workdir,
    execution: model ? { model } : undefined,
    model: model || undefined,
    agent: {
      name: 'implementer',
      model: model || undefined,
      prompt: {
        role: 'senior software engineer',
        task:
          args.phase === 'fix'
            ? 'Fix the codebase so failing scorers can pass, using mustFix feedback'
            : 'Implement the goal in the product codebase',
        context: {
          goal: args.goal,
          requirements: args.requirements,
          iteration: args.iteration,
          phase: args.phase,
          codebasePath: args.codebasePath,
          previousMustFix: args.previousMustFix,
          previousScores: args.previousScores,
          domain: args.domainContext,
        },
        instructions: [
          `Work ONLY in the product codebase at codebasePath: ${args.codebasePath || '(unset — refuse to invent a path)'}`,
          'Read real files in that tree before editing; do not invent file paths',
          'Respect domain CONTEXT and conventions from domainContext',
          'Follow skillPointers when they name authoritative docs for this product',
          'Make the smallest change set that satisfies the goal / mustFix list',
          'Do not invent product rules that contradict domainContext',
          'Return JSON listing filesModified (repo-relative) and summary of what changed',
        ],
        outputFormat: 'JSON with filesModified (string[]), summary (string), notes (string[])',
      },
      outputSchema: {
        type: 'object',
        required: ['filesModified', 'summary'],
        properties: {
          filesModified: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          notes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    io: {
      inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
      outputJsonPath: `tasks/${taskCtx.effectId}/result.json`,
    },
    labels: ['agent', args.phase, `iteration-${args.iteration}`],
  };
});

export const ensurePrTask = defineTask('ensure-pr', (args, taskCtx) => ({
  kind: 'agent',
  title: `Ensure branch/PR (iteration ${args.iteration})`,
  phase: 'execute',
  workdir: args.codebasePath || undefined,
  agent: {
    name: 'pr-ops',
    prompt: {
      role: 'release engineer',
      task: 'Ensure changes are on a branch and a PR exists (or is updated) for human review later',
      context: {
        createPr: args.createPr,
        existingPr: args.pr,
        goal: args.goal,
        impl: args.impl,
        codebasePath: args.codebasePath,
      },
      instructions: [
        `Operate git/gh inside codebasePath: ${args.codebasePath || '(unset)'}`,
        'Commit only if there are staged/unstaged relevant changes and the user/environment allows it',
        'Push the branch if remote is available',
        'If createPr is true and no PR exists, open a draft PR with gh; otherwise update the existing PR',
        'Return PR number, url, and branch name',
      ],
      outputFormat: 'JSON with branch (string), number (number|null), url (string|null), created (boolean)',
    },
    outputSchema: {
      type: 'object',
      required: ['branch'],
      properties: {
        branch: { type: 'string' },
        number: { type: ['number', 'null'] },
        url: { type: ['string', 'null'] },
        created: { type: 'boolean' },
      },
    },
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`,
  },
  labels: ['pr', `iteration-${args.iteration}`],
}));

export const runScorerTask = defineTask('run-scorer', (args, taskCtx) => {
  const scorer = args.scorer;
  const model = args.modelPolicy?.review;
  const prompt = scorer.prompt || {};
  const workdir = args.codebasePath || undefined;

  return {
    kind: scorer.kind === 'shell' ? 'shell' : 'agent',
    title: `Score: ${scorer.title || scorer.id}`,
    phase: scorer.phase || 'review',
    workdir,
    execution: model ? { model } : undefined,
    model: model || undefined,
    ...(scorer.kind === 'shell'
      ? {
          shell: {
            command: scorer.shell?.command || 'echo "{\"score\":0,\"findings\":[],\"mustFix\":[\"shell scorer missing command\"]}"',
          },
        }
      : {
          agent: {
            name: `scorer-${scorer.id}`,
            model: model || undefined,
            prompt: {
              role: prompt.role || 'strict code reviewer',
              task: prompt.task || `Score the PR for dimension ${scorer.id}`,
              context: {
                scorerId: scorer.id,
                scorerTitle: scorer.title,
                scope: scorer.scope,
                skillRefs: scorer.skillRefs || [],
                checklistPaths: scorer.checklistPaths || [],
                rubric: scorer.rubric || {},
                failFast: scorer.failFast || [],
                appliesWhen: scorer.appliesWhen || 'always',
                codebasePath: args.codebasePath,
                goal: args.goal,
                requirements: args.requirements,
                domain: args.domainContext,
                pr: args.pr,
                impl: args.impl,
                iteration: args.iteration,
              },
              instructions: [
                ...(prompt.instructions || [`Score dimension ${scorer.id}`]),
                `Verify against the REAL codebase at codebasePath: ${args.codebasePath || '(unset)'} — read/diff files; do not score from memory alone`,
                'Use domain CONTEXT and skillRefs/checklistPaths from this scorer context when judging',
                'Honor failFast: if any failFast condition applies, score must be below 90 and mustFix must list the blockers',
                'Calibrate using rubric bands; 90+ means ready for human code review on this dimension only',
                'Return score 0-100, findings[], mustFix[], summary',
              ],
              outputFormat:
                'JSON with score (0-100), findings (array of {severity,message,path?}), mustFix (string[]), summary (string)',
            },
            outputSchema: scorer.outputSchema,
          },
        }),
    io: {
      inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
      outputJsonPath: `tasks/${taskCtx.effectId}/result.json`,
    },
    labels: ['scorer', scorer.id, `iteration-${args.iteration}`],
  };
});

export const reviewFeedbackTask = defineTask('review-feedback', (args, taskCtx) => {
  const model = args.modelPolicy?.review;
  return {
    kind: 'agent',
    title: `Review feedback (iteration ${args.iteration})`,
    phase: 'review',
    workdir: args.codebasePath || undefined,
    execution: model ? { model } : undefined,
    model: model || undefined,
    agent: {
      name: 'review-synthesizer',
      model: model || undefined,
      prompt: {
        role: 'staff engineer synthesizing review feedback',
        task: 'Turn failing scorer results into a prioritized mustFix list for the next fix iteration',
        context: {
          goal: args.goal,
          codebasePath: args.codebasePath,
          domain: args.domainContext,
          scores: args.scores,
          failed: args.failed,
          targetScore: args.targetScore,
          pr: args.pr,
        },
        instructions: [
          `mustFix items must be actionable in codebasePath: ${args.codebasePath || '(unset)'}`,
          'Prioritize mustFix items that unblock the lowest scores first',
          'Deduplicate overlapping findings',
          'Keep guidance concrete and file-oriented when possible',
          'Do not ask to lower the score threshold',
        ],
        outputFormat: 'JSON with mustFix (string[]), summary (string), priorities (string[])',
      },
      outputSchema: {
        type: 'object',
        required: ['mustFix', 'summary'],
        properties: {
          mustFix: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          priorities: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    io: {
      inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
      outputJsonPath: `tasks/${taskCtx.effectId}/result.json`,
    },
    labels: ['review', `iteration-${args.iteration}`],
  };
});
