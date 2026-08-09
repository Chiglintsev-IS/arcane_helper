/**
 * Провод по сети.
 *
 * Знает про `fetch` и не знает больше ни про что: ни про команды, ни про снимок, ни про ядро.
 * Поэтому в сборке, выбравшей этот провод, ядра нет вовсе.
 *
 * Неуспешный ответ становится исключением, а не отказом: отказ по правилам приезжает телом с
 * `ok: false`, а пятисотка и обрыв связи — это дефект и обрыв, и выдавать их игроку за причину
 * отказа значило бы врать ему словами правил.
 */

import type { Transport } from "./transport";

async function body(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Бэкенд ответил ${response.status}`);
  }
  return await response.json();
}

export function createHttpTransport(baseUrl: string): Transport {
  return {
    async read(): Promise<unknown> {
      return await body(await fetch(`${baseUrl}/session`));
    },

    async send(command: unknown): Promise<unknown> {
      return await body(
        await fetch(`${baseUrl}/command`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(command),
        }),
      );
    },
  };
}
