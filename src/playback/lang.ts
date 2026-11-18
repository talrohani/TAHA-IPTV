/** Track languages: streams name them in ISO 639-1 or -2 (ar, ara, eng...), or not at all (und, empty). */

const NAMES: Record<string, string> = {
  fr: 'Français', fre: 'Français', fra: 'Français', es: 'Español', spa: 'Español', de: 'Deutsch', ger: 'Deutsch',
  deu: 'Deutsch', tr: 'Türkçe', tur: 'Türkçe', it: 'Italiano', ita: 'Italiano', pt: 'Português', por: 'Português',
  ru: 'Русский', rus: 'Русский', hi: 'हिन्दी', hin: 'हिन्दी', ur: 'اردو', urd: 'اردو', fa: 'فارسی', per: 'فارسی',
  fas: 'فارسی', ku: 'Kurdî', kur: 'Kurdî', nl: 'Nederlands', dut: 'Nederlands', nld: 'Nederlands',
};

export function isLang(code: string, want: 'ar' | 'en'): boolean {
  const c = (code || '').toLowerCase();
  return want === 'ar' ? c === 'ar' || c === 'ara' || c === 'arb' || c.indexOf('ar-') === 0
    : c === 'en' || c === 'eng' || c.indexOf('en-') === 0;
}

/** 'ar' / 'en' (the app's own words for them), another language's own name, its code, or null when unknown. */
export function langName(code: string): 'ar' | 'en' | string | null {
  if (isLang(code, 'ar')) return 'ar';
  if (isLang(code, 'en')) return 'en';
  const c = (code || '').toLowerCase();
  if (NAMES[c]) return NAMES[c];
  return c && c !== 'und' && c !== 'unknown' ? c.toUpperCase() : null;
}
