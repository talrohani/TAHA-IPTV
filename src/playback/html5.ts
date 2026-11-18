/** HTML5 video: the browser preview's engine (and a fallback). It proves the screens, not what a TV will play. */
import type { Engine, EngineEvents, Rect, Track } from './player';

export class Html5Engine implements Engine {
  readonly name = 'HTML5';
  private v: HTMLVideoElement | null = null;

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

  open(url: string, startAt: number, ev: EngineEvents): void {
    const v = this.v;
    if (!v) return;
    v.onloadedmetadata = () => { if (startAt) { try { v.currentTime = startAt / 1000; } catch { /* not yet */ } } ev.ready(); };
    v.onwaiting = () => ev.buffering(0);
    v.onplaying = () => ev.playing();
    v.onpause = () => { if (!v.ended) ev.paused(); };
    v.onended = () => ev.ended();
    v.onerror = () => {
      const c = v.error ? v.error.code : 0;
      ev.error(c === 4 ? 'unsupported' : c === 2 ? 'network' : 'stream');
    };
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
    const t = window.setTimeout(() => finish(false), 15000);
    v.addEventListener('seeked', yes);
    v.addEventListener('error', no);
    try { v.currentTime = Math.max(r.start(0), Math.min(r.end(r.length - 1) - 0.5, ms / 1000)); } catch { finish(false); }
  }

  time(): number { return this.v ? this.v.currentTime * 1000 : 0; }
  duration(): number { return this.v && isFinite(this.v.duration) ? this.v.duration * 1000 : 0; }
  buffered(): number {
    const v = this.v, b = v && v.buffered;
    if (!v || !b) return 0;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= v.currentTime + 0.5 && b.end(i) >= v.currentTime) return b.end(i) * 1000;
    return 0;
  }
  seekable(): boolean {
    const v = this.v, r = v && v.seekable;
    return !!(v && r && r.length && isFinite(v.duration) && r.end(r.length - 1) > r.start(0));
  }
  audioTracks(): Track[] { return []; }
  textTracks(): Track[] { return []; }
  setAudio(): void { /* HTML5 video can't switch audio tracks here */ }
  setText(): void { /* no side-loaded subtitles in phase 1 */ }

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
