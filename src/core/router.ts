/**
 * Screens in a stack: opening one hides the one under it (kept, with its focus), Back shows it again exactly as it
 * was. Dialogs sit over the top screen and take the arrows until closed.
 */
import { setLayer, focused, focus } from './focus';
import { clear } from './dom';
import type { Key } from './keys';

export interface Screen {
  el: HTMLElement;
  /** Keys before the focus engine (true: handled). */
  onKey?(key: Key, repeat: boolean): boolean;
  /** Back on this screen (true: handled, it stays). */
  onBack?(): boolean;
  /** Shown again (after the screen above it closed). */
  resume?(): void;
  /** Leaving for good: stop timers, players, requests. */
  destroy?(): void;
  /** The element to focus the first time. */
  first?(): HTMLElement | null;
}

export type ScreenFactory = (params?: Record<string, unknown>) => Screen;

interface Entry { name: string; screen: Screen; focus: HTMLElement | null }

const stack: Entry[] = [];
const registry: Record<string, ScreenFactory> = {};
let host: HTMLElement;
let dialog: { el: HTMLElement; onKey?: (k: Key) => boolean; close: () => void; restore: HTMLElement | null } | null = null;

export function init(stageEl: HTMLElement): void { host = stageEl; }
export function register(name: string, factory: ScreenFactory): void { registry[name] = factory; }
export function top(): Entry | undefined { return stack[stack.length - 1]; }
export function topName(): string { const e = top(); return e ? e.name : ''; }

export function open(name: string, params?: Record<string, unknown>, opts?: { replace?: boolean; reset?: boolean }): void {
  closeDialog();
  const prev = top();
  if (prev) prev.focus = focused();
  if (opts && opts.reset) while (stack.length) destroyEntry(stack.pop()!);
  else if (opts && opts.replace && prev) destroyEntry(stack.pop()!);
  else if (prev) prev.screen.el.style.display = 'none';
  // Memory: at most MAX_DEPTH screens kept; past that, the oldest above the first one (Home) go for good.
  while (stack.length >= MAX_DEPTH) destroyEntry(stack.splice(1, 1)[0]);
  const screen = registry[name](params);
  screen.el.classList.add('screen');
  host.appendChild(screen.el);
  stack.push({ name, screen, focus: null });
  setLayer(screen.el, screen.first ? screen.first() : null);
}

const MAX_DEPTH = 8;
const destroyHooks: Array<() => void> = [];
/** Called after a screen is gone for good (the image loader lets go of its pictures). */
export function onScreenGone(fn: () => void): void { destroyHooks.push(fn); }

function destroyEntry(e: Entry): void {
  if (e.screen.destroy) e.screen.destroy();
  if (e.screen.el.parentNode) e.screen.el.parentNode.removeChild(e.screen.el);
  for (const fn of destroyHooks) fn();
}

export function depth(): number { return stack.length; }

/** Back: the dialog, then the screen's own Back, then the screen under it. False at the bottom of the stack. */
export function back(): boolean {
  if (dialog) { closeDialog(); return true; }
  const cur = top();
  if (!cur) return false;
  if (cur.screen.onBack && cur.screen.onBack()) return true;
  if (stack.length < 2) return false;
  destroyEntry(stack.pop()!);
  const under = top()!;
  under.screen.el.style.display = '';
  setLayer(under.screen.el, under.focus);
  if (under.screen.resume) under.screen.resume();
  return true;
}

export function screenKey(key: Key, repeat: boolean): boolean {
  if (dialog) return dialog.onKey ? dialog.onKey(key) : false;
  const cur = top();
  return !!(cur && cur.screen.onKey && cur.screen.onKey(key, repeat));
}

/** A dialog over the top screen: the arrows stay in it until it closes (Back closes it). */
export function openDialog(el: HTMLElement, opts?: { onKey?: (k: Key) => boolean; onClose?: () => void; first?: HTMLElement }): void {
  closeDialog();
  const restore = focused();
  const wrap = document.createElement('div');
  wrap.className = 'dialog-layer';
  wrap.appendChild(el);
  host.appendChild(wrap);
  dialog = {
    el: wrap, onKey: opts && opts.onKey, restore,
    close: () => { if (opts && opts.onClose) opts.onClose(); },
  };
  setLayer(wrap, opts && opts.first ? opts.first : null);
}

export function closeDialog(): void {
  if (!dialog) return;
  const d = dialog;
  dialog = null;
  d.close();
  clear(d.el);
  if (d.el.parentNode) d.el.parentNode.removeChild(d.el);
  const cur = top();
  if (cur) { setLayer(cur.screen.el, d.restore); if (d.restore) focus(d.restore); }
}

export function hasDialog(): boolean { return !!dialog; }
