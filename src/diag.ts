/**
 * The diagnostics build (`TAHA_DIAG=1 npm run build`): the video display's story on the TV, for tizen/diag.py to
 * read over SDB (the TV refuses the remote inspector, so console logs can't be seen). Kept in the app's IndexedDB
 * (database taha-diag), the last 300 events. It holds states, rectangles, AVPlay's answers and error names: never
 * a stream address, a server, a user name or a password. In a normal build every call is an empty function that
 * the bundler drops.
 */
import type { Rect } from './playback/player';

interface Event { t: number; ev: string; [k: string]: unknown }
const log: Event[] = [];
let saveTimer = 0;

export function diag(ev: string, data?: Record<string, unknown>): void {
  if (!__DIAG__) return;
  log.push(Object.assign({ t: Math.round(performance.now()), ev }, data || {}));
  if (log.length > 300) log.splice(0, log.length - 300);
  // Gathered for 2 s: each save rewrites the whole log, and fewer rewrites keep it in IndexedDB's readable .log file.
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 2000);
}

function save(): void {
  try {
    const req = indexedDB.open('taha-diag', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('r');
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction('r', 'readwrite');
        tx.objectStore('r').put('DIAG_JSON_BEGIN' + JSON.stringify({ at: Date.now(), log }) + 'DIAG_JSON_END', 'log');
      } catch { /* full or closed: the next event tries again */ }
    };
  } catch { /* no IndexedDB */ }
}

/** A stage rectangle's centre and corners: what the page paints there, top layer first (tag.class, background, opacity). */
export function diagLayers(r: Rect): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!__DIAG__) return out;
  const stage = document.getElementById('stage');
  if (!stage || !document.elementsFromPoint) return out;
  const s = stage.getBoundingClientRect(), k = s.width / 1920 || 1;
  const spots: Array<[string, number, number]> = [['centre', 0.5, 0.5], ['topLeft', 0.08, 0.12], ['bottomRight', 0.92, 0.88]];
  for (const [name, fx, fy] of spots) {
    const x = s.left + (r.x + r.w * fx) * k, y = s.top + (r.y + r.h * fy) * k;
    out[name] = document.elementsFromPoint(x, y).slice(0, 12).map((e) => {
      const cs = getComputedStyle(e);
      const cls = typeof e.className === 'string' ? e.className : '';
      return (e.id ? '#' + e.id : e.tagName.toLowerCase() + (cls ? '.' + cls.split(' ').join('.') : '')) + ' bg=' + cs.backgroundColor
        + (cs.backgroundImage !== 'none' ? ' +image' : '') + (cs.opacity !== '1' ? ' op=' + cs.opacity : '')
        + (cs.visibility !== 'visible' ? ' ' + cs.visibility : '') + (cs.transform !== 'none' ? ' tf=' + cs.transform : '')
        + (cs.boxShadow !== 'none' ? ' shadow' : '');
    });
  }
  return out;
}

/** An element's box in the window (rounded), for the log. */
export function boxOf(el: Element | null): Record<string, number> | null {
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
}
