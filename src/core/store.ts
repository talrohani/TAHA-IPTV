/**
 * What the app keeps on the TV: preferences, favorites, history and resume points. localStorage is the app's own
 * private storage on Tizen (no other app can read it). Every read and write survives a full or missing storage.
 */
const PREFIX = 'taha.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* nothing to remove */ }
}

export interface Settings {
  lang: 'ar' | 'en';
  theme: 'navy' | 'midnight' | 'violet';
  fontScale: 100 | 110 | 120;
  posterSize: 'small' | 'medium' | 'large';
  animations: 'on' | 'reduced' | 'off';
  format: 'auto' | 'ts' | 'm3u8';
  buffer: 'auto' | 'low' | 'high';
  autoResume: boolean;
  audioLang: 'auto' | 'ar' | 'en';
  subtitles: 'off' | 'ar' | 'en';
  subtitleSize: 'small' | 'medium' | 'large';
}

export const DEFAULTS: Settings = {
  lang: 'ar', theme: 'navy', fontScale: 100, posterSize: 'medium', animations: 'on', format: 'auto', buffer: 'auto',
  autoResume: true, audioLang: 'auto', subtitles: 'off', subtitleSize: 'medium',
};

let settings: Settings = Object.assign({}, DEFAULTS, load<Partial<Settings>>('settings', {}));
const listeners: Array<(s: Settings) => void> = [];

export function getSettings(): Settings { return settings; }

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings = Object.assign({}, settings, { [key]: value });
  save('settings', settings);
  for (const fn of listeners) fn(settings);
}

export function onSettings(fn: (s: Settings) => void): void { listeners.push(fn); }

export function resetSettings(): void {
  settings = Object.assign({}, DEFAULTS);
  save('settings', settings);
  for (const fn of listeners) fn(settings);
}
