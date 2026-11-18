/**
 * The page's background, with a window where the picture is. On the TV, AVPlay draws on a plane under the whole
 * web page, so the page is transparent (html, body, #stage) and this paints the app's background everywhere else:
 * four panels around the picture's rectangle (one, the whole stage, when nothing plays). The screens above draw
 * over it as before; only the live preview and the full-screen player leave the window clear.
 *
 * Four plain panels rather than one huge box-shadow or a mask: those didn't paint on a Samsung TV before.
 */
import type { Matte, Rect } from './player';

export function createMatte(host: HTMLElement): Matte {
  const parts: HTMLElement[] = [];
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = 'matte';
    host.appendChild(d);
    parts.push(d);
  }
  const put = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
    const s = el.style;
    s.left = x + 'px'; s.top = y + 'px'; s.width = Math.max(0, w) + 'px'; s.height = Math.max(0, h) + 'px';
  };
  const show = (r: Rect | null): void => {
    if (!r) {
      put(parts[0], 0, 0, 1920, 1080);
      for (let i = 1; i < 4; i++) put(parts[i], 0, 0, 0, 0);
      return;
    }
    put(parts[0], 0, 0, 1920, r.y);                              // above
    put(parts[1], 0, r.y + r.h, 1920, 1080 - r.y - r.h);         // below
    put(parts[2], 0, r.y, r.x, r.h);                             // left
    put(parts[3], r.x + r.w, r.y, 1920 - r.x - r.w, r.h);        // right
  };
  show(null);
  return { show };
}
