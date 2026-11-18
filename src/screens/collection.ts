/**
 * Favorites and Watch history: one screen, two lists, filtered by kind. OK opens (a channel or a history entry plays,
 * a film or series shows its page); the red key removes the selected one.
 */
import { h, sidebar, hints, chip, button, resumeCard, confirm, toast } from '../ui/components';
import { iconEl } from '../ui/icons';
import { lazyImg } from '../core/dom';
import { t } from '../core/i18n';
import { focus, focused } from '../core/focus';
import { favorites, recent, resetHistory, removeFavorite, removeFromHistory } from '../data/library';
import { openEntry } from './nav';
import type { Screen } from '../core/router';
import type { Kind } from '../data/types';

type Filter = 'all' | Kind;
interface Card extends HTMLElement { __kind?: Kind; __id?: number }

export function collection(params?: Record<string, unknown>): Screen {
  const which = (params && params.which) === 'history' ? 'history' : 'favorites';
  let filter: Filter = 'all';
  const el = h('div', { cls: 'collection fixed' });
  const main = h('div', { cls: 'main' });
  el.appendChild(sidebar(which, { brand: true }));
  el.appendChild(main);
  el.appendChild(hints([{ keyIcon: 'arrowsLR', label: t('navigate') }, { key: 'OK', label: t('play') },
    { key: 'A', keyClass: 'red', label: t('remove') }, { icon: 'back', label: t('back') }]));

  const head = h('div', { cls: 'coll-head', group: 'head' }, [h('div', { cls: 'lib-title' }, [iconEl(which === 'history' ? 'history' : 'star'), h('span', { text: t(which) })])]);
  if (which === 'history') head.appendChild(button(t('resetHistory'), 'trash', () => confirm(t('resetHistory'), t('confirmAgain'), t('done'), () => { resetHistory(); toast(t('resetHistory') + ' ✓'); draw(); }), 'danger'));
  main.appendChild(head);
  const chips = h('div', { cls: 'coll-chips', group: 'chips' });
  main.appendChild(chips);
  const results = h('div', { cls: 'results', attrs: { 'data-scroll': 'y', 'data-pad': '120' } });
  main.appendChild(results);

  function mark(card: HTMLElement, kind: Kind, id: number): HTMLElement {
    (card as Card).__kind = kind;
    (card as Card).__id = id;
    return card;
  }

  function draw(): void {
    chips.innerHTML = '';
    const list: Array<[Filter, string]> = [['all', t('all')], ['live', t('channels')], ['movie', t('movies')], [which === 'history' ? 'episode' : 'series', t('series')]];
    for (const [f, label] of list) chips.appendChild(chip(label, null, f === filter, () => { filter = f; draw(); focus(chips.querySelector('.on') as HTMLElement); }));
    results.innerHTML = '';
    const grid = h('div', { cls: 'lib-grid', group: 'grid' });
    if (which === 'history') {
      const entries = recent().filter((e) => filter === 'all' || e.kind === filter);
      for (const e of entries) grid.appendChild(mark(resumeCard(e, () => openEntry(e, true), 'home'), e.kind, e.id));
      if (!entries.length) { results.appendChild(h('div', { cls: 'empty', text: t('emptyHistory') })); return; }
    } else {
      const favs = favorites().filter((f) => filter === 'all' || f.kind === filter);
      for (const f of favs) {
        const img = h('img', { attrs: { alt: '' } });
        lazyImg(img, f.image);
        const entry = { kind: f.kind, id: f.id, pos: 0, item: f.item };
        grid.appendChild(mark(f.kind === 'live'
          ? h('div', { cls: 'chan-tile', focus: true, onOk: () => openEntry(entry, true) }, [img, h('div', { cls: 'ct-name', text: f.name })])
          : h('div', { cls: 'poster-card', focus: true, onOk: () => openEntry(entry, false) }, [h('div', { cls: 'poster-frame' }, [img]), h('div', { cls: 'poster-title', text: f.name })]),
        f.kind, f.id));
        img.className = f.kind === 'live' ? '' : 'poster-img';
      }
      if (!favs.length) { results.appendChild(h('div', { cls: 'empty', text: t('emptyFav') })); return; }
    }
    results.appendChild(grid);
  }

  /** Red: the selected card goes; the focus moves to the one after it (or before, at the end). */
  function removeSelected(): boolean {
    const f = focused() as Card | null;
    if (!f || f.__kind === undefined || f.__id === undefined || !results.contains(f)) return false;
    const cards = Array.prototype.slice.call(results.querySelectorAll('[data-f]')) as HTMLElement[];
    const i = cards.indexOf(f);
    if (which === 'history') removeFromHistory(f.__kind, f.__id); else removeFavorite(f.__kind, f.__id);
    toast(t('removed'));
    draw();
    const after = results.querySelectorAll('[data-f]');
    focus((after[Math.min(i, after.length - 1)] as HTMLElement) || (chips.querySelector('.on') as HTMLElement));
    return true;
  }

  draw();
  return {
    el,
    first: () => (results.querySelector('[data-f]') as HTMLElement) || (chips.querySelector('.on') as HTMLElement),
    resume: draw,
    onKey(key) { return key === 'red' ? removeSelected() : false; },
  };
}
