/** Line icons drawn for the app (24 x 24, stroke = currentColor). */
const P: Record<string, string> = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  tv: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 3l4 4 4-4"/>',
  film: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 6l2-3M12 6l2-3M17 6l2-3"/><path d="M4 3.5l15-1.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9L12 3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v5h5"/><path d="M12 8v4.5l3 1.8"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/>',
  user: '<circle cx="12" cy="8.5" r="4"/><path d="M4 21c1.2-4.2 4.4-6.2 8-6.2s6.8 2 8 6.2"/>',
  play: '<path d="M7 4.5v15l12.5-7.5L7 4.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="4.5" width="3.8" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="13.7" y="4.5" width="3.8" height="15" rx="1" fill="currentColor" stroke="none"/>',
  back: '<path d="M10 6L4 12l6 6"/><path d="M4 12h12a4 4 0 0 1 0 8h-2"/>',
  chevronL: '<path d="M15 5l-7 7 7 7"/>',
  chevronR: '<path d="M9 5l7 7-7 7"/>',
  chevronUD: '<path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5"/>',
  arrowsLR: '<path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/><path d="M3 12h18"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  bookmark: '<path d="M6 3.5h12v17l-6-4.5-6 4.5v-17z"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10a2.4 2.4 0 1 0 0 4M17 10a2.4 2.4 0 1 0 0 4"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.5"/>',
  rewind: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 3v4h4"/>',
  forward: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3v4h-4"/>',
  signal: '<path d="M5 19v-3M10 19v-6M15 19v-9M20 19V6"/>',
  heart: '<path d="M12 20s-7.5-4.4-9-9.3C2 7.5 4.2 4.5 7.4 4.5c2 0 3.6 1.1 4.6 2.7 1-1.6 2.6-2.7 4.6-2.7 3.2 0 5.4 3 4.4 6.2C19.5 15.6 12 20 12 20z"/>',
  fire: '<path d="M12 21c-4 0-7-2.8-7-6.6 0-4.4 4.4-6.4 4.8-11.4 2.8 1.6 4.4 4.2 4.6 6.6 1-.8 1.6-2 1.8-3.4 2.2 2 3.8 4.6 3.8 8.2 0 3.8-3 6.6-8 6.6z"/>',
  news: '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h2.5v10a2 2 0 0 1-2 2"/><path d="M7 8h7M7 12h7M7 16h4"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.4 4.4H9.6l-1.4-4.4L12 7.5z"/><path d="M12 3v4.5M20.4 9.5l-4.6.8M17.6 19.5l-3.2-4.8M6.4 19.5l3.2-4.8M3.6 9.5l4.6.8"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19L13 11"/>',
  bear: '<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="6.5" r="2.5"/><circle cx="12" cy="13" r="7"/><circle cx="9.5" cy="12" r=".6" fill="currentColor"/><circle cx="14.5" cy="12" r=".6" fill="currentColor"/><path d="M10.5 15.5c.9.7 2.1.7 3 0"/>',
  mosque: '<path d="M12 3v2"/><path d="M6.5 13a5.5 5.5 0 0 1 11 0"/><path d="M4 21v-8h16v8"/><path d="M10 21v-3a2 2 0 0 1 4 0v3"/><path d="M2 21h20"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  broadcast: '<circle cx="12" cy="12" r="2"/><path d="M8 8a5.6 5.6 0 0 0 0 8M16 8a5.6 5.6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  serial: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18M7 5v14M17 5v14"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-.8 2-1.8 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/>',
  textSize: '<path d="M4 18L9 5l5 13M5.8 13.5h6.4"/><path d="M15 18l3-7.5 3 7.5M16 15.6h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  sparkles: '<path d="M12 3l1.6 4.8L18.5 9.5l-4.9 1.7L12 16l-1.6-4.8L5.5 9.5l4.9-1.7L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.5 12.5a9.5 9.5 0 0 1 13 0"/><path d="M8.8 16a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 21v-5h-5"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  logout: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8L20 3M16 7l3 3M18.5 4.5l2 2"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.5 2.4 2.3 4 2.3s3-.8 4-2.3"/><circle cx="9" cy="9.5" r=".8" fill="currentColor"/><circle cx="15" cy="9.5" r=".8" fill="currentColor"/>',
  ghost: '<path d="M5 20V11a7 7 0 0 1 14 0v9l-2.3-1.6L14.4 20 12 18.4 9.6 20l-2.3-1.6L5 20z"/><circle cx="9.5" cy="11" r=".8" fill="currentColor"/><circle cx="14.5" cy="11" r=".8" fill="currentColor"/>',
  masks: '<path d="M3 5c3 1 6 1 9 0v7a4.5 4.5 0 0 1-9 0V5z"/><path d="M12 8c3 1 6 1 9 0v7a4.5 4.5 0 0 1-8.6 1.8"/><path d="M5.5 9.5h2M8.5 9.5h1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  mountain: '<path d="M2 20L9 7l4 7 2.5-4L22 20H2z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M17.5 14.5c2.2.3 3.6 2 4 5"/>',
  cat: '<path d="M4 20V9l3-5 3 4h4l3-4 3 5v11H4z"/><circle cx="9.5" cy="13" r=".8" fill="currentColor"/><circle cx="14.5" cy="13" r=".8" fill="currentColor"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
  hd: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M6.5 9v6M6.5 12h4M10.5 9v6M14 9v6h1.5a3 3 0 0 0 0-6H14z"/>',
};

export type IconName = keyof typeof P;

export function icon(name: IconName, cls?: string): string {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[name] + '</svg>';
}

export function iconEl(name: IconName, cls?: string): HTMLElement {
  const s = document.createElement('span');
  s.className = 'ic-wrap';
  s.innerHTML = icon(name, cls);
  return s;
}
