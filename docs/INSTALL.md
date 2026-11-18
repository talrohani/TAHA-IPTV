# Installing Taha IPTV on a Samsung TV

Taha IPTV is installed as a developer app over your home network. It is its own app (package `TahaIPTV01`, app
`TahaIPTV01.TahaIPTV`): it doesn't replace or change anything else on the TV.

Built and tested for the **Samsung AU7000 (2021), Tizen 6.0, Chromium 76**. Other Samsung TVs from 2017 on should
work; 2023 and newer need a Samsung certificate (step 2).

## What you need

- A computer on the same network as the TV, with **Node.js 18+** (to build), **Python 3** (to package and install)
  and **Samsung's Tizen CLI** (to sign: Tizen Studio, or its command-line tools only).
- The TV's IP address: on the TV, Settings › General › Network › Network Status › IP Settings.

## 1. Developer Mode on the TV (once)

1. On the TV, open **Apps**.
2. On the remote, type **1 2 3 4 5** (number keys, or the on-screen number pad).
3. Turn **Developer mode** on, and set **Host PC IP** to your computer's IP address.
4. Turn the TV off and on again (fully: hold the power button until it restarts).

If your computer's IP changes later, put the new one in the same place, and restart the TV again.

## 2. A signing certificate (once)

The TV installs only signed apps, and later updates must be signed with the **same** certificate.

- **2017–2022 TVs (the AU7000 included):** a Tizen certificate is enough.
  - Tizen Studio: Tools › Certificate Manager › + › **Tizen** › create an author certificate › keep the default
    distributor. Name the profile (for example `taha`).
  - Or the command line:

    ```bash
    tizen certificate -a taha -p <password> -n "Your name"
    tizen security-profiles add -n taha -a ~/tizen-studio-data/keystore/author/taha.p12 -p <password>
    ```

- **2023 and newer TVs:** Certificate Manager › + › **Samsung**, signed in with your Samsung account, with this TV's
  DUID (the TV must be on and in Developer Mode). Samsung binds it to that TV.

Passwords are yours: type them in your own terminal or in Tizen Studio, never into a chat or a file you share.

## 3. Build and package

```bash
npm install
npm test
npm run build
python3 tizen/package.py --sign taha
```

`package.py` first checks the build for anything the AU7000's Chromium 76 can't run (`tizen/compat.py`), then
writes `TahaIPTV.wgt` with the version from `package.json`, signed with your profile. If Samsung's CLI isn't found,
set `TIZEN_STUDIO` to the folder it's installed in.

## 4. Install

**Option A — without Tizen Studio (Python only):**

```bash
python3 tizen/install.py <TV IP>
```

It copies the package to the TV over SDB (port 26101), installs it and opens it. `--info` shows what the TV
reports (Tizen version...) and changes nothing; `--uninstall` removes the app.

**Option B — with Tizen Studio's tools (sdb):**

```bash
sdb connect <TV IP>
sdb devices
tizen install -n TahaIPTV.wgt -t <device name from sdb devices>
tizen run -p TahaIPTV01.TahaIPTV -t <device name>
```

The app is then in the TV's **Apps** list as **Taha IPTV**; you can move it to the Home bar from there.

**Updating:** build, package and install again the same way. Saved accounts, favorites, history and settings
stay. **Removing:** `python3 tizen/install.py <TV IP> --uninstall`, `tizen uninstall -p TahaIPTV01 -t <device>`, or
on the TV: Apps › Settings › Taha IPTV › Delete (that also deletes what the app saved).

## 5. First start

1. Sign in with your Xtream Codes details: server address with its port (`http://host:port`), username, password.
   **Test connection** checks them without signing in. Or try the demo account first.
2. Settings › Playback: preferred stream format (Automatic tries MPEG-TS for live, HLS if the account allows only
   that), buffering, auto-resume, default audio and subtitle languages.
3. Settings › Application shows the player (Samsung AVPlay on the TV), the platform (Tizen and Chromium version),
   where the password is kept (Tizen secure store, or the app's private storage), memory and what's saved.

Remote: arrows and OK move and choose; Back goes back (on a playing film it first hides the controls); Play/Pause;
◀◀ ▶▶ move through a film; Channel ▲▼ change channel; red = favorite (subtitles in the player), green = audio,
yellow = player settings, blue = episodes; number keys on the seek bar jump to 10 %, 20 %…

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `Couldn't reach the TV on port 26101` | The TV must be **on** (not in standby), in Developer Mode, with **this** computer's IP as Host PC IP, and restarted after setting it. Check the TV's IP (not the computer's). |
| `install failed` mentioning a **different certificate**, or `failed[118]` | A Taha IPTV signed with another certificate is on the TV. Remove it (`install.py <IP> --uninstall`, or on the TV), then install again. Saved data goes with it. |
| `download failed[116]` | The TV is short of storage for apps: remove some apps (Settings › Support › Device Care › Manage Storage), restart, try again. |
| Sign-in: "wrong username or password" / "subscription expired" / "not an Xtream Codes server" | Check the details with your provider; the address needs the port your provider gave (often `:8080` or `:80`), and `http://` vs `https://` as they say. |
| Sign-in: "can't reach the server" or "didn't answer in time" | The TV's internet connection, or the provider's server is down. **Test connection** tells which. |
| A channel says "This TV can't play this stream's format" | The stream's codec isn't one the TV decodes (the AU7000 plays H.264 and HEVC; not AV1). Try Settings › Playback › Preferred stream format (MPEG-TS ↔ HLS); otherwise ask the provider. |
| A channel keeps "reconnecting", or stops after a while | Usually the account's connection limit (Settings › Account › Connections allowed): another device is using it. Or the provider's stream is down: another channel playing means the app is fine. |
| Picture black, sound plays (or the reverse) | The stream's video or audio format: try the other stream format, or the green key (audio track). |
| Lists take long the first time | Large providers send big lists (tens of thousands of films); they're kept for 30 minutes, categories for 12 hours. Settings › Application › Clear cache gets fresh lists. |
| A favorite or Continue Watching entry says the provider no longer has it | The provider removed or renumbered it: the red key removes it from Favorites or History. |
| Password storage says "app's private storage" | The TV didn't offer the Tizen secure store to the app; the password is kept in the app's own storage, which other apps can't read. |
| Arabic text or icons look wrong | Settings › Appearance › Language switches Arabic ⇄ English; Font size if text is cut off. |

To see the app's own diagnostics, open Settings › Application. The app never logs passwords or stream addresses.

## Test on the TV

What to try after installing; the last two columns say where it was checked.

| Check | Expected | Browser | TV |
| --- | --- | --- | --- |
| Xtream sign-in (right, wrong password, expired, unreachable) | Home; or the right message, details kept | ✓ (stand-in server) | |
| Large channel list (thousands) | Opens in a few seconds, scrolls smoothly | ✓ (6,000) | |
| Live TV switching (list, Channel ▲▼ on full screen) | Picture in the preview and full screen; channel up/down | ✓ | ✓ (plays) |
| Movie playback | Plays; seek bar; −30/+30 | ✓ | ✓ (plays) |
| Episode playback | Plays; next episode at the end; episodes list (blue) | ✓ | |
| Seek bar | ◀ ▶ choose a point, OK jumps, Back cancels | ✓ | |
| Resume playback | Leaving saves; Resume continues there | ✓ | |
| Remote navigation | Every screen by arrows, OK, Back | ✓ (keyboard) | partly |
| Network failures | Message with Try again; live reconnects by itself | ✓ | |
| Unsupported streams | "This TV can't play this stream's format", no retry loop | ✓ (logic, tests) | |
| Memory over a long session | Settings › Application › Memory stays steady | ✓ (logic, tests) | |
| Audio and subtitle tracks, 4K, Home and back | Tracks listed and switch; 4K plays; resumes after Home | — (TV only) | |
| Password in the Tizen secure store | Settings › Application › Password storage | — (TV only) | |
