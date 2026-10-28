import { describe, expect, it } from 'vitest';
import { patchHtmlForIframe } from '@/lib/utils/iframe';

describe('patchHtmlForIframe', () => {
  it('injects the storage shim and sizing CSS after <head>', () => {
    const out = patchHtmlForIframe(
      '<!DOCTYPE html><html><head><title>t</title></head><body></body></html>',
    );
    expect(out).toContain('data-iframe-storage-shim');
    expect(out).toContain('data-iframe-patch');
  });

  it('runs the storage shim before the page scripts', () => {
    const html =
      '<!DOCTYPE html><html><head><script>window.__x = localStorage.getItem("k");</script></head><body></body></html>';
    const out = patchHtmlForIframe(html);
    // The shim must appear before the page's own <script> so storage is safe by then.
    expect(out.indexOf('data-iframe-storage-shim')).toBeLessThan(out.indexOf('window.__x'));
  });

  it('the shim provides a working in-memory storage when the real one throws', () => {
    // Execute the injected shim against a fake window whose localStorage getter
    // throws (mirroring a null-origin sandboxed iframe), then assert the shim
    // installed a usable in-memory store.
    const out = patchHtmlForIframe('<html><head></head><body></body></html>');
    const shim = out.match(/<script data-iframe-storage-shim>([\s\S]*?)<\/script>/)?.[1];
    expect(shim).toBeTruthy();

    const win: Record<string, unknown> = {};
    Object.defineProperty(win, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('sandboxed');
      },
    });
    Object.defineProperty(win, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('sandboxed');
      },
    });
    new Function('window', shim as string)(win);

    const ls = win.localStorage as Storage;
    expect(ls.getItem('missing')).toBeNull();
    ls.setItem('a', '1');
    expect(ls.getItem('a')).toBe('1');
    expect(ls.length).toBe(1);
    ls.removeItem('a');
    expect(ls.getItem('a')).toBeNull();
  });

  it('creates a head when the authored document has none', () => {
    const out = patchHtmlForIframe('<div>no head</div>');
    expect(out.startsWith('<head>\n<script data-iframe-error-shim>')).toBe(true);
    expect(out.indexOf('</head>')).toBeLessThan(out.indexOf('<div>'));
  });

  it('does not treat head-like text in comments or scripts as the document head', () => {
    const authoredScript = 'const template = "<head>"; window.__template = template;';
    const html = `<!doctype html><!-- <head> --><html><body><script>${authoredScript}</script></body></html>`;
    const out = patchHtmlForIframe(html);

    expect(out).toContain(`<script>${authoredScript}</script>`);
    expect(out.indexOf('data-iframe-error-shim')).toBeLessThan(out.indexOf('<body>'));
  });

  it('injects the error-capture shim before the storage shim and page scripts', () => {
    const html = '<!DOCTYPE html><html><head><script>boom()</script></head><body></body></html>';
    const out = patchHtmlForIframe(html);
    expect(out).toContain('data-iframe-error-shim');
    // error shim runs first → before storage shim → before page scripts, so it
    // catches errors from everything that follows.
    expect(out.indexOf('data-iframe-error-shim')).toBeLessThan(
      out.indexOf('data-iframe-storage-shim'),
    );
    expect(out.indexOf('data-iframe-storage-shim')).toBeLessThan(out.indexOf('boom()'));
  });

  it('the error shim posts runtime errors (onerror / resource / rejection / console.error) to the parent', () => {
    const out = patchHtmlForIframe('<html><head></head><body></body></html>');
    const shim = out.match(/<script data-iframe-error-shim>([\s\S]*?)<\/script>/)?.[1];
    expect(shim).toBeTruthy();

    const posts: Array<[Record<string, unknown>, string]> = [];
    const handlers: Record<string, (e: unknown) => void> = {};
    const win = {
      parent: { postMessage: (m: Record<string, unknown>, o: string) => posts.push([m, o]) },
      addEventListener: (t: string, cb: (e: unknown) => void) => {
        handlers[t] = cb;
      },
      console: { error: (..._args: unknown[]) => {} },
    };
    new Function('window', shim as string)(win);

    handlers.error({ message: 'JSON.parse boom', filename: 'p.html', lineno: 12 });
    expect(posts[0][0]).toMatchObject({ kind: 'runtime-error', errorKind: 'error' });
    expect(posts[0][0].message).toContain('JSON.parse boom');
    expect(posts[0][1]).toBe('*');

    handlers.error({ target: { src: 'https://cdn/katex.js' } });
    expect(String(posts[1][0].message)).toContain('Failed to load resource');

    handlers.unhandledrejection({ reason: { message: 'rej' } });
    expect(posts[2][0]).toMatchObject({ errorKind: 'unhandledrejection' });

    win.console.error('console boom');
    expect(posts[3][0]).toMatchObject({ errorKind: 'console.error' });
    expect(String(posts[3][0].message)).toContain('console boom');
  });

  it('the error shim buffers errors and re-emits them on a parent replay request', () => {
    // Guards the subscribe-after-insert race: a page that throws synchronously
    // while srcDoc parses may post before the parent subscribes. The shim must
    // re-emit the whole buffer when the parent asks, so nothing is lost.
    const out = patchHtmlForIframe('<html><head></head><body></body></html>');
    const shim = out.match(/<script data-iframe-error-shim>([\s\S]*?)<\/script>/)?.[1];
    const posts: Array<[Record<string, unknown>, string]> = [];
    const handlers: Record<string, (e: unknown) => void> = {};
    const win = {
      parent: { postMessage: (m: Record<string, unknown>, o: string) => posts.push([m, o]) },
      addEventListener: (t: string, cb: (e: unknown) => void) => {
        handlers[t] = cb;
      },
      console: { error: (..._args: unknown[]) => {} },
    };
    new Function('window', shim as string)(win);

    // Two errors fire "before the parent subscribed".
    handlers.error({ message: 'first boom' });
    handlers.unhandledrejection({ reason: { message: 'second boom' } });
    expect(posts).toHaveLength(2);

    // Parent now subscribes and requests a replay.
    handlers.message({ data: { __maicErrorReplayRequest: true } });
    expect(posts).toHaveLength(4);
    expect(String(posts[2][0].message)).toContain('first boom');
    expect(String(posts[3][0].message)).toContain('second boom');
    expect(posts[2][0]).toMatchObject({ kind: 'runtime-error', errorKind: 'error' });

    // An unrelated message must NOT trigger a replay.
    handlers.message({ data: { foo: 1 } });
    expect(posts).toHaveLength(4);
  });

  it('the error shim ignores benign ResizeObserver delivery warnings', () => {
    // Generated widgets resize on every animation frame; Chrome reports the late
    // ResizeObserver delivery as an `error` event even though nothing is broken.
    // Reporting it would raise the "interactive did not run" banner on a healthy
    // page, so the shim drops these two message shapes.
    const out = patchHtmlForIframe('<html><head></head><body></body></html>');
    const shim = out.match(/<script data-iframe-error-shim>([\s\S]*?)<\/script>/)?.[1];
    const posts: Array<[Record<string, unknown>, string]> = [];
    const handlers: Record<string, (e: unknown) => void> = {};
    const win = {
      parent: { postMessage: (m: Record<string, unknown>, o: string) => posts.push([m, o]) },
      addEventListener: (t: string, cb: (e: unknown) => void) => {
        handlers[t] = cb;
      },
      console: { error: (..._args: unknown[]) => {} },
    };
    new Function('window', shim as string)(win);

    handlers.error({ message: 'ResizeObserver loop completed with undelivered notifications.' });
    handlers.error({ message: 'ResizeObserver loop limit exceeded' });
    expect(posts).toHaveLength(0);

    // A real failure still gets through, including one that merely mentions it.
    handlers.error({ message: 'Uncaught TypeError: cannot read x (about:srcdoc:12)' });
    expect(posts).toHaveLength(1);
    expect(String(posts[0][0].message)).toContain('TypeError');
  });

  it('injects the DOM token tolerance shim before the storage shim and page scripts', () => {
    const html =
      '<!DOCTYPE html><html><head><script>el.classList.add(maybeEmpty)</script></head><body></body></html>';
    const out = patchHtmlForIframe(html);
    expect(out).toContain('data-iframe-domtoken-shim');
    expect(out.indexOf('data-iframe-error-shim')).toBeLessThan(
      out.indexOf('data-iframe-domtoken-shim'),
    );
    expect(out.indexOf('data-iframe-domtoken-shim')).toBeLessThan(
      out.indexOf('el.classList.add'),
    );
  });

  it('the DOM token shim ignores empty tokens instead of throwing', () => {
    const out = patchHtmlForIframe('<html><head></head><body></body></html>');
    const shim = out.match(/<script data-iframe-domtoken-shim>([\s\S]*?)<\/script>/)?.[1];
    expect(shim).toBeTruthy();

    // Minimal DOMTokenList stand-in over a Set, mirroring the spec's throwing
    // behaviour so the shim's narrowing is observable.
    class StrictTokenList {
      private readonly set = new Set<string>();
      add(...tokens: unknown[]) {
        for (const token of tokens) this.reject(token);
        for (const token of tokens) this.set.add(token as string);
      }
      remove(...tokens: unknown[]) {
        for (const token of tokens) this.reject(token);
        for (const token of tokens) this.set.delete(token as string);
      }
      contains(token: unknown) {
        this.reject(token);
        return this.set.has(token as string);
      }
      toggle(token: unknown, force?: boolean) {
        this.reject(token);
        const has = this.set.has(token as string);
        const next = force === undefined ? !has : force;
        if (next) this.set.add(token as string);
        else this.set.delete(token as string);
        return next;
      }
      toString() {
        return [...this.set].join(' ');
      }
      private reject(token: unknown) {
        if (typeof token !== 'string' || token.length === 0)
          throw new SyntaxError('The token provided must not be empty.');
        if (/[\t\n\f\r ]/.test(token))
          throw new SyntaxError('The token provided must not contain spaces.');
      }
    }

    const win: Record<string, unknown> = { DOMTokenList: StrictTokenList };
    // Sanity: the unwrapped list throws, which is exactly the crash the shim
    // exists to prevent. Asserted BEFORE installing the shim, since it patches
    // the prototype in place.
    const raw = new StrictTokenList();
    expect(() => raw.add('')).toThrow(SyntaxError);
    expect(() => raw.add('a b')).toThrow(SyntaxError);

    new Function('window', 'document', shim as string)(win, { addEventListener: () => {} });

    const list = new (win.DOMTokenList as typeof StrictTokenList)();
    list.add('', 'active');
    expect(list.toString()).toBe('active');
    list.remove('');
    expect(list.toString()).toBe('active');
    expect(list.contains('')).toBe(false);
    expect(list.toggle('')).toBe(false);

    // WebIDL stringifies arguments, so undefined/null become real class names —
    // the shim must keep that behaviour rather than swallowing the argument.
    list.add(undefined as unknown as string);
    expect(list.toString()).toBe('active undefined');
    list.remove(undefined as unknown as string);

    // Whitespace-separated tokens are split rather than rejected.
    list.add('a b');
    expect(list.toString()).toBe('active a b');
    expect(list.contains('a b')).toBe(true);
    expect(list.contains('')).toBe(false);

    // A force flag still wins over the token, as the spec's toggle does.
    expect(list.toggle('', true)).toBe(false);
    expect(list.toString()).toBe('active a b');
  });
});
