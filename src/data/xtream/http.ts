/**
 * GET a JSON document with a timeout and cancellation. Errors carry a code, never the address (it holds the
 * username and password).
 */
export type ErrorCode = 'url' | 'offline' | 'network' | 'timeout' | 'http' | 'parse' | 'auth' | 'expired' | 'disabled' | 'cancelled';

export class XtreamError extends Error {
  code: ErrorCode;
  status: number;
  constructor(code: ErrorCode, status?: number) {
    super(code);
    this.code = code;
    this.status = status || 0;
  }
}

export interface GetOptions { timeout: number; signal?: AbortSignal }

export function getJson(url: string, opts: GetOptions): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject(new XtreamError('offline'));
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; if (ctrl) ctrl.abort(); }, opts.timeout);
  const outer = opts.signal;
  const onOuter = () => { if (ctrl) ctrl.abort(); };
  if (outer) { if (outer.aborted) onOuter(); else outer.addEventListener('abort', onOuter); }
  const done = () => { clearTimeout(timer); if (outer) outer.removeEventListener('abort', onOuter); };
  let req: Promise<Response>;
  try {
    req = fetch(url, { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit', cache: 'no-store' });
  } catch {
    done();
    return Promise.reject(new XtreamError('url'));
  }
  return req.then((res) => {
    if (res.status === 401 || res.status === 403) throw new XtreamError('auth', res.status);
    if (!res.ok) throw new XtreamError('http', res.status);
    return res.text();
  }).then((text) => {
    done();
    const body = text.trim();
    if (!body) return null;                 // some servers answer an empty body for an empty list
    try { return JSON.parse(body); } catch { throw new XtreamError('parse'); }
  }, (err) => {
    done();
    if (err instanceof XtreamError) throw err;
    if (timedOut) throw new XtreamError('timeout');
    if (outer && outer.aborted) throw new XtreamError('cancelled');
    throw new XtreamError('network');
  });
}
