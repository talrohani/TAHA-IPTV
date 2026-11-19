import { describe, expect, it } from 'vitest';
import { best, score, type Box } from '../src/core/spatial';
import { hms } from '../src/core/dom';
import { normalizeServer } from '../src/screens/login';
import { digitOf } from '../src/core/keys';
import { clampRect, isFull, toScreen } from '../src/playback/rect';

describe('video display rectangle', () => {
  const PREVIEW = { x: 998, y: 138, w: 896, h: 520 };
  it('is the stage rectangle itself on a 1920 x 1080 page (the AU7000: 1920x1080 @1)', () => {
    expect(toScreen(PREVIEW, { left: 0, top: 0, width: 1920 }, 1920)).toEqual(PREVIEW);
  });
  it('converts through the window, not the panel: a 1280 page with the stage scaled to fit', () => {
    // Stage scaled to 2/3 in a 1280-wide page: AVPlay still wants 1920 x 1080 numbers (Samsung: × 1920 / clientWidth).
    expect(toScreen(PREVIEW, { left: 0, top: 0, width: 1280 }, 1280)).toEqual(PREVIEW);
    // A letterboxed stage (window wider than 16:9) keeps its offset.
    expect(toScreen({ x: 0, y: 0, w: 1920, h: 1080 }, { left: 120, top: 0, width: 1680 }, 1920)).toEqual({ x: 120, y: 0, w: 1680, h: 945 });
  });
  it('refuses a box with no size and keeps a rectangle on the screen', () => {
    expect(clampRect({ x: 998, y: 138, w: 0, h: 520 })).toBeNull();
    expect(clampRect({ x: NaN, y: 0, w: 10, h: 10 })).toBeNull();
    expect(clampRect({ x: 1800, y: 1000, w: 400, h: 200 })).toEqual({ x: 1800, y: 1000, w: 120, h: 80 });
    expect(clampRect({ x: -10, y: 0, w: 100, h: 50 })).toEqual({ x: 0, y: 0, w: 90, h: 50 });
    expect(clampRect({ x: 998.4, y: 137.6, w: 895.7, h: 520.2 })).toEqual(PREVIEW);
    expect(isFull({ x: 0, y: 0, w: 1920, h: 1080 })).toBe(true);
    expect(isFull(PREVIEW)).toBe(false);
  });
});

describe('remote keys', () => {
  it('reads number keys, and never takes ↓ (down) for one', () => {
    expect(digitOf('d0')).toBe(0);
    expect(digitOf('d7')).toBe(7);
    expect(digitOf('down')).toBeNull();
    expect(digitOf('d')).toBeNull();
    expect(digitOf('d12')).toBeNull();
    expect(digitOf('ok')).toBeNull();
  });
});

const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h });

describe('spatial navigation', () => {
  const from = box(100, 100, 100, 100);
  it('ignores boxes that are not in the direction', () => {
    expect(score(from, box(0, 100, 80, 100), 'right')).toBe(Infinity);
    expect(score(from, box(300, 100, 80, 100), 'left')).toBe(Infinity);
    expect(score(from, box(100, 300, 100, 100), 'up')).toBe(Infinity);
  });
  it('prefers the neighbour in the same row over a closer one off the row', () => {
    const sameRow = box(400, 110, 100, 80), offRow = box(240, 400, 100, 100);
    expect(best(from, [offRow, sameRow], 'right')).toBe(1);
  });
  it('picks the nearest in a column', () => {
    expect(best(from, [box(100, 500, 100, 100), box(100, 240, 100, 100)], 'down')).toBe(1);
  });
  it('returns -1 when nothing is that way', () => {
    expect(best(from, [box(0, 0, 50, 50)], 'right')).toBe(-1);
  });
});

describe('time formats', () => {
  it('formats durations', () => {
    expect(hms(754000)).toBe('12:34');
    expect(hms(5400000)).toBe('1:30:00');
    expect(hms(1457000, true)).toBe('00:24:17');
    expect(hms(-5)).toBe('0:00');
  });
});

describe('server addresses', () => {
  it('normalizes what people type', () => {
    expect(normalizeServer('example.com:8080/')).toBe('http://example.com:8080');
    expect(normalizeServer('HTTPS://Example.com/player_api.php')).toBe('https://example.com');
    expect(normalizeServer('http://1.2.3.4:25461/get.php?x=1')).toBe('http://1.2.3.4:25461');
  });
  it('refuses what is not an address', () => {
    expect(normalizeServer('')).toBeNull();
    expect(normalizeServer('not an address')).toBeNull();
    expect(normalizeServer('ftp://host')).toBeNull();
    expect(normalizeServer('http://host:99999')).toBeNull();
  });
});
