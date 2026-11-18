/**
 * Favorites, watch history and resume points, kept on the TV per account (two providers' ids mean different things).
 *
 * Three stores, each with its own limit, so one can't push another out:
 *  - resume points (films, episodes): up to 500, the oldest go first. Channel surfing never touches them.
 *  - history: the last 150 things watched, of which at most 40 channels.
 *  - favorites: no limit (you choose them).
 * Each entry keeps a small copy of the item (without plot, cast or drawn pictures), so opening it from Home,
 * Favorites or History needs no catalogue download: a film opens from its copy; an episode needs only its series'
 * episode list (get_series_info).
 *
 * Writes are gathered for a second (a fast channel change writes once), and written at once when the app is hidden
 * or closed (flush). Data that doesn't read back as expected is dropped, store by store, never the whole app; a full
 * storage trims the oldest history and tries again. Format v2; v1 (phases 1-3) is carried over on first use.
 */
import { load, save, remove } from '../core/store';
import { poster as drawPoster, still as drawStill, logo as drawLogo } from '../ui/art';
import type { Channel, Episode, Item, Kind, Movie, Series } from './types';

export interface Entry {
  kind: Kind;
  id: number;
  name: string;
  image: string;
  at: number;          // last watched (ms)
  pos: number;         // resume point (ms)
  dur: number;         // length as played (ms), 0 for live or unknown
  done?: boolean;      // watched to the end (or within its last 2 minutes)
  seriesId?: number;
  seriesName?: string;
  season?: number;
  ep?: number;
  /** A small copy of the item (and of its series, for an episode): what opening it needs. */
  item?: Item;
  series?: Series;
}

export interface Fav { kind: Kind; id: number; name: string; image: string; at: number; item?: Item }
export interface Resume { pos: number; dur: number; at: number; done: boolean }

const VERSION = 2;
const HISTORY_MAX = 150, LIVE_MAX = 40, RESUME_MAX = 500;
const END_MARGIN = 120000;   // the last 2 minutes count as watched (credits)
const KINDS: Kind[] = ['live', 'movie', 'series', 'episode'];

const key = (kind: Kind, id: number): string => kind + ':' + id;
let owner = 'demo';
let favs: Record<string, Fav> = {};
let history: Entry[] = [];
let resume: Record<string, Resume> = {};
const K = (name: string) => name + '.' + owner;

// MARK: - Reading safely

function isEntry(e: unknown): e is Entry {
  const x = e as Entry;
  return !!x && typeof x === 'object' && KINDS.indexOf(x.kind) >= 0 && typeof x.id === 'number' && isFinite(x.id);
}
function objectOr<T>(v: unknown): Record<string, T> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {};
}
function number(v: unknown): number { return typeof v === 'number' && isFinite(v) ? v : 0; }

function readFavs(raw: unknown): Record<string, Fav> {
  const out: Record<string, Fav> = {}, o = objectOr<Fav>(raw);
  for (const k in o) if (isEntry(o[k])) out[k] = Object.assign({}, o[k], { at: number(o[k].at) });
  return out;
}
function readHistory(raw: unknown): Entry[] {
  return Array.isArray(raw) ? raw.filter(isEntry).map((e) => Object.assign({}, e, { pos: number(e.pos), dur: number(e.dur), at: number(e.at) })) : [];
}
function readResume(raw: unknown): Record<string, Resume> {
  const out: Record<string, Resume> = {}, o = objectOr<Resume>(raw);
  for (const k in o) {
    const r = o[k];
    if (r && typeof r === 'object') out[k] = { pos: number(r.pos), dur: number(r.dur), at: number(r.at), done: !!r.done };
  }
  return out;
}

// MARK: - Writing: gathered, flushed when hidden or closed

const dirty: Record<string, boolean> = {};
let timer: ReturnType<typeof setTimeout> | 0 = 0;

function later(name: 'favorites' | 'history' | 'resume'): void {
  dirty[name] = true;
  if (!timer) timer = setTimeout(flush, 1000);
}

/** Writes what changed now (the app is going away, or a test wants it on disk). */
export function flush(): void {
  if (timer) { clearTimeout(timer); timer = 0; }
  if (dirty.favorites) { delete dirty.favorites; write('favorites', favs); }
  if (dirty.history) { delete dirty.history; write('history', history); }
  if (dirty.resume) { delete dirty.resume; write('resume', resume); }
}

/** A full storage: the oldest half of the history and resume points go, then it tries once more. */
function write(name: string, value: unknown): void {
  if (save(K(name), value)) return;
  history = history.slice(0, Math.floor(history.length / 2));
  resume = newest(resume, Math.floor(Object.keys(resume).length / 2));
  save(K('history'), history);
  save(K('resume'), resume);
  if (name !== 'history' && name !== 'resume') save(K(name), value);
}

function newest(map: Record<string, Resume>, max: number): Record<string, Resume> {
  const keys = Object.keys(map);
  if (keys.length <= max) return map;
  keys.sort((a, b) => map[b].at - map[a].at);
  const out: Record<string, Resume> = {};
  for (const k of keys.slice(0, max)) out[k] = map[k];
  return out;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
}

// MARK: - Accounts and the v1 carry-over

export function useLibrary(accountId: string): void {
  flush();
  owner = accountId;
  favs = readFavs(load(K('favorites'), {}));
  history = readHistory(load(K('history'), []));
  resume = readResume(load(K('resume'), {}));
  if (load(K('lib.v'), 1) < VERSION) {
    // v1 kept resume points only in the history (and channel changes could push them out): copy them across.
    for (const e of history) {
      if ((e.kind === 'movie' || e.kind === 'episode') && e.pos > 0 && !resume[key(e.kind, e.id)]) {
        resume[key(e.kind, e.id)] = { pos: e.pos, dur: e.dur, at: e.at, done: isDone(e.pos, e.dur) };
      }
      if (e.image && e.image.indexOf('data:') === 0) e.image = '';   // v1 kept drawn pictures: drawn again on read
    }
    for (const k in favs) if (favs[k].image.indexOf('data:') === 0) favs[k].image = '';
    save(K('resume'), resume);
    save(K('history'), history);
    save(K('favorites'), favs);
    save(K('lib.v'), VERSION);
  }
}

// MARK: - Copies of items (what is kept, and what is drawn again)

function isDone(pos: number, dur: number): boolean { return dur > 0 && pos >= dur - END_MARGIN; }

/** A copy small enough to keep: no plot, cast, seasons, nor drawn pictures (data: URIs, made again on read). */
export function snapshot<T extends Item>(item: T): T {
  const c = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;   // getters (pictures) become values
  for (const f of ['poster', 'backdrop', 'still', 'logo']) if (typeof c[f] === 'string' && (c[f] as string).indexOf('data:') === 0) c[f] = '';
  if ('plot' in c) c.plot = '';
  if ('cast' in c) c.cast = [];
  if ('director' in c) c.director = '';
  delete c.seasons;
  return c as unknown as T;
}

function initials(name: string): string {
  return name.replace(/\b(hd|fhd|sd|4k|uhd)\b/gi, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase() || '#';
}

/** A kept copy, made whole again: the pictures it had to leave out are drawn. */
export function restore<T extends Item>(item: T): T {
  const c = Object.assign({}, item) as Record<string, unknown>;
  const name = String(c.name || '');
  if (item.kind === 'live' && !c.logo) c.logo = drawLogo(initials(name));
  if ((item.kind === 'movie' || item.kind === 'series') && !c.poster) c.poster = drawPoster(name);
  if ((item.kind === 'movie' || item.kind === 'series') && !c.backdrop) c.backdrop = drawStill(name);
  if (item.kind === 'episode' && !c.still) c.still = drawStill(name);
  if ((item.kind === 'movie' || item.kind === 'series') && !Array.isArray(c.genres)) c.genres = [];
  if ((item.kind === 'movie' || item.kind === 'series') && !Array.isArray(c.cast)) c.cast = [];
  return c as unknown as T;
}

/** The entry's picture, drawn when it has none. */
function withImage<T extends { kind: Kind; name: string; image: string; seriesName?: string }>(e: T): T {
  if (e.image) return e;
  const img = e.kind === 'live' ? drawLogo(initials(e.name)) : e.kind === 'episode' ? drawStill(e.seriesName || e.name) : drawPoster(e.name);
  return Object.assign({}, e, { image: img });
}

export function imageOf(item: Item): string {
  const s = item.kind === 'live' ? item.logo : item.kind === 'episode' ? item.still : item.poster;
  return s && s.indexOf('data:') === 0 ? '' : s;
}

// MARK: - Favorites

export function isFavorite(kind: Kind, id: number): boolean { return !!favs[key(kind, id)]; }

/** Adds or removes; true when it's now a favorite. */
export function toggleFavorite(item: Channel | Movie | Series): boolean {
  const k = key(item.kind, item.id);
  if (favs[k]) delete favs[k];
  else favs[k] = { kind: item.kind, id: item.id, name: item.name, image: imageOf(item), at: Date.now(), item: snapshot(item) };
  later('favorites');
  return !!favs[k];
}

export function removeFavorite(kind: Kind, id: number): void { delete favs[key(kind, id)]; later('favorites'); }

/** Newest first. */
export function favorites(kind?: Kind): Fav[] {
  const out: Fav[] = [];
  for (const k in favs) if (!kind || favs[k].kind === kind) out.push(withImage(favs[k]));
  return out.sort((a, b) => b.at - a.at);
}

export function resetFavorites(): void { favs = {}; delete dirty.favorites; remove(K('favorites')); }

// MARK: - History and resume points

/** When something starts playing, every 15 s while it plays, and when it stops: where it is and how long it is. */
export function record(item: Channel | Movie | Episode, pos: number, dur: number, series?: Series): void {
  const now = Date.now(), k = key(item.kind, item.id), prev = resume[k];
  // A start from 0 doesn't erase a point it had (it's written once it really plays on).
  if (item.kind !== 'live' && (pos > 0 || !prev)) {
    resume[k] = { pos, dur: dur || (prev ? prev.dur : 0), at: now, done: isDone(pos, dur || (prev ? prev.dur : 0)) };
    if (Object.keys(resume).length > RESUME_MAX) resume = newest(resume, RESUME_MAX);
    later('resume');
  }
  const r = resume[k];
  const e: Entry = { kind: item.kind, id: item.id, name: item.name, image: imageOf(item), at: now,
    pos: r ? r.pos : 0, dur: r ? r.dur : 0, done: r ? r.done : false, item: snapshot(item) };
  if (item.kind === 'episode') {
    e.seriesId = item.seriesId; e.season = item.season; e.ep = item.num;
    if (series) { e.seriesName = series.name; e.series = snapshot(series); }
  }
  let next = [e].concat(history.filter((h) => !(h.kind === e.kind && h.id === e.id)));
  // At most 40 channels: the oldest ones go, never a film's or an episode's place.
  let live = 0;
  next = next.filter((h) => h.kind !== 'live' || ++live <= LIVE_MAX);
  history = next.slice(0, HISTORY_MAX);
  later('history');
}

/** Watched to the end: marked done, so the series moves on to the next episode. */
export function markDone(item: Movie | Episode, dur: number): void {
  const k = key(item.kind, item.id), d = dur || (resume[k] ? resume[k].dur : 0);
  resume[k] = { pos: d, dur: d, at: Date.now(), done: true };
  for (const h of history) if (h.kind === item.kind && h.id === item.id) { h.pos = d; h.dur = d; h.done = true; }
  later('resume');
  later('history');
}

export function progress(kind: Kind, id: number): Resume | null { return resume[key(kind, id)] || null; }

/** Left part-way: past the first minute, not done. */
export function partWay(p: Resume | null): boolean { return !!p && !p.done && p.pos > 60000 && (!p.dur || p.pos < p.dur - END_MARGIN); }

/** Films and episodes left part-way, newest first; for a series, only its latest episode. */
export function continueWatching(): Entry[] {
  const seen: Record<number, boolean> = {}, out: Entry[] = [];
  for (const h of history) {
    if (h.kind !== 'movie' && h.kind !== 'episode') continue;
    const p = resume[key(h.kind, h.id)];
    if (!partWay(p) || !p.dur) continue;
    if (h.kind === 'episode' && h.seriesId !== undefined) {
      if (seen[h.seriesId]) continue;
      seen[h.seriesId] = true;
    }
    out.push(withImage(Object.assign({}, h, { pos: p.pos, dur: p.dur })));
  }
  return out;
}

export function recent(kind?: Kind): Entry[] {
  return (kind ? history.filter((h) => h.kind === kind) : history.slice()).map(withImage);
}

export function removeFromHistory(kind: Kind, id: number): void {
  history = history.filter((h) => !(h.kind === kind && h.id === id));
  delete resume[key(kind, id)];
  later('history');
  later('resume');
}

export function resetHistory(): void {
  history = []; resume = {};
  delete dirty.history; delete dirty.resume;
  remove(K('history')); remove(K('resume'));
}

/** What's kept for this account, for Settings' diagnostics. */
export function libraryStats(): { favorites: number; history: number; resume: number } {
  return { favorites: Object.keys(favs).length, history: history.length, resume: Object.keys(resume).length };
}

/** The demo account starts with a little history, so Continue Watching has something to show. */
export function seedDemo(items: { movies: Movie[]; channels: Channel[] }): void {
  if (load(K('seeded'), false)) return;
  const now = Date.now();
  const m = items.movies;
  const picks: Array<[Movie, number]> = [[m[0], 0.62], [m[4], 0.18], [m[9], 0.82], [m[13], 0.4]];
  history = []; resume = {};
  picks.forEach(([mv, f], i) => {
    const pos = Math.round(mv.duration * f), at = now - i * 3600000;
    resume[key('movie', mv.id)] = { pos, dur: mv.duration, at, done: false };
    history.push({ kind: 'movie', id: mv.id, name: mv.name, image: imageOf(mv), at, pos, dur: mv.duration, item: snapshot(mv) });
  });
  for (const c of items.channels.slice(0, 5)) history.push({ kind: 'live', id: c.id, name: c.name, image: imageOf(c), at: now - 86400000, pos: 0, dur: 0, item: snapshot(c) });
  favs = {};
  items.channels.slice(2, 5).forEach((c, i) => { favs[key('live', c.id)] = { kind: 'live', id: c.id, name: c.name, image: imageOf(c), at: now - i, item: snapshot(c) }; });
  save(K('history'), history);
  save(K('resume'), resume);
  save(K('favorites'), favs);
  save(K('lib.v'), VERSION);
  save(K('seeded'), true);
}
