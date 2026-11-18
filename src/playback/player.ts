/**
 * One player for the whole app (Samsung TVs give a web app one video plane). Screens ask it to play; it keeps the
 * state machine and refuses commands that the state doesn't allow, so the engine never gets an invalid call.
 *
 *   IDLE → PREPARING → READY → PLAYING ⇄ PAUSED, BUFFERING on the way, ERROR or ENDED at the end.
 *
 * Engines: HTML5 video (the browser preview, phase 1) and Samsung AVPlay (phase 3), behind the same interface.
 */
export type PState = 'IDLE' | 'PREPARING' | 'READY' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR' | 'ENDED';
export type ErrorCode = 'unsupported' | 'network' | 'timeout' | 'stream';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Track { id: string; label: string; lang: string }

export interface EngineEvents {
  ready(): void;
  playing(): void;
  paused(): void;
  buffering(percent: number): void;
  ended(): void;
  error(code: ErrorCode): void;
}

export interface Engine {
  readonly name: string;
  attach(host: HTMLElement): void;
  place(r: Rect): void;
  open(url: string, startAt: number, ev: EngineEvents): void;
  play(): void;
  pause(): void;
  seek(ms: number, done: (ok: boolean) => void): void;
  time(): number;
  duration(): number;
  buffered(): number;
  seekable(): boolean;
  audioTracks(): Track[];
  textTracks(): Track[];
  setAudio(id: string): void;
  setText(id: string | null): void;
  release(): void;
  detach(): void;
}

export interface PlayOptions { rect: Rect; live: boolean; startAt?: number; title?: string }

type Listener = (state: PState, info: { percent?: number; error?: ErrorCode }) => void;

const START_TIMEOUT = 20000;

export class Player {
  private engine: Engine;
  private st: PState = 'IDLE';
  private session = 0;
  private listeners: Listener[] = [];
  private timer = 0;
  private seeking = false;
  private queued: { ms: number; done?: (ok: boolean) => void } | null = null;
  live = false;
  url = '';

  constructor(engine: Engine) { this.engine = engine; }

  get state(): PState { return this.st; }
  get engineName(): string { return this.engine.name; }

  attach(host: HTMLElement): void { this.engine.attach(host); }

  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => { const i = this.listeners.indexOf(fn); if (i >= 0) this.listeners.splice(i, 1); };
  }

  private set(s: PState, info?: { percent?: number; error?: ErrorCode }): void {
    this.st = s;
    if (s !== 'PREPARING' && s !== 'BUFFERING') { clearTimeout(this.timer); this.timer = 0; }
    for (const fn of this.listeners.slice()) fn(s, info || {});
  }

  /** Plays url, after releasing whatever played (one stream at a time). */
  play(url: string, opts: PlayOptions): void {
    const id = ++this.session;
    this.engine.release();
    this.seeking = false;
    this.queued = null;
    this.live = opts.live;
    this.url = url;
    this.engine.place(opts.rect);
    this.set('PREPARING');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { if (id === this.session) { this.engine.release(); this.set('ERROR', { error: 'timeout' }); } }, START_TIMEOUT);
    const guard = (fn: () => void) => () => { if (id === this.session) fn(); };
    this.engine.open(url, opts.startAt || 0, {
      ready: guard(() => this.set('READY')),
      playing: guard(() => this.set('PLAYING')),
      paused: guard(() => this.set('PAUSED')),
      buffering: (p) => { if (id === this.session) this.set('BUFFERING', { percent: p }); },
      ended: guard(() => this.set('ENDED')),
      error: (code) => { if (id === this.session) { this.engine.release(); this.set('ERROR', { error: code }); } },
    });
  }

  place(r: Rect): void { this.engine.place(r); }

  pause(): void { if (this.st === 'PLAYING' || this.st === 'BUFFERING') { this.engine.pause(); this.set('PAUSED'); } }
  resume(): void { if (this.st === 'PAUSED' || this.st === 'READY') { this.engine.play(); this.set('PLAYING'); } }
  toggle(): void { if (this.st === 'PAUSED' || this.st === 'READY') this.resume(); else this.pause(); }

  canSeek(): boolean {
    return !this.live && (this.st === 'PLAYING' || this.st === 'PAUSED' || this.st === 'READY' || this.st === 'BUFFERING')
      && this.engine.duration() > 0 && this.engine.seekable();
  }

  /** To ms; one seek at a time, the newest target kept while one runs. done(false) leaves it where it was. */
  seek(ms: number, done?: (ok: boolean) => void): void {
    if (!this.canSeek()) { if (done) done(false); return; }
    const d = this.engine.duration();
    ms = Math.max(0, Math.min(d - 1500, ms));
    if (this.seeking) { this.queued = { ms, done }; return; }
    const id = this.session;
    this.seeking = true;
    this.engine.seek(ms, (ok) => {
      this.seeking = false;
      if (id !== this.session) return;
      const q = this.queued;
      this.queued = null;
      if (done) done(ok);
      if (q) this.seek(q.ms, q.done);
    });
  }

  get busy(): boolean { return this.seeking; }
  time(): number { return this.engine.time(); }
  duration(): number { return this.engine.duration(); }
  buffered(): number { return this.engine.buffered(); }
  audioTracks(): Track[] { return this.engine.audioTracks(); }
  textTracks(): Track[] { return this.engine.textTracks(); }
  setAudio(id: string): void { this.engine.setAudio(id); }
  setText(id: string | null): void { this.engine.setText(id); }

  stop(): void {
    this.session++;
    this.seeking = false;
    this.queued = null;
    clearTimeout(this.timer);
    this.engine.release();
    this.set('IDLE');
  }
}
