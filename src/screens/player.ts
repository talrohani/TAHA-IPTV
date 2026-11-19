/**
 * The full-screen player, after the reference design: title and episode at the top, the clock and quality in the
 * corner, and a control panel with the seek bar (films and episodes), −30 / play / +30, episodes, favorites, info,
 * subtitles, audio and settings. The overlay hides after 5 s and stays while seeking.
 *
 * Seek bar: ← → move a point along it without touching playback (held: bigger steps), OK jumps there, Back drops
 * it. Live channels have no seek bar (no fake timeline): ↑ ↓ and the channel keys change channel instead.
 *
 * The remote, in three modes (mode()):
 *   NORMAL_NAVIGATION  the overlay's rows, top to bottom: back · previous/next · seek bar · controls. ↑ ↓ go from
 *                      row to row (a row that isn't shown is skipped), ← → along a row, OK presses. Hidden overlay:
 *                      the first key brings it back on the seek bar (or play/pause, or a live channel's arrows);
 *                      ← → (films) and ↑ ↓ (live) keep their shortcuts.
 *   SEEK_MODE          a point chosen on the seek bar: ← → move it, OK jumps, Back drops it; ↑ ↓ drop it and move.
 *   MENU_OPEN          a side sheet: its own layer (↑ ↓, OK, ← → on a value, Back closes it and the focus goes back
 *                      to the button that opened it). The overlay stays up all the while.
 */
import { h, toast } from '../ui/components';
import { iconEl, icon, IconName } from '../ui/icons';
import { hms, clock, onKey } from '../core/dom';
import { t, errorText } from '../core/i18n';
import { openDialog, closeDialog, back, hasDialog } from '../core/router';
import { focus, focused, onFocus } from '../core/focus';
import { getSettings } from '../core/store';
import { app } from '../app';
import { record, markDone, isFavorite, toggleFavorite } from '../data/library';
import type { Screen } from '../core/router';
import type { Channel, Episode, Movie, Program, Series } from '../data/types';
import { digitOf } from '../core/keys';
import type { Key } from '../core/keys';
import type { Track } from '../playback/player';
import { isLang, langName } from '../playback/lang';

const FULL = { x: 0, y: 0, w: 1920, h: 1080 };

function trackName(tr: Track, i: number): string {
  const n = langName(tr.lang);
  return n === 'ar' ? t('trackAr') : n === 'en' ? t('trackEn') : n || t('trackN', { n: i + 1 });
}
const HIDE_AFTER = 5000;

type Playable = Channel | Movie | Episode;

export function player(params?: Record<string, unknown>): Screen {
  let item = (params && params.item) as Playable;
  const series = (params && params.series) as Series | undefined;
  const list = ((params && params.list) || []) as Channel[];
  const continuing = !!(params && params.continuing);
  const p = app.player;
  const demo = app.source.account().demo;

  const el = h('div', { cls: 'player' });
  const ov = h('div', { cls: 'ov' });
  el.appendChild(ov);

  // Top: brand, title, corner
  const thumb = h('img', { cls: 'pl-thumb', attrs: { alt: '' } });
  const name = h('div', { cls: 'pl-name' }), metaText = h('span'), metaBadge = h('span', { cls: 'badge' });
  const backBtn = h('div', { cls: 'pl-back', focus: true, onOk: () => leave(), html: icon('chevronL') });
  const corner = h('div', { cls: 'pl-corner' }, [h('span', { cls: 'res' }), iconEl('signal'), h('span', { cls: 'tm', text: clock(new Date()) })]);
  ov.appendChild(h('div', { cls: 'top-shade' }));
  ov.appendChild(h('div', { cls: 'bottom-shade' }));
  ov.appendChild(h('div', { cls: 'pl-brand' }, [iconEl('tv'), h('span', { text: 'Taha' }), h('b', { text: 'IPTV' })]));
  ov.appendChild(h('div', { cls: 'pl-title', group: 'title' }, [backBtn, thumb, h('div', { cls: 'pl-text' }, [name, h('div', { cls: 'pl-meta' }, [metaText, metaBadge])])]));
  ov.appendChild(corner);

  const spinner = h('div', { cls: 'spinner' }, [h('i'), h('span', { text: t('loading') })]);
  el.appendChild(spinner);

  // Subtitles: AVPlay hands each line to the page, which draws it (above the controls while they show).
  const subs = h('div', { cls: 'subs size-' + getSettings().subtitleSize }, [h('span')]);
  el.insertBefore(subs, ov);
  let subTimer: ReturnType<typeof setTimeout> | 0 = 0;
  const offText = p.onText((text, ms) => {
    const line = subs.firstChild as HTMLElement;
    line.textContent = text.replace(/<[^>]+>/g, '');   // tags some streams carry (<i>, <font>): text only
    subs.classList.toggle('on', !!line.textContent);
    if (subTimer) clearTimeout(subTimer);
    subTimer = setTimeout(() => subs.classList.remove('on'), Math.max(500, Math.min(ms, 15000)));
  });
  function clearSubs(): void { subs.classList.remove('on'); if (subTimer) clearTimeout(subTimer); }

  // Side arrows: previous / next episode or channel
  const prevBtn = h('div', { cls: 'side-arrow prev', focus: true, onOk: () => step(-1), html: icon('chevronL') });
  const nextBtn = h('div', { cls: 'side-arrow next', focus: true, onOk: () => step(1), html: icon('chevronR') });
  ov.appendChild(prevBtn);
  ov.appendChild(nextBtn);

  // The control panel
  const cur = h('span', { cls: 'cur' }), tot = h('span', { cls: 'tot' }), rem = h('span', { cls: 'rem' });
  const buf = h('div', { cls: 'buf' }), fill = h('div', { cls: 'fill' }), knob = h('div', { cls: 'knob' }), bubble = h('div', { cls: 'bubble' });
  const seekbar = h('div', { cls: 'seekbar', focus: true }, [buf, fill, knob, bubble]);
  const playIcon = h('span', { cls: 'ic-wrap' });
  const ctl = (ic: IconName, label: string, fn: () => void, extra?: string) =>
    h('div', { cls: 'ctl box' + (extra ? ' ' + extra : ''), focus: true, onOk: fn }, [iconEl(ic), h('span', { text: label })]);
  const favCtl = ctl('bookmark', t('favorites'), () => fav());
  const playCtl = h('div', { cls: 'ctl main', focus: true, onOk: () => p.toggle() }, [playIcon]);
  const ccCtl = ctl('cc', t('subtitles'), () => trackSheet('text'));
  ccCtl.appendChild(h('span', { cls: 'tag', text: 'CC' }));
  const controls = h('div', { cls: 'controls', group: 'controls' }, [
    ctl('list', t('episodes'), () => episodesSheet(), 'episodes'),
    favCtl,
    ctl('info', t('info'), () => infoSheet()),
    ctl('rewind', t('minus30'), () => jump(-30000), 'vod'),
    playCtl,
    ctl('forward', t('plus30'), () => jump(30000), 'vod'),
    ccCtl,
    ctl('headphones', t('audio'), () => trackSheet('audio')),
    ctl('settings', t('settings'), () => settingsSheet()),
  ]);
  const panel = h('div', { cls: 'panel-ctl glass' }, [h('div', { cls: 'times' }, [cur, tot, rem]), seekbar, controls]);
  ov.appendChild(panel);

  const liveInfo = h('div', { cls: 'live-info glass' }, [h('div', { cls: 'li-now' }), h('div', { cls: 'li-next' }), h('div', { cls: 'li-time' })]);
  ov.appendChild(liveInfo);

  const errBox = h('div', { cls: 'err glass' });
  el.appendChild(errBox);
  ov.appendChild(h('div', { cls: 'pl-hints glass' }, [
    hintEl('', t('showHide'), 'OK'), hintEl('', t('seek'), '◀ ▶'), hintEl('yellow', t('quality'), 'C'),
    hintEl('green', t('audio'), 'B'), hintEl('red', t('subtitles'), 'A'), hintEl('', t('back'), '', 'back'),
  ]));

  function hintEl(color: string, label: string, key: string, ic?: IconName): HTMLElement {
    const k = h('span', { cls: 'key' + (color ? ' ' + color : '') });
    if (ic) k.appendChild(iconEl(ic)); else k.textContent = key;
    return h('div', { cls: 'hint' }, [k, h('span', { text: label })]);
  }

  // MARK: state

  let uiOn = true, hideTimer = 0, tick = 0, saveTimer = 0, soonTimer = 0, leaving = false;
  const seek = { on: false, pos: 0, last: 0, run: 0 };
  let pending: number | null = null, busy = false;
  let epg: Program[] = [];

  function isLive(): boolean { return item.kind === 'live'; }
  function hasBar(): boolean { return !isLive() && p.canSeek(); }

  function describe(): void {
    const live = isLive();
    el.classList.toggle('is-live', live);
    thumb.src = item.kind === 'live' ? item.logo : item.kind === 'episode' ? (series ? series.poster : item.still) : item.poster;
    if (item.kind === 'episode') {
      name.textContent = series ? series.name + ' - ' + t('seasonN', { n: item.season }) : item.name;
      metaText.textContent = t('episodeN', { n: item.num }) + (series ? ' • ' + series.genres.join('، ') : '');
    } else if (item.kind === 'movie') {
      name.textContent = item.name;
      metaText.textContent = item.year + ' • ' + item.genres.join('، ');
    } else {
      name.textContent = (item.num ? item.num + '  ' : '') + item.name;
      metaText.textContent = t('liveChannels');
    }
    metaBadge.textContent = quality();
    drawResolution();
    panel.style.display = live ? 'none' : '';
    liveInfo.style.display = live ? '' : 'none';
    prevBtn.style.display = nextBtn.style.display = live ? (list.length > 1 ? '' : 'none') : item.kind === 'episode' ? '' : 'none';
    controls.querySelector('.episodes')!.toggleAttribute('data-disabled', item.kind !== 'episode');
    (controls.querySelector('.episodes') as HTMLElement).style.display = item.kind === 'episode' ? '' : 'none';
    drawFav();
    if (live) loadEpg();
  }

  function quality(): string {
    return item.kind === 'movie' ? item.quality : item.kind === 'episode' ? (series ? series.quality : 'HD') : item.hd ? 'HD' : 'SD';
  }

  /** The corner: the picture's real size once it plays, else what the list says. */
  function drawResolution(): void {
    const v = p.videoInfo(), hgt = v ? v.height : 0, q = quality();
    (corner.firstChild as HTMLElement).textContent = hgt
      ? hgt + 'p ' + (hgt >= 2000 ? '4K' : hgt >= 1000 ? 'FHD' : hgt >= 700 ? 'HD' : 'SD')
      : q === '4K' ? '2160p 4K' : q === 'HD' ? '1080p FHD' : '576p SD';
  }

  function drawFav(): void {
    const target = item.kind === 'episode' ? series : item;
    const on = !!target && isFavorite(target.kind, target.id);
    favCtl.classList.toggle('on', on);
  }

  let epgAt = 0;
  function loadEpg(): void {
    const c = item as Channel;
    epg = [];
    epgAt = Date.now();
    drawLive();
    app.source.epg(c).then((l) => { if (item === c) { epg = l; drawLive(); } });
  }

  function drawLive(): void {
    const now = Date.now(), a = epg.find((x) => x.start <= now && x.end > now), b = epg.find((x) => x.start > now);
    // The guide ran out (its last program ended while watching): ask again, at most once a minute.
    if (!a && epg.length && epg[epg.length - 1].end <= now && now - epgAt > 60000) { loadEpg(); return; }
    liveInfo.children[0].textContent = a ? t('now') + ': ' + a.title : t('noEpg');
    liveInfo.children[1].textContent = b ? t('next') + ': ' + b.title : '';
    liveInfo.children[2].textContent = a ? clock(new Date(a.start)) + ' – ' + clock(new Date(a.end)) : '';
  }

  function start(startAt: number): void {
    errBox.classList.remove('on');
    cancelSeek();
    clearSubs();
    prefsDone = false;
    describe();
    p.play(app.source.streamUrl(item), { rect: FULL, live: isLive(), startAt, uhd: quality() === '4K' });
    if (speed !== 1) speed = 1;
    if (aspect === 'fill') p.setFill(true);
    record(item, startAt, item.kind === 'live' ? 0 : item.duration, series);
  }

  // MARK: the overlay

  function show(): void {
    uiOn = true;
    el.classList.remove('hidden-ui');
    armHide();
    draw();
  }
  function mode(): 'NORMAL_NAVIGATION' | 'SEEK_MODE' | 'MENU_OPEN' {
    return hasDialog() ? 'MENU_OPEN' : seek.on ? 'SEEK_MODE' : 'NORMAL_NAVIGATION';
  }
  /** The overlay stays while a point is being chosen, a seek runs, a sheet is open, or the stream is paused/failed. */
  function held(): boolean { return mode() !== 'NORMAL_NAVIGATION' || busy; }
  function hide(): void {
    if (held() || p.state === 'PAUSED' || p.state === 'ERROR') return;
    uiOn = false;
    el.classList.add('hidden-ui');
  }
  function armHide(): void {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => { if (held()) armHide(); else hide(); }, HIDE_AFTER);
  }

  // MARK: remote focus in the overlay: rows, top to bottom

  const shown = (e: HTMLElement) => !e.hasAttribute('data-disabled') && e.offsetParent !== null;
  const midX = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return (r.left + r.right) / 2; };
  const ctls = () => Array.prototype.slice.call(controls.querySelectorAll('[data-f]')) as HTMLElement[];
  /** The row an element is in (0 back, 1 side arrows, 2 seek bar, 3 controls), or -1 (the error box). */
  function rowOf(e: HTMLElement | null): number {
    return !e ? -1 : e === backBtn ? 0 : e === prevBtn || e === nextBtn ? 1 : e === seekbar ? 2 : controls.contains(e) ? 3 : -1;
  }
  function row(i: number): HTMLElement[] {
    return (i === 0 ? [backBtn] : i === 1 ? [prevBtn, nextBtn] : i === 2 ? (hasBar() ? [seekbar] : []) : ctls()).filter(shown);
  }
  /** Where each row was left (coming back to a row lands there). */
  const lastIn: Array<HTMLElement | null> = [null, null, null, null];
  const offFocus = onFocus((e) => { const r = rowOf(e); if (r >= 0) lastIn[r] = e; });

  /** The element of `list` nearest to x, or the one closest that way (dir ±1) from `from`. */
  function nearest(list: HTMLElement[], x: number, dir?: number, from?: HTMLElement): HTMLElement | null {
    let best: HTMLElement | null = null, low = Infinity;
    for (const e of list) {
      if (e === from) continue;
      const d = (midX(e) - x) * (dir || 1);
      if (dir ? d > 1 && d < low : Math.abs(d) < low) { low = dir ? d : Math.abs(d); best = e; }
    }
    return best;
  }

  /** ↑ ↓ ← → in the overlay; false leaves it to the focus engine (the error box). */
  function navigate(key: 'up' | 'down' | 'left' | 'right'): boolean {
    if (errBox.classList.contains('on')) return false;
    const f = focused(), r = rowOf(f);
    if (r < 0 || !f || !shown(f)) { focus(home()); return true; }   // nothing focused, or it went (a disabled ±30)
    if (key === 'left' || key === 'right') {
      const next = nearest(row(r), midX(f), key === 'right' ? 1 : -1, f);
      if (next) focus(next);
      return true;                                  // the ends of a row: the focus stays
    }
    if (f === seekbar && seek.on) { cancelSeek(); draw(); }   // leaving the bar drops a chosen point
    for (let i = r + (key === 'down' ? 1 : -1); i >= 0 && i <= 3; i += key === 'down' ? 1 : -1) {
      const list = row(i);
      if (!list.length) continue;
      const m = lastIn[i];
      focus(m && list.indexOf(m) >= 0 ? m : nearest(list, midX(f)));
      return true;
    }
    return true;
  }

  /** Where the focus goes when the overlay comes back: the seek bar, else play/pause, else a live channel's arrows. */
  function home(): HTMLElement {
    if (hasBar()) return seekbar;
    if (!isLive()) return playCtl;
    const side = row(1);
    return lastIn[1] && side.indexOf(lastIn[1]) >= 0 ? lastIn[1] : side[side.length - 1] || backBtn;
  }

  function draw(): void {
    const st = p.state;
    playIcon.innerHTML = icon(st === 'PAUSED' || st === 'READY' ? 'play' : 'pause');
    spinner.classList.toggle('on', st === 'PREPARING' || st === 'BUFFERING' || busy);
    (spinner.lastChild as HTMLElement).textContent = busy ? t('seeking') : retrying ? t('reconnecting') : t('loading');
    (corner.lastChild as HTMLElement).textContent = clock(new Date());
    if (st === 'PLAYING') drawResolution();   // adaptive streams change quality as they go
    if (isLive()) { drawLive(); return; }
    const d = p.duration(), shownPos = busy && pending !== null ? pending : p.time();
    const bar = hasBar();
    seekbar.classList.toggle('live-bar', !bar);
    seekbar.toggleAttribute('data-disabled', !bar);
    for (const v of Array.prototype.slice.call(controls.querySelectorAll('.vod')) as HTMLElement[]) v.toggleAttribute('data-disabled', !bar);
    if (!d) { cur.textContent = tot.textContent = rem.textContent = ''; fill.style.width = buf.style.width = '0'; return; }
    const at = seek.on ? seek.pos : shownPos, pct = (v: number) => Math.max(0, Math.min(100, v / d * 100)).toFixed(2) + '%';
    fill.style.width = pct(shownPos);
    buf.style.width = pct(Math.max(shownPos, p.buffered()));
    knob.style.left = bubble.style.left = pct(at);
    bubble.textContent = seek.on ? hms(at, true) + '  (' + (at >= shownPos ? '+' : '−') + hms(Math.abs(at - shownPos)) + ')' : hms(at, true);
    cur.textContent = hms(shownPos, true);
    tot.textContent = hms(d, true);
    rem.textContent = '−' + hms(d - shownPos, true);
    seekbar.classList.toggle('choosing', seek.on);
    seekbar.classList.toggle('busy', busy);
  }

  // MARK: seeking

  function scrub(dir: number, big?: boolean): void {
    if (!hasBar()) { toast(t('noSeek')); return; }
    const d = p.duration(), now = Date.now();
    seek.run = now - seek.last < 450 ? seek.run + 1 : 0;
    seek.last = now;
    if (!seek.on) { seek.on = true; seek.pos = busy && pending !== null ? pending : p.time(); }
    const stepMs = big ? 30000 : seek.run < 5 ? 10000 : seek.run < 15 ? 30000 : seek.run < 30 ? 60000 : Math.max(120000, d / 50);
    seek.pos = Math.max(0, Math.min(d - 1500, seek.pos + dir * stepMs));
    focus(seekbar);
    show();
  }
  function cancelSeek(): void { seek.on = false; seek.run = 0; }
  function commitSeek(): void { if (!seek.on) return; const to = seek.pos; cancelSeek(); jumpTo(to); }
  function jump(by: number): void { jumpTo((busy && pending !== null ? pending : p.time()) + by); }
  function jumpTo(ms: number): void {
    if (!isFinite(ms)) return;
    if (!hasBar()) { toast(t('noSeek')); return; }
    cancelSeek();
    pending = Math.max(0, Math.min(p.duration() - 1500, ms));
    busy = true;
    const it = item;
    p.seek(pending, (ok) => {
      if (item !== it) return;
      busy = p.busy;
      if (!busy) pending = null;
      if (!ok) toast(t('noSeek'));
      saveSoon();
      draw();
    });
    show();
  }

  onKey(seekbar, (key) => {
    if (key === 'left' || key === 'right') { scrub(key === 'right' ? 1 : -1); return true; }
    // OK with the overlay hidden only brings it back (it used to pause: the seek bar keeps the focus while hidden).
    if (key === 'ok') { if (!uiOn) show(); else { if (seek.on) commitSeek(); else p.toggle(); show(); } return true; }
    return false;
  });

  // MARK: actions

  function step(d: number, auto?: boolean): void {
    if (isLive()) { zap(d); return; }
    if (item.kind !== 'episode' || !series || !series.seasons) return;
    const all: Episode[] = [];
    for (const s of series.seasons) for (const e of s.episodes) all.push(e);
    const i = all.findIndex((e) => e.id === item.id), next = i < 0 ? undefined : all[i + d];
    if (!next) {
      if (auto) leave();                            // the last episode ended: out of the player, as a film does
      else { toast(d > 0 ? t('lastEpisode') : t('firstEpisode')); show(); }
      return;
    }
    saveNow();
    item = next;
    start(0);
    show();
  }

  let zapTimer = 0;
  function zap(d: number): void {
    if (!list.length) return;
    const i = list.findIndex((c) => c.id === item.id), next = list[(i + d + list.length) % list.length];
    item = next;
    describe();
    show();
    clearTimeout(zapTimer);
    // A fast run of presses opens only the last channel.
    zapTimer = window.setTimeout(() => { if (item === next) start(0); }, 280);
  }

  function fav(): void {
    const target = item.kind === 'episode' ? series : item;
    if (!target) return;
    toast(toggleFavorite(target) ? t('addFavorite') + ' ✓' : t('removeFavorite'));
    drawFav();
  }

  function saveNow(): void { if (!isLive() && p.duration()) record(item, p.time(), p.duration() || (item as Movie).duration, series); }
  function saveSoon(): void { clearTimeout(soonTimer); soonTimer = window.setTimeout(saveNow, 3000); }

  /** Out of the player, to the screen under it (not just hiding the overlay). */
  function leave(): void {
    leaving = true;
    back();
  }

  // MARK: side sheets (Back closes them)

  /**
   * A side sheet. A row with `value` is a setting changed in place: OK steps it round, ← → step it down / up, and
   * the focus stays on it. The overlay stays while the sheet is open; Back (or a choice) closes it and the focus
   * goes back to the button that opened it.
   */
  interface Row { label: string; end?: string; on?: boolean; run: () => void; value?: () => string; adjust?: (dir: number) => void }
  function sheet(ic: IconName, title: string, rows: Row[]): void {
    if (seek.on) { cancelSeek(); draw(); }
    const box = h('div', { cls: 'sheet' }, [h('h3', null, [iconEl(ic), h('span', { text: title })])]);
    let first: HTMLElement | undefined;
    for (const r of rows) {
      const end = r.value ? h('span', { cls: 'end', text: r.value() }) : r.end ? h('span', { cls: 'end', text: r.end }) : null;
      const redraw = () => { if (end && r.value) end.textContent = r.value(); };
      const o = h('div', { cls: 'opt' + (r.on ? ' on' : ''), focus: true, onOk: () => { r.run(); redraw(); } }, [h('span', { text: r.label }), end]);
      if (r.adjust) {
        const adjust = r.adjust;
        onKey(o, (key) => {
          if (key !== 'left' && key !== 'right') return false;
          adjust(key === 'right' ? 1 : -1);
          redraw();
          return true;
        });
      }
      if (r.on && r.end === undefined) o.appendChild(h('span', { cls: 'end', html: icon('check') }));
      box.appendChild(o);
      if (!first || r.on) first = o;
    }
    show();
    openDialog(box, { first, onClose: () => show() });
  }

  function demoTracks(kind: 'audio' | 'text'): Track[] {
    return kind === 'audio' ? [{ id: 'a1', label: '', lang: 'ar' }, { id: 'a2', label: '', lang: 'en' }]
      : [{ id: 't1', label: '', lang: 'ar' }, { id: 't2', label: '', lang: 'en' }];
  }
  function tracks(kind: 'audio' | 'text'): Track[] {
    const real = kind === 'audio' ? p.audioTracks() : p.textTracks();
    return real.length ? real : demo ? demoTracks(kind) : [];
  }
  let audioSel: string | null = null, textSel: string | null = null, prefsDone = false;

  /** Your language preferences (Settings > Playback), once per stream, as soon as it plays and lists its tracks. */
  function applyPrefs(): void {
    if (prefsDone) return;
    prefsDone = true;
    const s = getSettings(), a = tracks('audio'), x = tracks('text');
    audioSel = p.currentAudio() || (a[0] ? a[0].id : null);
    const al = s.audioLang, sl = s.subtitles;
    if (al !== 'auto') {
      const want = a.find((tr) => isLang(tr.lang, al));
      if (want && want.id !== audioSel && p.setAudio(want.id)) audioSel = want.id;
    }
    textSel = null;
    if (sl !== 'off') {
      const want = x.find((tr) => isLang(tr.lang, sl)) || null;
      if (want && (p.setText(want.id) || demo)) textSel = want.id;
    }
  }

  function trackSheet(kind: 'audio' | 'text'): void {
    const list2 = tracks(kind);
    if (kind === 'audio' && list2.length < 2) { toast(t('noTracks')); return; }
    if (kind === 'text' && !list2.length) { toast(t('notHere')); return; }
    const rows = list2.map((tr, i) => ({ label: trackName(tr, i), end: tr.detail || undefined,
      on: kind === 'audio' ? audioSel === tr.id : textSel === tr.id,
      run: () => {
        const ok = kind === 'audio' ? p.setAudio(tr.id) || demo : p.setText(tr.id) || demo;
        if (ok) { if (kind === 'audio') audioSel = tr.id; else textSel = tr.id; }
        closeDialog();
        toast(ok ? trackName(tr, i) : t('notHere'));
      } }));
    if (kind === 'text') rows.unshift({ label: t('trackOff'), end: undefined, on: textSel === null,
      run: () => { textSel = null; p.setText(null); clearSubs(); closeDialog(); toast(t('trackOff')); } });
    sheet(kind === 'audio' ? 'headphones' : 'cc', kind === 'audio' ? t('audio') : t('subtitles'), rows);
  }

  function episodesSheet(): void {
    if (item.kind !== 'episode' || !series || !series.seasons) return;
    const season = series.seasons.find((s) => s.num === (item as Episode).season);
    if (!season) return;
    sheet('list', t('seasonN', { n: season.num }), season.episodes.map((e) => ({
      label: e.num + '. ' + e.name, end: hms(e.duration), on: e.id === item.id,
      run: () => { closeDialog(); saveNow(); item = e; start(0); },
    })));
  }

  function infoSheet(): void {
    const rows: Array<{ label: string; end?: string; run: () => void }> = [];
    const noop = () => {};
    if (item.kind === 'movie') {
      rows.push({ label: t('year'), end: String(item.year), run: noop }, { label: t('duration'), end: hms(item.duration), run: noop },
        { label: t('genre'), end: item.genres.join('، '), run: noop }, { label: t('rating'), end: item.rating.toFixed(1), run: noop },
        { label: t('director'), end: item.director, run: noop });
    } else if (item.kind === 'episode') {
      rows.push({ label: t('series'), end: series ? series.name : '', run: noop }, { label: t('seasonN', { n: item.season }), end: t('episodeN', { n: item.num }), run: noop },
        { label: t('duration'), end: hms(item.duration), run: noop });
    } else {
      rows.push({ label: t('channels'), end: item.name, run: noop }, { label: '#', end: String(item.num), run: noop });
    }
    const v = p.videoInfo();
    if (v) rows.push({ label: t('video'), end: v.width + ' × ' + v.height + (v.codec ? ' · ' + v.codec : ''), run: noop });
    rows.push({ label: t('engine'), end: p.engineName, run: noop });
    sheet('info', t('info'), rows);
  }

  let speed = 1, aspect: 'normal' | 'fill' = 'normal';
  function settingsSheet(): void {
    // Quality: neither engine offers a choice of renditions (AVPlay picks the bitrate of an adaptive stream by
    // itself), so the row says Auto rather than listing made-up options.
    const rows: Row[] = [
      { label: t('quality'), end: t('auto'), run: () => toast(t('quality') + ': ' + t('auto')) },
    ];
    // Speed only where the engine plays other speeds with sound, and never on a live channel.
    const speeds = p.speeds();
    const setSpeed = (i: number) => { const next = speeds[i]; if (next !== undefined && next !== speed && p.setSpeed(next)) speed = next; };
    if (speeds.length > 1 && !isLive()) rows.push({ label: t('speed'), value: () => speed + '×',
      run: () => setSpeed((speeds.indexOf(speed) + 1) % speeds.length),
      adjust: (dir) => setSpeed(Math.max(0, Math.min(speeds.length - 1, speeds.indexOf(speed) + dir))) });
    const flipAspect = () => { aspect = aspect === 'normal' ? 'fill' : 'normal'; p.setFill(aspect === 'fill'); };
    rows.push({ label: t('aspect'), value: () => t(aspect), run: flipAspect, adjust: flipAspect });
    sheet('settings', t('settings'), rows);
  }

  // MARK: player events

  let retrying = false;
  const off = p.on((st, info) => {
    retrying = !!info.retrying && (st === 'PREPARING' || st === 'BUFFERING');
    if (st === 'PLAYING') { applyPrefs(); drawResolution(); }
    if (st === 'ERROR') {
      clearSubs();
      errBox.innerHTML = '';
      errBox.appendChild(h('p', { text: errorText(info.error) }));
      const retry = h('div', { cls: 'btn primary', focus: true, onOk: () => start(isLive() ? 0 : p.time()) }, [h('span', { text: t('pressOk') + ' · ↻' })]);
      const back = h('div', { cls: 'btn', focus: true, onOk: () => leave() }, [h('span', { text: t('back') })]);
      errBox.appendChild(retry);
      errBox.appendChild(back);
      errBox.classList.add('on');
      show();
      focus(retry);
      return;
    }
    if (st === 'ENDED' && !isLive()) {
      markDone(item as Movie | Episode, p.duration());   // watched: the series moves on, Continue Watching lets it go
      if (item.kind === 'episode') { step(1, true); return; }
      leave();
      return;
    }
    draw();
  });

  // MARK: start

  describe();
  if (continuing) {
    p.place(FULL);
    record(item, 0, 0);
    if (p.state === 'PLAYING') { applyPrefs(); drawResolution(); }
  } else start((params && (params.startAt as number)) || 0);
  tick = window.setInterval(() => { if (uiOn) draw(); }, 1000);
  saveTimer = window.setInterval(saveNow, 15000) as unknown as number;
  armHide();

  return {
    el,
    first: () => (isLive() ? home() : seekbar),
    onKey(key: Key, repeat: boolean) {
      void repeat;
      // Hidden overlay: the first key brings it back (and acts, for the keys that have a meaning without it).
      if (!uiOn && key !== 'back') {
        if (isLive() && (key === 'up' || key === 'down')) { zap(key === 'up' ? 1 : -1); return true; }
        if (!isLive() && (key === 'left' || key === 'right')) { scrub(key === 'right' ? 1 : -1); return true; }
        if (key === 'playpause' || key === 'play' || key === 'pause') { if (key === 'pause') p.pause(); else if (key === 'play') p.resume(); else p.toggle(); show(); return true; }
        if (key === 'chup' || key === 'chdown') { if (isLive()) zap(key === 'chup' ? 1 : -1); show(); return true; }
        show();
        if (key === 'ok' || key === 'up' || key === 'down' || key === 'left' || key === 'right') {
          if (!errBox.classList.contains('on')) focus(home());
          return true;
        }
      }
      armHide();
      if (key === 'playpause' || key === 'play' || key === 'pause') { if (key === 'pause') p.pause(); else if (key === 'play') p.resume(); else p.toggle(); draw(); return true; }
      if (key === 'ff' || key === 'rw') { scrub(key === 'ff' ? 1 : -1, true); return true; }
      if (key === 'chup' || key === 'chdown') { if (isLive()) zap(key === 'chup' ? 1 : -1); return true; }
      if (key === 'red') { trackSheet('text'); return true; }
      if (key === 'green') { trackSheet('audio'); return true; }
      if (key === 'yellow') { settingsSheet(); return true; }
      if (key === 'blue') { episodesSheet(); return true; }
      if (key === 'info') { infoSheet(); return true; }
      const digit = digitOf(key);
      if (digit !== null) { if (hasBar()) jumpTo(p.duration() * digit / 10); return true; }
      if (key === 'up' || key === 'down' || key === 'left' || key === 'right') return navigate(key);
      return false;
    },
    onBack() {
      if (leaving) return false;
      if (seek.on) { cancelSeek(); draw(); return true; }      // Back while choosing a point: it stays where it was
      if (uiOn && !errBox.classList.contains('on') && p.state !== 'PAUSED') { hide(); return true; }
      return false;
    },
    destroy() {
      saveNow();
      off();
      offText();
      offFocus();
      clearSubs();
      if (aspect === 'fill') p.setFill(false);
      clearInterval(tick);
      clearInterval(saveTimer);
      clearTimeout(soonTimer);
      clearTimeout(hideTimer);
      clearTimeout(zapTimer);
      const onExit = params && (params.onExit as ((c: Playable) => void) | undefined);
      if (continuing && isLive()) { if (onExit) onExit(item); } else p.stop();
    },
  };
}
