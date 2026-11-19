/**
 * Samsung AVPlay (webapis.avplay): the TV's own player, with its hardware decoders, HLS and MPEG-TS. It draws on a
 * video plane under the web page (the page must be transparent there: see matte.ts), placed with setDisplayRect in
 * the TV's 1920 x 1080 coordinates.
 *
 * Order AVPlay insists on: open → setListener → (buffering, 4K, display) → prepareAsync → [seekTo] → play; every call
 * only in the states its reference allows, so each one is wrapped: a refused call is a no, never an exception.
 * A stream released while its prepare was running is dropped when the prepare answers (`gen`).
 */
import type { Engine, EngineEvents, ErrorCode, OpenOptions, Rect, Track, VideoInfo } from './player';
import { resumable } from './player';
import { clampRect, isFull, screenRect } from './rect';
import { diag, boxOf } from '../diag';

type AvState = 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED';
interface AvTrack { index: number; type: 'VIDEO' | 'AUDIO' | 'TEXT' | string; extra_info: string }
interface AvListener {
  onbufferingstart(): void;
  onbufferingprogress(percent: number): void;
  onbufferingcomplete(): void;
  onstreamcompleted(): void;
  oncurrentplaytime(ms: number): void;
  onevent(type: string, data: string): void;
  onerror(type: string): void;
  onsubtitlechange(duration: number, text: string, type?: number, attributes?: unknown): void;
  ondrmevent(type: string, data: unknown): void;
}
export interface AvPlay {
  open(url: string): void;
  close(): void;
  setListener(l: AvListener): void;
  prepareAsync(ok: () => void, fail: (e: unknown) => void): void;
  play(): void;
  pause(): void;
  stop(): void;
  seekTo(ms: number, ok?: () => void, fail?: (e: unknown) => void): void;
  getState(): AvState;
  getCurrentTime(): number;
  getDuration(): number;
  setDisplayRect(x: number, y: number, w: number, h: number): void;
  setDisplayMethod(m: string): void;
  setBufferingParam(option: string, unit: string, amount: number): void;
  setStreamingProperty(name: string, value: string): void;
  getTotalTrackInfo(): AvTrack[];
  getCurrentStreamInfo(): AvTrack[];
  setSelectTrack(type: string, index: number): void;
  setSilentSubtitle(silent: boolean): void;
  suspend(): void;
  restore(): void;
}

export function avplay(): AvPlay | null {
  const w = window as unknown as { webapis?: { avplay?: AvPlay } };
  return w.webapis && w.webapis.avplay ? w.webapis.avplay : null;
}

/** Seconds AVPlay fills before it starts (and after a stall). Automatic leaves the TV's own. */
const BUFFER: Record<'low' | 'high', [number, number]> = { low: [3, 5], high: [10, 15] };

/** AVPlay's error names → what the screen says. */
export function errorCode(name: unknown): ErrorCode {
  const n = String(name || '');
  if (/NOT_SUPPORTED|UNSUPPORTED|CODEC|FORMAT|INVALID_URI|NotSupported/i.test(n)) return 'unsupported';
  if (/CONNECTION|NETWORK|TIMEOUT|HTTP|NetworkError/i.test(n)) return 'network';
  return 'stream';
}

/** extra_info is JSON in a string (and not always): whatever can be read of it. */
function info(t: AvTrack): Record<string, string> {
  try { const o = JSON.parse(t.extra_info); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}

export function tracksOf(list: AvTrack[], type: 'AUDIO' | 'TEXT'): Track[] {
  const out: Track[] = [];
  for (const t of list || []) {
    if (!t || t.type !== type) continue;
    const x = info(t);
    const lang = String(x.language || x.track_lang || x.lang || '').toLowerCase();
    const parts: string[] = [];
    if (x.fourCC) parts.push(String(x.fourCC));
    const ch = parseInt(x.channels, 10);
    if (ch) parts.push(ch === 6 ? '5.1' : ch === 8 ? '7.1' : ch === 1 ? 'mono' : ch + '.0');
    out.push({ id: String(t.index), label: '', lang, detail: parts.join(' ') });
  }
  return out;
}

const errName = (e: unknown) => String((e && (e as { name?: string }).name) || e || 'error');

export class AvplayEngine implements Engine {
  readonly name = 'Samsung AVPlay';
  private el: HTMLElement | null = null;
  private rect: Rect = { x: 0, y: 0, w: 1920, h: 1080 };
  private gen = 0;
  private fill = false;
  private textOn = false;
  private live = false;

  constructor(private av: AvPlay) {}

  private state(): AvState { try { return this.av.getState(); } catch { return 'NONE'; } }

  attach(host: HTMLElement): void {
    if (this.el) return;
    const o = document.createElement('object');
    o.setAttribute('type', 'application/avplayer');
    o.className = 'video-plane avplay';
    host.appendChild(o);
    this.el = o;
    this.placeEl();
  }

  private placeEl(): void {
    if (!this.el) return;
    const s = this.el.style, r = this.rect;
    s.left = r.x + 'px'; s.top = r.y + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px';
  }

  place(r: Rect): void {
    const ok = clampRect(r);
    if (!ok) { diag('place.refused', { rect: r }); return; }   // no size (a box not laid out yet): keep the last one
    this.rect = ok;
    this.placeEl();
    if (this.state() === 'NONE') { diag('place.later', { mode: isFull(ok) ? 'FULLSCREEN' : 'PREVIEW', rect: ok }); return; }
    this.display(isFull(ok) ? 'FULLSCREEN' : 'PREVIEW');
  }

  /**
   * The display area, then the display method (letterbox or fill), always as a pair: at open (IDLE), again once
   * the stream is prepared (READY: the picture's size is known then), on every move, and after the app comes back.
   * On the TV the live preview stayed black with sound while the full screen showed, and the one difference was
   * when the area was set: the preview's only before prepare, the full screen's during playback. Hence the call
   * after prepare (the diagnostics build, tizen/diag.py, shows each call and AVPlay's answer).
   */
  private display(why: string): void {
    const s = clampRect(screenRect(this.rect)) || screenRect(this.rect), st = this.state();
    let rectOk = true, err = '';
    try { this.av.setDisplayRect(s.x, s.y, s.w, s.h); } catch (e) { rectOk = false; err = errName(e); }
    this.applyFill();
    diag('display', { why, state: st, stage: this.rect, tv: s, ok: rectOk, err, method: this.fill ? 'FULL_SCREEN' : 'LETTER_BOX', object: boxOf(this.el) });
  }

  open(url: string, o: OpenOptions, ev: EngineEvents): void {
    const av = this.av, my = ++this.gen;
    const live = (fn: () => void) => () => { if (my === this.gen) fn(); };
    this.live = o.live;
    this.textOn = false;
    try {
      av.open(url);
      av.setListener({
        onbufferingstart: live(() => ev.buffering(0)),
        onbufferingprogress: (p) => { if (my === this.gen) ev.buffering(p); },
        onbufferingcomplete: live(() => { if (this.state() === 'PAUSED') ev.paused(); else if (this.state() === 'PLAYING') ev.playing(); }),
        onstreamcompleted: live(() => ev.ended()),
        oncurrentplaytime: () => {},
        onevent: (type) => { if (my === this.gen) diag('avplay.event', { type: String(type) }); },
        onerror: (type) => { if (my === this.gen) { diag('avplay.error', { type: String(type) }); ev.error(errorCode(type)); } },
        onsubtitlechange: (duration, text) => { if (my === this.gen && this.textOn) ev.subtitle(String(text || ''), Number(duration) || 3000); },
        ondrmevent: () => {},
      });
      if (o.buffer !== 'auto') {
        const [play, resume] = BUFFER[o.buffer];
        try {
          av.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', play);
          av.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', resume);
        } catch { /* the TV keeps its own */ }
      }
      if (o.uhd) { try { av.setStreamingProperty('SET_MODE_4K', 'TRUE'); } catch { /* a stream that isn't 4K */ } }
      this.display('open');
      av.prepareAsync(live(() => {
        try { av.setSilentSubtitle(true); } catch { /* no subtitles */ }
        this.display('prepared');
        ev.ready();
        const go = live(() => {
          try { av.play(); ev.playing(); } catch (e) { diag('avplay.play.refused', { err: errName(e) }); ev.error(errorCode(e && (e as { name?: string }).name)); }
          if (__DIAG__) diag('avplay.playing', { state: this.state(), video: this.videoInfo(), stage: this.rect });
        });
        let d = 0;
        try { d = av.getDuration(); } catch { /* unknown: the point is taken */ }
        if (!o.live && resumable(o.startAt, d)) {
          try { av.seekTo(Math.floor(o.startAt), go, go); } catch { go(); }   // a refused seek starts from the top
        } else go();
      }), (e) => { if (my === this.gen) { diag('avplay.prepare.failed', { err: errName(e) }); ev.error(errorCode(e && ((e as { name?: string }).name || e))); } });
    } catch (e) {
      diag('avplay.open.failed', { err: errName(e) });
      ev.error(errorCode(e && (e as { name?: string }).name));
    }
  }

  play(): void { try { this.av.play(); } catch { /* not in this state */ } }
  pause(): void { try { this.av.pause(); } catch { /* not in this state */ } }

  seek(ms: number, done: (ok: boolean) => void): void {
    const s = this.state();
    if (s !== 'READY' && s !== 'PLAYING' && s !== 'PAUSED') { done(false); return; }
    const my = this.gen;
    let over = false;
    const end = (ok: boolean) => { if (over) return; over = true; clearTimeout(t); if (my === this.gen) done(ok); };
    const t = setTimeout(() => end(false), 15000);
    try { this.av.seekTo(Math.max(0, Math.floor(ms)), () => end(true), () => end(false)); } catch { end(false); }
  }

  time(): number { try { return this.av.getCurrentTime() || 0; } catch { return 0; } }
  duration(): number {
    if (this.live) return 0;
    try { const d = this.av.getDuration(); return d > 0 && d < 1e9 ? d : 0; } catch { return 0; }
  }
  /** AVPlay doesn't say how far it has read ahead. */
  buffered(): number { return 0; }
  seekable(): boolean { return !this.live && this.duration() > 0; }

  private all(): AvTrack[] { try { return this.av.getTotalTrackInfo() || []; } catch { return []; } }
  audioTracks(): Track[] { return tracksOf(this.all(), 'AUDIO'); }
  textTracks(): Track[] { return tracksOf(this.all(), 'TEXT'); }
  currentAudio(): string | null {
    try { const a = (this.av.getCurrentStreamInfo() || []).find((t) => t.type === 'AUDIO'); return a ? String(a.index) : null; } catch { return null; }
  }
  setAudio(id: string): boolean {
    try { this.av.setSelectTrack('AUDIO', parseInt(id, 10)); return true; } catch { return false; }
  }
  setText(id: string | null): boolean {
    try {
      if (id === null) { this.textOn = false; this.av.setSilentSubtitle(true); return true; }
      this.av.setSelectTrack('TEXT', parseInt(id, 10));
      this.av.setSilentSubtitle(false);
      this.textOn = true;
      return true;
    } catch { return false; }
  }

  videoInfo(): VideoInfo | null {
    try {
      const v = (this.av.getCurrentStreamInfo() || []).find((t) => t.type === 'VIDEO');
      if (!v) return null;
      const x = info(v), width = parseInt(x.Width || x.width, 10) || 0, height = parseInt(x.Height || x.height, 10) || 0;
      return width && height ? { width, height, codec: String(x.fourCC || '') } : null;
    } catch { return null; }
  }

  /** AVPlay's other speeds are trick play (no sound): only normal speed is offered. */
  speeds(): number[] { return [1]; }
  setSpeed(rate: number): boolean { return rate === 1; }

  setFill(fill: boolean): void { this.fill = fill; this.applyFill(); }
  private applyFill(): void {
    try { this.av.setDisplayMethod(this.fill ? 'PLAYER_DISPLAY_MODE_FULL_SCREEN' : 'PLAYER_DISPLAY_MODE_LETTER_BOX'); } catch { /* not yet */ }
  }

  suspend(): void { try { this.av.suspend(); } catch { /* nothing open */ } }
  restore(): boolean {
    try { this.av.restore(); } catch (e) { diag('avplay.restore.refused', { err: errName(e) }); return false; }
    this.display('restored');
    return true;
  }

  release(): void {
    this.gen++;
    this.textOn = false;
    const s = this.state();
    try { if (s === 'READY' || s === 'PLAYING' || s === 'PAUSED') this.av.stop(); } catch { /* already stopped */ }
    try { if (this.state() !== 'NONE') this.av.close(); } catch { /* already closed */ }
  }

  detach(): void {
    this.release();
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
  }
}
