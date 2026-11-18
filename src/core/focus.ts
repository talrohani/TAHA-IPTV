/**
 * Remote focus. Focusable elements carry [data-f]; the one with focus has .is-focused (no browser focus, so nothing
 * scrolls or outlines by itself). Arrows move to the nearest element that way, within the active layer (a screen,
 * or a dialog over it). A [data-group] remembers its last element, so coming back to a row or a column lands where
 * you left it. Scroll containers ([data-scroll="x"|"y"]) follow the focus.
 */
import { best, Dir } from './spatial';
import type { OkElement } from './dom';

let layer: HTMLElement | null = null;
let current: HTMLElement | null = null;
const memory = new WeakMap<HTMLElement, HTMLElement>();
const listeners: Array<(el: HTMLElement | null) => void> = [];

export function stageScale(): number {
  const s = document.getElementById('stage');
  return s ? s.getBoundingClientRect().width / 1920 : 1;
}

function visible(el: HTMLElement): boolean {
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function groupOf(el: HTMLElement): HTMLElement | null {
  const g = el.parentElement ? el.parentElement.closest('[data-group]') : null;
  return g && layer && layer.contains(g) ? (g as HTMLElement) : null;
}

export function focusables(root?: HTMLElement): HTMLElement[] {
  const r = root || layer;
  if (!r) return [];
  const all = r.querySelectorAll<HTMLElement>('[data-f]');
  const out: HTMLElement[] = [];
  for (let i = 0; i < all.length; i++) if (!all[i].hasAttribute('data-disabled') && visible(all[i])) out.push(all[i]);
  return out;
}

/** Keeps `el` inside every scrolling ancestor, with some room around it. */
function reveal(el: HTMLElement): void {
  const k = stageScale() || 1;
  let node = el.parentElement;
  while (node && node !== layer) {
    const axis = node.getAttribute('data-scroll');
    if (axis) {
      const c = node.getBoundingClientRect(), r = el.getBoundingClientRect();
      const pad = (parseInt(node.getAttribute('data-pad') || '', 10) || 60) * k;
      if (axis === 'x') {
        if (r.right > c.right - pad) node.scrollLeft += (r.right - c.right + pad) / k;
        else if (r.left < c.left + pad) node.scrollLeft += (r.left - c.left - pad) / k;
      } else {
        if (r.bottom > c.bottom - pad) node.scrollTop += (r.bottom - c.bottom + pad) / k;
        else if (r.top < c.top + pad) node.scrollTop += (r.top - c.top - pad) / k;
      }
    }
    node = node.parentElement;
  }
}

export function focus(el: HTMLElement | null): void {
  if (current === el) { if (el) reveal(el); return; }
  if (current) current.classList.remove('is-focused');
  current = el;
  if (el) {
    el.classList.add('is-focused');
    let g = groupOf(el);
    while (g) { memory.set(g, el); g = g.parentElement ? (g.parentElement.closest('[data-group]') as HTMLElement | null) : null; }
    reveal(el);
  }
  for (const fn of listeners) fn(el);
}

export function focused(): HTMLElement | null { return current; }

export function onFocus(fn: (el: HTMLElement | null) => void): () => void {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}

/** The layer arrows move in. With `first`, that element gets the focus; otherwise the layer's remembered one. */
export function setLayer(root: HTMLElement, first?: HTMLElement | null): void {
  layer = root;
  const remembered = memory.get(root);
  const target = first || (remembered && root.contains(remembered) && visible(remembered) ? remembered : null) || focusables(root)[0] || null;
  focus(target);
}

export function currentLayer(): HTMLElement | null { return layer; }

/** Focus the remembered element of a group (or its first). */
export function focusGroup(group: HTMLElement): void {
  const m = memory.get(group);
  focus(m && group.contains(m) && visible(m) ? m : focusables(group)[0] || null);
}

export function move(dir: Dir): boolean {
  if (!layer) return false;
  const list = focusables();
  if (!current || !layer.contains(current) || !visible(current)) { focus(list[0] || null); return !!list[0]; }
  const from = current.getBoundingClientRect();
  // A group with data-trap="v" (a side menu) keeps ↑ ↓ inside it: past its ends, the focus stays.
  const cg0 = groupOf(current);
  const trapped = cg0 && (dir === 'up' || dir === 'down') && cg0.getAttribute('data-trap') === 'v';
  const others = list.filter((e) => e !== current && (!trapped || cg0!.contains(e)));
  const i = best(from, others.map((e) => e.getBoundingClientRect()), dir);
  if (i < 0) return false;
  let target = others[i];
  // Into another group: its remembered element, if it's still there.
  const g = groupOf(target), cg = groupOf(current);
  if (g && g !== cg && !(cg && g.contains(cg))) {
    const m = memory.get(g);
    if (m && m !== current && g.contains(m) && visible(m)) target = m;
  }
  focus(target);
  return true;
}

/** Keys the focused element (or one of its ancestors in the layer) handles itself. */
export function componentKey(key: string, repeat: boolean): boolean {
  let node: HTMLElement | null = current;
  while (node && layer && node !== layer.parentElement) {
    const fn = (node as OkElement).__key;
    if (fn && fn(key, repeat)) return true;
    node = node.parentElement;
  }
  return false;
}

export function activate(): boolean {
  const el = current as OkElement | null;
  if (el && el.__ok) { el.__ok(el); return true; }
  return false;
}
