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
import type { Preview } from "@/contract/questions";
import type { Result } from "@/contract/result";
import type { Snapshot } from "@/contract/snapshot";

import { testSnapshot } from "@/ui/app/testing/stores";

import { createSessionStore } from "./sessionStore";

/** Снимок только что начатой сессии: проекции строит настоящий презентер, а не подделка рядом. */
const FRESH: Snapshot = testSnapshot();

/** Ядро-заглушка: здесь проверяется стор, а не правила, и ответы задаёт сам прогон. */
function fakeApi(answers: Partial<ArcaneApi> = {}): {
  api: ArcaneApi;
  sent: Envelope[];
} {
  const sent: Envelope[] = [];
  return {
    sent,
    api: {
      open: answers.open ?? (async () => FRESH),
      execute:
        answers.execute ??
        (async (envelope) => {
          sent.push(envelope);
          return { ok: true, snapshot: { ...FRESH, version: sent.length } } satisfies Result;
        }),
      ask:
        answers.ask ??
        (async () => ({ kind: "health_preview", effectiveMaximum: 60 }) satisfies Preview),
    },
  };
}

function makeStore(
  api: ArcaneApi,
  nextCommandId: () => string = (() => {
    let issued = 0;
    return () => `command-${++issued}`;
  })(),
) {
  return createSessionStore({ api, nextCommandId });
}

describe("открытие сессии", () => {
  it("до открытия состояния нет", () => {
    const { api } = fakeApi();

    expect(makeStore(api).getState()).toMatchObject({
      snapshot: null,
      status: "loading",
      error: null,
    });
  });

  it("после открытия показывает снимок ядра", async () => {
    const { api } = fakeApi();
    const store = makeStore(api);

    await store.getState().hydrate();

    expect(store.getState().status).toBe("ready");
    expect(store.getState().snapshot).toEqual(FRESH);
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
    expect(store.getState().snapshot).toBeNull();
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

  it("ответ, отставший от показанного, экран назад не тянет", async () => {
    // Две команды в полёте возвращаются в любом порядке: по сети это обычное дело.
    let answered = 0;
    const { api } = fakeApi({
      execute: async () => ({
        ok: true,
        snapshot: { ...FRESH, version: ++answered === 1 ? 3 : 2 },
      }),
    });
    const store = makeStore(api);
    await store.getState().hydrate();

    await store.getState().execute({ kind: "long_rest" });
    expect(await store.getState().execute({ kind: "long_rest" })).toBeNull();

    expect(store.getState().snapshot?.version).toBe(3);
  });

  it("первый же ответ показывается: показанного ещё нет", async () => {
    const { api } = fakeApi();
    const store = makeStore(api);

    await store.getState().execute({ kind: "long_rest" });

    expect(store.getState().snapshot?.version).toBe(1);
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

describe("вопрос про ненабранное", () => {
  it("ответ доезжает как есть: состояние им не двигают", async () => {
    const { api } = fakeApi();
    const store = makeStore(api);

    expect(await store.getState().ask({ kind: "level_preview", level: 8 })).toMatchObject({
      kind: "health_preview",
    });
    expect(store.getState().snapshot).toBeNull();
  });

  it("недоступный ответчик молчит, а не выдаёт причину отказа: игрок ещё печатает", async () => {
    const { api } = fakeApi({
      ask: async () => {
        throw new Error("Бэкенд ответил 503");
      },
    });
    const store = makeStore(api);

    expect(await store.getState().ask({ kind: "level_preview", level: 8 })).toBeNull();
    expect(store.getState().error).toBeNull();
  });
});
