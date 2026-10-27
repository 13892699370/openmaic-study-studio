/**
 * The time a run gives each provider-calling step: the budget the step's 1.1.x
 * API route declared, so a hung provider fails the step the way a route
 * timeout failed the browser's request, as a retryable failure.
 */

/** Per call, in milliseconds. */
const DEFAULT_STEP_DEADLINES_MS = {
  /**
   * One material's extraction, once a worker runs it (1.1.x declared no
   * budget; the platform's default applied).
   */
  materialAnalysis: 300_000,
  /** Research (1.1.x declared no budget; the platform's default applied). */
  research: 300_000,
  /** The outline, its own stream retries included. */
  outline: 300_000,
  agentProfiles: 120_000,
  /**
   * Per attempt. A slide finishes well inside a minute; an interactive scene
   * emits a whole runnable page in one response and routinely needs several
   * minutes, with the same scene sometimes taking twice as long as the last
   * time. At 300 s those attempts were killed mid-stream, and because a
   * timeout restarts the scene from nothing, one slow scene burned six
   * consecutive 300 s budgets before failing. The budget has to cover the
   * slow tail, not the median.
   */
  sceneContent: 600_000,
  /** Per attempt. */
  sceneActions: 60_000,
  /** Per clip attempt (POST /api/generate/tts). */
  narrationClip: 30_000,
} as const;

export type StepDeadlineKey = keyof typeof DEFAULT_STEP_DEADLINES_MS;

/** `sceneContent` -> `STEP_DEADLINE_SCENE_CONTENT_MS`. */
export function stepDeadlineEnvName(key: StepDeadlineKey): string {
  return `STEP_DEADLINE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}_MS`;
}

/**
 * The budgets with any `STEP_DEADLINE_<KEY>_MS` override applied. A slow model
 * or a slow host needs a longer budget than the default; a fast one may want a
 * shorter failure path. Values that are absent, non-numeric or not positive
 * keep the default rather than disabling the step's deadline.
 */
export function resolveStepDeadlines(
  env: Record<string, string | undefined> = process.env,
): Record<StepDeadlineKey, number> {
  const resolved = { ...DEFAULT_STEP_DEADLINES_MS } as Record<StepDeadlineKey, number>;
  for (const key of Object.keys(DEFAULT_STEP_DEADLINES_MS) as StepDeadlineKey[]) {
    const raw = Number.parseInt(env[stepDeadlineEnvName(key)] ?? '', 10);
    if (Number.isFinite(raw) && raw > 0) resolved[key] = raw;
  }
  return resolved;
}

export const STEP_DEADLINES_MS = resolveStepDeadlines();


/** A step ran out of its budget. A gateway timeout to the retries: retried. */
export class StepTimeoutError extends Error {
  readonly statusCode = 504;

  constructor(label: string, ms: number) {
    super(`${label} did not finish within ${ms / 1000} s`);
    this.name = 'StepTimeoutError';
  }
}

/**
 * Run `call` with a signal that aborts when the run's signal does (a lost
 * lease, a deleted course, shutdown) or when `ms` pass. A timeout rejects
 * with {@link StepTimeoutError} even if the call ignores its signal; the
 * run's own abort rejects as an abort.
 */
export async function withDeadline<T>(
  label: string,
  ms: number,
  runSignal: AbortSignal,
  call: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), ms);
  const signal = AbortSignal.any([runSignal, timeout.signal]);
  const failure = () =>
    runSignal.aborted
      ? (runSignal.reason ?? new DOMException('Aborted', 'AbortError'))
      : new StepTimeoutError(label, ms);
  try {
    return await new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        reject(failure());
        return;
      }
      signal.addEventListener('abort', () => reject(failure()), { once: true });
      call(signal).then(resolve, (error) => reject(signal.aborted ? failure() : error));
    });
  } finally {
    clearTimeout(timer);
  }
}
