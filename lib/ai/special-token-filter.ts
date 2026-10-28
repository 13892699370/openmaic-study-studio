/**
 * Strips model chat-template control tokens out of a streamed answer.
 *
 * Tool-capable providers occasionally leak their *native* tool-call markup into
 * the text channel — DeepSeek emits `<｜DSML｜_calls>` / `<｜DSML｜_invoke …>`
 * blocks whose argument payload is plain JSON. When that happens the call never
 * becomes a structured `tool-call` part, so whatever the learner sees is the raw
 * markup: `<|DSML|_parameter name="name" string="true">spotlight</…>`. A teacher
 * answering a student with XML soup is a visible defect, so the markup is
 * removed at the stream boundary.
 *
 * Deltas arrive split at arbitrary offsets, so the filter is stateful: an
 * opening token cut in half by a chunk boundary is held back until the next
 * chunk completes it, and a block that opens must close before its body is
 * muted. Nesting is tracked on a stack because these templates nest
 * (`_calls` → `_invoke` → `_parameter`).
 *
 * The readable payload of such a call is usually the value of its `content`
 * parameter — that is where a model puts the sentence it wanted to say while
 * asking the UI to spotlight an element — so a `content` parameter is
 * unwrapped rather than dropped: the learner still hears the answer.
 */

/** `<｜DSML｜_calls>` / `</｜DSML｜_calls>` / `<|tool_calls|>` … */
const TOKEN = /<(\/?)[｜|]([^<>]*)>/g;
/** A token opener whose `>` has not arrived yet. */
const PARTIAL_TOKEN = /^<\/?[｜|][^<>]*$/;
const CONTENT_PARAM = /name\s*=\s*["']content["']/i;

export interface SpecialTokenFilter {
  /** Feed a delta; returns the text that may be shown. */
  push(chunk: string): string;
  /** Drain anything still buffered (end of stream). */
  flush(): string;
}

export function createSpecialTokenFilter(): SpecialTokenFilter {
  let pending = '';
  /** One entry per open control-token block: true when its body is readable. */
  const stack: boolean[] = [];

  const muted = (): boolean => stack.length > 0 && !stack[stack.length - 1];

  const drain = (): string => {
    let out = '';
    let pos = 0;
    for (;;) {
      TOKEN.lastIndex = pos;
      const match = TOKEN.exec(pending);
      if (!match) break;
      if (!muted()) out += pending.slice(pos, match.index);
      if (match[1] === '/') {
        stack.pop();
      } else {
        stack.push(CONTENT_PARAM.test(match[2]));
      }
      pos = match.index + match[0].length;
    }

    let rest = pending.slice(pos);
    const lastOpen = rest.lastIndexOf('<');
    if (lastOpen < 0) {
      pending = '';
    } else {
      const fragment = rest.slice(lastOpen);
      if (PARTIAL_TOKEN.test(fragment)) {
        pending = fragment;
        rest = rest.slice(0, lastOpen);
      } else {
        pending = '';
      }
    }

    if (!muted()) out += rest;
    return out;
  };

  return {
    push(chunk) {
      if (!chunk) return '';
      pending += chunk;
      return drain();
    },
    flush() {
      const out = drain();
      pending = '';
      return out;
    },
  };
}
