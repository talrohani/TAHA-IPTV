/**
 * Settings: Playback, Appearance, Account, Application. OK on a choice opens its options; on a switch, flips it;
 * on an action, asks first when it erases something.
 */
import { h, sidebar, hints, toast, confirm } from '../ui/components';
import { iconEl, IconName } from '../ui/icons';
import { t, TextKey, applyDirection } from '../core/i18n';
import { open, openDialog, closeDialog } from '../core/router';
import { focus } from '../core/focus';
import { getSettings, setSetting, Settings } from '../core/store';
import { app } from '../app';
import { signOut } from '../session';
import { storeKind } from '../data/secure';
import { failText } from '../core/i18n';
import { resetFavorites, resetHistory } from '../data/library';
import type { Screen } from '../core/router';

type Section = 'playback' | 'appearance' | 'account' | 'application';

interface Row { ic: IconName; label: TextKey; value?: () => string; toggle?: () => boolean; act?: () => void; danger?: boolean; info?: boolean }

export function settings(params?: Record<string, unknown>): Screen {
  let section: Section = (params && (params.section as Section)) || 'playback';
  const el = h('div', { cls: 'settings fixed' });
  const main = h('div', { cls: 'main' });
  el.appendChild(sidebar('settings', { brand: true }));
  el.appendChild(main);
  el.appendChild(hints([{ keyIcon: 'chevronUD', label: t('navigate') }, { key: 'OK', label: t('chooseTrack') }, { icon: 'back', label: t('back') }]));
  main.appendChild(h('div', { cls: 'set-title' }, [iconEl('settings'), h('span', { text: t('settings') })]));

  const SECTIONS: Array<[Section, TextKey, IconName]> = [['playback', 'playback', 'play'], ['appearance', 'appearance', 'palette'],
    ['account', 'account', 'user'], ['application', 'application', 'cpu']];
  const secBox = h('div', { cls: 'set-sections', group: 'sections' });
  const rowsBox = h('div', { cls: 'set-rows', group: 'rows', attrs: { 'data-scroll': 'y', 'data-pad': '100' } });
  main.appendChild(secBox);
  main.appendChild(rowsBox);

  const label = (k: TextKey) => t(k);

  function choose<K extends keyof Settings>(key: K, title: TextKey, options: Array<[Settings[K], TextKey | string]>): void {
    const box = h('div', { cls: 'sheet' }, [h('h3', { text: t(title) })]);
    let first: HTMLElement | undefined;
    for (const [v, lk] of options) {
      const on = getSettings()[key] === v;
      const text = t(lk as TextKey);   // a text key, or a label as it is (MPEG-TS, 110%)
      const o = h('div', { cls: 'opt' + (on ? ' on' : ''), focus: true, onOk: () => {
        setSetting(key, v);
        closeDialog();
        applyLook();
        if (key === 'lang') { applyDirection(); open('settings', { section }, { replace: true }); return; }
        draw();
      } }, [h('span', { text }), on ? h('span', { cls: 'end', text: '✓' }) : null]);
      box.appendChild(o);
      if (!first || on) first = o;
    }
    openDialog(box, { first });
  }

  function rows(): Row[] {
    const s = getSettings(), acc = app.source.account();
    if (section === 'playback') return [
      { ic: 'film', label: 'format', value: () => s.format === 'ts' ? 'MPEG-TS' : s.format === 'm3u8' ? 'HLS' : t('auto'), act: () => choose('format', 'format', [['auto', 'auto'], ['ts', 'MPEG-TS'], ['m3u8', 'HLS']]) },
      { ic: 'cpu', label: 'buffer', value: () => t(s.buffer), act: () => choose('buffer', 'buffer', [['auto', 'auto'], ['low', 'low'], ['high', 'high']]) },
      { ic: 'history', label: 'autoResume', toggle: () => s.autoResume, act: () => setSetting('autoResume', !s.autoResume) },
      { ic: 'headphones', label: 'audioLang', value: () => s.audioLang === 'auto' ? t('auto') : s.audioLang === 'ar' ? t('trackAr') : t('trackEn'),
        act: () => choose('audioLang', 'audioLang', [['auto', 'auto'], ['ar', 'trackAr'], ['en', 'trackEn']]) },
      { ic: 'cc', label: 'subtitlePref', value: () => s.subtitles === 'off' ? t('off') : s.subtitles === 'ar' ? t('trackAr') : t('trackEn'),
        act: () => choose('subtitles', 'subtitlePref', [['off', 'off'], ['ar', 'trackAr'], ['en', 'trackEn']]) },
      { ic: 'textSize', label: 'subtitleSize', value: () => t(s.subtitleSize), act: () => choose('subtitleSize', 'subtitleSize', [['small', 'small'], ['medium', 'medium'], ['large', 'large']]) },
    ];
    if (section === 'appearance') return [
      { ic: 'globe', label: 'language', value: () => s.lang === 'ar' ? t('arabic') : t('english'), act: () => choose('lang', 'language', [['ar', 'arabic'], ['en', 'english']]) },
      { ic: 'palette', label: 'theme', value: () => t(s.theme), act: () => choose('theme', 'theme', [['navy', 'navy'], ['midnight', 'midnight'], ['violet', 'violet']]) },
      { ic: 'textSize', label: 'fontScale', value: () => s.fontScale + '%', act: () => choose('fontScale', 'fontScale', [[100, '100%'], [110, '110%'], [120, '120%']]) },
      { ic: 'image', label: 'posterSize', value: () => t(s.posterSize), act: () => choose('posterSize', 'posterSize', [['small', 'small'], ['medium', 'medium'], ['large', 'large']]) },
      { ic: 'sparkles', label: 'animations', value: () => t(s.animations), act: () => choose('animations', 'animations', [['on', 'on'], ['reduced', 'reduced'], ['off', 'off']]) },
    ];
    if (section === 'account') return [
      { ic: 'user', label: 'account', info: true, value: () => acc.demo ? t('demoAccount') : acc.username + ' @ ' + acc.server.replace(/^https?:\/\//, '') },
      { ic: 'crown', label: 'subscription', info: true, value: () => acc.status === 'Active' ? t('active') : acc.status },
      { ic: 'clock', label: 'expires', info: true, value: () => acc.expires ? new Date(acc.expires).toISOString().slice(0, 10) : '—' },
      { ic: 'users', label: 'maxConnections', info: true, value: () => acc.maxConnections ? String(acc.maxConnections) : '—' },
      { ic: 'wifi', label: 'connection', value: () => navigator.onLine === false ? t('offline') : t('testConnection'), act: () => {
        const c = app.source as unknown as { login?: () => Promise<unknown> };
        if (!c.login) { toast(t('connected')); return; }
        toast(t('testing'));
        c.login().then(() => toast(t('connected') + ' ✓'), (err) => toast(failText(err)));
      } },
      { ic: 'logout', label: 'changeAccount', act: () => signOut() },
    ];
    return [
      { ic: 'refresh', label: 'clearCache', act: () => confirm(t('clearCache'), '', t('done'), () => {
        const c = app.source as unknown as { clearCache?: () => void };
        if (c.clearCache) c.clearCache();
        toast(t('clearCache') + ' ✓');
      }) },
      { ic: 'star', label: 'resetFavorites', danger: true, act: () => confirm(t('resetFavorites'), t('confirmAgain'), t('done'), () => { resetFavorites(); toast(t('resetFavorites') + ' ✓'); }) },
      { ic: 'history', label: 'resetHistory', danger: true, act: () => confirm(t('resetHistory'), t('confirmAgain'), t('done'), () => { resetHistory(); toast(t('resetHistory') + ' ✓'); }) },
      { ic: 'cpu', label: 'engine', info: true, value: () => app.player.engineName },
      { ic: 'tv', label: 'resolution', info: true, value: () => screen.width + ' × ' + screen.height },
      { ic: 'wifi', label: 'network', info: true, value: () => navigator.onLine === false ? t('offline') : t('online') },
      { ic: 'cpu', label: 'memory', info: true, value: () => {
        const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        return m ? Math.round(m.usedJSHeapSize / 1048576) + ' MB' : '—';
      } },
      { ic: 'info', label: 'platform', info: true, value: () => (/Tizen\s[\d.]+/.exec(navigator.userAgent) || ['Browser'])[0] },
      { ic: 'key', label: 'storeKind', info: true, value: () => storeKind() === 'keymanager' ? t('keymanager') : t('appStore') },
      { ic: 'info', label: 'version', info: true, value: () => '0.2.0 (phase 2)' },
    ];
  }

  function draw(): void {
    secBox.innerHTML = '';
    for (const [id, lk, ic] of SECTIONS) {
      const b = h('div', { cls: 'set-section' + (id === section ? ' on' : ''), focus: true, onOk: () => { section = id; draw(); focus(rowsBox.querySelector('[data-f]') as HTMLElement); } },
        [iconEl(ic), h('span', { text: label(lk) })]);
      secBox.appendChild(b);
    }
    rowsBox.innerHTML = '';
    rowsBox.scrollTop = 0;
    for (const r of rows()) {
      const row = h('div', { cls: 'set-row glass' + (r.info ? ' info' : '') + (r.danger ? ' danger' : ''), focus: true,
        onOk: () => { if (r.act) { r.act(); if (r.toggle) draw(); } } }, [iconEl(r.ic), h('span', { text: label(r.label) })]);
      if (r.toggle) row.appendChild(h('span', { cls: 'toggle' + (r.toggle() ? ' on' : '') }));
      else if (r.value) row.appendChild(h('span', { cls: 'val', text: r.value() }));
      if (r.act && !r.toggle && !r.info) {
        const v = row.querySelector('.val') || row.appendChild(h('span', { cls: 'val' }));
        v.appendChild(iconEl(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR'));
      }
      rowsBox.appendChild(row);
    }
  }

  draw();
  return { el, first: () => secBox.querySelector('.on') as HTMLElement };
}

/** Theme, animations, font size and poster size on the page (also at start). */
export function applyLook(): void {
  const s = getSettings(), c = document.body.classList;
  c.remove('theme-midnight', 'theme-violet', 'anim-reduced', 'anim-off', 'size-small', 'size-large');
  if (s.theme !== 'navy') c.add('theme-' + s.theme);
  if (s.animations !== 'on') c.add('anim-' + s.animations);
  if (s.posterSize !== 'medium') c.add('size-' + s.posterSize);
  document.documentElement.style.setProperty('--scale', String(s.fontScale / 100));
}
