/**
 * Artwork for the demo data, drawn as SVG from a seed (no images to ship, nothing copied): film posters, landscape
 * thumbnails, channel logos and the home screen's skyline. Real accounts use the server's own pictures instead.
 */
const cache = new Map<string, string>();

function rnd(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return Math.abs(h) || 7;
}

const PALETTES = [
  ['#1B2A6B', '#7B3FE4', '#F59E0B'], ['#0F3D3E', '#0EA5A4', '#F4D35E'], ['#3B0D2E', '#C2185B', '#FFB74D'],
  ['#0B1F3A', '#1E88E5', '#90CAF9'], ['#2D1B0E', '#C2410C', '#FCD34D'], ['#101828', '#4338CA', '#F472B6'],
  ['#062A1F', '#15803D', '#BEF264'], ['#2A0F0F', '#B91C1C', '#FCA5A5'], ['#0E1A2B', '#0891B2', '#F0ABFC'],
  ['#1E1035', '#9333EA', '#FDE68A'],
];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function uri(svg: string): string { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

/** A scene: sky, a big light, ridges or a city, a figure — different for every seed. */
function scene(w: number, h: number, r: () => number, pal: string[]): string {
  const kind = Math.floor(r() * 4);
  let s = '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/>'
    + '<stop offset=".62" stop-color="' + pal[1] + '"/><stop offset="1" stop-color="' + pal[2] + '"/></linearGradient>'
    + '<radialGradient id="sun"><stop offset="0" stop-color="' + pal[2] + '" stop-opacity=".95"/><stop offset="1" stop-color="' + pal[2] + '" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#05070E" stop-opacity="0"/><stop offset="1" stop-color="#05070E" stop-opacity=".92"/></linearGradient></defs>'
    + '<rect width="' + w + '" height="' + h + '" fill="url(#g)"/>';
  const sx = w * (0.25 + r() * 0.5), sy = h * (0.3 + r() * 0.25), sr = Math.min(w, h) * (0.35 + r() * 0.3);
  s += '<circle cx="' + sx + '" cy="' + sy + '" r="' + sr + '" fill="url(#sun)"/>';
  s += '<circle cx="' + sx + '" cy="' + sy + '" r="' + sr * 0.18 + '" fill="' + pal[2] + '" opacity=".9"/>';
  const base = h * (0.62 + r() * 0.1);
  if (kind === 0 || kind === 2) {
    for (let layer = 0; layer < 3; layer++) {
      let d = 'M0 ' + h, x = 0, y = base + layer * h * 0.06;
      d += ' L0 ' + y;
      while (x < w) { x += w * (0.06 + r() * 0.12); y = base + layer * h * 0.06 - r() * h * (0.18 - layer * 0.04); d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1); }
      d += ' L' + w + ' ' + h + ' Z';
      s += '<path d="' + d + '" fill="#05070E" opacity="' + (0.45 + layer * 0.22) + '"/>';
    }
  } else {
    let x = 0;
    while (x < w) {
      const bw = w * (0.04 + r() * 0.08), bh = h * (0.12 + r() * 0.3);
      s += '<rect x="' + x.toFixed(1) + '" y="' + (base - bh + h * 0.1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (h - base + bh).toFixed(1) + '" fill="#05070E" opacity=".85"/>';
      if (r() < 0.35) s += '<circle cx="' + (x + bw / 2).toFixed(1) + '" cy="' + (base - bh + h * 0.1).toFixed(1) + '" r="' + (bw / 2).toFixed(1) + '" fill="#05070E" opacity=".85"/>';
      x += bw + w * 0.005;
    }
  }
  if (kind >= 2) {   // a figure looking at the light
    const fx = w * (0.3 + r() * 0.4), fh = h * 0.32, fy = h - fh * 0.55;
    s += '<g fill="#03040A"><circle cx="' + fx + '" cy="' + (fy - fh * 0.38) + '" r="' + fh * 0.08 + '"/>'
      + '<path d="M' + (fx - fh * 0.14) + ' ' + h + ' L' + (fx - fh * 0.11) + ' ' + (fy - fh * 0.28) + ' Q' + fx + ' ' + (fy - fh * 0.34) + ' ' + (fx + fh * 0.11) + ' ' + (fy - fh * 0.28) + ' L' + (fx + fh * 0.14) + ' ' + h + ' Z"/></g>';
  }
  return s;
}

/** A portrait poster (2:3) with the title at the bottom. */
export function poster(title: string, seed?: number): string {
  const key = 'p|' + title + '|' + seed;
  const hit = cache.get(key);
  if (hit) return hit;
  const sd = seed || hash(title), r = rnd(sd), pal = PALETTES[sd % PALETTES.length];
  const w = 300, h = 450, words = title.length > 18 ? 30 : title.length > 11 ? 36 : 44;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'
    + scene(w, h, r, pal) + '<rect width="' + w + '" height="' + h + '" fill="url(#fade)"/>'
    + '<text x="' + w / 2 + '" y="' + (h - 44) + '" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-weight="800" font-size="' + words + '" fill="#fff">' + esc(title) + '</text></svg>';
  const u = uri(svg);
  cache.set(key, u);
  return u;
}

/** A 16:9 still (continue watching, episodes, backdrops), without text. */
export function still(title: string, seed?: number): string {
  const key = 's|' + title + '|' + seed;
  const hit = cache.get(key);
  if (hit) return hit;
  const sd = (seed || hash(title)) + 11, r = rnd(sd), pal = PALETTES[sd % PALETTES.length];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' + scene(640, 360, r, pal) + '</svg>';
  const u = uri(svg);
  cache.set(key, u);
  return u;
}

/** A channel logo: its short name on the channel's colours. */
export function logo(text: string, seed?: number): string {
  const key = 'l|' + text + '|' + seed;
  const hit = cache.get(key);
  if (hit) return hit;
  const sd = seed || hash(text), pal = PALETTES[sd % PALETTES.length];
  const size = text.length > 6 ? 26 : text.length > 4 ? 32 : 38;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90">'
    + '<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + pal[1] + '"/><stop offset="1" stop-color="' + pal[0] + '"/></linearGradient></defs>'
    + '<rect width="160" height="90" rx="14" fill="url(#b)"/>'
    + '<text x="80" y="' + (45 + size * 0.36) + '" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-weight="900" font-size="' + size + '" fill="#fff">' + esc(text) + '</text></svg>';
  const u = uri(svg);
  cache.set(key, u);
  return u;
}

/** The home screen's header: a city of domes and minarets against the evening sky. */
export function skyline(): string {
  const hit = cache.get('skyline');
  if (hit) return hit;
  const w = 1920, h = 420, r = rnd(97);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid slice">'
    + '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1736"/><stop offset=".45" stop-color="#3A2A6E"/>'
    + '<stop offset=".72" stop-color="#B4537A"/><stop offset="1" stop-color="#F29A55"/></linearGradient>'
    + '<radialGradient id="glow" cx="1180" cy="330" r="620" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFC36B" stop-opacity=".8"/><stop offset="1" stop-color="#FFC36B" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="#080F1F" stop-opacity="0"/><stop offset="1" stop-color="#080F1F"/></linearGradient></defs>'
    + '<rect width="' + w + '" height="' + h + '" fill="url(#sky)"/><rect width="' + w + '" height="' + h + '" fill="url(#glow)"/>';
  for (let i = 0; i < 60; i++) s += '<circle cx="' + (r() * w).toFixed(0) + '" cy="' + (r() * h * 0.4).toFixed(0) + '" r="' + (r() * 1.4 + 0.3).toFixed(1) + '" fill="#fff" opacity="' + (r() * 0.6 + 0.2).toFixed(2) + '"/>';
  // Far roofs, then the mosque in the middle
  let x = 0;
  while (x < w) {
    const bw = 30 + r() * 70, bh = 30 + r() * 70;
    s += '<rect x="' + x.toFixed(0) + '" y="' + (h - 60 - bh).toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + (bh + 60) + '" fill="#160F2A"/>';
    if (r() < 0.25) s += '<circle cx="' + (x + bw / 2).toFixed(0) + '" cy="' + (h - 60 - bh).toFixed(0) + '" r="' + (bw / 2.4).toFixed(0) + '" fill="#160F2A"/>';
    x += bw;
  }
  const cx = 1180, by = h - 90;
  s += '<g fill="#0C0820">'
    + '<path d="M' + (cx - 120) + ' ' + by + ' Q' + (cx - 120) + ' ' + (by - 140) + ' ' + cx + ' ' + (by - 175) + ' Q' + (cx + 120) + ' ' + (by - 140) + ' ' + (cx + 120) + ' ' + by + ' Z"/>'
    + '<rect x="' + (cx - 1.5) + '" y="' + (by - 215) + '" width="3" height="40"/><circle cx="' + cx + '" cy="' + (by - 218) + '" r="6"/>'
    + '<path d="M' + (cx - 230) + ' ' + by + ' Q' + (cx - 230) + ' ' + (by - 70) + ' ' + (cx - 170) + ' ' + (by - 88) + ' Q' + (cx - 110) + ' ' + (by - 70) + ' ' + (cx - 110) + ' ' + by + ' Z"/>'
    + '<path d="M' + (cx + 110) + ' ' + by + ' Q' + (cx + 110) + ' ' + (by - 70) + ' ' + (cx + 170) + ' ' + (by - 88) + ' Q' + (cx + 230) + ' ' + (by - 70) + ' ' + (cx + 230) + ' ' + by + ' Z"/>';
  [-330, -200, 200, 330].forEach((dx, i) => {
    const mh = i === 1 || i === 2 ? 300 : 230, mx = cx + dx;
    s += '<rect x="' + (mx - 11) + '" y="' + (by - mh) + '" width="22" height="' + mh + '"/>'
      + '<rect x="' + (mx - 17) + '" y="' + (by - mh * 0.62) + '" width="34" height="10" rx="3"/>'
      + '<rect x="' + (mx - 15) + '" y="' + (by - mh * 0.86) + '" width="30" height="9" rx="3"/>'
      + '<path d="M' + (mx - 11) + ' ' + (by - mh) + ' L' + mx + ' ' + (by - mh - 34) + ' L' + (mx + 11) + ' ' + (by - mh) + ' Z"/>';
  });
  s += '<rect x="' + (cx - 380) + '" y="' + by + '" width="760" height="90"/></g>';
  for (let i = 0; i < 40; i++) {
    const wx = cx - 360 + r() * 720, wy = by + 12 + r() * 50;
    s += '<rect x="' + wx.toFixed(0) + '" y="' + wy.toFixed(0) + '" width="5" height="8" fill="#FFC36B" opacity="' + (0.3 + r() * 0.5).toFixed(2) + '"/>';
  }
  s += '<rect width="' + w + '" height="' + h + '" fill="url(#fade)"/></svg>';
  const u = uri(s);
  cache.set('skyline', u);
  return u;
}
