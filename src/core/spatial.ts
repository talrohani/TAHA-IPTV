/** Picking the next element in a direction, from rectangles only (no DOM): kept pure so it can be tested. */
export type Dir = 'left' | 'right' | 'up' | 'down';

export interface Box { left: number; top: number; right: number; bottom: number }

/**
 * A score for moving from `from` to `to` in `dir`, or Infinity when `to` isn't that way. Lower is better: the gap
 * along the direction, plus the sideways offset (weighted more when the boxes don't overlap sideways, so a move
 * stays in its row or column when it can).
 */
export function score(from: Box, to: Box, dir: Dir): number {
  const fcx = (from.left + from.right) / 2, fcy = (from.top + from.bottom) / 2;
  const tcx = (to.left + to.right) / 2, tcy = (to.top + to.bottom) / 2;
  const E = 2;   // rounding slack
  let gap: number, side: number, overlap: number;
  if (dir === 'right' || dir === 'left') {
    if (dir === 'right' ? tcx <= fcx + E || to.right <= from.right - E : tcx >= fcx - E || to.left >= from.left + E) return Infinity;
    gap = Math.max(0, dir === 'right' ? to.left - from.right : from.left - to.right);
    side = Math.abs(tcy - fcy);
    overlap = Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top);
  } else {
    if (dir === 'down' ? tcy <= fcy + E || to.bottom <= from.bottom - E : tcy >= fcy - E || to.top >= from.top + E) return Infinity;
    gap = Math.max(0, dir === 'down' ? to.top - from.bottom : from.top - to.bottom);
    side = Math.abs(tcx - fcx);
    overlap = Math.min(from.right, to.right) - Math.max(from.left, to.left);
  }
  return gap + side * (overlap > 0 ? 0.3 : 2.5) + (overlap > 0 ? 0 : 400);
}

/** The index of the best box in `dir`, or -1. */
export function best(from: Box, boxes: Box[], dir: Dir): number {
  let at = -1, low = Infinity;
  for (let i = 0; i < boxes.length; i++) {
    const s = score(from, boxes[i], dir);
    if (s < low) { low = s; at = i; }
  }
  return at;
}
