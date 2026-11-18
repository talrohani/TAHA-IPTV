import { describe, expect, it } from 'vitest';
import * as N from '../src/data/xtream/normalize';
import type { Series } from '../src/data/types';

/** UTF-8 text to base64, as a server would send it. */
const enc = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(''));

describe('Xtream answers, as servers really send them', () => {
  it('reads lists sent as arrays or as objects', () => {
    expect(N.arr([1, 2])).toEqual([1, 2]);
    expect(N.arr({ a: 1, b: 2 })).toEqual([1, 2]);
    expect(N.arr(null)).toEqual([]);
    expect(N.arr('oops')).toEqual([]);
  });

  it('reads numbers sent as strings, and survives missing ones', () => {
    expect(N.num('42')).toBe(42);
    expect(N.num('7.5')).toBe(7.5);
    expect(N.num(undefined, 3)).toBe(3);
    expect(N.num('n/a')).toBe(0);
  });

  it('decodes base64 EPG text as UTF-8, and leaves plain text alone', () => {
    const ar = enc('نشرة الأخبار');
    expect(N.b64(ar)).toBe('نشرة الأخبار');
    expect(N.b64('Plain title!')).toBe('Plain title!');
    expect(N.b64('')).toBe('');
  });

  it('reads the account, and its status', () => {
    const a = N.account({ user_info: { username: 'u', auth: 1, status: 'Active', exp_date: '1800000000', max_connections: '2', allowed_output_formats: ['m3u8', 'ts'] } }, 'http://x');
    expect(a).toMatchObject({ username: 'u', status: 'Active', expires: 1800000000000, maxConnections: 2, formats: ['m3u8', 'ts'] });
    expect(N.account({ user_info: { status: 'Expired' } }, 'http://x')!.status).toBe('Expired');
    expect(N.account({}, 'http://x')).toBeNull();
    expect(N.account('<html>', 'http://x')).toBeNull();
  });

  it('skips broken entries and fills in what is missing', () => {
    expect(N.channel({ name: 'No id' }, 0)).toBeNull();
    const c = N.channel({ stream_id: '12', name: 'Arena Sports HD', stream_icon: 'not-a-url' }, 4)!;
    expect(c).toMatchObject({ id: 12, num: 5, name: 'Arena Sports HD', hd: true });
    expect(c.logo.indexOf('data:image/svg+xml')).toBe(0);   // a drawn logo, not a broken picture
    const m = N.movie({ stream_id: 5, name: 'Film 4K', rating: '7.4', container_extension: 'mkv', added: '1700000000' })!;
    expect(m).toMatchObject({ id: 5, quality: '4K', rating: 7.4, ext: 'mkv', added: 1700000000000 });
    expect(N.movie({})).toBeNull();
    expect(N.category({ category_name: 'x' })).toBeNull();
    expect(N.category({ category_id: 3, category_name: 'News' })).toEqual({ id: '3', name: 'News', count: 0 });
  });

  it('fills a film in from get_vod_info', () => {
    const m = N.movie({ stream_id: 9, name: 'Film' })!;
    const full = N.movieInfo(m, { info: { plot: 'A plot', duration_secs: 5400, genre: 'Drama, Action', backdrop_path: ['https://img/b.jpg'] }, movie_data: { container_extension: 'mp4' } });
    expect(full).toMatchObject({ plot: 'A plot', duration: 5400000, genres: ['Drama', 'Action'], backdrop: 'https://img/b.jpg' });
    expect(N.movieInfo(m, null).duration).toBe(0);
  });

  it('orders seasons and episodes, whatever order they come in', () => {
    const s = N.series({ series_id: 1, name: 'Show' }) as Series;
    const seasons = N.seasons(s, { episodes: {
      2: [{ id: '21', episode_num: 1, title: 'S2E1', container_extension: 'mkv' }],
      1: [{ id: '12', episode_num: 2, title: 'S1E2' }, { id: '11', episode_num: 1, title: 'S1E1', info: { duration_secs: 2700 } }],
    } });
    expect(seasons.map((x) => x.num)).toEqual([1, 2]);
    expect(seasons[0].episodes.map((e) => e.name)).toEqual(['S1E1', 'S1E2']);
    expect(seasons[0].episodes[0].duration).toBe(2700000);
    expect(seasons[1].episodes[0].ext).toBe('mkv');
    expect(N.seasons(s, {})).toEqual([]);
  });

  it('keeps only programs still on or to come, in order', () => {
    const now = 1700000000000, at = (m: number) => String(Math.floor(now / 1000) + m * 60);
    const list = N.programs({ epg_listings: [
      { title: enc('Later'), start_timestamp: at(60), stop_timestamp: at(120) },
      { title: enc('Over'), start_timestamp: at(-120), stop_timestamp: at(-60) },
      { title: enc('Now'), start_timestamp: at(-10), stop_timestamp: at(50) },
    ] }, now);
    expect(list.map((p) => p.title)).toEqual(['Now', 'Later']);
    expect(N.programs(null, now)).toEqual([]);
  });
});
