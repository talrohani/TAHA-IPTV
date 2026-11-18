/**
 * Xtream Codes sign-in: server, username, password, remember, test, connect; saved accounts to use, edit or remove.
 * The server is asked (player_api.php) before anything is saved. Errors say what went wrong, never with the
 * address or the password.
 */
import { h, button, brand, confirm } from '../ui/components';
import { iconEl } from '../ui/icons';
import { skyline } from '../ui/art';
import { t, failText } from '../core/i18n';
import { focus } from '../core/focus';
import * as Accounts from '../data/accounts';
import { signIn, test as testAccount, startDemo } from '../session';
import type { Screen } from '../core/router';

export function normalizeServer(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s;
  const m = /^(https?):\/\/([a-z0-9.-]+|\[[0-9a-f:.]+\])(:\d{1,5})?(\/[^?#]*)?$/i.exec(s.replace(/[?#].*$/, ''));
  if (!m || (m[3] && +m[3].slice(1) > 65535)) return null;
  return m[1].toLowerCase() + '://' + m[2].toLowerCase() + (m[3] || '') + (m[4] || '').replace(/\/(player_api|get)\.php$/i, '').replace(/\/+$/, '');
}

export function login(params?: Record<string, unknown>): Screen {
  const prefill = params && (params.prefill as Accounts.SavedAccount | undefined);
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
  let editing: Accounts.SavedAccount | null = null;
  let remember = true, busy = false;
  const check = h('div', { cls: 'check on', focus: true, onOk: () => { remember = !remember; check.classList.toggle('on', remember); } },
    [h('span', { cls: 'box' }, [iconEl('check')]), h('span', { text: t('remember') })]);
  const msg = h('div', { cls: 'msg' });

  function say(text: string, kind?: 'err' | 'ok'): void {
    msg.textContent = text;
    msg.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function edit(a: Accounts.SavedAccount): void {
    editing = a;
    server.input.value = a.server;
    user.input.value = a.username;
    pass.input.value = '';
    remember = a.remember;
    check.classList.toggle('on', remember);
    pass.input.placeholder = Accounts.password(a.id) ? t('passwordKeep') : '';
  }

  /** The three values, checked; null (with the reason shown) when something's missing or wrong. */
  function values(): { s: string; u: string; p: string } | null {
    const u = user.input.value.trim();
    let p = pass.input.value;
    if (!p && editing && editing.server === normalizeServer(server.input.value) && editing.username === u) p = Accounts.password(editing.id) || '';
    if (!server.input.value.trim() || !u || !p) { say(t('errMissing'), 'err'); return null; }
    const s = normalizeServer(server.input.value);
    if (!s) { say(t('errUrl'), 'err'); return null; }
    return { s, u, p };
  }

  function test(): void {
    const v = values();
    if (!v || busy) return;
    busy = true;
    say(t('testing'));
    testAccount(v.s, v.u, v.p).then((a) => {
      busy = false;
      say(t('testOk', { d: a.expires ? new Date(a.expires).toISOString().slice(0, 10) : '—' }), 'ok');
    }, (err) => { busy = false; say(failText(err), 'err'); });
  }

  function connect(): void {
    const v = values();
    if (!v || busy) return;
    busy = true;
    say(t('connecting'));
    signIn(v.s, v.u, v.p, remember).catch((err) => { busy = false; say(failText(err), 'err'); });
  }

  const card = h('div', { cls: 'card glass', group: 'form' }, [
    brand('top'), h('h1', { text: t('login') }), h('div', { cls: 'sub', text: t('loginSub') }),
    server.wrap, user.wrap, pass.wrap, check,
    h('div', { cls: 'actions' }, [button(t('connect'), 'wifi', connect, 'primary'), button(t('testConnection'), 'refresh', test),
      button(t('useDemo'), 'sparkles', () => startDemo())]),
    msg,
  ]);
  el.appendChild(card);

  const list = h('div', { cls: 'accounts', group: 'accounts' });
  function drawAccounts(): void {
    list.innerHTML = '';
    const saved = Accounts.accounts();
    if (!saved.length) return;
    list.appendChild(h('div', { cls: 'section-title' }, [iconEl('user'), h('span', { text: t('savedAccounts') })]));
    for (const a of saved) {
      list.appendChild(h('div', { cls: 'acc-row glass' }, [
        h('span', { cls: 'who', text: a.username + ' @ ' + a.server.replace(/^https?:\/\//, '') }),
        button(t('edit'), 'edit', () => { edit(a); focus(pass.wrap); }),
        button(t('removeAcc'), 'trash', () => confirm(t('removeConfirm'), a.username + ' @ ' + a.server.replace(/^https?:\/\//, ''), t('removeAcc'), () => {
          Accounts.removeAccount(a.id);
          if (editing && editing.id === a.id) editing = null;
          drawAccounts();
          focus(server.wrap);
        }), 'danger'),
      ]));
    }
  }
  drawAccounts();
  el.appendChild(list);

  if (prefill) edit(prefill);
  if (params && params.error) say(failText(params.error), 'err');

  return { el, first: () => (prefill ? pass.wrap : server.wrap) };
}

export function splash(params?: Record<string, unknown>): Screen {
  const el = h('div', { cls: 'login' });
  const bg = h('div', { cls: 'bg' });
  bg.style.backgroundImage = 'url("' + skyline() + '")';
  el.appendChild(bg);
  el.appendChild(h('div', { cls: 'card glass splash' }, [brand('top'), h('div', { cls: 'spin' }),
    h('div', { cls: 'sub', text: t('connectingTo', { s: String((params && params.text) || '') }) })]));
  return { el };
}
