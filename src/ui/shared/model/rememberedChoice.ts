/** Приватный режим Safari бросает на самом обращении к хранилищу, а на сервере его нет вовсе. */
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readRemembered<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = stored(key);
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

export function writeRemembered(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}
