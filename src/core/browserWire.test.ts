/**
 * Ядро в браузере, собранное целиком.
 *
 * Правила проверены сборкой ядра, хранилище — своим набором; здесь проверяется одно: собранное
 * отвечает по проводу. IndexedDB подменяется fake-indexeddb — браузера у прогона нет.
 */

import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { createBrowserWire } from "./browserWire";

describe("ядро в браузере", () => {
  it("отвечает снимком по проводу в процессе", async () => {
    expect(await createBrowserWire().read()).toMatchObject({ version: 0 });
  });
});
