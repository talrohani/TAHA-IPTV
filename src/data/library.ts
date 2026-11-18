/** Favorites, watch history and resume points, kept on the TV (per account in phase 2). */
import { load, save, remove } from '../core/store';
import type { Channel, Episode, Item, Kind, Movie, Series } from './types';

export interface Entry {
  kind: Kind;
  id: number;
  name: string;
  image: string;
  at: number;          // last watched (ms)
  pos: number;         // resume point (ms)
  dur: number;         // length (ms), 0 for live
  seriesId?: number;
  seriesName?: string;
  season?: number;
  ep?: number;
}

type Fav = Pick<Entry, 'kind' | 'id' | 'name' | 'image'>;

const key = (kind: Kind, id: number): string => kind + ':' + id;
// Per account: two providers' ids mean different things. useLibrary() switches.
let owner = 'demo';
let favs: Record<string, Fav> = {};
let history: Entry[] = [];
const K = (name: string) => name + '.' + owner;

export function useLibrary(accountId: string): void {
  owner = accountId;
  favs = load(K('favorites'), {});
  history = load(K('history'), []);
}

export function imageOf(item: Item): string {
  return item.kind === 'live' ? item.logo : item.kind === 'episode' ? item.still : item.poster;
}

export function isFavorite(kind: Kind, id: number): boolean { return !!favs[key(kind, id)]; }

/** Adds or removes; true when it's now a favorite. */
export function toggleFavorite(item: Channel | Movie | Series): boolean {
  const k = key(item.kind, item.id);
  if (favs[k]) delete favs[k];
  else favs[k] = { kind: item.kind, id: item.id, name: item.name, image: imageOf(item) };
  save(K('favorites'), favs);
  return !!favs[k];
}

export function favorites(kind?: Kind): Fav[] {
  const out: Fav[] = [];
  for (const k in favs) if (!kind || favs[k].kind === kind) out.push(favs[k]);
  return out;
}

export function resetFavorites(): void { favs = {}; remove(K('favorites')); }

/** Recorded when something starts playing, and again with where it stopped. */
export function record(item: Channel | Movie | Episode, pos: number, dur: number, series?: Series): void {
  const e: Entry = { kind: item.kind, id: item.id, name: item.name, image: imageOf(item), at: Date.now(), pos, dur };
  if (item.kind === 'episode') { e.seriesId = item.seriesId; e.season = item.season; e.ep = item.num; if (series) { e.seriesName = series.name; e.image = item.still; } }
  history = [e].concat(history.filter((h) => !(h.kind === e.kind && h.id === e.id))).slice(0, 120);
  save(K('history'), history);
}

export function progress(kind: Kind, id: number): Entry | null {
  for (const h of history) if (h.kind === kind && h.id === id) return h;
  return null;
}

/** Films and episodes left part-way (not in the first minute, not in the last two). */
export function continueWatching(): Entry[] {
  return history.filter((h) => (h.kind === 'movie' || h.kind === 'episode') && h.pos > 60000 && h.dur && h.pos < h.dur - 120000);
}

export function recent(kind?: Kind): Entry[] { return kind ? history.filter((h) => h.kind === kind) : history.slice(); }

export function removeFromHistory(kind: Kind, id: number): void {
  history = history.filter((h) => !(h.kind === kind && h.id === id));
  save(K('history'), history);
}

export function resetHistory(): void { history = []; remove(K('history')); }

/** The demo account starts with a little history, so Continue Watching has something to show. */
export function seedDemo(items: { movies: Movie[]; channels: Channel[] }): void {
  if (load(K('seeded'), false)) return;
  const now = Date.now();
  const m = items.movies;
  const picks: Array<[Movie, number]> = [[m[0], 0.62], [m[4], 0.18], [m[9], 0.82], [m[13], 0.4]];
  history = picks.map(([mv, f], i) => ({ kind: 'movie' as Kind, id: mv.id, name: mv.name, image: mv.poster, at: now - i * 3600000,
    pos: Math.round(mv.duration * f), dur: mv.duration }));
  for (const c of items.channels.slice(0, 5)) history.push({ kind: 'live', id: c.id, name: c.name, image: c.logo, at: now - 86400000, pos: 0, dur: 0 });
  save(K('history'), history);
  favs = {};
  for (const c of items.channels.slice(2, 5)) favs[key('live', c.id)] = { kind: 'live', id: c.id, name: c.name, image: c.logo };
  save(K('favorites'), favs);
  save(K('seeded'), true);
}
