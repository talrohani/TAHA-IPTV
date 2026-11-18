# Taha IPTV

A fast Xtream Codes player for Samsung Tizen TVs (built for the AU7000, Tizen 6.0), Arabic first (right to left),
English as an option. Plain TypeScript and CSS, no UI framework; Vite builds it into one classic script that runs on
the TV's Chromium 76 from the `.wgt` package.

## Status: phase 1 (UI) — waiting for review

Every screen is built with demo data and full remote navigation. Not started yet, by plan: the real Xtream Codes
client (phase 2), Samsung AVPlay (phase 3), persistence and EPG tuning (phase 4), the Tizen package (phase 5).

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
  data/      types (Xtream's shapes), demo source, favorites/history/resume
  playback/  player state machine (IDLE → PREPARING → READY → PLAYING/PAUSED/BUFFERING → ERROR/ENDED), HTML5 engine
  screens/   home, live, library, details, player, login, settings, search, collection
  styles/    tokens (colours, radii, scale), base, screens
tests/       focus geometry, time formats, server addresses
```

## TV constraints kept in the code

- Chromium 76: no flex `gap`, `aspect-ratio`, `inset`; the bundle is compiled to ES2019 (no `?.` / `??`).
- `file://`: no module scripts; the build is an IIFE loaded with `defer`.
- One video plane: one player for preview and full screen (moving the picture, not restarting the stream).
- Long lists are virtualized (only the rows on screen exist); posters load when near the screen.
