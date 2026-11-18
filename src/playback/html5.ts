/**
 * HTML5 video: the browser preview's engine (and the fallback where AVPlay isn't there). It proves the screens and
 * the player's logic, not what a TV will play: the TV uses AVPlay.
 */
import type { Engine, EngineEvents, OpenOptions, Rect, Track, VideoInfo } from './player';
import { resumable } from './player';

export class Html5Engine implements Engine {
  readonly name = 'HTML5';
  private v: HTMLVideoElement | null = null;
  private live = false;

  attach(host: HTMLElement): void {
    if (this.v) return;
    const v = document.createElement('video');
    v.className = 'video-plane';
    v.setAttribute('playsinline', '');
    host.appendChild(v);
    this.v = v;
  }

  place(r: Rect): void {
    if (!this.v) return;
    const s = this.v.style;
    s.left = r.x + 'px'; s.top = r.y + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px';
  }

  open(url: string, o: OpenOptions, ev: EngineEvents): void {
    const v = this.v;
    if (!v) return;
    this.live = o.live;
    let started = false;
    v.onloadedmetadata = () => {
      if (o.startAt && !o.live && resumable(o.startAt, v.duration * 1000)) { try { v.currentTime = o.startAt / 1000; } catch { /* not yet */ } }
      ev.ready();
    };
    v.onwaiting = () => ev.buffering(0);
    v.onplaying = () => { started = true; ev.playing(); };
    v.onpause = () => { if (!v.ended && started) ev.paused(); };
    v.onended = () => ev.ended();
    v.onerror = () => {
      const c = v.error ? v.error.code : 0;
      ev.error(c === 4 ? 'unsupported' : c === 2 ? 'network' : 'stream');
    };
    v.playbackRate = 1;
    v.src = url;
    const p = v.play();
    if (p && p.catch) p.catch(() => { /* autoplay may need a key press first */ });
  }

  play(): void { if (this.v) { const p = this.v.play(); if (p && p.catch) p.catch(() => {}); } }
  pause(): void { if (this.v) this.v.pause(); }

  seek(ms: number, done: (ok: boolean) => void): void {
    const v = this.v, r = v && v.seekable;
    if (!v || !r || !r.length) { done(false); return; }
    let over = false;
    const finish = (ok: boolean) => {
      if (over) return;
      over = true;
      clearTimeout(t);
      v.removeEventListener('seeked', yes);
      v.removeEventListener('error', no);
      done(ok);
    };
    const yes = () => finish(true), no = () => finish(false);
    const t = setTimeout(() => finish(false), 15000);
    v.addEventListener('seeked', yes);
    v.addEventListener('error', no);
    try { v.currentTime = Math.max(r.start(0), Math.min(r.end(r.length - 1) - 0.5, ms / 1000)); } catch { finish(false); }
  }

  time(): number { return this.v ? this.v.currentTime * 1000 : 0; }
  duration(): number { return this.v && !this.live && isFinite(this.v.duration) ? this.v.duration * 1000 : 0; }
  buffered(): number {
    const v = this.v, b = v && v.buffered;
    if (!v || !b) return 0;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= v.currentTime + 0.5 && b.end(i) >= v.currentTime) return b.end(i) * 1000;
    return 0;
  }
  seekable(): boolean {
    const v = this.v, r = v && v.seekable;
    return !!(v && !this.live && r && r.length && isFinite(v.duration) && r.end(r.length - 1) > r.start(0));
  }
  /** Chromium lists a stream's audio and text tracks only behind a flag: the browser offers none. */
  audioTracks(): Track[] { return []; }
  textTracks(): Track[] { return []; }
  currentAudio(): string | null { return null; }
  setAudio(): boolean { return false; }
  setText(id: string | null): boolean { return id === null; }

  videoInfo(): VideoInfo | null {
    const v = this.v;
    return v && v.videoWidth ? { width: v.videoWidth, height: v.videoHeight, codec: '' } : null;
  }

  speeds(): number[] { return [0.5, 0.75, 1, 1.25, 1.5, 2]; }
  setSpeed(rate: number): boolean { if (!this.v) return false; this.v.playbackRate = rate; return true; }
  setFill(fill: boolean): void { if (this.v) this.v.style.objectFit = fill ? 'cover' : 'contain'; }

  suspend(): void { if (this.v) this.v.pause(); }
  restore(): boolean { if (!this.v || !this.v.src) return false; this.play(); return true; }

  release(): void {
    const v = this.v;
    if (!v) return;
    v.onloadedmetadata = v.onwaiting = v.onplaying = v.onpause = v.onended = v.onerror = null;
    try { v.pause(); } catch { /* already stopped */ }
    v.removeAttribute('src');
    try { v.load(); } catch { /* nothing loaded */ }
  }

  detach(): void {
    this.release();
    if (this.v && this.v.parentNode) this.v.parentNode.removeChild(this.v);
    this.v = null;
  }
}
