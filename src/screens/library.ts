/**
 * The Library: Movies | Series, genre chips, then either rows (continue watching, recently added, top rated) or,
 * with a genre picked, a poster grid that adds posters as the focus nears the end (no list is built all at once).
 */
import { h, sidebar, hints, sectionTitle, posterCard, resumeCard, chip, go, toast, failBox } from '../ui/components';
import { iconEl, IconName } from '../ui/icons';
import { still } from '../ui/art';
import { t } from '../core/i18n';
import { onFocus, focused, focus } from '../core/focus';
import { app } from '../app';
import { continueWatching, toggleFavorite } from '../data/library';
import { openEntry, openItem } from './nav';
import type { Screen } from '../core/router';
import type { Category, Movie, Series } from '../data/types';
import type { Key } from '../core/keys';

type Mode = 'movie' | 'series';
type Sort = 'newest' | 'rating' | 'name' | 'year';
const PAGE = 24;

export function library(params?: Record<string, unknown>): Screen {
  let mode: Mode = params && params.mode === 'series' ? 'series' : 'movie';
  let sort: Sort = 'newest';
  let genre = '*';
  let destroyed = false;

  const el = h('div', { cls: 'library fixed' });
  const main = h('div', { cls: 'main' });
  const art = h('div', { cls: 'lib-art' });
  art.style.backgroundImage = 'url("' + still('library-reel', 4242) + '")';
  const head = h('div', { cls: 'lib-head' }, [
    h('div', { cls: 'lib-title' }, [iconEl('film'), h('span', { text: t('library') })]),
    h('div', { cls: 'lib-sub', text: t('librarySub') }),
  ]);

  const segMovies = h('div', { cls: 'seg', focus: true, onOk: () => setMode('movie') }, [iconEl('film'), h('span', { text: t('movies') })]);
  const segSeries = h('div', { cls: 'seg', focus: true, onOk: () => setMode('series') }, [iconEl('tv'), h('span', { text: t('series') })]);
  const sortLabel = h('span');
  const controls = h('div', { cls: 'lib-controls', group: 'controls' }, [
    h('div', { cls: 'pill', focus: true, onOk: () => go('favorites') }, [iconEl('heart'), h('span', { text: t('favorites') })]),
    h('div', { cls: 'pill', focus: true, onOk: () => go('search', { scope: mode }) }, [iconEl('search'), h('span', { text: t('search') })]),
    h('div', { cls: 'pill', focus: true, onOk: () => cycleSort() }, [iconEl('list'), sortLabel]),
    h('div', { cls: 'spacer' }),
    h('div', { cls: 'segmented fixed' }, [segSeries, segMovies]),
  ]);
  const chipsTrack = h('div', { cls: 'track', group: 'chips', attrs: { 'data-scroll': 'x', 'data-pad': '120' } });
  const chips = h('div', { cls: 'lib-chips' }, [chipsTrack]);
  const scroll = h('div', { cls: 'lib-scroll', attrs: { 'data-scroll': 'y', 'data-pad': '120' } });

  main.appendChild(art);
  main.appendChild(head);
  main.appendChild(controls);
  main.appendChild(chips);
  main.appendChild(scroll);
  el.appendChild(sidebar('library', { brand: true }));
  el.appendChild(main);
  el.appendChild(hints([
    { keyIcon: 'arrowsLR', label: t('navigate') }, { key: 'OK', label: t('play') }, { key: 'A', keyClass: 'red', label: t('addFavorite') },
    { icon: 'list', label: t('options') }, { icon: 'back', label: t('back') },
  ]));

  let items: Array<Movie | Series> = [];
  let shown = 0, grid: HTMLElement | null = null;

  function sortLabelText(): string {
    return t('sort') + ': ' + t(sort === 'newest' ? 'sortNewest' : sort === 'rating' ? 'sortRating' : sort === 'name' ? 'sortName' : 'sortYear');
  }

  function sorted(list: Array<Movie | Series>): Array<Movie | Series> {
    const out = list.slice();
    if (sort === 'newest') out.sort((a, b) => b.added - a.added);
    else if (sort === 'rating') out.sort((a, b) => b.rating - a.rating);
    else if (sort === 'year') out.sort((a, b) => b.year - a.year);
    else out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  function setMode(m: Mode): void {
    if (m === mode) return;
    mode = m;
    genre = '*';
    render();
  }

  function cycleSort(): void {
    const order: Sort[] = ['newest', 'rating', 'name', 'year'];
    sort = order[(order.indexOf(sort) + 1) % order.length];
    sortLabel.textContent = sortLabelText();
    renderBody();
  }

  function renderChips(cats: Category[]): void {
    chipsTrack.innerHTML = '';
    chipsTrack.appendChild(chip(t('all'), 'chevronL', genre === '*', () => { genre = '*'; renderChips(cats); renderBody(); }));
    for (const c of cats) {
      chipsTrack.appendChild(chip(c.name, (c.icon || 'film') as IconName, genre === c.id, () => { genre = c.id; renderChips(cats); renderBody(); }));
    }
  }

  function render(): void {
    segMovies.classList.toggle('on', mode === 'movie');
    segSeries.classList.toggle('on', mode === 'series');
    sortLabel.textContent = sortLabelText();
    const m = mode;
    (mode === 'movie' ? app.source.movieCategories() : app.source.seriesCategories()).then((cats) => {
      if (destroyed || m !== mode) return;
      renderChips(cats);
      renderBody();
    }, (err) => { if (!destroyed && m === mode) showFail(err, render); });
  }

  function showFail(err: unknown, retry: () => void): void {
    scroll.innerHTML = '';
    const box = failBox(err, retry);
    scroll.appendChild(box);
    focus(box.querySelector('[data-f]') as HTMLElement);
  }

  function renderBody(): void {
    const m = mode, g = genre;
    scroll.innerHTML = '';
    scroll.appendChild(h('div', { cls: 'empty', text: t('loading') }));
    const load = mode === 'movie' ? app.source.movies(genre) : app.source.series(genre);
    load.then((list) => {
      if (destroyed || m !== mode || g !== genre) return;   // another tab or genre was picked meanwhile
      items = sorted(list as Array<Movie | Series>);
      scroll.innerHTML = '';
      scroll.scrollTop = 0;
      grid = null;
      if (genre === '*') rows();
      else gridView();
    }, (err) => { if (!destroyed && m === mode && g === genre) showFail(err, renderBody); });
  }

  function section(ic: IconName, title: string, cards: HTMLElement[]): void {
    if (!cards.length) return;
    const track = h('div', { cls: 'track', group: 'r-' + title, attrs: { 'data-scroll': 'x', 'data-pad': '80' } }, cards);
    scroll.appendChild(h('div', { cls: 'section' }, [sectionTitle(ic, title), track]));
  }

  const itemOf = new WeakMap<HTMLElement, Movie | Series>();
  function card(x: Movie | Series): HTMLElement {
    const c = posterCard(x, () => openItem(x));
    itemOf.set(c, x);
    return c;
  }

  function rows(): void {
    const cw = continueWatching().filter((e) => (mode === 'movie' ? e.kind === 'movie' : e.kind === 'episode'));
    section('history', t('continueWatching'), cw.slice(0, 8).map((e) => resumeCard(e, () => openEntry(e, true), 'library')));
    section('fire', t('latestAdded'), items.slice(0, 16).map(card));
    const top = items.slice().sort((a, b) => b.rating - a.rating).slice(0, 16);
    section('star', t('topRated'), top.map(card));
  }

  function gridView(): void {
    if (!items.length) { scroll.appendChild(h('div', { cls: 'empty', text: t('noResults') })); return; }
    grid = h('div', { cls: 'lib-grid', group: 'grid' });
    scroll.appendChild(h('div', { cls: 'section-title' }, [iconEl('grid'), h('span', { text: t('items', { n: items.length }) })]));
    scroll.appendChild(grid);
    shown = 0;
    more();
  }

  /** The next page of posters. */
  function more(): void {
    if (!grid) return;
    const end = Math.min(items.length, shown + PAGE);
    for (let i = shown; i < end; i++) grid.appendChild(card(items[i]));
    shown = end;
  }

  // Near the end of the grid: the next page.
  const offFocus = onFocus((f) => {
    if (!grid || !f || !grid.contains(f)) return;
    const idx = Array.prototype.indexOf.call(grid.children, f) as number;
    if (idx >= shown - 12 && shown < items.length) more();
  });

  render();

  return {
    el,
    first: () => (mode === 'movie' ? segMovies : segSeries),
    onKey(key: Key) {
      if (key === 'red') {
        const f = focused(), it = f ? itemOf.get(f) : undefined;
        if (!it) return false;
        toast(toggleFavorite(it) ? t('addFavorite') + ' ✓' : t('removeFavorite'));
        return true;
      }
      return false;
    },
    resume() { /* posters keep their place */ },
    destroy() { destroyed = true; offFocus(); },
  };
}
