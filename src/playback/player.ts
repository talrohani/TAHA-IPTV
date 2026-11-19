/**
 * One player for the whole app (Samsung TVs give a web app one video plane). Screens ask it to play; it keeps the
 * state machine and refuses commands that the state doesn't allow, so the engine never gets an invalid call.
 *
 *   IDLE → PREPARING → READY → PLAYING ⇄ PAUSED, BUFFERING on the way, ERROR or ENDED at the end.
 *
 * Engines: Samsung AVPlay on the TV, HTML5 video in a browser, behind the same interface. Every play() is a session:
 * events from an older one are dropped, so a fast channel change never shows the last channel's error.
 *
 * Besides the engine calls, the player:
 *  - gives up on a start that takes over 20 s, and on buffering that hasn't moved for 30 s;
 *  - reconnects a live channel by itself after a drop (twice; then it shows the error, and OK tries again);
 *  - suspends the stream when the app goes to the background and restores it when it comes back;
 *  - keeps the page transparent only where the picture is (the matte), and the TV's screensaver off while playing.
 */
export type PState = 'IDLE' | 'PREPARING' | 'READY' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR' | 'ENDED';
export type ErrorCode = 'unsupported' | 'network' | 'timeout' | 'stream';

export interface Rect { x: number; y: number; w: number; h: number }
/** id: the engine's; lang: as the stream says it (ara, en, und...); detail: codec, channels... (may be empty). */
export interface Track { id: string; label: string; lang: string; detail?: string }
export interface VideoInfo { width: number; height: number; codec: string }

export interface EngineEvents {
  ready(): void;
  playing(): void;
  paused(): void;
  buffering(percent: number): void;
  ended(): void;
  error(code: ErrorCode): void;
  /** A subtitle line to show for `ms` (AVPlay hands embedded subtitles to the page to draw). */
  subtitle(text: string, ms: number): void;
}

export interface OpenOptions {
  startAt: number;
  live: boolean;
  /** Settings > Buffering. */
  buffer: 'auto' | 'low' | 'high';
  /** A 4K stream: AVPlay needs to be told before it prepares. */
  uhd: boolean;
}

export interface Engine {
  readonly name: string;
  attach(host: HTMLElement): void;
  place(r: Rect): void;
  open(url: string, o: OpenOptions, ev: EngineEvents): void;
  play(): void;
  pause(): void;
  seek(ms: number, done: (ok: boolean) => void): void;
  time(): number;
  duration(): number;
  buffered(): number;
  seekable(): boolean;
  audioTracks(): Track[];
  textTracks(): Track[];
  /** The tracks playing now (ids), when the engine can tell. */
  currentAudio(): string | null;
  setAudio(id: string): boolean;
  setText(id: string | null): boolean;
  videoInfo(): VideoInfo | null;
  /** Playback rates this engine can do with sound (1 only: no speed choice). */
  speeds(): number[];
  setSpeed(rate: number): boolean;
  setFill(fill: boolean): void;
  /** App to the background / back: false from restore() means the stream must be opened again. */
  suspend(): void;
  restore(): boolean;
  release(): void;
  detach(): void;
}

export interface PlayOptions { rect: Rect; live: boolean; startAt?: number; title?: string; uhd?: boolean }

type Listener = (state: PState, info: { percent?: number; error?: ErrorCode; retrying?: boolean }) => void;
type TextListener = (text: string, ms: number) => void;

/** Where the picture shows through the page (see matte.ts); null: nowhere. */
export interface Matte { show(r: Rect | null): void }
/** The TV's screensaver (tizen.ts); a no-op in a browser. */
export type ScreenSaver = (on: boolean) => void;

/**
 * A resume point the stream can take: inside it, and not in its last 10 s (a provider's listed length can be wrong;
 * a point past the real end would end the film the moment it starts). An unknown length takes it.
 */
export function resumable(at: number, duration: number): boolean {
  return at > 0 && (!(duration > 0) || !isFinite(duration) || at < duration - 10000);
}

const START_TIMEOUT = 20000;
const STALL_TIMEOUT = 30000;
const LIVE_RETRIES = 2;
const RETRY_DELAY = 2000;
const STABLE_AFTER = 60000;   // a live stream that played this long earns its retries back

export class Player {
  private engine: Engine;
  private host: HTMLElement | null = null;
  private st: PState = 'IDLE';
  private session = 0;
  private listeners: Listener[] = [];
  private textListeners: TextListener[] = [];
  private timer: ReturnType<typeof setTimeout> | 0 = 0;
  private retryTimer: ReturnType<typeof setTimeout> | 0 = 0;
  private seeking = false;
  private queued: { ms: number; done?: (ok: boolean) => void } | null = null;
  private opts: PlayOptions | null = null;
  private retries = 0;
  private playingSince = 0;
  private suspended = false;
  private lastPercent = -1;
  private matte: Matte | null = null;
  private saver: ScreenSaver = () => {};
  private buffer: () => OpenOptions['buffer'] = () => 'auto';
  live = false;
  url = '';

  constructor(engine: Engine) { this.engine = engine; }

  get state(): PState { return this.st; }
  get engineName(): string { return this.engine.name; }

  /** Start-up: the engine this TV has (before attach), the matte, the screensaver and the buffering setting. */
  setEngine(e: Engine): void { if (!this.host) this.engine = e; }
  use(parts: { matte?: Matte; screensaver?: ScreenSaver; buffer?: () => OpenOptions['buffer'] }): void {
    if (parts.matte) this.matte = parts.matte;
    if (parts.screensaver) this.saver = parts.screensaver;
    if (parts.buffer) this.buffer = parts.buffer;
  }

  attach(host: HTMLElement): void { this.host = host; this.engine.attach(host); }

  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => { const i = this.listeners.indexOf(fn); if (i >= 0) this.listeners.splice(i, 1); };
  }
  onText(fn: TextListener): () => void {
    this.textListeners.push(fn);
    return () => { const i = this.textListeners.indexOf(fn); if (i >= 0) this.textListeners.splice(i, 1); };
  }

  private set(s: PState, info?: { percent?: number; error?: ErrorCode; retrying?: boolean }): void {
    const was = this.st;
    this.st = s;
    if (s === 'PLAYING' && was !== 'PLAYING' && !this.playingSince) this.playingSince = Date.now();
    if (s !== 'PREPARING' && s !== 'BUFFERING') this.clearTimer();
    // Buffering: 30 s without progress is a stall (each new percent starts the count again).
    const pct = info && info.percent !== undefined ? info.percent : -1;
    if (s === 'BUFFERING' && (!this.timer || pct !== this.lastPercent)) this.arm(STALL_TIMEOUT, 'network');
    this.lastPercent = s === 'BUFFERING' ? pct : -1;
    if (s !== was) this.saver(!(s === 'PLAYING' || s === 'BUFFERING' || s === 'PREPARING' || s === 'READY'));
    for (const fn of this.listeners.slice()) fn(s, info || {});
  }

  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = 0; }

  /** Gives up after ms in PREPARING or BUFFERING (the stream stopped moving). */
  private arm(ms: number, code: ErrorCode): void {
    this.clearTimer();
    const id = this.session;
    this.timer = setTimeout(() => {
      this.timer = 0;
      if (id === this.session && (this.st === 'PREPARING' || this.st === 'BUFFERING')) this.fail(id, code);
    }, ms);
  }

  /** Plays url, after releasing whatever played (one stream at a time). */
  play(url: string, opts: PlayOptions): void {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = 0; }
    this.retries = 0;
    this.start(url, opts);
  }

  private start(url: string, opts: PlayOptions): void {
    const id = ++this.session;
    this.engine.release();
    this.seeking = false;
    this.queued = null;
    this.live = opts.live;
    this.url = url;
    this.opts = opts;
    this.playingSince = 0;
    this.engine.place(opts.rect);
    if (this.matte) this.matte.show(opts.rect);
    this.set('PREPARING', { retrying: this.retries > 0 });
    this.arm(START_TIMEOUT, 'timeout');
    const guard = (fn: () => void) => () => { if (id === this.session) fn(); };
    this.engine.open(url, { startAt: opts.startAt || 0, live: opts.live, buffer: this.buffer(), uhd: !!opts.uhd }, {
      ready: guard(() => this.set('READY')),
      playing: guard(() => this.set('PLAYING')),
      paused: guard(() => this.set('PAUSED')),
      buffering: (p) => { if (id === this.session && this.st !== 'PREPARING') this.set('BUFFERING', { percent: p }); },
      ended: guard(() => { if (this.live) this.fail(id, 'stream'); else this.set('ENDED'); }),
      error: (code) => { if (id === this.session) this.fail(id, code); },
      subtitle: (text, ms) => { if (id === this.session) for (const fn of this.textListeners.slice()) fn(text, ms); },
    });
  }

  /**
   * An error, or a live stream that ended: a live channel is opened again (after 2 s, twice, and again after it has
   * played a minute); a film stops on the error, where it was, for the screen to offer Try again.
   */
  private fail(id: number, code: ErrorCode): void {
    if (id !== this.session) return;
    this.clearTimer();
    this.engine.release();
    const opts = this.opts;
    if (this.playingSince && Date.now() - this.playingSince > STABLE_AFTER) this.retries = 0;
    if (this.live && opts && code !== 'unsupported' && this.retries < LIVE_RETRIES) {
      this.retries++;
      this.set('BUFFERING', { percent: 0, retrying: true });
      this.clearTimer();   // the retry has its own clock
      const url = this.url;
      this.retryTimer = setTimeout(() => { this.retryTimer = 0; if (id === this.session) this.start(url, opts); }, RETRY_DELAY);
      return;
    }
    this.set('ERROR', { error: code });
  }

  place(r: Rect): void {
    if (this.opts) this.opts = Object.assign({}, this.opts, { rect: r });
    this.engine.place(r);
    if (this.matte && this.st !== 'IDLE') this.matte.show(r);
  }

  pause(): void { if (this.st === 'PLAYING' || this.st === 'BUFFERING') { this.engine.pause(); this.set('PAUSED'); } }
  resume(): void { if (this.st === 'PAUSED' || this.st === 'READY') { this.engine.play(); this.set('PLAYING'); } }
  toggle(): void { if (this.st === 'PAUSED' || this.st === 'READY') this.resume(); else this.pause(); }

  canSeek(): boolean {
    return !this.live && (this.st === 'PLAYING' || this.st === 'PAUSED' || this.st === 'READY' || this.st === 'BUFFERING')
      && this.engine.duration() > 0 && this.engine.seekable();
  }

  /** To ms; one seek at a time, the newest target kept while one runs. done(false) leaves it where it was. */
  seek(ms: number, done?: (ok: boolean) => void): void {
    if (!this.canSeek() || !isFinite(ms)) { if (done) done(false); return; }
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
  currentAudio(): string | null { return this.engine.currentAudio(); }
  setAudio(id: string): boolean { return this.engine.setAudio(id); }
  setText(id: string | null): boolean { return this.engine.setText(id); }
  videoInfo(): VideoInfo | null { return this.st === 'IDLE' ? null : this.engine.videoInfo(); }
  speeds(): number[] { return this.engine.speeds(); }
  setSpeed(rate: number): boolean { return this.engine.setSpeed(rate); }
  setFill(fill: boolean): void { this.engine.setFill(fill); }

  /** The app went to the background (another app, Home): the stream is put aside. */
  suspend(): void {
    if (this.suspended || this.st === 'IDLE' || this.st === 'ERROR' || this.st === 'ENDED') return;
    this.suspended = true;
    this.clearTimer();
    this.engine.suspend();
  }

  /** Back in front: the stream goes on; a live one, or one the engine can't restore, is opened again. */
  restore(): void {
    if (!this.suspended) return;
    this.suspended = false;
    const opts = this.opts;
    if (!opts || this.st === 'IDLE') return;
    if (!this.live && this.engine.restore()) return;
    const at = this.live ? 0 : this.engine.time();
    this.play(this.url, Object.assign({}, opts, { startAt: at }));
  }

  stop(): void {
    this.session++;
    this.seeking = false;
    this.queued = null;
    this.suspended = false;
    this.opts = null;
    this.clearTimer();
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = 0; }
    this.engine.release();
    if (this.matte) this.matte.show(null);
    this.set('IDLE');
  }
}
