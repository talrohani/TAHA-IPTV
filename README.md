# Taha IPTV

A fast Xtream Codes player for Samsung Tizen TVs (built for the AU7000, Tizen 6.0), Arabic first (right to left),
English as an option. Plain TypeScript and CSS, no UI framework; Vite builds it into one classic script that runs on
the TV's Chromium 76 from the `.wgt` package.

## Status: phase 2 (Xtream Codes) — waiting for review

Phase 1 (every screen, demo data, remote navigation) was approved. Phase 2 connects the screens to a real
Xtream Codes account. Not started yet, by plan: Samsung AVPlay (phase 3), persistence and EPG tuning (phase 4),
the Tizen package (phase 5).

### How the app talks to the server (`src/data/xtream/`)

- `player_api.php` only: login, `get_live_categories`, `get_live_streams`, `get_short_epg`, `get_vod_categories`,
  `get_vod_streams`, `get_vod_info`, `get_series_categories`, `get_series`, `get_series_info`.
- What loads when: at sign-in, the account check only; Home loads the film and series lists; Live loads the
  channel list once (categories and counts come from it); films and series by category; details
  (`get_vod_info`, `get_series_info`) and the guide (`get_short_epg`) only for the item on screen.
- Caches: lists 30 min and the guide 10 min in memory (at most 14 lists); categories 12 h on the TV, under a
  key that holds no credentials. Requests asked twice while running are shared. Settings › Clear cache empties both.
- Odd answers are expected: lists sent as objects, numbers as strings, missing names/posters/guides, base64 guide
  text, HTML instead of JSON, empty bodies. Broken entries are skipped, missing pictures are drawn instead.
- Errors have a kind (wrong login, expired, disabled, unreachable, timeout after 15 s / 45 s for big lists,
  not an Xtream server, HTTP error) and a message in Arabic or English; never the address, which holds the password.
  Each screen shows the error with Try again.
- Accounts: several can be saved (edit, remove after asking). The password goes to Tizen Key Manager when the TV
  offers it, else the app's own private storage (Settings › Application shows which). The app never logs.

### Tested

- Unit tests: response normalizers (odd shapes above), addresses, focus geometry, time formats.
- In the browser, against a local stand-in server: sign-in (valid, wrong password, expired, HTML answer,
  unreachable, timeout), 6,000 channels, categories, guide, films, film details, series seasons, search, saved
  account at start, server down at start and mid-session, Try again.
- Not yet on the TV: real providers, Key Manager, and playback (phase 3).

| Screen | What's there |
| --- | --- |
| Login | Server, username, password, remember, test connection, saved accounts (edit, remove), demo account |
| Home | Live / Movies / Series / Favorites shortcuts; Continue watching, Latest movies, Recently watched, Latest series |
| Live TV | Categories · channels (virtualized, ~600) · preview with now/next; OK plays, OK again goes full screen |
| Library | Movies / Series, genre chips, sort, continue watching, recently added, top rated; genre grid that pages |
| Details | Backdrop, poster, facts, plot, cast; resume / from the start; seasons and episodes with watched marks |
| Player | Title, quality, clock; seek bar (preview point, OK jumps, Back cancels, held keys speed up); −30 / +30; episodes, info, subtitles, audio, settings sheets; live: now/next and channel up/down |
| Settings | Playback, Appearance (language, theme, font size, poster size, animations), Account, Application (reset, diagnostics) |
| Search, Favorites, History | Search across all three kinds; favorites and history filtered by kind |

Demo data is made up (titles, channels, artwork drawn in code); nothing copyrighted is shipped. Its streams are a
public HLS test film.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5180 — the keyboard stands in for the remote
npm run build      # dist/: what goes into the .wgt
npm test
```

Remote ↔ keyboard: arrows; Enter = OK; Escape or Backspace = Back; Space = Play/Pause; A B C D = red, green,
yellow, blue; [ ] = rewind / fast forward; PageUp / PageDown = channel up / down; 0–9.

## Layout

```
src/
  core/      dom helpers, focus engine (spatial, with group memory), keys, router, i18n, storage
  ui/        icons, generated artwork, shared components (side menu, tabs, cards, virtual list, hints)
  data/      types (Xtream's shapes), demo source, favorites/history/resume (per account), saved accounts,
             password storage; xtream/: HTTP, response normalizers, client
  playback/  player state machine (IDLE → PREPARING → READY → PLAYING/PAUSED/BUFFERING → ERROR/ENDED), HTML5 engine
  screens/   home, live, library, details, player, login, settings, search, collection
  styles/    tokens (colours, radii, scale), base, screens
tests/       focus geometry, time formats, server addresses, Xtream response shapes
```

## TV constraints kept in the code

- Chromium 76: no flex `gap`, `aspect-ratio`, `inset`; the bundle is compiled to ES2019 (no `?.` / `??`).
- `file://`: no module scripts; the build is an IIFE loaded with `defer`.
- One video plane: one player for preview and full screen (moving the picture, not restarting the stream).
- Long lists are virtualized (only the rows on screen exist); posters load when near the screen.
