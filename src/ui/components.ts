/** Pieces the screens are built from, matching the reference designs. */
import { h, iconify, lazyImg, onKey, onOk } from './helpers';
import { icon, iconEl, IconName } from './icons';
import { t, TextKey, failText } from '../core/i18n';
import { clock, hms } from '../core/dom';
import { open, openDialog, closeDialog, topName } from '../core/router';
import { focus, focused, focusables } from '../core/focus';
import { app } from '../app';
import type { Entry } from '../data/library';
import type { Movie, Series } from '../data/types';

export { h, iconify };

// MARK: - Navigation: the side menu (Home, Library) and the top tabs (Live TV)

const NAV: Array<[string, TextKey, IconName]> = [
  ['home', 'home', 'home'], ['live', 'live', 'tv'], ['library', 'library', 'film'], ['favorites', 'favorites', 'star'],
  ['history', 'history', 'history'], ['settings', 'settings', 'settings'],
];

/** Moves between the main sections: from Home they open over it; between sections they replace each other. */
export function go(name: string, params?: Record<string, unknown>): void {
  if (name === topName() && !params) return;
  if (name === 'home') { open('home', undefined, { reset: true }); return; }
  open(name, params, { replace: topName() !== 'home' });
}

export function sidebar(active: string, opts?: { brand?: boolean }): HTMLElement {
  const nav = h('nav', { cls: 'sidebar', group: 'sidebar', attrs: { 'data-trap': 'v' } });
  if (opts && opts.brand) nav.appendChild(brand('side'));
  for (const [name, label, ic] of NAV) {
    const item = h('div', { cls: 'side-item' + (name === active ? ' on' : ''), focus: true, onOk: () => go(name) }, [iconEl(ic), h('span', { text: t(label) })]);
    nav.appendChild(item);
  }
  const acc = app.source.account();
  nav.appendChild(h('div', { cls: 'acct-card glass' }, [
    h('div', { cls: 'acct-status' }, [h('i', { cls: 'dot' }), h('span', { text: t('connected') })]),
    h('div', { cls: 'acct-exp' }, [iconEl('crown'), h('div', null, [h('div', { cls: 'muted', text: t('subEnds') }),
      h('div', { cls: 'acct-date', text: acc.expires ? new Date(acc.expires).toISOString().slice(0, 10) : '—' })])]),
  ]));
  return nav;
}

let brandIds = 0;
export function brand(kind: 'side' | 'top'): HTMLElement {
  // Its own gradient id: a gradient inside a hidden screen can't paint another screen's logo.
  const id = 'bm' + ++brandIds;
  const mark = h('div', { cls: 'brand-mark', html: '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00A8FF"/><stop offset="1" stop-color="#A855F7"/></linearGradient></defs><path d="M12 6l30 18-30 18z" fill="url(#' + id + ')"/><path d="M12 6l30 18-14 4z" fill="#fff" opacity=".18"/></svg>' });
  return h('div', { cls: 'brand ' + kind }, [mark, h('div', { cls: 'brand-text' }, [h('div', { cls: 'brand-name', text: t('appName') }),
    kind === 'side' ? h('div', { cls: 'brand-sub', text: t('appSub') }) : null])]);
}

export function topTabs(active: string): HTMLElement {
  const bar = h('header', { cls: 'tabs-bar' }, [brand('top')]);
  const tabs = h('div', { cls: 'tabs', group: 'tabs' });
  const items: Array<[string, TextKey, IconName]> = [['live', 'liveChannels', 'tv'], ['library', 'movies', 'film'], ['series', 'series', 'layers'],
    ['favorites', 'favorites', 'star'], ['history', 'history', 'history'], ['settings', 'settings', 'settings']];
  for (const [name, label, ic] of items) {
    tabs.appendChild(h('div', { cls: 'tab' + (name === active ? ' on' : ''), focus: true,
      onOk: () => name === 'series' ? go('library', { mode: 'series' }) : go(name) }, [iconEl(ic), h('span', { text: t(label) })]));
  }
  bar.appendChild(tabs);
  return bar;
}

/** The top-right corner: account, settings, search and the clock. */
export function headerTools(): HTMLElement {
  const time = h('div', { cls: 'clock', text: clock(new Date()) });
  const tick = () => { time.textContent = clock(new Date()); };
  window.setInterval(tick, 15000);
  return h('div', { cls: 'tools', group: 'tools' }, [
    h('div', { cls: 'tool', focus: true, onOk: () => go('settings', { section: 'account' }) }, [iconEl('user')]),
    h('div', { cls: 'tool', focus: true, onOk: () => go('settings') }, [iconEl('settings')]),
    h('div', { cls: 'tool', focus: true, onOk: () => go('search') }, [iconEl('search')]),
    time,
  ]);
}

// MARK: - The hint bar

export interface Hint { key?: string; keyIcon?: IconName; keyClass?: string; icon?: IconName; label: string }

export function hints(list: Hint[]): HTMLElement {
  const bar = h('footer', { cls: 'hints' });
  for (const x of list) {
    const hint = h('div', { cls: 'hint' });
    if (x.key || x.keyIcon) {
      const k = h('span', { cls: 'key' + (x.keyClass ? ' ' + x.keyClass : '') });
      if (x.keyIcon) k.appendChild(iconEl(x.keyIcon)); else k.textContent = x.key || '';
      hint.appendChild(k);
    }
    if (x.icon) hint.appendChild(iconify(x.icon, 'ic-only'));
    hint.appendChild(h('span', { text: x.label }));
    bar.appendChild(hint);
  }
  return bar;
}

// MARK: - Cards

export function sectionTitle(ic: IconName, text: string): HTMLElement {
  return h('div', { cls: 'section-title' }, [iconEl(ic), h('span', { text })]);
}

/** A portrait poster (Library): quality badge, title under it. */
export function posterCard(item: Movie | Series, onPick: () => void): HTMLElement {
  const img = h('img', { cls: 'poster-img', attrs: { alt: '' } });
  lazyImg(img, item.poster);
  return h('div', { cls: 'poster-card', focus: true, onOk: onPick }, [
    h('div', { cls: 'poster-frame' }, [img, h('span', { cls: 'badge' + (item.quality === '4K' ? ' k4' : ''), text: item.quality }),
      h('span', { cls: 'play-dot', html: icon('play') })]),
    h('div', { cls: 'poster-title', text: item.name }),
  ]);
}

/** A landscape still (Home: latest movies). */
export function stillCard(item: Movie | Series, onPick: () => void): HTMLElement {
  const img = h('img', { cls: 'still-img', attrs: { alt: '' } });
  lazyImg(img, item.backdrop);
  return h('div', { cls: 'still-card', focus: true, onOk: onPick }, [img, h('div', { cls: 'still-name', text: item.name })]);
}

/** Continue watching: picture, title, time and progress, a play button. */
export function resumeCard(e: Entry, onPick: () => void, variant: 'home' | 'library'): HTMLElement {
  const img = h('img', { cls: 'resume-img', attrs: { alt: '' } });
  lazyImg(img, e.image);
  const frac = e.dur ? Math.min(1, e.pos / e.dur) : 0;
  const title = e.kind === 'episode' && e.seriesName ? e.seriesName : e.name;
  const sub = variant === 'home' ? hms(e.pos, e.dur >= 3600000) + ' / ' + hms(e.dur, e.dur >= 3600000)
    : e.kind === 'episode' ? t('seasonEpisode', { s: e.season || 1, e: e.ep || 1 }) : t('remaining', { t: hms(e.dur - e.pos) });
  return h('div', { cls: 'resume-card ' + variant, focus: true, onOk: onPick }, [
    img, h('div', { cls: 'resume-shade' }),
    h('span', { cls: 'resume-play', html: icon('play') }),
    h('div', { cls: 'resume-info' }, [h('div', { cls: 'resume-title', text: title }), h('div', { cls: 'resume-sub', text: sub }),
      h('div', { cls: 'progress' }, [h('i', { style: { width: (frac * 100).toFixed(1) + '%' } })])]),
  ]);
}

/** A chip (genre, scope, season): icon, label, on when selected. */
export function chip(label: string, ic: IconName | null, on: boolean, onPick: () => void): HTMLElement {
  return h('div', { cls: 'pill chip' + (on ? ' on' : ''), focus: true, onOk: onPick }, [ic ? iconEl(ic) : null, h('span', { text: label })]);
}

export function button(label: string, ic: IconName | null, onPick: () => void, cls?: string): HTMLElement {
  return h('div', { cls: 'btn' + (cls ? ' ' + cls : ''), focus: true, onOk: onPick }, [ic ? iconEl(ic) : null, h('span', { text: label })]);
}

// MARK: - A virtualized list: a fixed set of row nodes, refilled as the focus moves (thousands of rows stay cheap)

export interface VList<T> {
  el: HTMLElement;
  set(items: T[], index?: number): void;
  index(): number;
  item(): T | undefined;
  all(): T[];
  refresh(): void;
}

export function vlist<T>(opts: {
  rowHeight: number; visible: number; cls?: string;
  make: (row: HTMLElement) => void;
  fill: (row: HTMLElement, item: T, index: number) => void;
  onMove?: (item: T, index: number) => void;
  onPick?: (item: T, index: number) => void;
}): VList<T> {
  const el = h('div', { cls: 'vlist ' + (opts.cls || ''), focus: true });
  el.style.height = opts.rowHeight * opts.visible + 'px';
  const rows: HTMLElement[] = [];
  for (let i = 0; i < opts.visible; i++) {
    const r = h('div', { cls: 'vrow' });
    r.style.top = i * opts.rowHeight + 'px';
    r.style.height = opts.rowHeight - 10 + 'px';
    opts.make(r);
    el.appendChild(r);
    rows.push(r);
  }
  let items: T[] = [], at = 0, top = 0;
  const drawn: number[] = [];
  function draw(): void {
    for (let k = 0; k < rows.length; k++) {
      const i = top + k, r = rows[k];
      if (i >= items.length) { r.style.display = 'none'; drawn[k] = -1; continue; }
      r.style.display = '';
      if (drawn[k] !== i) { opts.fill(r, items[i], i); drawn[k] = i; }
      r.classList.toggle('sel', i === at);
    }
  }
  function moveTo(i: number): boolean {
    if (!items.length) return false;
    const n = Math.max(0, Math.min(items.length - 1, i));
    if (n === at) return false;
    at = n;
    if (at < top) top = at;
    else if (at >= top + opts.visible) top = at - opts.visible + 1;
    draw();
    if (opts.onMove) opts.onMove(items[at], at);
    return true;
  }
  onKey(el, (key) => {
    if (key === 'up') return moveTo(at - 1) || false;
    if (key === 'down') return moveTo(at + 1) || false;
    if (key === 'chup') { moveTo(at - opts.visible); return true; }
    if (key === 'chdown') { moveTo(at + opts.visible); return true; }
    return false;
  });
  onOk(el, () => { if (items[at] !== undefined && opts.onPick) opts.onPick(items[at], at); });
  // A pointer click picks the row under it.
  el.addEventListener('click', (e) => {
    const r = (e.target as HTMLElement).closest('.vrow');
    const k = rows.indexOf(r as HTMLElement);
    if (k >= 0 && top + k < items.length) moveTo(top + k);
  }, true);
  return {
    el,
    set(list: T[], index?: number) {
      items = list;
      at = Math.max(0, Math.min(index || 0, list.length - 1));
      top = Math.max(0, Math.min(at - Math.floor(opts.visible / 2), list.length - opts.visible));
      for (let k = 0; k < rows.length; k++) drawn[k] = -2;
      draw();
    },
    index: () => at,
    item: () => items[at],
    all: () => items,
    refresh() { for (let k = 0; k < rows.length; k++) drawn[k] = -2; draw(); },
  };
}

/** A list that couldn't load: why, and Try again. */
export function failBox(err: unknown, retry: () => void, land?: () => HTMLElement | null): HTMLElement {
  const box = h('div', { cls: 'fail' });
  const btn = button(t('retry'), 'refresh', () => {
    const host = box.parentElement;
    retry();
    // The button goes away with the retry: once something to focus is back, the remote lands on it
    // (where `land` says, else the first thing where the box was), unless the screen placed the focus itself.
    let n = 0;
    const tick = () => {
      const f = focused();
      if (f && f !== btn && document.body.contains(f)) return;
      const target = land ? land() : host ? focusables(host)[0] : null;
      if (target) { focus(target); return; }
      if (++n < 80) setTimeout(tick, 150);
    };
    setTimeout(tick, 0);
  }, 'primary');
  box.appendChild(h('div', { text: t('loadFailed') }));
  box.appendChild(h('div', { cls: 'muted', text: failText(err) }));
  box.appendChild(btn);
  return box;
}

// MARK: - Toasts and confirmations

let toastEl: HTMLElement | null = null, toastTimer = 0;
export function toast(text: string): void {
  if (!toastEl) { toastEl = h('div', { cls: 'toast' }); document.getElementById('stage')!.appendChild(toastEl); }
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl!.classList.remove('on'), 2600);
}

export function confirm(title: string, body: string, okLabel: string, onYes: () => void): void {
  const yes = button(okLabel, null, () => { closeDialog(); onYes(); }, 'primary');
  const no = button(t('cancel'), null, () => closeDialog());
  const box = h('div', { cls: 'dialog glass' }, [h('h2', { text: title }), body ? h('p', { text: body }) : null, h('div', { cls: 'actions' }, [yes, no])]);
  openDialog(box, { first: no });
}
