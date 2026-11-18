/**
 * Xtream Codes answers, turned into the app's types. Servers differ: numbers come as strings, lists as objects,
 * fields go missing, text comes base64-encoded (EPG). Everything here survives that: a bad entry is skipped, a
 * missing value gets a sensible default, never an exception.
 */
import type { Account, Category, Channel, Episode, Movie, Program, Season, Series } from '../types';
import { poster as drawPoster, still as drawStill, logo as drawLogo } from '../../ui/art';

type Raw = Record<string, unknown>;

export function obj(v: unknown): Raw { return v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {}; }

/** An array, or an object's values (some servers send {"1": {...}, "2": {...}}). */
export function arr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.keys(v as Raw).map((k) => (v as Raw)[k]);
  return [];
}

export function str(v: unknown): string { return v === null || v === undefined ? '' : String(v).trim(); }

export function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(str(v));
  return isFinite(n) ? n : fallback;
}

/** Base64 text as UTF-8 (EPG titles and descriptions); plain text stays as it is. */
export function b64(v: unknown): string {
  const s = str(v);
  if (!s) return '';
  if (!/^[A-Za-z0-9+/=\s]+$/.test(s) || s.length % 4 === 1) return s;
  try {
    const bin = atob(s.replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return s;
  }
}

/** An http(s) picture address, or ''. */
function img(v: unknown): string {
  const s = str(v);
  return /^https?:\/\//i.test(s) ? s : '';
}

function quality(name: string): '4K' | 'HD' | 'SD' {
  return /\b(4k|uhd|2160p?)\b/i.test(name) ? '4K' : /\b(sd|480p?|576p?)\b/i.test(name) ? 'SD' : 'HD';
}

function split(v: unknown): string[] {
  return str(v).split(/\s*[,/|،]\s*/).filter(Boolean).slice(0, 4);
}

/** Minutes, "01:45:00" or seconds → ms. */
function durationMs(secs: unknown, text: unknown): number {
  const s = num(secs);
  if (s > 0) return s * 1000;
  const m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(str(text));
  if (m) return m[3] !== undefined ? ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 : (+m[1] * 60 + +m[2]) * 1000;
  const mins = num(text);
  return mins > 0 ? mins * 60000 : 0;
}

export function account(raw: unknown, server: string): Account | null {
  const u = obj(obj(raw).user_info);
  if (!Object.keys(u).length) return null;
  const status = str(u.status) || 'Active';
  return {
    server, username: str(u.username),
    status: /expired/i.test(status) ? 'Expired' : /banned|disabled/i.test(status) ? 'Disabled' : 'Active',
    expires: num(u.exp_date) > 0 ? num(u.exp_date) * 1000 : 0,
    maxConnections: num(u.max_connections), formats: arr(u.allowed_output_formats).map(str).filter(Boolean), demo: false,
  };
}

export function category(raw: unknown): Category | null {
  const r = obj(raw), id = str(r.category_id);
  if (!id) return null;
  return { id, name: str(r.category_name) || id, count: 0 };
}

export function channel(raw: unknown, index: number): Channel | null {
  const r = obj(raw), id = num(r.stream_id, NaN);
  if (!isFinite(id)) return null;
  const name = str(r.name) || 'Channel ' + id, icon = img(r.stream_icon);
  const short = name.replace(/\b(hd|fhd|sd|4k|uhd)\b/gi, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase() || '#';
  return {
    kind: 'live', id, num: num(r.num) || index + 1, name, category: str(r.category_id),
    epgId: str(r.epg_channel_id) || undefined, hd: quality(name) !== 'SD',
    get logo() { return icon || drawLogo(short); },
  } as Channel;
}

export function movie(raw: unknown): Movie | null {
  const r = obj(raw), id = num(r.stream_id, NaN);
  if (!isFinite(id)) return null;
  const name = str(r.name) || '#' + id, cover = img(r.stream_icon), added = num(r.added) * 1000;
  return {
    kind: 'movie', id, name, category: str(r.category_id), genres: split(r.genre), year: num(r.year) || num(str(r.releaseDate).slice(0, 4)),
    rating: Math.min(10, num(r.rating) || num(r.rating_5based) * 2), duration: 0, quality: quality(name), added: added || 0,
    plot: str(r.plot), cast: split(r.cast), director: str(r.director), ext: str(r.container_extension) || 'mp4',
    get poster() { return cover || drawPoster(name); },
    get backdrop() { return drawStill(name); },
  } as Movie;
}

/** get_vod_info: fills in what the list didn't have (plot, cast, length, backdrop). */
export function movieInfo(m: Movie, raw: unknown): Movie {
  const i = obj(obj(raw).info), d = obj(obj(raw).movie_data);
  const back = arr(i.backdrop_path).map(img).filter(Boolean)[0] || img(i.backdrop) || '';
  const cover = img(i.movie_image) || img(i.cover_big);
  const cast = split(i.cast || i.actors), genres = split(i.genre);
  return Object.assign({}, m, {
    poster: cover || m.poster,
    backdrop: back || cover || m.backdrop,
    plot: str(i.plot) || str(i.description) || m.plot,
    cast: cast.length ? cast : m.cast,
    director: str(i.director) || m.director,
    genres: genres.length ? genres : m.genres,
    year: num(str(i.releasedate || i.release_date).slice(0, 4)) || m.year,
    rating: Math.min(10, num(i.rating)) || m.rating,
    duration: durationMs(i.duration_secs, i.duration) || m.duration,
    ext: str(d.container_extension) || m.ext,
  });
}

export function series(raw: unknown): Series | null {
  const r = obj(raw), id = num(r.series_id, NaN);
  if (!isFinite(id)) return null;
  const name = str(r.name) || '#' + id, cover = img(r.cover);
  const back = arr(r.backdrop_path).map(img).filter(Boolean)[0] || '';
  return {
    kind: 'series', id, name, category: str(r.category_id), genres: split(r.genre),
    year: num(str(r.releaseDate || r.release_date).slice(0, 4)) || num(r.year), rating: Math.min(10, num(r.rating) || num(r.rating_5based) * 2),
    quality: quality(name), added: num(r.last_modified) * 1000, plot: str(r.plot), cast: split(r.cast),
    get poster() { return cover || drawPoster(name); },
    get backdrop() { return back || cover || drawStill(name); },
  } as Series;
}

/** get_series_info → seasons in order, each with its episodes in order. */
export function seasons(s: Series, raw: unknown): Season[] {
  const eps = obj(obj(raw).episodes), out: Season[] = [];
  for (const key of Object.keys(eps)) {
    const list: Episode[] = [];
    arr(eps[key]).forEach((e, i) => {
      const r = obj(e), info = obj(r.info), id = num(r.id, NaN);
      if (!isFinite(id)) return;
      const n = num(r.episode_num) || i + 1, season = num(r.season) || num(key) || 1, pic = img(info.movie_image) || img(info.cover_big);
      const title = str(r.title) || 'E' + n, seed = s.name + season + 'x' + n;
      list.push({
        kind: 'episode', id, seriesId: s.id, season, num: n, name: title, duration: durationMs(info.duration_secs, info.duration),
        plot: str(info.plot), ext: str(r.container_extension) || 'mp4',
        get still() { return pic || drawStill(seed); },
      } as Episode);
    });
    if (list.length) { list.sort((a, b) => a.num - b.num); out.push({ num: list[0].season, episodes: list }); }
  }
  return out.sort((a, b) => a.num - b.num);
}

/** get_short_epg → programs still on or to come, in order. */
export function programs(raw: unknown, now: number): Program[] {
  const out: Program[] = [];
  for (const e of arr(obj(raw).epg_listings)) {
    const r = obj(e);
    const start = num(r.start_timestamp) * 1000 || Date.parse(str(r.start).replace(' ', 'T'));
    const end = num(r.stop_timestamp) * 1000 || Date.parse(str(r.end || r.stop).replace(' ', 'T'));
    if (!isFinite(start) || !isFinite(end) || end <= now) continue;
    out.push({ title: b64(r.title) || '—', desc: b64(r.description), start, end });
  }
  return out.sort((a, b) => a.start - b.start);
}
