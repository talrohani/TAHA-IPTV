/**
 * Live TV: categories | channels (virtualized: only the rows on screen exist) | preview with now and next.
 * OK on a channel plays it in the preview; OK again opens it full screen. The preview and the full screen share the
 * one player: going full screen only moves the picture, it doesn't restart the stream.
 */
import { h, topTabs, hints, vlist, toast } from '../ui/components';
import { iconEl, icon, IconName } from '../ui/icons';
import { lazyImg } from '../core/dom';
import { t, errorText } from '../core/i18n';
import { open } from '../core/router';
import { focus } from '../core/focus';
import { app } from '../app';
import { isFavorite, toggleFavorite, record } from '../data/library';
import type { Screen } from '../core/router';
import type { Category, Channel, Program } from '../data/types';
import type { Key } from '../core/keys';

const PREVIEW = { x: 998, y: 138, w: 896, h: 520 };

export function live(params?: Record<string, unknown>): Screen {
  const el = h('div', { cls: 'live fixed' });
  el.appendChild(topTabs('live'));
  const body = h('div', { cls: 'body' });
  el.appendChild(body);

  // Categories
  const cats = vlist<Category>({
    rowHeight: 80, visible: 9, cls: 'cats-list',
    make: (r) => { r.classList.add('cat-row'); r.appendChild(h('span', { cls: 'ic-wrap' })); r.appendChild(h('span', { cls: 'nm' })); r.appendChild(h('span', { cls: 'count' })); },
    fill: (r, c) => {
      (r.children[0] as HTMLElement).innerHTML = icon((c.icon || 'tv') as IconName);
      r.children[1].textContent = c.id === '*' ? t('all') : c.name;
      r.children[2].textContent = String(c.count);
    },
    onMove: (c) => { clearTimeout(catTimer); catTimer = window.setTimeout(() => loadChannels(c), 220); },
    onPick: () => focus(chans.el),
  });
  let catTimer = 0;
  const catPanel = h('section', { cls: 'panel cats glass' }, [h('div', { cls: 'panel-head' }, [iconEl('grid'), h('span', { text: t('categories') })]), cats.el]);

  // Channels
  const countLabel = h('span', { text: t('channelsCount', { n: '…' }) });
  const searchPill = h('div', { cls: 'search-pill', focus: true, onOk: () => open('search', { scope: 'live' }) }, [iconEl('search'), h('span', { text: t('search') })]);
  const chans = vlist<Channel>({
    rowHeight: 80, visible: 9, cls: 'chans-list',
    make: (r) => {
      r.classList.add('chan-row');
      r.appendChild(h('span', { cls: 'num' }));
      const lg = h('span', { cls: 'logo' }); lg.appendChild(h('img', { attrs: { alt: '' } })); r.appendChild(lg);
      r.appendChild(h('span', { cls: 'name' }));
      r.appendChild(h('span', { cls: 'star' }));
    },
    fill: (r, c) => {
      r.children[0].textContent = ('00' + c.num).slice(-3);
      const img = r.children[1].firstChild as HTMLImageElement;
      const src = c.logo;
      if (img.getAttribute('src') !== src) img.src = src;
      r.children[2].textContent = c.name;
      const fav = isFavorite('live', c.id), star = r.children[3] as HTMLElement;
      star.className = 'star' + (fav ? ' on' : '');
      star.innerHTML = icon('star').replace('fill="none"', fav ? 'fill="currentColor"' : 'fill="none"');
    },
    onMove: (c) => { clearTimeout(infoTimer); infoTimer = window.setTimeout(() => showInfo(c), 160); },
    onPick: (c) => pick(c),
  });
  let infoTimer = 0;
  const chanPanel = h('section', { cls: 'panel chans glass' }, [h('div', { cls: 'panel-head', group: 'chan-head' }, [iconEl('tv'), countLabel, searchPill]), chans.el]);

  // Preview, now, next
  const pLogo = h('img', { attrs: { alt: '' } });
  const pMsg = h('div', { cls: 'p-msg' });
  const pFill = h('i');
  const preview = h('div', { cls: 'preview', focus: true, onOk: () => { const c = chans.item(); if (c) full(c); } }, [
    h('div', { cls: 'hole' }), h('div', { cls: 'p-logo' }, [pLogo]), h('span', { cls: 'badge live', text: t('live2') }), pMsg,
    h('div', { cls: 'p-bar' }, [iconEl('pause'), h('div', { cls: 'progress' }, [pFill]), iconEl('signal'), h('span', { cls: 'hdb', text: 'HD' }), iconEl('fullscreen')]),
  ]);
  const nLogo = h('img', { attrs: { alt: '' } });
  const nName = h('div', { cls: 'n-name' }), nProg = h('div', { cls: 'n-prog' });
  const nStart = h('span'), nEnd = h('span'), nFill = h('i');
  const favBtn = h('div', { cls: 'fav-btn', focus: true, onOk: () => { const c = chans.item(); if (c) fav(c); } });
  favBtn.innerHTML = icon('star');
  const nowCard = h('div', { cls: 'now-card glass' }, [h('div', { cls: 'n-logo' }, [nLogo]),
    h('div', { cls: 'n-body' }, [nName, nProg, h('div', { cls: 'n-time' }, [nStart, h('div', { cls: 'progress' }, [nFill]), nEnd, h('span', { cls: 'now-pill', text: t('now') })])]), favBtn]);
  const nxTime = h('span', { cls: 'nx-time' }), nxTitle = h('div', { cls: 'nx-title' });
  const nextCard = h('div', { cls: 'next-card glass' }, [h('div', { cls: 'nx-head' }, [iconEl('clock'), h('span', { text: t('next') }), nxTime]), nxTitle]);
  const side = h('section', { cls: 'panel side', group: 'side' }, [preview, nowCard, nextCard]);

  body.appendChild(catPanel);
  body.appendChild(chanPanel);
  body.appendChild(side);
  el.appendChild(hints([
    { keyIcon: 'chevronUD', label: t('hintChannel') }, { keyIcon: 'arrowsLR', label: t('navigate') },
    { key: 'OK', label: t('hintPlayFull') }, { key: 'A', keyClass: 'red', label: t('addFavorite') },
    { icon: 'settings', label: t('settings') }, { icon: 'back', label: t('back') },
  ]));

  let playing: Channel | null = null;
  const epgCache = new Map<number, { at: number; list: Program[] }>();
  let epgFor = 0;
  let destroyed = false;

  function loadChannels(c: Category): void {
    app.source.channels(c.id).then((list) => {
      if (destroyed || cats.item() !== c) return;
      chans.set(list, 0);
      countLabel.textContent = t('channelsCount', { n: list.length });
      if (list[0]) showInfo(list[0]);
    });
  }

  function epg(c: Channel, done: (list: Program[]) => void): void {
    const hit = epgCache.get(c.id);
    if (hit && Date.now() - hit.at < 600000) { done(hit.list); return; }
    epgFor = c.id;
    app.source.epg(c).then((list) => { epgCache.set(c.id, { at: Date.now(), list }); if (epgFor === c.id) done(list); });
  }

  function showInfo(c: Channel): void {
    if (pLogo.getAttribute('src') !== c.logo) pLogo.src = c.logo;
    lazyImg(nLogo, c.logo);
    nLogo.src = c.logo;
    nName.textContent = c.name;
    const on = isFavorite('live', c.id);
    favBtn.classList.toggle('on', on);
    favBtn.innerHTML = icon('star').replace('fill="none"', on ? 'fill="currentColor"' : 'fill="none"');
    nProg.textContent = '';
    nStart.textContent = nEnd.textContent = nxTime.textContent = nxTitle.textContent = '';
    nFill.style.width = pFill.style.width = '0';
    epg(c, (list) => {
      if (chans.item() !== c) return;
      const now = Date.now(), cur = list.find((p) => p.start <= now && p.end > now), nx = list.find((p) => p.start > now);
      if (!cur) { nProg.textContent = t('noEpg'); return; }
      nProg.textContent = cur.title;
      nStart.textContent = hm(cur.start); nEnd.textContent = hm(cur.end);
      const f = Math.min(100, (now - cur.start) / (cur.end - cur.start) * 100).toFixed(1) + '%';
      nFill.style.width = f;
      if (playing === c) pFill.style.width = f;
      if (nx) { nxTitle.textContent = nx.title; nxTime.textContent = hm(nx.start) + ' – ' + hm(nx.end); }
    });
  }

  function hm(ms: number): string { const d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  function pick(c: Channel): void {
    if (playing && playing.id === c.id) { full(c); return; }
    playing = c;
    pMsg.textContent = t('loading');
    app.player.play(app.source.streamUrl(c), { rect: PREVIEW, live: true });
    record(c, 0, 0);
  }

  function full(c: Channel): void {
    if (!playing || playing.id !== c.id) pick(c);
    // The category's channels go along, for channel up/down on the full screen.
    open('player', { item: c, list: chans.all(), continuing: true, onExit: (shown: Channel) => {
      // Zapped on the full screen: the preview and the list follow the channel that's playing now.
      playing = shown;
      const i = chans.all().indexOf(shown);
      if (i >= 0) chans.set(chans.all(), i);
      showInfo(shown);
    } });
  }

  function fav(c: Channel): void {
    const on = toggleFavorite(c);
    toast(on ? t('addFavorite') + ' ✓' : t('removeFavorite'));
    chans.refresh();
    showInfo(c);
  }

  const off = app.player.on((s, info) => {
    if (!playing) return;
    pMsg.textContent = s === 'PREPARING' || s === 'BUFFERING' ? t('loading') : s === 'ERROR' ? errorText(info.error) : '';
  });

  app.source.liveCategories().then((list) => {
    if (destroyed) return;
    const startCat = params && params.category ? list.findIndex((c) => c.id === params.category) : 0;
    cats.set(list, Math.max(0, startCat));
    if (list[Math.max(0, startCat)]) loadChannels(list[Math.max(0, startCat)]);
  });

  return {
    el,
    first: () => chans.el,
    onKey(key: Key) {
      if (key === 'red' || key === 'yellow') { const c = chans.item(); if (c) fav(c); return true; }
      return false;
    },
    resume() {
      // Back from the full screen: the picture goes back into the preview.
      if (playing) app.player.place(PREVIEW);
      chans.refresh();
    },
    destroy() {
      destroyed = true;
      off();
      clearTimeout(catTimer);
      clearTimeout(infoTimer);
      if (playing) app.player.stop();
    },
  };
}
