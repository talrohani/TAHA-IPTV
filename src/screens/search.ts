/** Search across channels, movies and series; results come as you type (after a short pause). */
import { h, sidebar, hints, sectionTitle, posterCard, chip } from '../ui/components';
import { iconEl } from '../ui/icons';
import { lazyImg } from '../core/dom';
import { t } from '../core/i18n';
import { app } from '../app';
import { openItem } from './nav';
import type { Screen } from '../core/router';
import type { Channel, Movie, Series } from '../data/types';

type Scope = 'all' | 'live' | 'movie' | 'series';

export function search(params?: Record<string, unknown>): Screen {
  let scope: Scope = (params && (params.scope as Scope)) || 'all';
  const el = h('div', { cls: 'search fixed' });
  const main = h('div', { cls: 'main' });
  el.appendChild(sidebar('', { brand: true }));
  el.appendChild(main);
  el.appendChild(hints([{ keyIcon: 'arrowsLR', label: t('navigate') }, { key: 'OK', label: t('play') }, { icon: 'back', label: t('back') }]));

  const input = h('input', { attrs: { type: 'text', placeholder: t('searchHint'), autocomplete: 'off', spellcheck: 'false' } });
  const field = h('div', { cls: 'field', focus: true, onOk: () => input.focus() }, [iconEl('search'), input]);
  main.appendChild(h('div', { cls: 'bar' }, [field]));
  const scopes = h('div', { cls: 'scopes', group: 'scopes' });
  main.appendChild(scopes);
  const results = h('div', { cls: 'results', attrs: { 'data-scroll': 'y', 'data-pad': '120' } });
  main.appendChild(results);

  function drawScopes(): void {
    scopes.innerHTML = '';
    const list: Array<[Scope, string]> = [['all', t('all')], ['live', t('channels')], ['movie', t('movies')], ['series', t('series')]];
    for (const [s, label] of list) scopes.appendChild(chip(label, null, s === scope, () => { scope = s; drawScopes(); run(); }));
  }

  let seq = 0, timer = 0;
  function run(): void {
    const q = input.value.trim().toLowerCase(), my = ++seq;
    results.innerHTML = '';
    if (!q) { results.appendChild(h('div', { cls: 'empty', text: t('searchHint') })); return; }
    Promise.all([
      scope === 'all' || scope === 'live' ? app.source.channels('*') : Promise.resolve([] as Channel[]),
      scope === 'all' || scope === 'movie' ? app.source.movies('*') : Promise.resolve([] as Movie[]),
      scope === 'all' || scope === 'series' ? app.source.series('*') : Promise.resolve([] as Series[]),
    ]).then(([cs, ms, ss]) => {
      if (my !== seq) return;
      const hit = (n: string) => n.toLowerCase().indexOf(q) >= 0;
      const c = cs.filter((x) => hit(x.name)).slice(0, 30), m = ms.filter((x) => hit(x.name)).slice(0, 30), s = ss.filter((x) => hit(x.name)).slice(0, 30);
      if (!c.length && !m.length && !s.length) { results.appendChild(h('div', { cls: 'empty', text: t('noResults') })); return; }
      const row = (ic: Parameters<typeof sectionTitle>[0], title: string, cards: HTMLElement[]) => {
        if (!cards.length) return;
        results.appendChild(h('div', { cls: 'section', style: { marginBottom: '34px' } }, [sectionTitle(ic, title + ' (' + cards.length + ')'),
          h('div', { cls: 'track', group: 's-' + title, attrs: { 'data-scroll': 'x', 'data-pad': '80' } }, cards)]));
      };
      row('tv', t('channels'), c.map((x) => chanTile(x, () => openItem(x, c))));
      row('film', t('movies'), m.map((x) => posterCard(x, () => openItem(x))));
      row('layers', t('series'), s.map((x) => posterCard(x, () => openItem(x))));
    });
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(run, 280); });

  drawScopes();
  run();
  return { el, first: () => field, destroy: () => clearTimeout(timer) };
}

export function chanTile(c: Channel, onPick: () => void): HTMLElement {
  const img = h('img', { attrs: { alt: '' } });
  lazyImg(img, c.logo);
  return h('div', { cls: 'chan-tile', focus: true, onOk: onPick }, [img, h('div', { cls: 'ct-name', text: c.name })]);
}
