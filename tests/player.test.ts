import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player, resumable } from '../src/playback/player';
import type { Engine, EngineEvents, OpenOptions, PState, Rect } from '../src/playback/player';
import { AvplayEngine, errorCode, tracksOf } from '../src/playback/avplay';
import type { AvPlay } from '../src/playback/avplay';
import { isLang, langName } from '../src/playback/lang';

/** An engine that does nothing by itself: the test plays the stream's part through `ev`. */
class FakeEngine implements Engine {
  readonly name = 'fake';
  ev: EngineEvents | null = null;
  opens: Array<{ url: string; o: OpenOptions }> = [];
  seeks: Array<{ ms: number; done: (ok: boolean) => void }> = [];
  released = 0;
  restoreOk = true;
  pos = 0;
  dur = 600000;
  attach(): void {}
  place(): void {}
  open(url: string, o: OpenOptions, ev: EngineEvents): void { this.opens.push({ url, o }); this.ev = ev; }
  play(): void {}
  pause(): void {}
  seek(ms: number, done: (ok: boolean) => void): void { this.seeks.push({ ms, done }); }
  time(): number { return this.pos; }
  duration(): number { return this.dur; }
  buffered(): number { return 0; }
  seekable(): boolean { return true; }
  audioTracks() { return []; }
  textTracks() { return []; }
  currentAudio(): string | null { return null; }
  setAudio(): boolean { return true; }
  setText(): boolean { return true; }
  videoInfo() { return null; }
  speeds(): number[] { return [1]; }
  setSpeed(): boolean { return false; }
  setFill(): void {}
  suspend(): void {}
  restore(): boolean { return this.restoreOk; }
  release(): void { this.released++; }
  detach(): void {}
}

const RECT: Rect = { x: 0, y: 0, w: 1920, h: 1080 };

function setup() {
  const e = new FakeEngine(), p = new Player(e);
  const states: PState[] = [], matte: Array<Rect | null> = [], saver: boolean[] = [];
  p.use({ matte: { show: (r) => matte.push(r) }, screensaver: (on) => saver.push(on) });
  p.on((s) => states.push(s));
  return { e, p, states, matte, saver };
}

describe('Player', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('goes PREPARING → READY → PLAYING, opens the matte, and keeps the screensaver off while playing', () => {
    const { e, p, states, matte, saver } = setup();
    p.play('u', { rect: RECT, live: false, startAt: 5000 });
    expect(e.opens[0].o).toMatchObject({ startAt: 5000, live: false, buffer: 'auto', uhd: false });
    e.ev!.ready();
    e.ev!.playing();
    expect(states).toEqual(['PREPARING', 'READY', 'PLAYING']);
    expect(matte[matte.length - 1]).toEqual(RECT);
    expect(saver[saver.length - 1]).toBe(false);
    p.stop();
    expect(p.state).toBe('IDLE');
    expect(matte[matte.length - 1]).toBeNull();
    expect(saver[saver.length - 1]).toBe(true);
  });

  it("drops an older stream's events (a fast channel change never shows the last channel's error)", () => {
    const { e, p } = setup();
    p.play('a', { rect: RECT, live: true });
    const old = e.ev!;
    p.play('b', { rect: RECT, live: true });
    old.error('network');
    old.playing();
    expect(p.state).toBe('PREPARING');
    e.ev!.playing();
    expect(p.state).toBe('PLAYING');
  });

  it('gives up on a start that takes over 20 s', () => {
    const { e, p } = setup();
    p.play('u', { rect: RECT, live: false });
    vi.advanceTimersByTime(19000);
    expect(p.state).toBe('PREPARING');
    vi.advanceTimersByTime(1500);
    expect(p.state).toBe('ERROR');
    expect(e.released).toBeGreaterThan(1);
  });

  it('calls 30 s of buffering without progress a stall, but not buffering that moves', () => {
    const { e, p } = setup();
    p.play('u', { rect: RECT, live: false });
    e.ev!.ready(); e.ev!.playing();
    e.ev!.buffering(0);
    vi.advanceTimersByTime(25000);
    e.ev!.buffering(40);   // moving: the count starts again
    vi.advanceTimersByTime(25000);
    expect(p.state).toBe('BUFFERING');
    vi.advanceTimersByTime(6000);
    expect(p.state).toBe('ERROR');
  });

  it('reconnects a live channel twice after a drop, then shows the error', () => {
    const { e, p } = setup();
    const info: boolean[] = [];
    p.on((_, i) => info.push(!!i.retrying));
    p.play('live', { rect: RECT, live: true });
    e.ev!.playing();
    e.ev!.error('network');
    expect(p.state).toBe('BUFFERING');
    expect(info[info.length - 1]).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(e.opens.length).toBe(2);
    e.ev!.ended();                      // a live stream that "ends" dropped too
    vi.advanceTimersByTime(2000);
    expect(e.opens.length).toBe(3);
    e.ev!.error('network');
    expect(p.state).toBe('ERROR');
    expect(e.opens.length).toBe(3);
  });

  it("doesn't retry a format the TV can't play, and ends a film normally", () => {
    const a = setup();
    a.p.play('live', { rect: RECT, live: true });
    a.e.ev!.error('unsupported');
    expect(a.p.state).toBe('ERROR');
    const b = setup();
    b.p.play('film', { rect: RECT, live: false });
    b.e.ev!.playing();
    b.e.ev!.ended();
    expect(b.p.state).toBe('ENDED');
  });

  it('runs one seek at a time and keeps only the newest target', () => {
    const { e, p } = setup();
    p.play('u', { rect: RECT, live: false });
    e.ev!.ready(); e.ev!.playing();
    const done: boolean[] = [];
    p.seek(60000, (ok) => done.push(ok));
    p.seek(90000);
    p.seek(120000, (ok) => done.push(ok));
    expect(e.seeks.map((s) => s.ms)).toEqual([60000]);
    e.seeks[0].done(true);
    expect(e.seeks.map((s) => s.ms)).toEqual([60000, 120000]);
    e.seeks[1].done(true);
    expect(done).toEqual([true, true]);
    expect(p.busy).toBe(false);
  });

  it("doesn't seek a live channel, and keeps the target inside the film", () => {
    const { e, p } = setup();
    p.play('live', { rect: RECT, live: true });
    e.ev!.playing();
    let answer: boolean | null = null;
    p.seek(1000, (ok) => { answer = ok; });
    expect(answer).toBe(false);
    p.play('film', { rect: RECT, live: false });
    e.ev!.playing();
    p.seek(10 * 60000);
    expect(e.seeks[0].ms).toBe(600000 - 1500);
  });

  it('takes a film up where it was after the app comes back, and opens a live channel again', () => {
    const { e, p } = setup();
    p.play('film', { rect: RECT, live: false });
    e.ev!.playing();
    p.suspend(); p.restore();
    expect(e.opens.length).toBe(1);           // restored in place
    e.restoreOk = false;
    e.pos = 42000;
    p.suspend(); p.restore();
    expect(e.opens[1].o.startAt).toBe(42000); // couldn't restore: opened again where it was
    p.play('live', { rect: RECT, live: true });
    e.ev!.playing();
    p.suspend(); p.restore();
    expect(e.opens[3].url).toBe('live');
    expect(e.opens[3].o.startAt).toBe(0);
  });
});

// MARK: - AVPlay, against a stand-in that records what is called

function fakeAv() {
  const calls: string[] = [];
  let state: 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED' = 'NONE';
  let prepared: { ok: () => void; fail: (e: unknown) => void } | null = null;
  let listener: Record<string, (...a: unknown[]) => void> = {};
  const rec = (name: string) => (...a: unknown[]) => { calls.push(a.length ? name + '(' + a.join(',') + ')' : name); };
  const av = {
    open: (u: string) => { calls.push('open'); void u; state = 'IDLE'; },
    close: () => { calls.push('close'); state = 'NONE'; },
    setListener: (l: Record<string, (...a: unknown[]) => void>) => { calls.push('setListener'); listener = l; },
    prepareAsync: (ok: () => void, fail: (e: unknown) => void) => { calls.push('prepareAsync'); prepared = { ok: () => { state = 'READY'; ok(); }, fail }; },
    play: () => { calls.push('play'); state = 'PLAYING'; },
    pause: () => { calls.push('pause'); state = 'PAUSED'; },
    stop: () => { calls.push('stop'); state = 'IDLE'; },
    seekTo: (ms: number, ok?: () => void) => { calls.push('seekTo(' + ms + ')'); if (ok) ok(); },
    getState: () => state,
    getCurrentTime: () => 1000,
    getDuration: () => 5400000,
    setDisplayRect: rec('setDisplayRect'),
    setDisplayMethod: rec('setDisplayMethod'),
    setBufferingParam: rec('setBufferingParam'),
    setStreamingProperty: rec('setStreamingProperty'),
    getTotalTrackInfo: () => [
      { index: 0, type: 'VIDEO', extra_info: '{"fourCC":"H264","Width":"1920","Height":"1080"}' },
      { index: 1, type: 'AUDIO', extra_info: '{"fourCC":"AAC","language":"ara","channels":"2"}' },
      { index: 2, type: 'AUDIO', extra_info: '{"fourCC":"AC3","language":"eng","channels":"6"}' },
      { index: 3, type: 'TEXT', extra_info: '{"track_lang":"ara"}' },
      { index: 4, type: 'TEXT', extra_info: 'not json' },
    ],
    getCurrentStreamInfo: () => [
      { index: 0, type: 'VIDEO', extra_info: '{"fourCC":"H264","Width":"1920","Height":"1080"}' },
      { index: 2, type: 'AUDIO', extra_info: '{}' },
    ],
    setSelectTrack: rec('setSelectTrack'),
    setSilentSubtitle: rec('setSilentSubtitle'),
    suspend: rec('suspend'),
    restore: rec('restore'),
  };
  return { av: av as unknown as AvPlay, calls, prepare: () => prepared, fire: (n: string, ...a: unknown[]) => listener[n](...a) };
}

function events(log: string[]): EngineEvents {
  return {
    ready: () => log.push('ready'), playing: () => log.push('playing'), paused: () => log.push('paused'),
    buffering: (p) => log.push('buffering ' + p), ended: () => log.push('ended'), error: (c) => log.push('error ' + c),
    subtitle: (t) => log.push('sub ' + t),
  };
}

describe('AVPlay engine', () => {
  beforeEach(() => {
    (globalThis as unknown as { document: unknown }).document = { getElementById: () => null, documentElement: { clientWidth: 1920 } };
    (globalThis as unknown as { window: unknown }).window = { innerWidth: 1920 };
  });

  it('calls AVPlay in the order it insists on, then seeks to the resume point before playing', () => {
    const f = fakeAv(), log: string[] = [], e = new AvplayEngine(f.av);
    e.place({ x: 998, y: 138, w: 896, h: 520 });
    e.open('http://s/movie/u/p/1.mkv', { startAt: 61000, live: false, buffer: 'low', uhd: true }, events(log));
    expect(f.calls).toEqual(['open', 'setListener',
      'setBufferingParam(PLAYER_BUFFER_FOR_PLAY,PLAYER_BUFFER_SIZE_IN_SECOND,3)',
      'setBufferingParam(PLAYER_BUFFER_FOR_RESUME,PLAYER_BUFFER_SIZE_IN_SECOND,5)',
      'setStreamingProperty(SET_MODE_4K,TRUE)', 'setDisplayRect(998,138,896,520)',
      'setDisplayMethod(PLAYER_DISPLAY_MODE_LETTER_BOX)', 'prepareAsync']);
    f.prepare()!.ok();
    expect(f.calls.slice(-3)).toEqual(['setSilentSubtitle(true)', 'seekTo(61000)', 'play']);
    expect(log).toEqual(['ready', 'playing']);
  });

  it('starts a live channel at once (no seek), and reports no length for it', () => {
    const f = fakeAv(), log: string[] = [], e = new AvplayEngine(f.av);
    e.open('http://s/live/u/p/1.ts', { startAt: 5000, live: true, buffer: 'auto', uhd: false }, events(log));
    expect(f.calls).not.toContain('setBufferingParam(PLAYER_BUFFER_FOR_PLAY,PLAYER_BUFFER_SIZE_IN_SECOND,3)');
    f.prepare()!.ok();
    expect(f.calls.filter((c) => c.indexOf('seekTo') === 0)).toEqual([]);
    expect(e.duration()).toBe(0);
    expect(e.seekable()).toBe(false);
  });

  it('starts from the top when the resume point is past the real end (a wrong listed length)', () => {
    const f = fakeAv(), log: string[] = [], e = new AvplayEngine(f.av);   // the stand-in is 90 min long
    e.open('a', { startAt: 133 * 60000, live: false, buffer: 'auto', uhd: false }, events(log));
    f.prepare()!.ok();
    expect(f.calls.filter((c) => c.indexOf('seekTo') === 0)).toEqual([]);
    expect(f.calls[f.calls.length - 1]).toBe('play');
    expect(resumable(60000, 0)).toBe(true);               // length unknown: taken
    expect(resumable(5395000, 5400000)).toBe(false);      // its last 10 s
    expect(resumable(0, 5400000)).toBe(false);
  });

  it('drops a prepare that answers after the stream was released', () => {
    const f = fakeAv(), log: string[] = [], e = new AvplayEngine(f.av);
    e.open('a', { startAt: 0, live: true, buffer: 'auto', uhd: false }, events(log));
    const late = f.prepare()!;
    e.release();
    late.ok();
    expect(log).toEqual([]);
    expect(f.calls).not.toContain('play');
  });

  it('reads tracks, picks them, and passes subtitles on only while they are on', () => {
    const f = fakeAv(), log: string[] = [], e = new AvplayEngine(f.av);
    e.open('a', { startAt: 0, live: false, buffer: 'auto', uhd: false }, events(log));
    f.prepare()!.ok();
    expect(e.audioTracks()).toEqual([
      { id: '1', label: '', lang: 'ara', detail: 'AAC 2.0' },
      { id: '2', label: '', lang: 'eng', detail: 'AC3 5.1' },
    ]);
    expect(e.textTracks().map((t) => t.lang)).toEqual(['ara', '']);
    expect(e.currentAudio()).toBe('2');
    expect(e.videoInfo()).toEqual({ width: 1920, height: 1080, codec: 'H264' });
    f.fire('onsubtitlechange', 2000, 'hidden');
    expect(e.setText('3')).toBe(true);
    f.fire('onsubtitlechange', 2000, 'مرحبا');
    e.setText(null);
    f.fire('onsubtitlechange', 2000, 'hidden again');
    expect(log.filter((l) => l.indexOf('sub') === 0)).toEqual(['sub مرحبا']);
    expect(f.calls).toContain('setSelectTrack(TEXT,3)');
    expect(f.calls[f.calls.length - 1]).toBe('setSilentSubtitle(true)');
  });

  it("names AVPlay's errors the way the screen says them", () => {
    expect(errorCode('PLAYER_ERROR_NOT_SUPPORTED_FORMAT')).toBe('unsupported');
    expect(errorCode('PLAYER_ERROR_INVALID_URI')).toBe('unsupported');
    expect(errorCode('PLAYER_ERROR_CONNECTION_FAILED')).toBe('network');
    expect(errorCode('PLAYER_ERROR_STREAMING_CONNECTION_FAILED')).toBe('network');
    expect(errorCode('PLAYER_ERROR_GENEREIC')).toBe('stream');
    expect(errorCode(undefined)).toBe('stream');
  });

  it('survives track lists with odd entries', () => {
    expect(tracksOf(null as never, 'AUDIO')).toEqual([]);
    expect(tracksOf([{ index: 7, type: 'AUDIO', extra_info: '' }], 'AUDIO')).toEqual([{ id: '7', label: '', lang: '', detail: '' }]);
  });
});

describe('track languages', () => {
  it('knows Arabic and English in their usual codes, and names the rest', () => {
    expect(['ar', 'ara', 'arb', 'ar-EG'].every((c) => isLang(c, 'ar'))).toBe(true);
    expect(['en', 'eng', 'en-US'].every((c) => isLang(c, 'en'))).toBe(true);
    expect(isLang('are', 'ar')).toBe(false);
    expect(langName('fre')).toBe('Français');
    expect(langName('xyz')).toBe('XYZ');
    expect(langName('und')).toBeNull();
    expect(langName('')).toBeNull();
  });
});
