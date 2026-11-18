/** Arabic first (right to left), English as the option. Keys are short names; {x} are filled in. */
import { getSettings } from './store';

const AR = {
  appName: 'Taha IPTV', appSub: 'IPTV Player',
  home: 'الرئيسية', live: 'البث المباشر', liveChannels: 'القنوات المباشرة', channels: 'القنوات', movies: 'الأفلام',
  series: 'المسلسلات', library: 'المكتبة', librarySub: 'الأفلام والمسلسلات حسب التصنيف', favorites: 'المفضلة',
  history: 'سجل المشاهدة', settings: 'الإعدادات', search: 'بحث', account: 'الحساب',
  continueWatching: 'متابعة المشاهدة', recentlyWatched: 'شوهد مؤخرًا', latestMovies: 'أحدث الأفلام',
  latestSeries: 'أحدث المسلسلات', latestAdded: 'أحدث الإضافات', topRated: 'الأعلى تقييمًا',
  categories: 'التصنيفات', all: 'الكل', channelsCount: 'القنوات ({n})', live2: 'مباشر', now: 'الآن', next: 'التالي',
  noEpg: 'لا يوجد دليل برامج لهذه القناة',
  hintCategory: 'تغيير التصنيف', hintChannel: 'تغيير القناة', hintPlayFull: 'تشغيل / شاشة كاملة',
  addFavorite: 'إضافة للمفضلة', removeFavorite: 'إزالة من المفضلة', back: 'رجوع', navigate: 'تنقل', play: 'تشغيل',
  options: 'قائمة الخيارات', showHide: 'إظهار / إخفاء التحكم', seek: 'التقديم / التأخير', subtitles: 'الترجمة',
  audio: 'الصوت', quality: 'جودة الفيديو', episodes: 'الحلقات', info: 'معلومات', minus30: '‎-30 ثانية', plus30: '‎+30 ثانية',
  loading: 'جاري التحميل...', remaining: 'متبقي {t}', episodeN: 'الحلقة {n}', seasonN: 'الموسم {n}',
  seasonEpisode: 'الموسم {s} - الحلقة {e}', connected: 'متصل', subEnds: 'انتهاء الاشتراك', resume: 'استئناف',
  fromStart: 'من البداية', watchNow: 'شاهد الآن', trailer: 'المقطع الدعائي', cast: 'طاقم العمل', director: 'إخراج',
  minutes: '{n} دقيقة', watched: 'تمت المشاهدة', sort: 'الترتيب', sortNewest: 'الأحدث', sortRating: 'الأعلى تقييمًا',
  sortName: 'الاسم', sortYear: 'سنة الإصدار', items: '{n} عنصر', noResults: 'لا توجد نتائج', searchHint: 'اكتب اسم قناة أو فيلم أو مسلسل',
  login: 'تسجيل الدخول', loginSub: 'أدخل بيانات اشتراك Xtream Codes', server: 'عنوان الخادم', username: 'اسم المستخدم',
  password: 'كلمة المرور', connect: 'اتصال', testConnection: 'اختبار الاتصال', remember: 'تذكر الحساب',
  savedAccounts: 'الحسابات المحفوظة', edit: 'تعديل', removeAcc: 'حذف', useDemo: 'استخدام الحساب التجريبي',
  testing: 'جارٍ اختبار الاتصال...', testOk: 'الاتصال ناجح · الاشتراك نشط حتى {d}', connecting: 'جارٍ الاتصال...',
  errMissing: 'املأ الحقول الثلاثة', errUrl: 'عنوان الخادم يجب أن يبدأ بـ http:// أو https://',
  playback: 'التشغيل', appearance: 'المظهر', application: 'التطبيق',
  format: 'صيغة البث المفضلة', buffer: 'التخزين المؤقت', autoResume: 'الاستئناف التلقائي', audioLang: 'لغة الصوت الافتراضية',
  subtitlePref: 'الترجمة الافتراضية', subtitleSize: 'حجم الترجمة', language: 'اللغة', theme: 'السمة',
  fontScale: 'حجم الخط', posterSize: 'حجم الملصقات', animations: 'الحركات', subscription: 'الاشتراك',
  expires: 'تاريخ الانتهاء', status: 'الحالة', connection: 'حالة الاتصال', changeAccount: 'تغيير الحساب',
  clearCache: 'مسح الذاكرة المؤقتة', resetFavorites: 'إعادة تعيين المفضلة', resetHistory: 'مسح سجل المشاهدة',
  diagnostics: 'التشخيص', auto: 'تلقائي', on: 'تشغيل', off: 'إيقاف', reduced: 'مخففة', low: 'منخفض', high: 'مرتفع',
  small: 'صغير', medium: 'متوسط', large: 'كبير', arabic: 'العربية', english: 'English', navy: 'كحلي', midnight: 'منتصف الليل',
  violet: 'بنفسجي', active: 'نشط', done: 'تم', confirmAgain: 'اضغط OK مرة أخرى للتأكيد', exitTitle: 'الخروج من Taha IPTV؟',
  exit: 'خروج', cancel: 'إلغاء', engine: 'المشغل', resolution: 'الدقة', network: 'الشبكة', online: 'متصل', offline: 'غير متصل',
  memory: 'الذاكرة', version: 'الإصدار', platform: 'النظام', trackOff: 'إيقاف', trackAr: 'العربية', trackEn: 'English',
  previous: 'السابق', nextEp: 'التالي', demoNote: 'وضع المعاينة: بيانات تجريبية', noSeek: 'لا يمكن التقديم في هذا البث',
  seeking: 'جارٍ الانتقال...', chooseTrack: 'اختر', episodesOf: 'حلقات {s}', moreInfo: 'تفاصيل', genre: 'التصنيف',
  rating: 'التقييم', year: 'السنة', duration: 'المدة', added: 'أضيف', removeFromHistory: 'إزالة من السجل',
  emptyFav: 'لا توجد عناصر في المفضلة بعد', emptyHistory: 'لم تشاهد شيئًا بعد', channelsTab: 'القنوات', pressOk: 'اضغط OK',
  speed: 'السرعة', aspect: 'أبعاد الصورة', normal: 'عادي', fill: 'ملء الشاشة',
};

type Dict = typeof AR;
export type TextKey = keyof Dict;

const EN: Dict = {
  appName: 'Taha IPTV', appSub: 'IPTV Player',
  home: 'Home', live: 'Live TV', liveChannels: 'Live channels', channels: 'Channels', movies: 'Movies', series: 'Series',
  library: 'Library', librarySub: 'Movies and series by category', favorites: 'Favorites', history: 'Watch history',
  settings: 'Settings', search: 'Search', account: 'Account', continueWatching: 'Continue watching',
  recentlyWatched: 'Recently watched', latestMovies: 'Latest movies', latestSeries: 'Latest series', latestAdded: 'Recently added',
  topRated: 'Top rated', categories: 'Categories', all: 'All', channelsCount: 'Channels ({n})', live2: 'LIVE', now: 'Now', next: 'Next',
  noEpg: 'No program guide for this channel', hintCategory: 'Category', hintChannel: 'Channel', hintPlayFull: 'Play / full screen',
  addFavorite: 'Add to favorites', removeFavorite: 'Remove from favorites', back: 'Back', navigate: 'Navigate', play: 'Play',
  options: 'Options', showHide: 'Show / hide controls', seek: 'Seek', subtitles: 'Subtitles', audio: 'Audio', quality: 'Video quality',
  episodes: 'Episodes', info: 'Info', minus30: '-30 s', plus30: '+30 s', loading: 'Loading...', remaining: '{t} left',
  episodeN: 'Episode {n}', seasonN: 'Season {n}', seasonEpisode: 'Season {s} · Episode {e}', connected: 'Connected',
  subEnds: 'Subscription ends', resume: 'Resume', fromStart: 'From the start', watchNow: 'Watch now', trailer: 'Trailer',
  cast: 'Cast', director: 'Director', minutes: '{n} min', watched: 'Watched', sort: 'Sort', sortNewest: 'Newest',
  sortRating: 'Top rated', sortName: 'Name', sortYear: 'Year', items: '{n} items', noResults: 'No results',
  searchHint: 'Type a channel, movie or series name', login: 'Sign in', loginSub: 'Enter your Xtream Codes subscription',
  server: 'Server address', username: 'Username', password: 'Password', connect: 'Connect', testConnection: 'Test connection',
  remember: 'Remember account', savedAccounts: 'Saved accounts', edit: 'Edit', removeAcc: 'Remove', useDemo: 'Use the demo account',
  testing: 'Testing the connection...', testOk: 'Connected · subscription active until {d}', connecting: 'Connecting...',
  errMissing: 'Fill in all three fields', errUrl: 'The server address must start with http:// or https://',
  playback: 'Playback', appearance: 'Appearance', application: 'Application', format: 'Preferred stream format',
  buffer: 'Buffering', autoResume: 'Auto-resume', audioLang: 'Default audio', subtitlePref: 'Default subtitles',
  subtitleSize: 'Subtitle size', language: 'Language', theme: 'Theme', fontScale: 'Font size', posterSize: 'Poster size',
  animations: 'Animations', subscription: 'Subscription', expires: 'Expires', status: 'Status', connection: 'Connection',
  changeAccount: 'Change account', clearCache: 'Clear cache', resetFavorites: 'Reset favorites', resetHistory: 'Clear watch history',
  diagnostics: 'Diagnostics', auto: 'Automatic', on: 'On', off: 'Off', reduced: 'Reduced', low: 'Low', high: 'High',
  small: 'Small', medium: 'Medium', large: 'Large', arabic: 'العربية', english: 'English', navy: 'Navy', midnight: 'Midnight',
  violet: 'Violet', active: 'Active', done: 'Done', confirmAgain: 'Press OK again to confirm', exitTitle: 'Leave Taha IPTV?',
  exit: 'Exit', cancel: 'Cancel', engine: 'Player', resolution: 'Resolution', network: 'Network', online: 'Online', offline: 'Offline',
  memory: 'Memory', version: 'Version', platform: 'Platform', trackOff: 'Off', trackAr: 'العربية', trackEn: 'English',
  previous: 'Previous', nextEp: 'Next', demoNote: 'Preview mode: demo data', noSeek: "This stream can't be sought",
  seeking: 'Seeking...', chooseTrack: 'Choose', episodesOf: '{s} episodes', moreInfo: 'Details', genre: 'Genre',
  rating: 'Rating', year: 'Year', duration: 'Duration', added: 'Added', removeFromHistory: 'Remove from history',
  emptyFav: 'No favorites yet', emptyHistory: 'Nothing watched yet', channelsTab: 'Channels', pressOk: 'Press OK',
  speed: 'Speed', aspect: 'Picture', normal: 'Normal', fill: 'Fill screen',
};

const ERRORS: Record<string, [string, string]> = {
  unsupported: ['لا يدعم هذا التلفزيون صيغة هذا البث', "This TV can't play this stream's format"],
  network: ['تعذّر الوصول إلى البث. تحقق من الاتصال', "Can't reach the stream. Check the connection"],
  timeout: ['استغرق البث وقتًا طويلًا للبدء', 'The stream took too long to start'],
  stream: ['تعذّر تشغيل هذا البث', "This stream couldn't be played"],
};

/** A player error, as the screen says it (never with the stream's address). */
export function errorText(code?: string): string {
  const e = ERRORS[code || 'stream'] || ERRORS.stream;
  return lang() === 'ar' ? e[0] : e[1];
}

export function lang(): 'ar' | 'en' { return getSettings().lang; }
export function rtl(): boolean { return lang() === 'ar'; }

export function t(key: TextKey, vars?: Record<string, string | number>): string {
  let s: string = (lang() === 'ar' ? AR : EN)[key] || EN[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', String(vars[k]));
  return s;
}

/** html lang and dir follow the language: the whole layout mirrors with `dir`. */
export function applyDirection(): void {
  document.documentElement.lang = lang();
  document.documentElement.dir = rtl() ? 'rtl' : 'ltr';
}
