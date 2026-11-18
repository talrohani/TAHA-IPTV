/**
 * The TV's side of playback: Samsung's webapis (AVPlay, the screensaver), loaded only on a Tizen TV, and the app
 * going to the background and back.
 */
import { AvplayEngine, avplay } from './avplay';
import type { Player } from './player';

interface AppCommon {
  setScreenSaver(state: number): void;
  AppCommonScreenSaverState: { SCREEN_SAVER_ON: number; SCREEN_SAVER_OFF: number };
}

function isTizen(): boolean { return !!(window as unknown as { tizen?: unknown }).tizen; }

/**
 * On a Tizen TV: loads `$WEBAPIS/webapis/webapis.js` (the runtime resolves that address inside the package), then
 * calls done. Elsewhere, or if it can't load in 3 s, done straight away (the HTML5 engine stays).
 */
export function loadWebapis(done: () => void): void {
  const w = window as unknown as { webapis?: unknown };
  if (!isTizen() || w.webapis) { done(); return; }
  let over = false;
  const finish = () => { if (!over) { over = true; done(); } };
  const s = document.createElement('script');
  s.src = '$WEBAPIS/webapis/webapis.js';
  s.onload = finish;
  s.onerror = finish;
  document.head.appendChild(s);
  setTimeout(finish, 3000);
}

/** AVPlay where the TV has it. */
export function pickEngine(player: Player): void {
  const av = avplay();
  if (av) player.setEngine(new AvplayEngine(av));
}

/** The TV's screensaver: off while something plays, back on after. */
export function screensaver(on: boolean): void {
  try {
    const ac = (window as unknown as { webapis?: { appcommon?: AppCommon } }).webapis!.appcommon!;
    ac.setScreenSaver(on ? ac.AppCommonScreenSaverState.SCREEN_SAVER_ON : ac.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
  } catch { /* not a TV */ }
}

/** Home, another app or the TV's menu takes the screen: the stream is put aside, and taken up again after. */
export function followVisibility(player: Player): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) player.suspend(); else player.restore();
  });
}
