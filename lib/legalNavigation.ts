const legalReturnStorageKey = "punktlandung-legal-return-v1";
const legalReturnTtlMs = 60 * 60 * 1000;

type LegalReturn = {
  path: string;
  savedAt: number;
};

function isSafeAppPath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export function rememberLegalReturn(path: string): void {
  if (typeof window === "undefined" || !isSafeAppPath(path)) return;
  try {
    const value: LegalReturn = { path, savedAt: Date.now() };
    window.sessionStorage.setItem(legalReturnStorageKey, JSON.stringify(value));
  } catch {
    // Navigation must still work when browser storage is unavailable.
  }
}

export function readLegalReturn(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(legalReturnStorageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LegalReturn>;
    if (!isSafeAppPath(value.path) || !value.savedAt || Date.now() - value.savedAt > legalReturnTtlMs) {
      window.sessionStorage.removeItem(legalReturnStorageKey);
      return null;
    }
    return value.path;
  } catch {
    window.sessionStorage.removeItem(legalReturnStorageKey);
    return null;
  }
}

export function consumeLegalReturn(path: string): boolean {
  const returnPath = readLegalReturn();
  if (returnPath !== path) return false;
  try {
    window.sessionStorage.removeItem(legalReturnStorageKey);
  } catch {
    // The matching marker has done its job even if it cannot be removed.
  }
  return true;
}
