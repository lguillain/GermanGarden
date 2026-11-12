// Browser storage is optional: private windows and blocked site data throw on access.
type StorageKind = 'local' | 'session';
const area = (kind: StorageKind) => (kind === 'local' ? localStorage : sessionStorage);

export function storageGet(kind: StorageKind, key: string): string | null {
  try {
    return area(kind).getItem(key);
  } catch {
    return null;
  }
}
// Each write reports success so callers can warn when progress is not retained.
export function storageSet(kind: StorageKind, key: string, value: unknown): boolean {
  try {
    area(kind).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function storageRemove(kind: StorageKind, key: string): boolean {
  try {
    area(kind).removeItem(key);
    return true;
  } catch {
    return false;
  }
}
