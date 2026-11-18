/** Opening things: a film or series shows its details; a channel or an entry from history plays. */
import { open } from '../core/router';
import { app } from '../app';
import type { Entry } from '../data/library';
import type { Channel, Episode, Item, Movie, Series } from '../data/types';

export function openItem(item: Item, list?: Channel[]): void {
  if (item.kind === 'live') open('player', { item, list: list || [item] });
  else if (item.kind === 'movie' || item.kind === 'series') open('details', { item });
}

/** play: start playing (Continue Watching); otherwise show the film's or series' page. */
export function openEntry(e: Entry, play: boolean): void {
  const s = app.source;
  if (e.kind === 'live') {
    s.channels('*').then((all) => { const c = all.find((x) => x.id === e.id); if (c) open('player', { item: c, list: all.filter((x) => x.category === c.category) }); });
  } else if (e.kind === 'movie') {
    s.movies('*').then((all) => { const m = all.find((x) => x.id === e.id) as Movie | undefined; if (m) open(play ? 'player' : 'details', play ? { item: m, startAt: e.pos } : { item: m }); });
  } else if (e.kind === 'series') {
    s.series('*').then((all) => { const sr = all.find((x) => x.id === e.id); if (sr) open('details', { item: sr }); });
  } else if (e.kind === 'episode') {
    s.series('*').then((all) => {
      const sr = all.find((x) => x.id === e.seriesId) as Series | undefined;
      if (!sr) return;
      if (!play) { open('details', { item: sr }); return; }
      s.seriesInfo(sr).then((seasons) => {
        let ep: Episode | undefined;
        for (const se of seasons) for (const x of se.episodes) if (x.id === e.id) ep = x;
        if (ep) open('player', { item: ep, series: sr, startAt: e.pos });
      });
    });
  }
}
