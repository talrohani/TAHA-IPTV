/**
 * Opening things: a film or series shows its details; a channel or an entry from history plays.
 *
 * Saved entries (Continue Watching, History, Favorites) carry a copy of their item, so a film opens straight from it
 * and an episode needs only its series' episode list: no catalogue download. Entries saved before phase 4 have no
 * copy and are looked up in the catalogue as before. Something the provider no longer has says so.
 */
import { open } from '../core/router';
import { t, failText } from '../core/i18n';
import { toast } from '../ui/components';
import { app } from '../app';
import { restore } from '../data/library';
import type { Entry } from '../data/library';
import type { Channel, Episode, Item, Movie, Series } from '../data/types';

export function openItem(item: Item, list?: Channel[]): void {
  if (item.kind === 'live') open('player', { item, list: list || [item] });
  else if (item.kind === 'movie' || item.kind === 'series') open('details', { item });
}

type Saved = Pick<Entry, 'kind' | 'id' | 'pos'> & Partial<Pick<Entry, 'item' | 'series' | 'seriesId'>>;

function gone(): void { toast(t('gone')); }
function failed(err: unknown): void { toast(failText(err)); }

/** play: start playing (Continue Watching, History); otherwise show the film's or series' page. */
export function openEntry(e: Saved, play: boolean): void {
  const s = app.source;
  if (e.kind === 'live') {
    const copy = e.item && e.item.kind === 'live' ? restore(e.item) : null;
    // The channel list (one download, kept 30 min) gives the current channel and its category, for channel up/down.
    s.channels('*').then((all) => {
      const c = all.find((x) => x.id === e.id) || copy;
      if (!c) { gone(); return; }
      open('player', { item: c, list: all.filter((x) => x.category === c.category) });
    }, (err) => { if (copy) open('player', { item: copy, list: [copy] }); else failed(err); });
    return;
  }
  if (e.kind === 'movie') {
    const go = (m: Movie) => open(play ? 'player' : 'details', play ? { item: m, startAt: e.pos } : { item: m });
    if (e.item && e.item.kind === 'movie') { go(restore(e.item)); return; }
    s.movies('*').then((all) => { const m = all.find((x) => x.id === e.id); if (m) go(m); else gone(); }, failed);
    return;
  }
  const findSeries = (id: number): Promise<Series | null> => {
    const copy = e.kind === 'series' && e.item && e.item.kind === 'series' ? e.item : e.series;
    if (copy && copy.id === id) return Promise.resolve(restore(copy));
    return s.series('*').then((all) => all.find((x) => x.id === id) || null);
  };
  if (e.kind === 'series') {
    findSeries(e.id).then((sr) => { if (sr) open('details', { item: sr }); else gone(); }, failed);
    return;
  }
  // An episode: its series' episodes (get_series_info), then the episode.
  const seriesId = e.seriesId !== undefined ? e.seriesId : e.item && e.item.kind === 'episode' ? e.item.seriesId : -1;
  findSeries(seriesId).then((sr) => {
    if (!sr) { gone(); return; }
    if (!play) { open('details', { item: sr }); return; }
    return s.seriesInfo(sr).then((seasons) => {
      let ep: Episode | undefined;
      for (const se of seasons) for (const x of se.episodes) if (x.id === e.id) ep = x;
      if (ep) open('player', { item: ep, series: sr, startAt: e.pos });
      else gone();
    });
  }).catch(failed);
}
