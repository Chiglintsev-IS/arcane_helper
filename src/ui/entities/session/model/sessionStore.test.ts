/**
 * Стор сессии как зеркало ядра.
 *
 * Правила игры проверяются там, где живут, — у ядра. Здесь проверяется ровно то, за что стор
 * отвечает: что снимок и показанное состояние приходят от ядра, что причина отказа доезжает до
 * экрана и что каждая отправка несёт свою попытку.
 */

import { describe, expect, it } from "vitest";

import type { Envelope } from "@/contract/commands";
import type { ArcaneApi } from "@/contract/port";
import type { Result } from "@/contract/result";
import type { Snapshot } from "@/contract/snapshot";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createSession, type LiveSession } from "@/core/application/session";

import { createSessionStore } from "./sessionStore";

const EMPTY: Snapshot = { version: 0, journal: [] };

function live(): LiveSession {
  return {
    session: createSession(createThorne()),
    spellCatalog: loadThorneSpells(),
    spellCatalogSource: "built_in",
  };
}

/** Ядро-заглушка: здесь проверяется стор, а не правила, и ответы задаёт сам прогон. */
function fakeApi(answers: Partial<ArcaneApi> = {}): {
  api: ArcaneApi;
  sent: Envelope[];
} {
  const sent: Envelope[] = [];
  return {
    sent,
    api: {
      open: answers.open ?? (async () => EMPTY),
      execute:
        answers.execute ??
        (async (envelope) => {
          sent.push(envelope);
          return { ok: true, snapshot: { version: sent.length, journal: [] } } satisfies Result;
        }),
    },
  };
}

function makeStore(
  api: ArcaneApi,
  readLive: () => LiveSession | null = () => live(),
  nextCommandId: () => string = (() => {
    let issued = 0;
    return () => `command-${++issued}`;
  })(),
) {
  return createSessionStore({ api, nextCommandId, readLive });
}

describe("открытие сессии", () => {
  it("до открытия состояния нет", () => {
    const { api } = fakeApi();

    expect(makeStore(api).getState()).toMatchObject({
      session: null,
      snapshot: null,
      status: "loading",
      error: null,
    });
  });

  it("после открытия показывает снимок и состояние от ядра", async () => {
    const { api } = fakeApi();
    const store = makeStore(api);

    await store.getState().hydrate();

    expect(store.getState().status).toBe("ready");
    expect(store.getState().snapshot).toEqual(EMPTY);
    expect(store.getState().session?.character.name).toBe("Торн");
    expect(store.getState().spellCatalogSource).toBe("built_in");
  });

  it("отказ ядра при открытии показывается, состояние остаётся пустым", async () => {
    const { api } = fakeApi({
      open: async () => {
        throw new Error("Сохранённое состояние повреждено");
      },
    });
    const store = makeStore(api);

    await store.getState().hydrate();

    expect(store.getState().status).toBe("error");
    expect(store.getState().error).toMatch(/повреждено/);
    expect(store.getState().session).toBeNull();
  });

  it("ядро без живой сессии зеркалить нечего: снимок всё равно приходит", async () => {
    const { api } = fakeApi();
    const store = makeStore(api, () => null);

    await store.getState().hydrate();

    expect(store.getState().snapshot).toEqual(EMPTY);
    expect(store.getState().session).toBeNull();
  });
});

describe("отправка намерений", () => {
  it("каждая отправка несёт свою попытку", async () => {
    const { api, sent } = fakeApi();
    const store = makeStore(api);
    await store.getState().hydrate();

    await store.getState().execute({ kind: "long_rest" });
    await store.getState().execute({ kind: "long_rest" });

    expect(sent.map((envelope) => envelope.commandId)).toEqual(["command-1", "command-2"]);
  });

  it("успех обновляет снимок и снимает прежнюю причину отказа", async () => {
    const { api } = fakeApi();
    const store = makeStore(api);
    await store.getState().hydrate();

    expect(await store.getState().execute({ kind: "long_rest" })).toBeNull();
    expect(store.getState().snapshot?.version).toBe(1);
    expect(store.getState().error).toBeNull();
  });

  it("отказ по правилам доезжает до экрана словами", async () => {
    const { api } = fakeApi({
      execute: async () => ({ ok: false, reasonRu: "Заклинание с ячейкой требует способа оплаты" }),
    });
    const store = makeStore(api);
    await store.getState().hydrate();

    const reason = await store.getState().execute({ kind: "long_rest" });

    expect(reason).toMatch(/требует способа оплаты/);
    expect(store.getState().error).toBe(reason);
  });

  it("оборванная доставка тоже называет причину, а не молчит", async () => {
    const { api } = fakeApi({
      execute: async () => {
        throw new Error("Бэкенд ответил 503");
      },
    });
    const store = makeStore(api);
    await store.getState().hydrate();

    expect(await store.getState().execute({ kind: "long_rest" })).toMatch(/503/);
  });

  it("не-Error тоже описывается", async () => {
    const { api } = fakeApi({
      execute: async () => {
        throw "строка вместо ошибки";
      },
    });
    const store = makeStore(api);

    expect(await store.getState().execute({ kind: "long_rest" })).toBe("строка вместо ошибки");
  });

  it("сообщение об ошибке снимается", async () => {
    const { api } = fakeApi({
      execute: async () => ({ ok: false, reasonRu: "нельзя" }),
    });
    const store = makeStore(api);
    await store.getState().execute({ kind: "long_rest" });

    store.getState().dismissError();

    expect(store.getState().error).toBeNull();
  });
});
