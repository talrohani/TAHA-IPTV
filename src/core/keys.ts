/**
 * The Samsung remote, and a computer's keyboard standing in for it in the browser preview:
 *   arrows → arrows, Enter → OK, Escape/Backspace → Back, Space → Play/Pause, PageUp/PageDown → Channel up/down,
 *   A B C D → the red, green, yellow and blue keys, [ ] → Rewind / Fast forward.
 */
export type Key = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back' | 'play' | 'pause' | 'playpause' | 'stop' | 'ff' | 'rw'
  | 'chup' | 'chdown' | 'red' | 'green' | 'yellow' | 'blue' | 'info' | `d${number}`;

const CODES: Record<number, Key> = {
  37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'ok', 10009: 'back', 27: 'back', 8: 'back',
  415: 'play', 19: 'pause', 10252: 'playpause', 413: 'stop', 417: 'ff', 412: 'rw', 427: 'chup', 428: 'chdown',
  403: 'red', 404: 'green', 405: 'yellow', 406: 'blue', 457: 'info', 33: 'chup', 34: 'chdown',
};

/** Samsung keys a web app has to ask for (the arrows, OK and Back come by themselves). */
const TIZEN_KEYS = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
  'ChannelUp', 'ChannelDown', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const TIZEN_NAMES: Record<string, Key> = {
  MediaPlayPause: 'playpause', MediaPlay: 'play', MediaPause: 'pause', MediaStop: 'stop', MediaFastForward: 'ff',
  MediaRewind: 'rw', ChannelUp: 'chup', ChannelDown: 'chdown', ColorF0Red: 'red', ColorF1Green: 'green',
  ColorF2Yellow: 'yellow', ColorF3Blue: 'blue', Info: 'info',
};

interface TizenInput {
  registerKey(name: string): void;
  getKey(name: string): { code: number } | null;
}

/** On the TV: asks for the media, channel, colour and number keys, and learns this model's codes for them. */
export function registerTizenKeys(): void {
  const dev = (window as unknown as { tizen?: { tvinputdevice?: TizenInput } }).tizen?.tvinputdevice;
  if (!dev) return;
  for (const name of TIZEN_KEYS) {
    try {
      dev.registerKey(name);
      const k = dev.getKey(name);
      if (k && TIZEN_NAMES[name]) CODES[k.code] = TIZEN_NAMES[name];
    } catch { /* not on this model */ }
  }
}

const BROWSER: Record<string, Key> = { ' ': 'playpause', a: 'red', b: 'green', c: 'yellow', d: 'blue', '[': 'rw', ']': 'ff', i: 'info' };

export function keyOf(e: KeyboardEvent): Key | null {
  const t = e.target as HTMLElement | null;
  const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
  if (CODES[e.keyCode]) {
    // In a text field, Backspace deletes and ← → move the caret; Escape, Back, ↑ ↓ and Enter still navigate.
    if (typing && (e.keyCode === 8 || e.keyCode === 37 || e.keyCode === 39)) return null;
    return CODES[e.keyCode];
  }
  if (e.keyCode >= 48 && e.keyCode <= 57 && !typing) return ('d' + (e.keyCode - 48)) as Key;
  if (!typing && e.key && BROWSER[e.key.toLowerCase()]) return BROWSER[e.key.toLowerCase()];
  if (e.keyCode === 65376) return 'ok';      // Samsung keyboard: Done
  if (e.keyCode === 65385) return 'back';    // Samsung keyboard: Cancel
  return null;
}
