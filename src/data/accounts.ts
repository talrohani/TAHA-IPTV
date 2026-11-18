/**
 * Saved Xtream accounts (server and username; the password only when "Remember" is on, in the secure store) and
 * which one is in use. The demo account is a separate, built-in choice.
 */
import { load, save, remove } from '../core/store';
import { savePassword, readPassword, forgetPassword } from './secure';

export interface SavedAccount { id: string; server: string; username: string; remember: boolean }

export function accounts(): SavedAccount[] { return load<SavedAccount[]>('accounts', []).filter((a) => a && a.id && a.server); }

export function activeId(): string | null { return load<string | null>('active', null); }

export function active(): SavedAccount | null {
  const id = activeId();
  return accounts().find((a) => a.id === id) || null;
}

export function isDemo(): boolean { return activeId() === 'demo'; }

export function useDemo(): void { save('active', 'demo'); }

/** Adds or updates (same server and username) and makes it the active one. */
export function remember(server: string, username: string, password: string, keep: boolean): Promise<SavedAccount> {
  const list = accounts();
  let acc = list.find((a) => a.server === server && a.username === username);
  if (!acc) {
    acc = { id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), server, username, remember: keep };
    list.unshift(acc);
  }
  acc.remember = keep;
  save('accounts', list.slice(0, 8));
  save('active', acc.id);
  const saved = acc;
  if (!keep) { forgetPassword(acc.id); return Promise.resolve(saved); }
  return savePassword(acc.id, password).then(() => saved);
}

export function password(id: string): string | null { return readPassword(id); }

export function removeAccount(id: string): void {
  forgetPassword(id);
  save('accounts', accounts().filter((a) => a.id !== id));
  if (activeId() === id) remove('active');
}

export function signOut(): void { remove('active'); }
