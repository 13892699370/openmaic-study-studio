import { describe, it, expect } from 'vitest';
import { createSpecialTokenFilter } from '@/lib/ai/special-token-filter';

/** Feed a stream as the provider would chunk it, then flush. */
function run(chunks: string[]): string {
  const filter = createSpecialTokenFilter();
  let out = '';
  for (const chunk of chunks) out += filter.push(chunk);
  out += filter.flush();
  return out;
}

describe('createSpecialTokenFilter', () => {
  it('passes ordinary text through untouched', () => {
    expect(run(['平抛运动', '的等时性：两个分运动的时间相同。'])).toBe(
      '平抛运动的等时性：两个分运动的时间相同。',
    );
  });

  it('drops a leaked tool-call block instead of showing its markup', () => {
    const chunks = [
      '我们来看轨迹。',
      '<｜DSML｜_calls>\n<｜DSML｜_invoke name="action">\n',
      '<｜DSML｜_parameter name="name" string="true">spotlight</｜DSML｜_parameter>\n',
      '<｜DSML｜_parameter name="params" string="false">{"elementId":"m1"}</｜DSML｜_parameter>\n',
      '</｜DSML｜_invoke>\n</｜DSML｜_calls>',
      '这就是答案。',
    ];
    expect(run(chunks)).toBe('我们来看轨迹。这就是答案。');
  });

  it('unwraps the readable payload of a content parameter', () => {
    const chunks = [
      '<｜DSML｜_calls><｜DSML｜_invoke name="action">',
      '<｜DSML｜_parameter name="name" string="true">spotlight</｜DSML｜_parameter>',
      '<｜DSML｜_parameter name="content" string="true">只能有一个时间，',
      '两方向同时开始、同时结束。</｜DSML｜_parameter>',
      '</｜DSML｜_invoke></｜DSML｜_calls>',
    ];
    expect(run(chunks)).toBe('只能有一个时间，两方向同时开始、同时结束。');
  });

  it('holds a token split across chunks instead of leaking half of it', () => {
    expect(run(['答案在', '<｜DS', 'ML｜_calls>', '内部', '</｜DSML｜_calls>', '之后'])).toBe(
      '答案在之后',
    );
  });

  it('handles the ASCII-pipe variant', () => {
    expect(run(['前', '<|tool_calls|>', '{"a":1}', '</|tool_calls|>', '后'])).toBe('前后');
  });

  it('keeps ordinary angle brackets that are not control tokens', () => {
    expect(run(['当 x < 3 且 y > 2 时，', 'a<b>c'])).toBe('当 x < 3 且 y > 2 时，a<b>c');
  });

  it('flushes a dangling partial opener at end of stream without stalling', () => {
    expect(run(['结尾<｜DSML'])).toBe('结尾');
  });
});
