/**
 * Выбор интерфейса, переживающий перезапуск: режим экрана, показанная часть «Вещей».
 *
 * Это состояние интерфейса, а не правило игры: в сохранение персонажа оно не попадает, и значение,
 * которого нет среди допустимых, читается как отсутствующее.
 */

/**
 * Приватный режим Safari бросает на самом обращении к хранилищу, а на сервере его нет вовсе: ни один
 * выбор интерфейса не стоит того, чтобы приложение из-за него не открылось.
 */
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Читается только после гидратации: статическая сборка отдаёт разметку без хранилища, и значение,
 * прочитанное на первом рендере, разошлось бы с отданным сервером.
 */
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
