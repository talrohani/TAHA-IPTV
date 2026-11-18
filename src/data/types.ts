/**
 * What the screens show, in the shape the Xtream Codes API gives it (player_api.php), trimmed to what's used.
 * Phase 1 fills it with demo data; phase 2's Xtream client returns the same types.
 */
export type Kind = 'live' | 'movie' | 'series' | 'episode';

export interface Category { id: string; name: string; count: number; icon?: string }

export interface Channel {
  kind: 'live';
  id: number;
  num: number;
  name: string;
  logo: string;
  category: string;
  epgId?: string;
  hd?: boolean;
}

export interface Program { title: string; desc: string; start: number; end: number }

export interface Movie {
  kind: 'movie';
  id: number;
  name: string;
  poster: string;
  backdrop: string;
  category: string;
  genres: string[];
  year: number;
  rating: number;
  duration: number;   // ms
  quality: '4K' | 'HD' | 'SD';
  added: number;      // ms since epoch
  plot: string;
  cast: string[];
  director: string;
  ext: string;
}

export interface Episode {
  kind: 'episode';
  id: number;
  seriesId: number;
  season: number;
  num: number;
  name: string;
  still: string;
  duration: number;
  plot: string;
  ext: string;
}

export interface Season { num: number; episodes: Episode[] }

export interface Series {
  kind: 'series';
  id: number;
  name: string;
  poster: string;
  backdrop: string;
  category: string;
  genres: string[];
  year: number;
  rating: number;
  quality: '4K' | 'HD' | 'SD';
  added: number;
  plot: string;
  cast: string[];
  seasons?: Season[];   // loaded on demand (get_series_info)
}

export type Item = Channel | Movie | Series | Episode;

export interface Account {
  server: string;
  username: string;
  status: 'Active' | 'Expired' | 'Disabled';
  expires: number;    // ms, 0 = none
  maxConnections: number;
  formats: string[];
  demo: boolean;
}

/** Everything the app asks of a provider. Lists are loaded on demand, never all at start. */
export interface DataSource {
  account(): Account;
  liveCategories(): Promise<Category[]>;
  channels(categoryId: string): Promise<Channel[]>;
  epg(channel: Channel): Promise<Program[]>;
  movieCategories(): Promise<Category[]>;
  movies(categoryId: string): Promise<Movie[]>;
  /** A film with its details filled in (plot, cast, length, backdrop), when a page opens. */
  movieInfo(m: Movie): Promise<Movie>;
  seriesCategories(): Promise<Category[]>;
  series(categoryId: string): Promise<Series[]>;
  seriesInfo(s: Series): Promise<Season[]>;
  streamUrl(item: Channel | Movie | Episode): string;
}
