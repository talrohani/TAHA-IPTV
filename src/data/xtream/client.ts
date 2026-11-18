/**
 * An Xtream Codes account (player_api.php), as the app's DataSource.
 *
 * Load as little as possible, once: live TV fetches the channel list one time (categories and counts come from it,
 * so switching category costs nothing); films and series load one category at a time; details (get_vod_info,
 * get_series_info) only when a page opens; the guide (get_short_epg) per channel, kept 10 minutes. Requests asked
 * twice while running are shared. Categories are kept on the TV for 12 hours, under a key without credentials.
 */
import type { Account, Category, Channel, DataSource, Episode, Movie, Program, Season, Series } from '../types';
import { getJson, XtreamError } from './http';
import * as N from './normalize';
import { load, save, getSettings } from '../../core/store';
import { hash } from '../../ui/art';

const TIMEOUT = 15000, BIG_TIMEOUT = 45000;
const LIST_TTL = 30 * 60000, CAT_TTL = 12 * 3600000, EPG_TTL = 10 * 60000;
const GUIDE_MAX = 300;

interface Cached<T> { at: number; data: T }
interface Guide { at: number; list: Program[] }

/**
 * At most `max` jobs at a time; the newest waiting job goes first (what's on screen now), and past `keep` waiting the
 * oldest are dropped: they never run, and their promise rejects (to the caller, like a failed request).
 */
export class Queue {
  private active = 0;
  private waiting: Array<{ go: () => void; drop: () => void }> = [];
  constructor(private readonly max: number, private readonly keep: number) {}

  run<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const go = () => {
        this.active++;
        let p: Promise<T>;
        try { p = job(); } catch (e) { p = Promise.reject(e); }
        p.then((v) => { this.next(); resolve(v); }, (e) => { this.next(); reject(e); });
      };
      if (this.active < this.max) { go(); return; }
      this.waiting.push({ go, drop: () => reject(new XtreamError('cancelled')) });
      while (this.waiting.length > this.keep) this.waiting.shift()!.drop();
    });
  }

  private next(): void {
    this.active--;
    const w = this.waiting.pop();
    if (w) w.go();
  }

  get size(): { active: number; waiting: number } { return { active: this.active, waiting: this.waiting.length }; }
}

export class XtreamClient implements DataSource {
  private readonly base: string;
  private readonly user: string;
  private readonly pass: string;
  private acc: Account | null = null;
  private readonly mem = new Map<string, Cached<unknown>>();
  private readonly running = new Map<string, Promise<unknown>>();
  private readonly cacheKey: string;
  private readonly guide = new Map<number, Guide>();
  private readonly guideRunning = new Map<number, Promise<Program[]>>();
  private readonly guideQueue = new Queue(3, 12);

  constructor(server: string, username: string, password: string) {
    this.base = server.replace(/\/+$/, '');
    this.user = username;
    this.pass = password;
    this.cacheKey = 'cache.' + hash(this.base + '|' + username).toString(36);
  }

  private url(params: Record<string, string | number>): string {
    let q = 'username=' + encodeURIComponent(this.user) + '&password=' + encodeURIComponent(this.pass);
    for (const k in params) q += '&' + k + '=' + encodeURIComponent(String(params[k]));
    return this.base + '/player_api.php?' + q;
  }

  /** One request per (action, parameters) at a time; a second ask while it runs gets the same answer. */
  private call(params: Record<string, string | number>, big?: boolean): Promise<unknown> {
    const key = JSON.stringify(params);
    const run = this.running.get(key);
    if (run) return run;
    const p = getJson(this.url(params), { timeout: big ? BIG_TIMEOUT : TIMEOUT }).then((json) => {
      // Some servers answer an action with the login object when the account stopped working.
      const u = N.obj(N.obj(json).user_info);
      if (Object.keys(u).length && String(u.auth) === '0') throw new XtreamError('auth');
      return json;
    });
    this.running.set(key, p);
    const clear = () => { this.running.delete(key); };
    p.then(clear, clear);
    return p;
  }

  private cached<T>(key: string, ttl: number, make: () => Promise<T>): Promise<T> {
    const hit = this.mem.get(key);
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data as T);
    return make().then((data) => { this.mem.set(key, { at: Date.now(), data }); this.trim(); return data; });
  }

  /** At most 14 lists in memory (the oldest go first); the channel list and categories stay. */
  private trim(): void {
    if (this.mem.size <= 14) return;
    const keys: string[] = [];
    this.mem.forEach((_, k) => { if (k.indexOf('cats.') !== 0 && k !== 'live.all') keys.push(k); });
    keys.sort((a, b) => this.mem.get(a)!.at - this.mem.get(b)!.at);
    while (this.mem.size > 14 && keys.length) this.mem.delete(keys.shift()!);
  }

  /** Categories kept on the TV between starts (12 h). */
  private categories(kind: 'live' | 'vod' | 'series'): Promise<Category[]> {
    const stored = load<Record<string, Cached<Category[]>>>(this.cacheKey, {});
    const hit = stored[kind];
    if (hit && Date.now() - hit.at < CAT_TTL) return Promise.resolve(hit.data.map((c) => Object.assign({}, c)));
    return this.cached('cats.' + kind, CAT_TTL, () => this.call({ action: 'get_' + kind + '_categories' }).then((json) => {
      const list = N.arr(json).map(N.category).filter((c): c is Category => !!c);
      const all = load<Record<string, Cached<Category[]>>>(this.cacheKey, {});
      all[kind] = { at: Date.now(), data: list };
      if (!save(this.cacheKey, all)) save(this.cacheKey, {});   // storage full: drop the cache, not the app
      return list;
    }));
  }

  // MARK: account

  /** Checks the account; rejects with auth / expired / disabled / parse / network / timeout... */
  login(): Promise<Account> {
    return this.call({}).then((json) => {
      const u = N.obj(N.obj(json).user_info);
      if (!Object.keys(u).length) throw new XtreamError('parse');
      if (String(u.auth) !== '1') throw new XtreamError('auth');
      const a = N.account(json, this.base);
      if (!a) throw new XtreamError('parse');
      if (a.status === 'Expired' || (a.expires && a.expires < Date.now())) throw new XtreamError('expired');
      if (a.status === 'Disabled') throw new XtreamError('disabled');
      this.acc = a;
      return a;
    });
  }

  account(): Account {
    return this.acc || { server: this.base, username: this.user, status: 'Active', expires: 0, maxConnections: 0, formats: [], demo: false };
  }

  /** Forget everything kept for this account (Settings > Clear cache). */
  clearCache(): void {
    this.mem.clear();
    this.guide.clear();
    save(this.cacheKey, {});
  }

  /**
   * Memory: what has expired goes (lists after 30 min, guides after 10), so a long evening of watching doesn't keep
   * every list and guide it ever opened. Called every few minutes and when the app goes to the background.
   */
  trimMemory(): void {
    const now = Date.now();
    this.mem.forEach((v, k) => { if (now - v.at > (k.indexOf('cats.') === 0 ? CAT_TTL : LIST_TTL)) this.mem.delete(k); });
    this.guide.forEach((v, k) => { if (now - v.at > EPG_TTL) this.guide.delete(k); });
  }

  /** For Settings' diagnostics: how much is held in memory. */
  memoryStats(): { lists: number; guides: number } { return { lists: this.mem.size, guides: this.guide.size }; }

  // MARK: live

  private allChannels(): Promise<Channel[]> {
    return this.cached('live.all', LIST_TTL, () => this.call({ action: 'get_live_streams' }, true).then((json) =>
      N.arr(json).map((r, i) => N.channel(r, i)).filter((c): c is Channel => !!c)));
  }

  liveCategories(): Promise<Category[]> {
    return Promise.all([this.categories('live'), this.allChannels()]).then(([cats, chans]) => {
      const count: Record<string, number> = {};
      for (const c of chans) count[c.category] = (count[c.category] || 0) + 1;
      const list = cats.map((c) => Object.assign({}, c, { count: count[c.id] || 0 })).filter((c) => c.count > 0);
      return [{ id: '*', name: '*', count: chans.length, icon: 'tv' } as Category].concat(list);
    });
  }

  channels(categoryId: string): Promise<Channel[]> {
    return this.allChannels().then((all) => (categoryId === '*' ? all : all.filter((c) => c.category === categoryId)));
  }

  /**
   * A channel's guide (get_short_epg, 4 programs). Kept apart from the lists (they'd push each other out): the last
   * 300 channels for 10 minutes, or until the programs it has are all over. At most 3 asked at a time, the newest
   * first, and only the last 12 waiting (a fast scroll through a list doesn't queue hundreds). No guide is no error.
   */
  epg(c: Channel): Promise<Program[]> {
    const now = Date.now(), hit = this.guide.get(c.id);
    if (hit && now - hit.at < EPG_TTL && (!hit.list.length || hit.list[hit.list.length - 1].end > now)) {
      this.guide.delete(c.id);
      this.guide.set(c.id, hit);   // most recently used last
      return Promise.resolve(hit.list.filter((p) => p.end > now));
    }
    const running = this.guideRunning.get(c.id);
    if (running) return running;
    const p = this.guideQueue.run(() => this.call({ action: 'get_short_epg', stream_id: c.id, limit: 4 }))
      .then((json) => N.programs(json, Date.now()), () => [] as Program[])
      .then((list) => {
        this.guide.delete(c.id);
        this.guide.set(c.id, { at: Date.now(), list });
        while (this.guide.size > GUIDE_MAX) this.guide.delete(this.guide.keys().next().value as number);
        return list;
      });
    this.guideRunning.set(c.id, p);
    const done = () => { this.guideRunning.delete(c.id); };
    p.then(done, done);
    return p;
  }

  // MARK: movies

  movieCategories(): Promise<Category[]> { return this.categories('vod'); }

  movies(categoryId: string): Promise<Movie[]> {
    const all = categoryId === '*';
    return this.cached('vod.' + categoryId, LIST_TTL, () => this.call(all ? { action: 'get_vod_streams' } : { action: 'get_vod_streams', category_id: categoryId }, all)
      .then((json) => N.arr(json).map(N.movie).filter((m): m is Movie => !!m)));
  }

  movieInfo(m: Movie): Promise<Movie> {
    return this.cached('vodinfo.' + m.id, LIST_TTL, () => this.call({ action: 'get_vod_info', vod_id: m.id }).then((json) => N.movieInfo(m, json)))
      .catch(() => m);   // the list's facts are enough to play it
  }

  // MARK: series

  seriesCategories(): Promise<Category[]> { return this.categories('series'); }

  series(categoryId: string): Promise<Series[]> {
    const all = categoryId === '*';
    return this.cached('series.' + categoryId, LIST_TTL, () => this.call(all ? { action: 'get_series' } : { action: 'get_series', category_id: categoryId }, all)
      .then((json) => N.arr(json).map(N.series).filter((s): s is Series => !!s)));
  }

  seriesInfo(s: Series): Promise<Season[]> {
    if (s.seasons) return Promise.resolve(s.seasons);
    return this.cached('seriesinfo.' + s.id, LIST_TTL, () => this.call({ action: 'get_series_info', series_id: s.id }).then((json) => N.seasons(s, json)))
      .then((list) => { s.seasons = list; return list; });
  }

  // MARK: streams

  /** Live: the format from Settings, or on Automatic MPEG-TS where the account allows it (else HLS). */
  liveFormat(): 'ts' | 'm3u8' {
    const pref = getSettings().format, allowed = this.acc ? this.acc.formats : [];
    if (pref === 'ts' || pref === 'm3u8') return pref;
    if (!allowed.length || allowed.indexOf('ts') >= 0) return 'ts';
    return allowed.indexOf('m3u8') >= 0 ? 'm3u8' : 'ts';
  }

  streamUrl(item: Channel | Movie | Episode): string {
    const u = encodeURIComponent(this.user), p = encodeURIComponent(this.pass);
    if (item.kind === 'live') return this.base + '/live/' + u + '/' + p + '/' + item.id + '.' + this.liveFormat();
    if (item.kind === 'movie') return this.base + '/movie/' + u + '/' + p + '/' + item.id + '.' + (item.ext || 'mp4');
    return this.base + '/series/' + u + '/' + p + '/' + item.id + '.' + (item.ext || 'mp4');
  }
}

export { XtreamError };
