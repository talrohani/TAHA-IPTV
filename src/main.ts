/**
 * Taha IPTV: start-up. The 1920 x 1080 stage is scaled to the screen; keys go, in order, to a text field being
 * typed in, the focused component (a list, the seek bar), the screen, then the focus engine; Back walks the stack.
 */
import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import { registerTizenKeys, keyOf } from './core/keys';
import { applyDirection } from './core/i18n';
import { init, register, open, back, screenKey } from './core/router';
import { move, componentKey, activate } from './core/focus';
import { load, onSettings } from './core/store';
import { app } from './app';
import { demo } from './data/mock';
import { seedDemo } from './data/library';
import { home } from './screens/home';
import { live } from './screens/live';
import { library } from './screens/library';
import { details } from './screens/details';
import { player } from './screens/player';
import { login } from './screens/login';
import { settings, applyLook } from './screens/settings';
import { search } from './screens/search';
import { collection } from './screens/collection';

const stage = document.getElementById('stage')!;

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

// The video plane sits under the screens (on the TV, AVPlay draws behind the page).
const videoHost = document.createElement('div');
videoHost.className = 'video-host';
stage.appendChild(videoHost);
app.player.attach(videoHost);

init(stage);
register('home', home);
register('live', live);
register('library', library);
register('details', details);
register('player', player);
register('login', login);
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

if (app.source.account().demo) seedDemo({ movies: demo.movies, channels: demo.channels });
open(load('account', null) ? 'home' : 'login');
