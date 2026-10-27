/** A step's budget: a timeout is a retryable failure; the run's own abort is an abort. */
import { describe, expect, it } from 'vitest';
import { isAbortError } from '@openmaic/generation';

import {
  StepTimeoutError,
  resolveStepDeadlines,
  stepDeadlineEnvName,
  withDeadline,
} from '@/lib/server/generation/run/deadline';
import { withRouteRetry } from '@/lib/server/generation/run/retry';

describe('step deadline budgets', () => {
  it('gives an interactive scene room for the slow tail, not the median', () => {
    // Measured: the same scene finished in 224 s one attempt and 400 s+ on
    // another. A budget under the slow tail fails scenes that would have
    // succeeded, and a timeout restarts the scene from nothing.
    expect(resolveStepDeadlines({}).sceneContent).toBeGreaterThanOrEqual(600_000);
  });

  it('lets a deployment override one step by name', () => {
    const env = { [stepDeadlineEnvName('sceneContent')]: '900000' };
    const resolved = resolveStepDeadlines(env);
    expect(stepDeadlineEnvName('sceneContent')).toBe('STEP_DEADLINE_SCENE_CONTENT_MS');
    expect(resolved.sceneContent).toBe(900_000);
    // Untouched steps keep their budget.
    expect(resolved.sceneActions).toBe(resolveStepDeadlines({}).sceneActions);
  });

  it('ignores an override that would disable the deadline', () => {
    const base = resolveStepDeadlines({});
    for (const bad of ['', 'abc', '0', '-1']) {
      const resolved = resolveStepDeadlines({ STEP_DEADLINE_SCENE_CONTENT_MS: bad });
      expect(resolved.sceneContent).toBe(base.sceneContent);
    }
  });
});

describe('step deadlines', () => {
  it('fails a call that outlives its budget, even one that ignores its signal', async () => {
    const run = new AbortController();
    let seen: AbortSignal | undefined;
    const pending = withDeadline('scene:0:actions', 20, run.signal, (signal) => {
      seen = signal;
      return new Promise<never>(() => undefined);
    });
    await expect(pending).rejects.toBeInstanceOf(StepTimeoutError);
    expect(seen?.aborted).toBe(true);
  });

  it("rejects as an abort when the run's own signal aborts", async () => {
    const run = new AbortController();
    const pending = withDeadline(
      'scene:0:content',
      60_000,
      run.signal,
      (signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('cancelled'))),
        ),
    );
    run.abort();
    const error = await pending.catch((reason: unknown) => reason);
    expect(isAbortError(error)).toBe(true);
  });

  it('is retried, and the retry reports what failed', async () => {
    const causes: string[] = [];
    let attempts = 0;
    const result = await withRouteRetry(
      () =>
        withDeadline('step', 10, new AbortController().signal, async () => {
          attempts += 1;
          if (attempts === 1) return new Promise<string>(() => undefined);
          return 'ok';
        }),
      {
        label: 'step',
        maxRetries: 2,
        refusalStatus: 500,
        sleep: async () => undefined,
        onRetry: (event) => {
          causes.push(event.cause);
        },
      },
    );
    expect(result).toBe('ok');
    expect(causes).toEqual(['StepTimeoutError: step did not finish within 0.01 s']);
  });
});
