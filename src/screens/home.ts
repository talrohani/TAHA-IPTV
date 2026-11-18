/**
 * Home: the four big shortcuts, then rows: continue watching, latest movies, recently watched, latest series.
 * Rows load one after another (the first ones first), so the screen is up at once.
 */
import { h, sidebar, headerTools, brand, sectionTitle, resumeCard, stillCard, posterCard, go, confirm } from '../ui/components';
import { iconEl } from '../ui/icons';
import { skyline } from '../ui/art';
import { t } from '../core/i18n';
import { app } from '../app';
import { continueWatching, recent } from '../data/library';
import { openEntry, openItem } from './nav';
import type { Screen } from '../core/router';
import type { Movie, Series } from '../data/types';

const WAVE = '<svg class="wave" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 140 C 90 90, 170 190, 260 120 S 380 70, 400 90 L400 200 L0 200 Z" fill="rgba(255,255,255,0.10)"/><path d="M0 160 C 120 120, 200 200, 300 150 S 380 120, 400 130" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/></svg>';

export function home(): Screen {
  const el = h('div', { cls: 'home fixed' });
  const hero = h('div', { cls: 'hero' });
  hero.style.backgroundImage = 'url("' + skyline() + '")';
  const main = h('div', { cls: 'main', attrs: { 'data-scroll': 'y', 'data-pad': '220' } });

  const shortcut = (cls: string, ic: Parameters<typeof iconEl>[0], label: string, fn: () => void) => {
    const c = h('div', { cls: 'shortcut ' + cls, focus: true, onOk: fn, html: WAVE });
    c.appendChild(iconEl(ic));
    c.appendChild(h('span', { text: label }));
    return c;
  };
  const shortcuts = h('div', { cls: 'shortcuts', group: 'shortcuts' }, [
    shortcut('live', 'tv', t('liveChannels'), () => go('live')),
    shortcut('movies', 'film', t('movies'), () => go('library', { mode: 'movie' })),
    shortcut('series', 'layers', t('series'), () => go('library', { mode: 'series' })),
    shortcut('favs', 'star', t('favorites'), () => go('favorites')),
  ]);
  main.appendChild(shortcuts);

  const rows = h('div');
  main.appendChild(rows);

  function row(ic: Parameters<typeof sectionTitle>[0], title: string, cards: HTMLElement[]): void {
    if (!cards.length) return;
    const track = h('div', { cls: 'track', group: 'row-' + title, attrs: { 'data-scroll': 'x', 'data-pad': '80' } }, cards);
    rows.appendChild(h('div', { cls: 'section' }, [sectionTitle(ic, title), track]));
  }

  function build(): void {
    rows.innerHTML = '';
    row('history', t('continueWatching'), continueWatching().slice(0, 10).map((e) => resumeCard(e, () => openEntry(e, true), 'home')));
    // Latest movies, then the rest, a frame later each: the screen shows before every row is built.
    app.source.movies('*').then((list) => {
      const latest = (list as Movie[]).slice().sort((a, b) => b.added - a.added).slice(0, 18);
      row('film', t('latestMovies'), latest.map((m) => stillCard(m, () => openItem(m))));
      const watched = recent().slice(0, 14);
      setTimeout(() => {
        row('clock', t('recentlyWatched'), watched.map((e) => resumeCard(e, () => openEntry(e, false), 'home')));
        app.source.series('*').then((sl) => {
          const ls = (sl as Series[]).slice().sort((a, b) => b.added - a.added).slice(0, 16);
          row('layers', t('latestSeries'), ls.map((s) => posterCard(s, () => openItem(s))));
        });
      }, 30);
    });
  }
  build();

  el.appendChild(hero);
  el.appendChild(sidebar('home'));
  el.appendChild(headerTools());
  el.appendChild(brand('top'));
  el.appendChild(main);
  if (app.source.account().demo) el.appendChild(h('div', { cls: 'demo-flag', text: t('demoNote') }));

  return {
    el,
    first: () => shortcuts.firstChild as HTMLElement,
    // Back on Home: leave the app (asked first).
    onBack: () => {
      confirm(t('exitTitle'), '', t('exit'), () => {
        try { (window as unknown as { tizen: { application: { getCurrentApplication(): { exit(): void } } } }).tizen.application.getCurrentApplication().exit(); } catch { /* the browser preview stays */ }
      });
      return true;
    },
    resume: () => {
      // History may have changed while a player or a section was open.
      const f = document.querySelector('.home .is-focused');
      if (!f || !main.contains(f)) build();
    },
  };
}
