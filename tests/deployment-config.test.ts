import { expect, it } from 'vitest';
import { parseModelConfig } from '@/lib/server/model-config/openmaic-yml';

/**
 * Interactive (simulation) scenes ask the model to emit a whole runnable
 * HTML + Canvas page in one response — an order of magnitude longer than a
 * slide. A deployment pins that one slot to a stronger model and leaves the
 * short-output slots on the fast one, so generation speed for slides is
 * unaffected. These tests hold that arrangement in place, because losing it
 * silently reintroduces HTTP 500 / step-timeout failures on interactive scenes.
 */
const CONFIG = `
providers:
  qwen:
    preset: qwen
    apiKey: \${QWEN_API_KEY}
    models: [fast-model, strong-model, backup-model]

slots:
  llm: qwen:fast-model
  course.content: qwen:fast-model
  course.content.interactive:
    model: qwen:strong-model
    fallback: qwen:backup-model
`;

const env = { QWEN_API_KEY: 'test-key' };
const load = (text = CONFIG) => parseModelConfig(text, { file: 'openmaic.yml', env });

it('parses a per-slot model override with a fallback', () => {
  expect(load().slots?.['course.content.interactive']).toMatchObject({
    model: 'qwen:strong-model',
    fallback: 'qwen:backup-model',
  });
});

it('keeps the short-output content slots on the fast model', () => {
  const config = load();
  // Not named individually, so they inherit course.content.
  for (const id of ['course.content.slide', 'course.content.quiz', 'course.content.pbl']) {
    expect(config.slots?.[id]).toBeUndefined();
  }
  expect(config.slots?.['course.content']).toBe('qwen:fast-model');
});

it('authorizes both the primary and the fallback model on the provider', () => {
  // Authorization is checked against the provider's `models` list; a model that
  // is only referenced but never listed is what makes a deployment fall back to
  // a single fast model without anyone noticing.
  const config = load();
  const qwen = config.providers?.qwen as { models?: string[] } | undefined;
  expect(qwen?.models).toEqual(['fast-model', 'strong-model', 'backup-model']);
});