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

    async readRaw(): Promise<unknown> {
      return await body(await fetch(`${baseUrl}/session/raw`));
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

    async ask(question: unknown): Promise<unknown> {
      return await body(
        await fetch(`${baseUrl}/question`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(question),
        }),
      );
    },
  };
}
