import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from '../src/data/library';
import { fold, matching, newest, sortedBy, topBy } from '../src/data/lists';
import { Queue } from '../src/data/xtream/client';
import type { Channel, Episode, Movie, Series } from '../src/data/types';

/** localStorage as the TV has it, with a size limit to test a full storage. */
class Storage {
  data: Record<string, string> = {};
  limit = Infinity;
  writes = 0;
  getItem(k: string) { return k in this.data ? this.data[k] : null; }
  setItem(k: string, v: string) {
    const size = Object.keys(this.data).reduce((n, x) => n + (x === k ? 0 : this.data[x].length), 0) + v.length;
    if (size > this.limit) throw new Error('QuotaExceededError');
    this.data[k] = v;
    this.writes++;
  }
  removeItem(k: string) { delete this.data[k]; }
}
let store: Storage;
let n = 0;
const fresh = () => { L.useLibrary('t' + (++n)); return 't' + n; };
const read = (name: string, acc: string) => JSON.parse(store.getItem('taha.' + name + '.' + acc) || 'null');

const movie = (id: number, extra?: Partial<Movie>): Movie => Object.assign({
  kind: 'movie', id, name: 'Film ' + id, poster: 'https://p/' + id + '.jpg', backdrop: 'data:image/svg+xml,AAAA', category: '1',
  genres: ['Drama'], year: 2020, rating: 7, duration: 0, quality: 'HD', added: id, plot: 'long plot', cast: ['A'], director: 'D', ext: 'mkv',
} as Movie, extra || {});
const channel = (id: number): Channel => ({ kind: 'live', id, num: id, name: 'Channel ' + id, logo: 'data:image/svg+xml,LOGO', category: '1' });
const series = (id: number): Series => ({ kind: 'series', id, name: 'Show ' + id, poster: '', backdrop: '', category: '2', genres: [], year: 2021, rating: 8,
  quality: 'HD', added: 0, plot: 'p', cast: [] });
const episode = (id: number, seriesId: number, num: number): Episode => ({ kind: 'episode', id, seriesId, season: 1, num, name: 'E' + num,
  still: 'https://s/' + id, duration: 0, plot: 'p', ext: 'mp4' });

beforeEach(() => {
  store = new Storage();
  (globalThis as unknown as { localStorage: Storage }).localStorage = store;
  vi.useFakeTimers();
});
afterEach(() => { L.flush(); vi.useRealTimers(); });

describe('saved data (library v2)', () => {
  it("keeps film resume points while you flip through 200 channels", () => {
    fresh();
    L.record(movie(1), 30 * 60000, 90 * 60000);
    for (let i = 0; i < 200; i++) L.record(channel(i), 0, 0);
    expect(L.progress('movie', 1)).toMatchObject({ pos: 30 * 60000, dur: 90 * 60000, done: false });
    const h = L.recent();
    expect(h.filter((e) => e.kind === 'live').length).toBe(40);
    expect(h.some((e) => e.kind === 'movie' && e.id === 1)).toBe(true);
    expect(L.continueWatching().map((e) => e.id)).toEqual([1]);
  });

  it('gathers writes for a second, and writes at once on flush', () => {
    const acc = fresh();
    const before = store.writes;
    L.record(channel(1), 0, 0); L.record(channel(2), 0, 0); L.record(channel(3), 0, 0);
    expect(store.writes).toBe(before);
    vi.advanceTimersByTime(1100);
    expect(read('history', acc).map((e: { id: number }) => e.id)).toEqual([3, 2, 1]);
    L.record(channel(4), 0, 0);
    L.flush();
    expect(read('history', acc)[0].id).toBe(4);
  });

  it('a start from 0 keeps the point it had; watching to the end marks it done', () => {
    fresh();
    L.record(movie(5), 40 * 60000, 100 * 60000);
    L.record(movie(5), 0, 0);                         // opened again "from the start": not erased yet
    expect(L.progress('movie', 5)!.pos).toBe(40 * 60000);
    expect(L.partWay(L.progress('movie', 5))).toBe(true);
    L.markDone(movie(5), 100 * 60000);
    expect(L.progress('movie', 5)).toMatchObject({ done: true });
    expect(L.partWay(L.progress('movie', 5))).toBe(false);
    expect(L.continueWatching()).toEqual([]);
    L.record(movie(5), 3 * 60000, 100 * 60000);       // watched again later: part-way once more
    expect(L.progress('movie', 5)!.done).toBe(false);
  });

  it("doesn't call an episode watched when the provider listed no length", () => {
    fresh();
    L.record(episode(11, 7, 1), 5 * 60000, 0);         // length unknown
    expect(L.progress('episode', 11)!.done).toBe(false);
    L.record(episode(11, 7, 1), 5 * 60000, 45 * 60000);
    expect(L.progress('episode', 11)!.done).toBe(false);
    L.record(episode(11, 7, 1), 44 * 60000, 45 * 60000); // its last 2 minutes (credits)
    expect(L.progress('episode', 11)!.done).toBe(true);
  });

  it('shows one episode per series in Continue Watching, the latest', () => {
    fresh();
    const s = series(7);
    L.record(episode(21, 7, 1), 10 * 60000, 45 * 60000, s);
    vi.advanceTimersByTime(10);
    L.record(episode(22, 7, 2), 20 * 60000, 45 * 60000, s);
    vi.advanceTimersByTime(10);
    L.record(movie(3), 30000, 90 * 60000);              // the first minute: not "part-way"
    const cw = L.continueWatching();
    expect(cw.map((e) => e.id)).toEqual([22]);
    expect(cw[0]).toMatchObject({ seriesName: 'Show 7', season: 1, ep: 2 });
    expect(cw[0].series!.id).toBe(7);
  });

  it('keeps a small copy of the item: no plot, cast or drawn pictures; restore draws them again', () => {
    fresh();
    L.toggleFavorite(movie(9));
    const f = L.favorites()[0];
    const copy = f.item as Movie;
    expect(copy).toMatchObject({ id: 9, poster: 'https://p/9.jpg', backdrop: '', plot: '', cast: [], director: '', ext: 'mkv', category: '1' });
    const back = L.restore(copy);
    expect(back.backdrop.indexOf('data:image/svg+xml')).toBe(0);
    expect(back.poster).toBe('https://p/9.jpg');
    L.record(channel(3), 0, 0);
    const e = L.recent('live')[0];
    expect((e.item as Channel).logo).toBe('');              // not stored...
    expect(e.image.indexOf('data:image/svg+xml')).toBe(0);  // ...drawn when read
  });

  it('newest favorites first; removing one from history removes its resume point', () => {
    fresh();
    L.toggleFavorite(channel(1)); vi.advanceTimersByTime(5);
    L.toggleFavorite(channel(2));
    expect(L.favorites().map((f) => f.id)).toEqual([2, 1]);
    L.removeFavorite('live', 2);
    expect(L.isFavorite('live', 2)).toBe(false);
    L.record(movie(4), 20 * 60000, 90 * 60000);
    L.removeFromHistory('movie', 4);
    expect(L.progress('movie', 4)).toBeNull();
  });

  it('drops data that does not read back as expected, store by store', () => {
    const acc = 'broken';
    store.data['taha.history.' + acc] = '{"not":"a list"}';
    store.data['taha.favorites.' + acc] = JSON.stringify({ a: { kind: 'live', id: 1, name: 'ok', image: '' }, b: { kind: 'nope', id: 2 }, c: 5 });
    store.data['taha.resume.' + acc] = 'not json at all';
    store.data['taha.lib.v.' + acc] = '2';
    L.useLibrary(acc);
    expect(L.recent()).toEqual([]);
    expect(L.favorites().map((f) => f.id)).toEqual([1]);
    expect(L.progress('movie', 1)).toBeNull();
  });

  it('carries v1 data over: resume points out of the history, drawn pictures dropped', () => {
    const acc = 'old';
    store.data['taha.history.' + acc] = JSON.stringify([
      { kind: 'movie', id: 1, name: 'F', image: 'data:image/svg+xml,BIG', at: 5, pos: 1200000, dur: 5400000 },
      { kind: 'live', id: 2, name: 'C', image: 'https://logo', at: 4, pos: 0, dur: 0 },
    ]);
    L.useLibrary(acc);
    expect(L.progress('movie', 1)).toMatchObject({ pos: 1200000, dur: 5400000, done: false });
    expect(read('history', acc)[0].image).toBe('');
    expect(read('lib.v', acc)).toBe(2);
    expect(L.continueWatching().map((e) => e.id)).toEqual([1]);
  });

  it('survives a full storage: the oldest history goes, the newest stays', () => {
    const acc = fresh();
    for (let i = 0; i < 150; i++) L.record(movie(1000 + i, { name: 'A long film name to fill the storage ' + i }), 5 * 60000, 90 * 60000);
    L.flush();
    const size = Object.keys(store.data).reduce((s, k) => s + store.data[k].length, 0);
    store.limit = Math.floor(size * 0.8);
    L.record(movie(1), 10 * 60000, 90 * 60000);
    expect(() => L.flush()).not.toThrow();
    const h = read('history', acc);
    expect(h.length).toBeLessThan(150);
    expect(h[0].id).toBe(1);
  });
});

describe('big lists', () => {
  const films = Array.from({ length: 5000 }, (_, i) => movie(i, { added: (i * 7919) % 5000, rating: (i * 31) % 10, year: 1990 + (i % 30),
    name: i % 2 ? 'أخبار ' + i : 'News ' + i }));

  it('picks the newest without sorting the whole list, and the same answer each time', () => {
    const top = newest(films, 5);
    expect(top.map((m) => m.added)).toEqual([4999, 4998, 4997, 4996, 4995]);
    expect(newest(films, 5)).toBe(top);          // worked on once per list
    expect(topBy(films, 3, 'rating').every((m) => m.rating === 9)).toBe(true);
  });

  it('sorts once per list and order', () => {
    const a = sortedBy(films, 'year');
    expect(a[0].year).toBe(2019);
    expect(sortedBy(films, 'year')).toBe(a);
    // By name: Arabic first (the app's language), numbers in their natural order (3 before 11)
    const byName = sortedBy(films, 'name').map((m) => m.name);
    expect(byName.slice(0, 3)).toEqual(['أخبار 1', 'أخبار 3', 'أخبار 5']);
    expect(byName.indexOf('News 2')).toBeLessThan(byName.indexOf('News 10'));
  });

  it('finds Arabic names whatever the alef or taa marbuta, and stops at the limit', () => {
    expect(fold('أخبارٌ')).toBe('اخبار');
    expect(fold('مدرسة')).toBe('مدرسه');
    expect(matching(films, 'اخبار', 30).length).toBe(30);
    expect(matching(films, 'news 4999', 30)).toEqual([]);   // 4999 is odd: an Arabic name
    expect(matching(films, 'NEWS 4998', 30).map((m) => m.id)).toEqual([4998]);
    expect(matching(films, '   ', 30)).toEqual([]);
  });
});

describe('guide request queue', () => {
  it('runs 3 at a time, the newest waiting first, and drops the oldest past 12', async () => {
    vi.useRealTimers();
    const q = new Queue(3, 12);
    const started: number[] = [], release: Array<() => void> = [], outcome: Record<number, string> = {};
    for (let i = 0; i < 20; i++) {
      q.run(() => new Promise<void>((res) => { started.push(i); release.push(res); }))
        .then(() => { outcome[i] = 'done'; }, () => { outcome[i] = 'dropped'; });
    }
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    expect(q.size).toEqual({ active: 3, waiting: 12 });
    await new Promise((r) => setTimeout(r, 0));
    expect(Object.keys(outcome).filter((k) => outcome[+k] === 'dropped').map(Number)).toEqual([3, 4, 5, 6, 7]);
    release[0]();
    await new Promise((r) => setTimeout(r, 0));
    expect(started[3]).toBe(19);                 // the newest waiting
  });
});
