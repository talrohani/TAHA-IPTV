/**
 * Where the picture goes, in one place. Screens work in the stage's 1920 x 1080 coordinates (the stage is scaled to
 * the window); AVPlay's setDisplayRect takes "a 1920 x 1080 resolution screen, regardless of the actual application
 * resolution" (Samsung's AVPlay reference), so a stage rectangle is converted through the window, never through the
 * panel's physical (4K) size.
 */
import type { Rect } from './player';

export const FULL: Rect = { x: 0, y: 0, w: 1920, h: 1080 };

export function isFull(r: Rect): boolean { return r.x <= 0 && r.y <= 0 && r.w >= 1920 && r.h >= 1080; }

/** Whole pixels inside the 1920 x 1080 screen, or null when nothing of it is left (zero or negative size). */
export function clampRect(r: Rect): Rect | null {
  if (!r || !isFinite(r.x) || !isFinite(r.y) || !isFinite(r.w) || !isFinite(r.h)) return null;
  const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
  const w = Math.min(1920 - x, Math.round(r.w + Math.min(0, r.x))), h = Math.min(1080 - y, Math.round(r.h + Math.min(0, r.y)));
  return w > 0 && h > 0 && x < 1920 && y < 1080 ? { x, y, w, h } : null;
}

/**
 * A stage rectangle → AVPlay's 1920 x 1080 screen. `stage` is the stage's box in the window (it is scaled and
 * centred to fit), `viewport` the document's width: Samsung's own conversion is 1920 / clientWidth.
 */
export function toScreen(r: Rect, stage: { left: number; top: number; width: number }, viewport: number): Rect {
  const k = stage.width / 1920 || 1, toTv = 1920 / (viewport || 1920);
  return {
    x: Math.round((stage.left + r.x * k) * toTv), y: Math.round((stage.top + r.y * k) * toTv),
    w: Math.round(r.w * k * toTv), h: Math.round(r.h * k * toTv),
  };
}

/** The same, from the page as it is now. */
export function screenRect(r: Rect): Rect {
  const stage = document.getElementById('stage');
  const box = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: 1920 };
  return toScreen(r, box, document.documentElement.clientWidth || window.innerWidth || 1920);
}

/** An element's box in stage coordinates (what screens pass to the player), or null if it has no size yet. */
export function stageRectOf(el: HTMLElement): Rect | null {
  const stage = document.getElementById('stage');
  if (!stage || !el.isConnected) return null;
  const s = stage.getBoundingClientRect(), b = el.getBoundingClientRect(), k = s.width / 1920 || 1;
  return clampRect({ x: (b.left - s.left) / k, y: (b.top - s.top) / k, w: b.width / k, h: b.height / k });
}
