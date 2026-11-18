/**
 * Xtream Codes sign-in: server, username, password, remember, test, connect; saved accounts to edit or remove.
 * Phase 1: the form checks what it can (all three fields, an http(s) address) and connects to the demo data; the
 * real player_api.php login comes in phase 2. Passwords are never saved in phase 1 (server and username only).
 */
import { h, button, brand } from '../ui/components';
import { iconEl } from '../ui/icons';
import { skyline } from '../ui/art';
import { t } from '../core/i18n';
import { open } from '../core/router';
import { focus } from '../core/focus';
import { load, save } from '../core/store';
import { app } from '../app';
import type { Screen } from '../core/router';

interface Saved { server: string; username: string }

export function normalizeServer(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s;
  const m = /^(https?):\/\/([a-z0-9.-]+|\[[0-9a-f:.]+\])(:\d{1,5})?(\/[^?#]*)?$/i.exec(s.replace(/[?#].*$/, ''));
  if (!m || (m[3] && +m[3].slice(1) > 65535)) return null;
  return m[1].toLowerCase() + '://' + m[2].toLowerCase() + (m[3] || '') + (m[4] || '').replace(/\/(player_api|get)\.php$/i, '').replace(/\/+$/, '');
}

export function login(): Screen {
  const el = h('div', { cls: 'login' });
  const bg = h('div', { cls: 'bg' });
  bg.style.backgroundImage = 'url("' + skyline() + '")';
  el.appendChild(bg);

  function field(label: string, type: string, hint: string): { wrap: HTMLElement; input: HTMLInputElement } {
    const input = h('input', { attrs: { type, placeholder: hint, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off' } });
    const wrap = h('div', { cls: 'field', focus: true, onOk: () => input.focus() }, [h('label', { text: label }), input]);
    return { wrap, input };
  }
  const server = field(t('server'), 'url', 'http://example.com:8080');
  const user = field(t('username'), 'text', '');
  const pass = field(t('password'), 'password', '');
  let remember = true;
  const check = h('div', { cls: 'check on', focus: true, onOk: () => { remember = !remember; check.classList.toggle('on', remember); } },
    [h('span', { cls: 'box' }, [iconEl('check')]), h('span', { text: t('remember') })]);
  const msg = h('div', { cls: 'msg' });

  function say(text: string, kind?: 'err' | 'ok'): void {
    msg.textContent = text;
    msg.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function check3(): string | null {
    if (!server.input.value.trim() || !user.input.value.trim() || !pass.input.value) { say(t('errMissing'), 'err'); return null; }
    const s = normalizeServer(server.input.value);
    if (!s) { say(t('errUrl'), 'err'); return null; }
    return s;
  }

  function test(): void {
    if (!check3()) return;
    say(t('testing'));
    setTimeout(() => { const a = app.source.account(); say(t('testOk', { d: new Date(a.expires).toISOString().slice(0, 10) }), 'ok'); }, 700);
  }

  function connect(): void {
    const s = check3();
    if (!s) return;
    say(t('connecting'));
    if (remember) {
      const list = load<Saved[]>('accounts', []).filter((a) => !(a.server === s && a.username === user.input.value.trim()));
      list.unshift({ server: s, username: user.input.value.trim() });
      save('accounts', list.slice(0, 5));
    }
    save('account', { server: s, username: user.input.value.trim(), demo: true });
    setTimeout(() => open('home', undefined, { reset: true }), 500);
  }

  const connectBtn = button(t('connect'), 'wifi', connect, 'primary');
  const card = h('div', { cls: 'card glass', group: 'form' }, [
    brand('top'), h('h1', { text: t('login') }), h('div', { cls: 'sub', text: t('loginSub') }),
    server.wrap, user.wrap, pass.wrap, check,
    h('div', { cls: 'actions' }, [connectBtn, button(t('testConnection'), 'refresh', test), button(t('useDemo'), 'sparkles', () => {
      save('account', { server: 'demo', username: 'demo', demo: true });
      open('home', undefined, { reset: true });
    })]),
    msg,
  ]);
  el.appendChild(card);

  const accounts = h('div', { cls: 'accounts', group: 'accounts' });
  function drawAccounts(): void {
    accounts.innerHTML = '';
    const list = load<Saved[]>('accounts', []);
    if (!list.length) return;
    accounts.appendChild(h('div', { cls: 'section-title' }, [iconEl('user'), h('span', { text: t('savedAccounts') })]));
    for (const a of list) {
      accounts.appendChild(h('div', { cls: 'acc-row glass' }, [
        h('span', { cls: 'who', text: a.username + ' @ ' + a.server.replace(/^https?:\/\//, '') }),
        button(t('edit'), 'edit', () => { server.input.value = a.server; user.input.value = a.username; pass.input.value = ''; focus(pass.wrap); say(t('password') + '…'); }),
        button(t('removeAcc'), 'trash', () => { save('accounts', load<Saved[]>('accounts', []).filter((x) => x !== a && !(x.server === a.server && x.username === a.username))); drawAccounts(); focus(server.wrap); }, 'danger'),
      ]));
    }
  }
  drawAccounts();
  el.appendChild(accounts);

  return { el, first: () => server.wrap };
}
