/**
 * Where a remembered password goes. On a Samsung TV, Tizen's Key Manager (tizen.keymanager) when the TV offers it:
 * the platform's store for secrets. Otherwise the app's own private storage (no other app can read it, but it isn't
 * encrypted: an encryption key kept next to it would protect nothing, so it doesn't pretend to). Never logged.
 */
import { load, save, remove } from '../core/store';

interface KeyManager {
  saveData(name: string, data: string, password: string | null, ok?: () => void, err?: (e: unknown) => void): void;
  getData(alias: unknown, password?: string | null): string;
  removeData(alias: unknown): void;
}

function keyManager(): KeyManager | null {
  try {
    const km = (window as unknown as { tizen?: { keymanager?: KeyManager } }).tizen?.keymanager;
    return km && typeof km.saveData === 'function' ? km : null;
  } catch {
    return null;
  }
}

const NAME = (id: string) => 'taha_pw_' + id.replace(/[^a-z0-9_]/gi, '');

/** 'keymanager' (Tizen's store) or 'app' (the app's private storage). */
export function storeKind(): 'keymanager' | 'app' { return keyManager() ? 'keymanager' : 'app'; }

export function savePassword(id: string, password: string): Promise<void> {
  const km = keyManager();
  if (!km) { save('pw.' + id, password); return Promise.resolve(); }
  return new Promise((resolve) => {
    try { km.removeData({ name: NAME(id) }); } catch { /* nothing saved yet */ }
    try {
      km.saveData(NAME(id), password, null, () => resolve(), () => { save('pw.' + id, password); resolve(); });
    } catch {
      save('pw.' + id, password);   // this firmware's Key Manager refused: the app's storage instead
      resolve();
    }
  });
}

export function readPassword(id: string): string | null {
  const km = keyManager();
  if (km) {
    try { return km.getData({ name: NAME(id) }, null); } catch { /* not there: maybe saved in the app's storage */ }
    try { return km.getData(NAME(id), null); } catch { /* older API shape */ }
  }
  return load<string | null>('pw.' + id, null);
}

export function forgetPassword(id: string): void {
  const km = keyManager();
  if (km) { try { km.removeData({ name: NAME(id) }); } catch { /* not there */ } }
  remove('pw.' + id);
}
