/**
 * Demo data for phase 1: made-up channels, films and series (no real titles, logos or posters), sized like a real
 * subscription (about 600 channels) so the long lists are tested as they'll be used. Streams are public test streams.
 */
import type { Account, Category, Channel, DataSource, Episode, Movie, Program, Season, Series } from './types';
import { logo, poster, still, hash } from '../ui/art';

const HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const DAY = 86400000;
const NOW = Date.now();

const LIVE_CATS: Array<[string, string, string, string[]]> = [
  ['general', 'القنوات العامة', 'broadcast', ['Taha One', 'Nour TV', 'Wasla', 'Sama Family', 'Bayt TV', 'Rawabi', 'Diwan', 'Majlis']],
  ['news', 'الأخبار', 'news', ['Khabar 24', 'Akhbar Now', 'Mubasher News', 'Daily Report', 'World Desk', 'Market Watch']],
  ['sports', 'الرياضة', 'ball', ['Arena Sports', 'Goal Max', 'Sport Plus', 'Stadium TV', 'Racing One', 'Fit Live', 'Padel TV']],
  ['movies', 'الأفلام', 'film', ['Cinema Hall', 'Film Club', 'Action Max', 'Classic Films', 'Drama Cine']],
  ['series', 'المسلسلات', 'serial', ['Hekayat', 'Series One', 'Drama Plus', 'Turkish Drama', 'Gulf Series']],
  ['docs', 'الوثائقية', 'leaf', ['Doc World', 'Nature Planet', 'History Lens', 'Science Box', 'Wild Earth']],
  ['kids', 'الأطفال', 'bear', ['Kids Planet', 'Toon Town', 'Little Stars', 'Baby Joy', 'Junior Lab']],
  ['religion', 'الدينية', 'mosque', ['Quran Kareem', 'Sunnah TV', 'Iqraa Light', 'Huda Channel']],
  ['music', 'الموسيقى', 'music', ['Tarab FM TV', 'Hits Arabia', 'Mawwal', 'Oud Classic']],
];

const PROGRAMS: Record<string, string[]> = {
  general: ['صباح الخير', 'برنامج المساء', 'حكايات من الحياة', 'مسابقة الأسرة', 'سهرة خاصة'],
  news: ['نشرة الأخبار', 'حصاد اليوم', 'تقرير اقتصادي', 'لقاء خاص', 'موجز الأخبار'],
  sports: ['الدوري المحلي: الصقور × النسور', 'الاستوديو التحليلي', 'أهداف الأسبوع', 'كأس الأبطال: النجوم × الفرسان', 'ملخص المباريات'],
  movies: ['فيلم السهرة', 'كلاسيكيات السينما', 'عرض أول', 'فيلم الأكشن'],
  series: ['الحلقة الجديدة', 'إعادة الحلقة', 'مسلسل العائلة', 'دراما المساء'],
  docs: ['عالم البحار', 'أسرار الصحراء', 'حضارات قديمة', 'رحلة إلى الفضاء'],
  kids: ['مغامرات الأصدقاء', 'عالم الألوان', 'حكايات قبل النوم', 'ألغاز صغيرة'],
  religion: ['تلاوة مباركة', 'درس العصر', 'قصص الأنبياء', 'برنامج الفتاوى'],
  music: ['أغاني الطرب', 'أمسية موسيقية', 'أحدث الأغاني', 'حفل مباشر'],
};

const MOVIE_TITLES = ['رمال الذهب', 'المدار الأخير', 'قلعة الصمت', 'Deep Blue Run', 'ليالي المدينة', 'Iron Valley', 'الطريق إلى الجنوب',
  'Neon Harbor', 'سر المنارة', 'The Quiet Orbit', 'حارس النهر', 'Last Signal', 'جسر الأحلام', 'Red Canyon', 'صوت البحر',
  'Glass Kingdom', 'مدينة الضباب', 'Silver Line', 'رحلة الصقر', 'Northern Lights', 'بيت على التل', 'Zero Hour', 'قمر الشتاء',
  'Storm Chaser', 'أمواج عالية', 'The Long Night', 'سفينة الصحراء', 'Hidden Garden', 'الفارس الأخير', 'Paper Planes',
  'ظل الجبل', 'Copper Sun', 'خريطة الكنز', 'Midnight Express', 'نجمة الفجر', 'Blue Horizon'];
const SERIES_TITLES = ['حراس الصحراء', 'ليالي الحي القديم', 'The Northern Line', 'بيت العائلة', 'أسرار القصر', 'Harbor Lights',
  'دروب الأمل', 'Signal Lost', 'المدينة الخفية', 'Crown of Sand', 'رحلة العمر', 'Second Chance', 'قلوب شجاعة', 'The Archive',
  'زمن الفرسان', 'Night Shift', 'ممر الذكريات', 'Blue Station'];
const MOVIE_GENRES: Array<[string, string, string]> = [
  ['action', 'أكشن', 'target'], ['drama', 'دراما', 'masks'], ['comedy', 'كوميديا', 'smile'], ['adventure', 'مغامرة', 'mountain'],
  ['horror', 'رعب', 'ghost'], ['animation', 'رسوم متحركة', 'cat'], ['family', 'عائلي', 'users'], ['docs', 'وثائقي', 'leaf'],
];
const PLOTS = [
  'في رحلة محفوفة بالمخاطر، يكتشف فريق صغير سرًا قديمًا قد يغير مصير مدينتهم إلى الأبد.',
  'بعد سنوات من الغياب، يعود بطلنا إلى بلدته ليواجه ماضيه ويحمي من يحب.',
  'قصة عائلة تتحدى الظروف الصعبة بالحب والصبر والإصرار على الحلم.',
  'سباق مع الزمن لإنقاذ آخر إشارة قادمة من الفضاء قبل أن تختفي.',
  'مغامرة مليئة بالمفاجآت بين البحر والصحراء بحثًا عن كنز مفقود.',
];
const NAMES = ['سامي حداد', 'ليلى منصور', 'Omar Haddad', 'نادين صالح', 'Karim Aziz', 'هند يوسف', 'Yara Nasser', 'طارق عادل'];

function pick<T>(list: T[], n: number): T { return list[n % list.length]; }

// MARK: - Live

const categories: Category[] = [];
const channels: Channel[] = [];
let num = 1;
for (const [id, name, ic, brands] of LIVE_CATS) {
  const count = id === 'sports' ? 86 : id === 'news' ? 28 : id === 'general' ? 42 : id === 'movies' ? 72 : id === 'series' ? 66 : id === 'docs' ? 35 : id === 'kids' ? 28 : id === 'religion' ? 24 : 18;
  for (let i = 0; i < count; i++) {
    const brand = brands[i % brands.length], n = Math.floor(i / brands.length) + 1;
    const nm = brand + (n > 1 || id === 'sports' ? ' ' + n : '') + (i % 3 !== 2 ? ' HD' : '');
    const short = brand.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase() + (n > 1 || id === 'sports' ? n : '');
    const seed = hash(brand);
    // Artwork is drawn the first time it's shown, not at start.
    channels.push({ kind: 'live', id: 10000 + num, num, name: nm, get logo() { return logo(short, seed); }, category: id, hd: i % 3 !== 2 });
    num++;
  }
  categories.push({ id, name, count, icon: ic });
}

function programsFor(c: Channel): Program[] {
  const list = PROGRAMS[c.category] || PROGRAMS.general, h = hash(c.name);
  const slot = 90 * 60000, start = NOW - (NOW % slot) - ((h % 3) * 15 * 60000);
  const out: Program[] = [];
  for (let i = 0; i < 4; i++) {
    out.push({ title: pick(list, h + i), desc: 'برنامج من ' + c.name + '، يعرض الآن مباشرة.', start: start + i * slot, end: start + (i + 1) * slot });
  }
  return out;
}

// MARK: - Movies and series

const movieCats: Category[] = MOVIE_GENRES.map(([id, name, ic]) => ({ id, name, count: 0, icon: ic }));
const movies: Movie[] = [];
for (let i = 0; i < 180; i++) {
  const base = MOVIE_TITLES[i % MOVIE_TITLES.length], part = Math.floor(i / MOVIE_TITLES.length);
  const name = base + (part ? ' ' + (part + 1) : ''), h = hash(name), g = MOVIE_GENRES[(h + i) % MOVIE_GENRES.length];
  movies.push({
    kind: 'movie', id: 20000 + i, name, get poster() { return poster(name, h); }, get backdrop() { return still(name, h); }, category: g[0],
    genres: [g[1], MOVIE_GENRES[(h + 3) % MOVIE_GENRES.length][1]], year: 2015 + (h % 11), rating: 5.5 + (h % 40) / 10,
    duration: (85 + (h % 70)) * 60000, quality: h % 3 === 0 ? '4K' : 'HD', added: NOW - i * DAY * 0.7,
    plot: pick(PLOTS, h), cast: [pick(NAMES, h), pick(NAMES, h + 3), pick(NAMES, h + 5)], director: pick(NAMES, h + 1), ext: 'mp4',
  });
}
for (const c of movieCats) c.count = movies.filter((m) => m.category === c.id).length;

const seriesCats: Category[] = MOVIE_GENRES.slice(0, 7).map(([id, name, ic]) => ({ id, name, count: 0, icon: ic }));
const seriesList: Series[] = [];
for (let i = 0; i < 72; i++) {
  const base = SERIES_TITLES[i % SERIES_TITLES.length], part = Math.floor(i / SERIES_TITLES.length);
  const name = base + (part ? ' ' + (part + 1) : ''), h = hash(name), g = MOVIE_GENRES[(h + i) % 7];
  seriesList.push({
    kind: 'series', id: 30000 + i, name, get poster() { return poster(name, h); }, get backdrop() { return still(name, h); }, category: g[0],
    genres: [g[1]], year: 2016 + (h % 10), rating: 6 + (h % 35) / 10, quality: h % 4 === 0 ? '4K' : 'HD',
    added: NOW - i * DAY * 1.3, plot: pick(PLOTS, h + 2), cast: [pick(NAMES, h), pick(NAMES, h + 2)],
  });
}
for (const c of seriesCats) c.count = seriesList.filter((s) => s.category === c.id).length;

function seasonsFor(s: Series): Season[] {
  const n = 1 + (s.id % 4), out: Season[] = [];
  for (let k = 1; k <= n; k++) {
    const eps: Episode[] = [];
    const count = 8 + ((s.id + k) % 7);
    for (let e = 1; e <= count; e++) {
      const stillKey = s.name + k + e;
      eps.push({ kind: 'episode', id: s.id * 1000 + k * 100 + e, seriesId: s.id, season: k, num: e, name: 'الحلقة ' + e,
        get still() { return still(stillKey); }, duration: (38 + ((s.id + e) % 20)) * 60000, plot: pick(PLOTS, s.id + e), ext: 'mp4' });
    }
    out.push({ num: k, episodes: eps });
  }
  return out;
}

function later<T>(value: T, ms?: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms === undefined ? 120 : ms));
}

export const mockSource: DataSource = {
  account(): Account {
    return { server: 'demo.taha-iptv.local', username: 'demo', status: 'Active', expires: Date.UTC(2027, 2, 15),
      maxConnections: 2, formats: ['m3u8', 'ts'], demo: true };
  },
  liveCategories: () => later([{ id: '*', name: 'الكل', count: channels.length, icon: 'tv' } as Category].concat(categories)),
  channels: (cat) => later(cat === '*' ? channels : channels.filter((c) => c.category === cat)),
  epg: (c) => later(c.id % 9 === 0 ? [] : programsFor(c), 180),
  movieCategories: () => later(movieCats),
  movies: (cat) => later(cat === '*' ? movies : movies.filter((m) => m.category === cat)),
  seriesCategories: () => later(seriesCats),
  series: (cat) => later(cat === '*' ? seriesList : seriesList.filter((s) => s.category === cat)),
  seriesInfo: (s) => later(s.seasons || (s.seasons = seasonsFor(s)), 160),
  streamUrl: () => HLS,
};

/** Synchronous lookups for the demo's home screen rows. */
export const demo = { movies, seriesList, channels };
