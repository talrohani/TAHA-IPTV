export { h, lazyImg, onKey, onOk } from '../core/dom';
import { iconEl, IconName } from './icons';

/** An icon element with an extra class. */
export function iconify(name: IconName, cls: string): HTMLElement {
  const e = iconEl(name);
  e.classList.add(cls);
  return e;
}
