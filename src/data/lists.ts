/**
 * Work on big lists done once per list. A provider's film list can hold 50,000 entries: Home's "latest" rows and
 * search shouldn't sort or lower-case all of it again on every visit or keystroke. Results are kept per list object
 * (WeakMap): a new list from the server (after its cache expires) is worked on afresh, an old one is let go with it.
 */

type Field = 'added' | 'rating' | 'year';
const topCache = new WeakMap<object, Record<string, unknown[]>>();

/** The n highest by field, highest first (ties keep the list's order), without sorting the whole list. */
export function topBy<T extends Record<Field, number>>(list: T[], n: number, field: Field): T[] {
  const id = field + n;
  let byKey = topCache.get(list);
  if (byKey && byKey[id]) return byKey[id] as T[];
  const top: T[] = [];
  for (const x of list) {
    const v = x[field];
    if (top.length === n && v <= top[n - 1][field]) continue;
    let i = top.length;
    while (i > 0 && top[i - 1][field] < v) i--;
    top.splice(i, 0, x);
    if (top.length > n) top.pop();
  }
  if (!byKey) { byKey = {}; topCache.set(list, byKey); }
  byKey[id] = top;
  return top;
}

/** The n newest (by `added`). */
export function newest<T extends Record<Field, number>>(list: T[], n: number): T[] { return topBy(list, n, 'added'); }

export type Sort = 'newest' | 'rating' | 'name' | 'year';
const sortCache = new WeakMap<object, Record<string, unknown[]>>();
let collator: Intl.Collator | null = null;

/** The list sorted, once per list and order (a 50,000-film sort by name takes the TV about a second). */
export function sortedBy<T extends Record<Field, number> & { name: string }>(list: T[], sort: Sort): T[] {
  let bySort = sortCache.get(list);
  if (bySort && bySort[sort]) return bySort[sort] as T[];
  const out = list.slice();
  if (sort === 'newest') out.sort((a, b) => b.added - a.added);
  else if (sort === 'rating') out.sort((a, b) => b.rating - a.rating);
  else if (sort === 'year') out.sort((a, b) => b.year - a.year);
  else {
    if (!collator) collator = new Intl.Collator(['ar', 'en'], { sensitivity: 'base', numeric: true });
    out.sort((a, b) => collator!.compare(a.name, b.name));
  }
  if (!bySort) { bySort = {}; sortCache.set(list, bySort); }
  bySort[sort] = out;
  return out;
}

const keyCache = new WeakMap<object, string[]>();

/** Lower-case form of text, for matching: Arabic letter forms folded (أ إ آ → ا, ة → ه, ى → ي), marks dropped. */
export function fold(text: string): string {
  return text.toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')     // harakat, superscript alef, tatweel
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
}

/** The items whose name holds q (folded), up to max, in the list's order. */
export function matching<T extends { name: string }>(list: T[], q: string, max: number): T[] {
  let keys = keyCache.get(list);
  if (!keys) { keys = list.map((x) => fold(x.name)); keyCache.set(list, keys); }
  const want = fold(q.trim()), out: T[] = [];
  if (!want) return out;
  for (let i = 0; i < keys.length && out.length < max; i++) if (keys[i].indexOf(want) >= 0) out.push(list[i]);
  return out;
}
