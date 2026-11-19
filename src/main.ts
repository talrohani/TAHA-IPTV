/**
 * Taha IPTV: start-up. The 1920 x 1080 stage is scaled to the screen; keys go, in order, to a text field being
 * typed in, the focused component (a list, the seek bar), the screen, then the focus engine; Back walks the stack.
 */
import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/lite.css';
import { registerTizenKeys, keyOf } from './core/keys';
import { applyDirection } from './core/i18n';
import { init, register, back, screenKey, onScreenGone } from './core/router';
import { sweepImages } from './core/dom';
import { move, componentKey, activate } from './core/focus';
import { onSettings, getSettings } from './core/store';
import { loadWebapis, pickEngine, screensaver, followVisibility } from './playback/tizen';
import { createMatte } from './playback/matte';
import { perfInit } from './perf';
import { app } from './app';
import { resume } from './session';
import { home } from './screens/home';
import { live } from './screens/live';
import { library } from './screens/library';
import { details } from './screens/details';
import { player } from './screens/player';
import { login, splash } from './screens/login';
import { settings, applyLook } from './screens/settings';
import { search } from './screens/search';
import { collection } from './screens/collection';

const stage = document.getElementById('stage')!;

// Lite drawing on the TV (styles/lite.css: no animated focus, no soft shadows); a browser can try it with ?lite.
if ((window as unknown as { tizen?: unknown }).tizen || /[?&]lite\b/.test(location.search)) {
  document.documentElement.classList.add('lite');
}

function fit(): void {
  const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = 'scale(' + k + ')';
  stage.style.left = Math.round((window.innerWidth - 1920 * k) / 2) + 'px';
  stage.style.top = Math.round((window.innerHeight - 1080 * k) / 2) + 'px';
}
window.addEventListener('resize', fit);
fit();

applyDirection();
applyLook();
onSettings(() => applyLook());
registerTizenKeys();

init(stage);
onScreenGone(sweepImages);

// Memory: expired lists and guides go every 5 minutes, and when the app goes to the background.
const trim = () => { const s = app.source as unknown as { trimMemory?: () => void }; if (s.trimMemory) s.trimMemory(); };
setInterval(trim, 5 * 60000);
document.addEventListener('visibilitychange', () => { if (document.hidden) trim(); });
register('home', home);
register('live', live);
register('library', library);
register('details', details);
register('player', player);
register('login', login);
register('splash', splash);
register('settings', settings);
register('search', search);
register('favorites', () => collection({ which: 'favorites' }));
register('history', () => collection({ which: 'history' }));

document.addEventListener('keydown', (e) => {
  const key = keyOf(e);
  // Typing: the field keeps its keys; Done/OK, Back and ↑ ↓ leave it.
  const a = document.activeElement as HTMLElement | null;
  if (a && a.tagName === 'INPUT') {
    if (key === 'ok' || key === 'back' || key === 'up' || key === 'down') {
      a.blur();
      e.preventDefault();
      if (key === 'up' || key === 'down') move(key);
    }
    return;
  }
  if (!key) return;
  e.preventDefault();
  const repeat = e.repeat;
  if (componentKey(key, repeat)) return;
  if (screenKey(key, repeat)) return;
  if (key === 'left' || key === 'right' || key === 'up' || key === 'down') { move(key); return; }
  if (key === 'ok') { activate(); return; }
  if (key === 'back') back();
});

// The video plane sits under the screens. On the TV, AVPlay draws behind the whole page: the page turns transparent
// and the matte paints the background everywhere but the picture. Then the session starts (the saved account).
loadWebapis(() => {
  pickEngine(app.player);
  const videoHost = document.createElement('div');
  videoHost.className = 'video-host';
  stage.insertBefore(videoHost, stage.firstChild);
  app.player.attach(videoHost);
  app.player.use({ matte: createMatte(videoHost), screensaver, buffer: () => getSettings().buffer });
  if (app.player.engineName !== 'HTML5') document.documentElement.classList.add('plane-under');
  followVisibility(app.player);
  resume();
  if (__PERF__) perfInit();
});
