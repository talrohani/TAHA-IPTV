/**
 * The full-screen player, after the reference design: title and episode at the top, the clock and quality in the
 * corner, and a control panel with the seek bar (films and episodes), −30 / play / +30, episodes, favorites, info,
 * subtitles, audio and settings. The overlay hides after 5 s and stays while seeking.
 *
 * Seek bar: ← → move a point along it without touching playback (held: bigger steps), OK jumps there, Back drops
 * it. Live channels have no seek bar (no fake timeline): ↑ ↓ and the channel keys change channel instead.
 */
import { h, toast } from '../ui/components';
import { iconEl, icon, IconName } from '../ui/icons';
import { hms, clock, onKey } from '../core/dom';
import { t, errorText } from '../core/i18n';
import { openDialog, closeDialog, back } from '../core/router';
import { focus, focused, focusGroup } from '../core/focus';
import { getSettings } from '../core/store';
import { app } from '../app';
import { record, isFavorite, toggleFavorite } from '../data/library';
import type { Screen } from '../core/router';
import type { Channel, Episode, Movie, Program, Series } from '../data/types';
import type { Key } from '../core/keys';
import type { Track } from '../playback/player';

const FULL = { x: 0, y: 0, w: 1920, h: 1080 };
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
    const q = item.kind === 'movie' ? item.quality : item.kind === 'episode' ? (series ? series.quality : 'HD') : item.hd ? 'HD' : 'SD';
    metaBadge.textContent = q;
    (corner.firstChild as HTMLElement).textContent = q === '4K' ? '2160p 4K' : q === 'HD' ? '1080p FHD' : '576p SD';
    panel.style.display = live ? 'none' : '';
    liveInfo.style.display = live ? '' : 'none';
    prevBtn.style.display = nextBtn.style.display = live ? (list.length > 1 ? '' : 'none') : item.kind === 'episode' ? '' : 'none';
    controls.querySelector('.episodes')!.toggleAttribute('data-disabled', item.kind !== 'episode');
    (controls.querySelector('.episodes') as HTMLElement).style.display = item.kind === 'episode' ? '' : 'none';
    drawFav();
    if (live) loadEpg();
  }

  function drawFav(): void {
    const target = item.kind === 'episode' ? series : item;
    const on = !!target && isFavorite(target.kind, target.id);
    favCtl.classList.toggle('on', on);
  }

  function loadEpg(): void {
    const c = item as Channel;
    epg = [];
    drawLive();
    app.source.epg(c).then((l) => { if (item === c) { epg = l; drawLive(); } });
  }

  function drawLive(): void {
    const now = Date.now(), a = epg.find((x) => x.start <= now && x.end > now), b = epg.find((x) => x.start > now);
    liveInfo.children[0].textContent = a ? t('now') + ': ' + a.title : t('noEpg');
    liveInfo.children[1].textContent = b ? t('next') + ': ' + b.title : '';
    liveInfo.children[2].textContent = a ? clock(new Date(a.start)) + ' – ' + clock(new Date(a.end)) : '';
  }

  function start(startAt: number): void {
    errBox.classList.remove('on');
    cancelSeek();
    describe();
    p.play(app.source.streamUrl(item), { rect: FULL, live: isLive(), startAt });
    record(item, startAt, item.kind === 'live' ? 0 : item.duration, series);
  }

  // MARK: the overlay

  function show(): void {
    uiOn = true;
    el.classList.remove('hidden-ui');
    armHide();
    draw();
  }
  function hide(): void {
    if (seek.on || busy || p.state === 'PAUSED' || p.state === 'ERROR') return;
    uiOn = false;
    el.classList.add('hidden-ui');
  }
  function armHide(): void {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => { if (seek.on || busy) armHide(); else hide(); }, HIDE_AFTER);
  }

  function draw(): void {
    const st = p.state;
    playIcon.innerHTML = icon(st === 'PAUSED' || st === 'READY' ? 'play' : 'pause');
    spinner.classList.toggle('on', st === 'PREPARING' || st === 'BUFFERING' || busy);
    (spinner.lastChild as HTMLElement).textContent = busy ? t('seeking') : t('loading');
    (corner.lastChild as HTMLElement).textContent = clock(new Date());
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
    if (key === 'ok') { if (seek.on) commitSeek(); else p.toggle(); show(); return true; }
    return false;
  });

  // MARK: actions

  function step(d: number): void {
    if (isLive()) { zap(d); return; }
    if (item.kind !== 'episode' || !series || !series.seasons) return;
    const all: Episode[] = [];
    for (const s of series.seasons) for (const e of s.episodes) all.push(e);
    const i = all.findIndex((e) => e.id === item.id), next = all[i + d];
    if (!next) return;
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

  function sheet(ic: IconName, title: string, rows: Array<{ label: string; end?: string; on?: boolean; run: () => void }>): void {
    const box = h('div', { cls: 'sheet' }, [h('h3', null, [iconEl(ic), h('span', { text: title })])]);
    let first: HTMLElement | undefined;
    for (const r of rows) {
      const o = h('div', { cls: 'opt' + (r.on ? ' on' : ''), focus: true, onOk: () => { r.run(); } }, [h('span', { text: r.label }), r.end ? h('span', { cls: 'end', text: r.end }) : null]);
      if (r.on && r.end === undefined) o.appendChild(h('span', { cls: 'end', html: icon('check') }));
      box.appendChild(o);
      if (!first || r.on) first = o;
    }
    openDialog(box, { first, onClose: () => show() });
  }

  function demoTracks(kind: 'audio' | 'text'): Track[] {
    return kind === 'audio' ? [{ id: 'a1', label: t('trackAr'), lang: 'ar' }, { id: 'a2', label: t('trackEn'), lang: 'en' }]
      : [{ id: 't1', label: t('trackAr'), lang: 'ar' }, { id: 't2', label: t('trackEn'), lang: 'en' }];
  }
  let audioSel = 'a1', textSel: string | null = getSettings().subtitles === 'off' ? null : 't1';

  function trackSheet(kind: 'audio' | 'text'): void {
    const real = kind === 'audio' ? p.audioTracks() : p.textTracks();
    const list2 = real.length ? real : demo ? demoTracks(kind) : [];
    const rows = list2.map((tr) => ({ label: tr.label, on: kind === 'audio' ? audioSel === tr.id : textSel === tr.id,
      run: () => { if (kind === 'audio') { audioSel = tr.id; p.setAudio(tr.id); } else { textSel = tr.id; p.setText(tr.id); } closeDialog(); toast(tr.label); } }));
    if (kind === 'text') rows.unshift({ label: t('trackOff'), on: textSel === null, run: () => { textSel = null; p.setText(null); closeDialog(); toast(t('trackOff')); } });
    if (!rows.length) { toast(t('trackOff')); return; }
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
    rows.push({ label: t('engine'), end: p.engineName, run: noop });
    sheet('info', t('info'), rows);
  }

  let speed = 1, aspect: 'normal' | 'fill' = 'normal';
  function settingsSheet(): void {
    sheet('settings', t('settings'), [
      { label: t('quality'), end: t('auto'), run: () => toast(t('quality') + ': ' + t('auto')) },
      { label: t('speed'), end: speed + '×', run: () => { speed = speed >= 2 ? 0.5 : speed + 0.25; const v = document.querySelector('.video-plane') as HTMLVideoElement | null; if (v) v.playbackRate = speed; closeDialog(); settingsSheet(); } },
      { label: t('aspect'), end: t(aspect), run: () => { aspect = aspect === 'normal' ? 'fill' : 'normal'; const v = document.querySelector('.video-plane') as HTMLVideoElement | null; if (v) v.style.objectFit = aspect === 'fill' ? 'cover' : 'contain'; closeDialog(); settingsSheet(); } },
    ]);
  }

  // MARK: player events

  const off = p.on((st, info) => {
    if (st === 'ERROR') {
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
      saveNow();
      if (item.kind === 'episode') { step(1); return; }
      leave();
      return;
    }
    draw();
  });

  // MARK: start

  describe();
  if (continuing) { p.place(FULL); record(item, 0, 0); } else start((params && (params.startAt as number)) || 0);
  tick = window.setInterval(() => { if (uiOn) draw(); }, 1000);
  saveTimer = window.setInterval(saveNow, 15000) as unknown as number;
  armHide();

  return {
    el,
    first: () => (isLive() ? playCtl : seekbar),
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
          focus(hasBar() ? seekbar : playCtl);
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
      if (key.charAt(0) === 'd' && hasBar()) { jumpTo(p.duration() * parseInt(key.slice(1), 10) / 10); return true; }
      // Up from the controls onto the seek bar, and down again, without passing the side arrows.
      const f = focused();
      if (key === 'up' && f && controls.contains(f) && hasBar()) { focus(seekbar); return true; }
      if (key === 'down' && f === seekbar) { focusGroup(controls); return true; }
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
