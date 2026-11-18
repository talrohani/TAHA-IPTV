/** Small DOM helpers: no framework, so building a screen is plain element creation. */

type Child = Node | string | number | null | undefined | false;

export interface Props {
  cls?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string>;
  style?: Partial<Record<keyof CSSStyleDeclaration, string>>;
  /** Focusable by the remote (the focus engine looks for [data-f]). */
  focus?: boolean;
  /** OK on it (or a click). */
  onOk?: (el: HTMLElement) => void;
  /** A group remembers its last focused element, so coming back lands where you were. */
  group?: string;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, children?: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.cls) el.className = props.cls;
    if (props.text !== undefined) el.textContent = props.text;
    if (props.html !== undefined) el.innerHTML = props.html;
    if (props.attrs) for (const k in props.attrs) el.setAttribute(k, props.attrs[k]);
    if (props.style) Object.assign(el.style, props.style);
    if (props.focus) el.setAttribute('data-f', '');
    if (props.group) el.setAttribute('data-group', props.group);
    if (props.onOk) onOk(el, props.onOk);
  }
  if (children) append(el, children);
  return el;
}

export function append(parent: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function toggle(el: Element, cls: string, on: boolean): void {
  if (on) el.classList.add(cls);
  else el.classList.remove(cls);
}

/** What OK does on an element; a pointer click does the same. */
export function onOk(el: HTMLElement, fn: (el: HTMLElement) => void): void {
  (el as OkElement).__ok = fn;
  el.addEventListener('click', () => fn(el));
}

export interface OkElement extends HTMLElement {
  __ok?: (el: HTMLElement) => void;
  /** A component that handles some keys itself (a list, the seek bar): true when it did. */
  __key?: (key: string, repeat: boolean) => boolean;
}

export function onKey(el: HTMLElement, fn: (key: string, repeat: boolean) => boolean): void {
  (el as OkElement).__key = fn;
}

/** Images load only once they're near the screen. */
let observer: IntersectionObserver | null = null;
export function lazyImg(img: HTMLImageElement, src: string): void {
  if (!src) return;
  if (typeof IntersectionObserver === 'undefined') { img.src = src; return; }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const i = e.target as HTMLImageElement;
        const s = i.getAttribute('data-src');
        if (s) { i.src = s; i.removeAttribute('data-src'); }
        observer!.unobserve(i);
      }
    }, { rootMargin: '400px' });
  }
  img.setAttribute('data-src', src);
  observer.observe(img);
}

export function pad2(n: number): string { return (n < 10 ? '0' : '') + n; }

/** 5400000 → "1:30:00", 754000 → "12:34"; long forms keep hours ("00:24:17" with `hours`). */
export function hms(ms: number, hours?: boolean): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  if (hours) return pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss);
  return (hh ? hh + ':' + pad2(mm) : String(mm)) + ':' + pad2(ss);
}

export function clock(d: Date): string { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
