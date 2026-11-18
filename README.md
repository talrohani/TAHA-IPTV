# Taha IPTV

A fast Xtream Codes player for Samsung Tizen TVs (built for the AU7000, Tizen 6.0), Arabic first (right to left),
English as an option. Plain TypeScript and CSS, no UI framework; Vite builds it into one classic script that runs on
the TV's Chromium 76 from the `.wgt` package.

## Status: phase 3 (playback) — waiting for review

Phases 1 (screens) and 2 (Xtream Codes) were approved. Phase 3 plays the streams: Samsung AVPlay on the TV,
HTML5 video in a browser. Not started yet, by plan: persistence and EPG tuning (phase 4), the Tizen package (phase 5).

### Playback (`src/playback/`)

- `player.ts`: one player for the app, a state machine (IDLE → PREPARING → READY → PLAYING ⇄ PAUSED, BUFFERING,
  ERROR, ENDED) over an engine. Each play() is a session: an older stream's late events are dropped. It gives up on
  a start after 20 s and on buffering that hasn't moved for 30 s; a live channel that drops is opened again after
  2 s (twice; a format the TV can't play is never retried); one seek at a time, the newest target kept.
- `avplay.ts`: Samsung AVPlay. open → listener → buffering (Settings › Buffering) → 4K mode for 4K films →
  display rectangle → prepareAsync → seek to the resume point → play. Audio and subtitle tracks
  (`getTotalTrackInfo`, `setSelectTrack`); subtitles come to the page as text (`onsubtitlechange`) and the player
  draws them (Settings › Subtitle size). Picture: letterbox or fill. Every AVPlay call is guarded.
- `matte.ts`: AVPlay draws under the whole page, so on the TV the page is transparent and four panels paint the
  background around the picture (the live preview's box, or the full screen).
- `tizen.ts`: loads `$WEBAPIS/webapis/webapis.js` only on a TV; the screensaver is off while something plays; the
  stream is suspended when the app goes to the background and restored after (a live channel is opened again).
- `html5.ts`: the browser's engine (no track switching there; speed 0.5–2×, which AVPlay only offers without sound).
- Resume: Settings › Auto-resume puts Resume (or From the start) first on a film's page and decides whether episode
  cards start where they were left. A resume point within 10 s of the stream's real end is ignored (a provider's
  listed length can be wrong). Your default audio and subtitle languages are picked when a stream starts.

### Phase 2: how the app talks to the server (`src/data/xtream/`)

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

- Unit tests (32): the player's states, stale events, start and stall timeouts, live reconnects, seek queue,
  background and back; AVPlay's call order, resume seek, late prepares, tracks, subtitles, errors (against a
  stand-in for `webapis.avplay`); response normalizers; addresses, focus geometry, time formats.
- In the browser (HTML5 engine, demo streams): live preview inside its box, full screen and back to the preview,
  film resume, seek bar (choose a point, OK), speed, info (real resolution), leaving saves the position. Phase 2's
  sign-in, lists, search and error cases against a local stand-in server.
- Not yet on the TV: AVPlay itself (the picture under the page, tracks, subtitles, 4K, suspend/restore), real
  providers' streams and Key Manager. The AU7000 decodes H.264 and HEVC in HLS and MPEG-TS; which of a provider's
  streams play depends on their formats.

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
