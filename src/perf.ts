/**
 * The measuring build (`TAHA_PERF=1 npm run build`): about a minute after start it moves through Home, Live TV and
 * the Library by itself, timing every key press (the app's work, and the time to the next drawn frame), then runs
 * Home's moves again with shadows and animations off, to tell drawing cost from code cost. The results go to the
 * app's IndexedDB (copied off the TV over SDB); nothing is sent anywhere. Never part of the normal build.
 * They hold timings and counts only: no names, addresses or account details.
 */
import { go } from './ui/components';
import { focusables, focused } from './core/focus';
import { topName } from './core/router';

interface Press { screen: string; key: string; probe: string; js: number; frame: number }
const presses: Press[] = [];
const longTasks: number[] = [];
const notes: Record<string, unknown> = {};
let probe = 'normal';
let t0 = 0, t1 = 0, label = '';

const KEYS: Record<string, number> = { left: 37, up: 38, right: 39, down: 40, ok: 13 };
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** The next drawn frame's time; -1 if none comes within 2 s (a hidden page draws none). */
const frame = () => new Promise<number>((r) => {
  let done = false;
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!done) { done = true; r(performance.now()); } }));
  setTimeout(() => { if (!done) { done = true; r(-1); } }, 2000);
});

function press(key: string): Promise<void> {
  const e = document.createEvent('Event') as KeyboardEvent;
  e.initEvent('keydown', true, true);
  Object.defineProperty(e, 'keyCode', { get: () => KEYS[key] });
  Object.defineProperty(e, 'key', { get: () => '' });
  label = key;
  document.dispatchEvent(e);
  const js = t1 - t0;
  return frame().then((t2) => {
    presses.push({ screen: topName(), key, probe, js: Math.round(js * 10) / 10, frame: t2 < 0 ? -1 : Math.round((t2 - t0) * 10) / 10 });
  });
}

async function run(keys: string[], gap = 450): Promise<void> {
  for (const k of keys) { await press(k); await wait(gap); }
}

function count(name: string): void {
  const t = performance.now();
  let n = 0;
  for (let i = 0; i < 10; i++) n = focusables().length;
  notes['focusables.' + name] = { count: n, msPerCall: Math.round((performance.now() - t) / 10 * 10) / 10,
    elements: document.getElementsByTagName('*').length, images: document.images.length };
}

function setProbe(p: string): void {
  probe = p;
  const id = 'perf-probe';
  let st = document.getElementById(id);
  if (!st) { st = document.createElement('style'); st.id = id; document.head.appendChild(st); }
  st.textContent = p === 'noshadow' ? '*{box-shadow:none!important;text-shadow:none!important}'
    : p === 'notransition' ? '*{transition:none!important;animation:none!important;scroll-behavior:auto!important}'
    : p === 'neither' ? '*{box-shadow:none!important;text-shadow:none!important;transition:none!important;animation:none!important;scroll-behavior:auto!important}'
    : p === 'noglass' ? '.glass,.sidebar,.tabs-bar,.hints{background:#111C30!important;box-shadow:none!important}'
    : '';
}

function save(result: unknown): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.open('taha-perf', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('r');
    req.onsuccess = () => {
      const tx = req.result.transaction('r', 'readwrite');
      tx.objectStore('r').put('PERF_JSON_BEGIN' + JSON.stringify(result) + 'PERF_JSON_END', 'result');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

function banner(text: string): void {
  let b = document.getElementById('perf-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'perf-banner';
    b.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:99;padding:10px 18px;border-radius:10px;background:#B45309;color:#fff;font:600 22px sans-serif';
    document.body.appendChild(b);
  }
  b.textContent = text;
}

function summary(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const groups: Record<string, Press[]> = {};
  for (const p of presses) (groups[p.screen + '/' + p.probe] = groups[p.screen + '/' + p.probe] || []).push(p);
  for (const k in groups) {
    const g = groups[k], js = g.map((p) => p.js).sort((a, b) => a - b), fr = g.map((p) => p.frame).sort((a, b) => a - b);
    const med = (a: number[]) => a[Math.floor(a.length / 2)];
    out[k] = { n: g.length, jsMedian: med(js), jsMax: js[js.length - 1], frameMedian: med(fr), frameMax: fr[fr.length - 1] };
  }
  return out;
}

export function perfInit(): void {
  // The app's handler sits on document: window capture runs before it, window bubble after it.
  window.addEventListener('keydown', () => { t0 = performance.now(); }, true);
  window.addEventListener('keydown', () => { t1 = performance.now(); }, false);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] });
  } catch { notes.longtask = 'unsupported'; }
  void label;

  setTimeout(async () => {
    banner('Taha IPTV: measuring speed, please wait (1 min)…');
    notes.ua = (/Chrome\/\d+/.exec(navigator.userAgent) || [''])[0];
    notes.screen = window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1);
    go('home');
    await wait(3000);
    count('home');
    await run(['down', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'left', 'left', 'left', 'left', 'down', 'right', 'right', 'up']);
    for (const p of ['noshadow', 'notransition', 'neither', 'noglass']) {
      setProbe(p);
      await run(['right', 'right', 'right', 'right', 'left', 'left', 'left', 'left']);
    }
    setProbe('normal');
    go('live');
    await wait(5000);
    count('live');
    await run(['down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'up', 'up', 'up', 'up']);
    setProbe('neither');
    await run(['down', 'down', 'down', 'down', 'down', 'down', 'up', 'up', 'up', 'up']);
    setProbe('normal');
    go('library', { mode: 'movie' });
    await wait(5000);
    count('library');
    await run(['down', 'down', 'right', 'right', 'right', 'right', 'right', 'right', 'down', 'left', 'left', 'left', 'up']);
    setProbe('neither');
    await run(['right', 'right', 'right', 'right', 'left', 'left', 'left', 'left']);
    setProbe('normal');
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
    notes.memoryMB = m ? Math.round(m.usedJSHeapSize / 1048576) : null;
    notes.focusedAtEnd = focused() ? (focused() as HTMLElement).className.slice(0, 40) : null;
    await save({ at: Date.now(), summary: summary(), presses, longTasks, notes });
    go('home');
    banner('Taha IPTV: measuring done ✓');
    setTimeout(() => { const b = document.getElementById('perf-banner'); if (b) b.remove(); }, 8000);
  }, 15000);
}
