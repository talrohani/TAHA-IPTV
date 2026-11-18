/** Signing in and out: the account in use, its data source and its library. */
import { open } from './core/router';
import { setSource } from './app';
import { mockSource, demo } from './data/mock';
import { XtreamClient } from './data/xtream/client';
import { useLibrary, seedDemo } from './data/library';
import * as Accounts from './data/accounts';
import type { Account } from './data/types';

export function startDemo(): void {
  Accounts.useDemo();
  setSource(mockSource);
  useLibrary('demo');
  seedDemo({ movies: demo.movies, channels: demo.channels });
  open('home', undefined, { reset: true });
}

/** Checks the account with the server; on success it becomes the one in use (saved as asked). */
export function signIn(server: string, username: string, password: string, keep: boolean): Promise<Account> {
  const client = new XtreamClient(server, username, password);
  return client.login().then((acc) => Accounts.remember(server, username, password, keep).then((saved) => {
    setSource(client);
    useLibrary(saved.id);
    open('home', undefined, { reset: true });
    return acc;
  }));
}

/** Only checks (Test connection): nothing is saved or switched. */
export function test(server: string, username: string, password: string): Promise<Account> {
  return new XtreamClient(server, username, password).login();
}

/** At start: the account in use, signed in again with its saved password; else the sign-in screen. */
export function resume(): void {
  const id = Accounts.activeId();
  if (id === 'demo') { startDemo(); return; }
  const acc = Accounts.active(), pw = acc ? Accounts.password(acc.id) : null;
  if (!acc || !pw) { open('login', acc ? { prefill: acc } : undefined, { reset: true }); return; }
  open('splash', { text: acc.server.replace(/^https?:\/\//, '') }, { reset: true });
  const client = new XtreamClient(acc.server, acc.username, pw);
  client.login().then(() => {
    setSource(client);
    useLibrary(acc.id);
    open('home', undefined, { reset: true });
  }, (err) => open('login', { prefill: acc, error: err }, { reset: true }));
}

export function signOut(): void {
  Accounts.signOut();
  setSource(mockSource);
  open('login', undefined, { reset: true });
}
