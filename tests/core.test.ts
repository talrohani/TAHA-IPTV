import { describe, expect, it } from 'vitest';
import { best, score, type Box } from '../src/core/spatial';
import { hms } from '../src/core/dom';
import { normalizeServer } from '../src/screens/login';

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
