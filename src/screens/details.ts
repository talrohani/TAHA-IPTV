/**
 * A film's or a series' page: backdrop, poster, facts, plot, actions; for a series, its seasons and episodes
 * (fetched only now: get_series_info), with watched marks and resume points.
 */
import { h, hints, sectionTitle, posterCard, button, chip, toast } from '../ui/components';
import { icon } from '../ui/icons';
import { hms, lazyImg } from '../core/dom';
import { focus } from '../core/focus';
import { t } from '../core/i18n';
import { open } from '../core/router';
import { app } from '../app';
import { isFavorite, toggleFavorite, progress } from '../data/library';
import { openItem } from './nav';
import type { Screen } from '../core/router';
import type { Episode, Movie, Season, Series } from '../data/types';

export function details(params?: Record<string, unknown>): Screen {
  const item = (params && params.item) as Movie | Series;
  const el = h('div', { cls: 'details' });
  const back = h('img', { cls: 'backdrop', attrs: { alt: '' } });
  back.src = item.backdrop;
  const scroll = h('div', { cls: 'scroll', attrs: { 'data-scroll': 'y', 'data-pad': '160' } });
  el.appendChild(back);
  el.appendChild(h('div', { cls: 'shade' }));
  el.appendChild(scroll);
  el.appendChild(hints([{ keyIcon: 'arrowsLR', label: t('navigate') }, { key: 'OK', label: t('play') },
    { key: 'A', keyClass: 'red', label: t('addFavorite') }, { icon: 'back', label: t('back') }]));

  const poster = h('img', { cls: 'd-poster', attrs: { alt: '' } });
  poster.src = item.poster;
  const meta = h('div', { cls: 'meta' }, [
    h('span', { cls: 'rating', html: icon('star') + ' ' + item.rating.toFixed(1) }),
    h('span', { text: String(item.year) }),
    item.kind === 'movie' ? h('span', { text: t('minutes', { n: Math.round(item.duration / 60000) }) }) : null,
    h('span', { text: item.genres.join('، ') }),
    h('span', { cls: 'badge' + (item.quality === '4K' ? ' k4' : ''), text: item.quality }),
  ]);
  const credits = h('div', { cls: 'credits' }, [
    item.kind === 'movie' ? h('div', null, [h('b', { text: t('director') + ': ' }), item.director]) : null,
    h('div', null, [h('b', { text: t('cast') + ': ' }), item.cast.join('، ')]),
  ]);
  const actions = h('div', { cls: 'actions', group: 'actions' });
  const resumeLine = h('div', { cls: 'resume-line' });
  const info = h('div', { cls: 'd-info' }, [h('h1', { text: item.name }), meta, h('div', { cls: 'plot', text: item.plot }), credits, resumeLine, actions]);
  scroll.appendChild(h('div', { cls: 'top' }, [poster, info]));

  const favBtn = button('', 'star', () => {
    const on = toggleFavorite(item);
    toast(on ? t('addFavorite') + ' ✓' : t('removeFavorite'));
    drawFav();
  });
  function drawFav(): void {
    const on = isFavorite(item.kind, item.id);
    favBtn.lastChild!.textContent = on ? t('removeFavorite') : t('addFavorite');
    favBtn.classList.toggle('on', on);
  }

  let firstBtn: HTMLElement | null = null;
  let seasons: Season[] = [];
  const epSection = h('div', { cls: 'section' });

  function drawActions(): void {
    actions.innerHTML = '';
    resumeLine.innerHTML = '';
    if (item.kind === 'movie') {
      const p = progress('movie', item.id), resumable = p && p.pos > 60000 && p.pos < item.duration - 120000;
      if (resumable) {
        resumeLine.appendChild(h('div', { cls: 'progress' }, [h('i', { style: { width: (p!.pos / item.duration * 100).toFixed(1) + '%' } })]));
        resumeLine.appendChild(h('span', { text: t('remaining', { t: hms(item.duration - p!.pos) }) }));
        firstBtn = button(t('resume'), 'play', () => open('player', { item, startAt: p!.pos }), 'primary');
        actions.appendChild(firstBtn);
        actions.appendChild(button(t('fromStart'), 'rewind', () => open('player', { item, startAt: 0 })));
      } else {
        firstBtn = button(t('watchNow'), 'play', () => open('player', { item, startAt: 0 }), 'primary');
        actions.appendChild(firstBtn);
      }
    } else {
      const next = nextEpisode();
      firstBtn = button(next ? (next.pos ? t('resume') : t('watchNow')) + ' · ' + t('seasonEpisode', { s: next.ep.season, e: next.ep.num }) : t('watchNow'), 'play', () => {
        if (next) open('player', { item: next.ep, series: item, startAt: next.pos });
      }, 'primary');
      actions.appendChild(firstBtn);
    }
    actions.appendChild(favBtn);
    drawFav();
  }

  /** The episode to watch next: the one left part-way, or the one after the last one finished. */
  function nextEpisode(): { ep: Episode; pos: number } | null {
    let best: { ep: Episode; pos: number; at: number } | null = null;
    const all: Episode[] = [];
    for (const s of seasons) for (const e of s.episodes) all.push(e);
    all.forEach((e, i) => {
      const p = progress('episode', e.id);
      if (!p) return;
      const done = p.pos >= e.duration - 120000;
      const cand = done ? (all[i + 1] ? { ep: all[i + 1], pos: 0, at: p.at } : null) : { ep: e, pos: p.pos, at: p.at };
      if (cand && (!best || cand.at > best.at)) best = cand;
    });
    if (best) return best;
    return all[0] ? { ep: all[0], pos: 0 } : null;
  }

  function drawEpisodes(season: number): void {
    epSection.innerHTML = '';
    const chips = h('div', { cls: 'track', group: 'seasons', attrs: { 'data-scroll': 'x' } },
      seasons.map((s) => chip(t('seasonN', { n: s.num }), null, s.num === season, () => drawEpisodes(s.num))));
    const s = seasons.find((x) => x.num === season) || seasons[0];
    const cards = s.episodes.map((e) => {
      const p = progress('episode', e.id), watched = !!p && p.pos >= e.duration - 120000;
      const img = h('img', { attrs: { alt: '' } });
      lazyImg(img, e.still);
      const frame = h('div', { cls: 'ep-img' }, [img,
        watched ? h('span', { cls: 'watched', html: icon('check') }) : null,
        p && !watched ? h('div', { cls: 'progress' }, [h('i', { style: { width: (p.pos / e.duration * 100).toFixed(1) + '%' } })]) : null]);
      return h('div', { cls: 'ep-card', focus: true, onOk: () => open('player', { item: e, series: item, startAt: p && !watched ? p.pos : 0 }) }, [
        frame,
        h('div', { cls: 'ep-body' }, [h('div', { cls: 'ep-title', text: e.num + '. ' + e.name }),
          h('div', { cls: 'ep-meta', text: t('minutes', { n: Math.round(e.duration / 60000) }) + (watched ? ' · ' + t('watched') : '') }),
          h('div', { cls: 'ep-plot', text: e.plot })]),
      ]);
    });
    epSection.appendChild(sectionTitle('list', t('episodes')));
    epSection.appendChild(chips);
    epSection.appendChild(h('div', { style: { height: '24px' } }));
    epSection.appendChild(h('div', { cls: 'track', group: 'episodes', attrs: { 'data-scroll': 'x', 'data-pad': '80' } }, cards));
  }

  if (item.kind === 'series') {
    scroll.appendChild(epSection);
    app.source.seriesInfo(item).then((ss) => {
      seasons = ss;
      drawActions();
      const n = nextEpisode();
      drawEpisodes(n ? n.ep.season : (ss[0] ? ss[0].num : 1));
    });
  }
  drawActions();

  // More like it: the same genre.
  const more = h('div', { cls: 'section' });
  scroll.appendChild(more);
  (item.kind === 'movie' ? app.source.movies(item.category) : app.source.series(item.category)).then((list) => {
    const similar = (list as Array<Movie | Series>).filter((x) => x.id !== item.id).slice(0, 14);
    if (!similar.length) return;
    more.appendChild(sectionTitle('sparkles', t('topRated')));
    more.appendChild(h('div', { cls: 'track', group: 'similar', attrs: { 'data-scroll': 'x', 'data-pad': '80' } },
      similar.map((x) => posterCard(x, () => openItem(x)))));
  });

  return {
    el,
    first: () => firstBtn,
    onKey(key) {
      if (key === 'red') { favBtn.click(); return true; }
      return false;
    },
    resume() {
      // Back from the player: resume points and watched marks changed.
      drawActions();
      if (item.kind === 'series' && seasons.length) {
        const cur = epSection.querySelector('.chip.on');
        const n = cur ? parseInt((cur.textContent || '').replace(/\D/g, ''), 10) : seasons[0].num;
        drawEpisodes(n || seasons[0].num);
      }
      focus(firstBtn);
    },
  };
}
