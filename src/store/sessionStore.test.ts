import { beforeEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import { loadThorneSpells } from "@/data/content/thorne";
import { createMemoryRepository } from "./memoryRepository";
import { toPersisted, type SessionRepository } from "./repository";
import { castSpell, createSession, longRest, undoLast, type Clock } from "./session";
import { createSessionStore } from "./sessionStore";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));
const mageArmor = spells.get("mage-armor")!;

function testClock(): Clock {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 6, 31, 18, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
  };
}

let clock: Clock;

beforeEach(() => {
  clock = testClock();
});

function makeStore(repository: SessionRepository = createMemoryRepository()) {
  return createSessionStore({ repository, clock, createInitialCharacter: createThorne });
}

describe("загрузка состояния", () => {
  it("до загрузки состояния нет", () => {
    const store = makeStore();
    expect(store.getState()).toMatchObject({ session: null, status: "loading", error: null });
  });

  it("на пустом хранилище начинает с чистого персонажа и сразу сохраняет", async () => {
    const repository = createMemoryRepository();
    const store = makeStore(repository);
    await store.getState().hydrate();

    expect(store.getState().status).toBe("ready");
    expect(store.getState().session?.character.name).toBe("Торн");
    // Немедленная запись: закрытие приложения сразу после старта не теряет состояние.
    expect(await repository.load()).not.toBeNull();
  });

  it("читает сохранённое состояние вместо создания нового", async () => {
    const wounded = createThorne();
    wounded.hitPoints.current = 17;
    const repository = createMemoryRepository(
      toPersisted(createSession(wounded), "2026-07-31T18:00:00.000Z"),
    );

    const store = makeStore(repository);
    await store.getState().hydrate();
    expect(store.getState().session?.character.hitPoints.current).toBe(17);
  });

  it("на повреждённом хранилище сообщает и не затирает данные", async () => {
    const repository = createMemoryRepository({ schemaVersion: 1, savedAt: "", character: {} });
    const store = makeStore(repository);
    await store.getState().hydrate();

    expect(store.getState().status).toBe("error");
    expect(store.getState().error).toMatch(/повреждено/);
    expect(store.getState().session).toBeNull();
  });

  it("на сохранении новее версии сообщает про обновление приложения", async () => {
    const repository = createMemoryRepository({
      ...toPersisted(createSession(createThorne()), "2026-07-31T18:00:00.000Z"),
      schemaVersion: 99,
    });
    const store = makeStore(repository);
    await store.getState().hydrate();
    expect(store.getState().error).toMatch(/обновите приложение/);
  });

  it("восстановление состояния после перезапуска", async () => {
    const repository = createMemoryRepository();
    const first = makeStore(repository);
    await first.getState().hydrate();
    first.getState().apply((session) =>
      castSpell(session, { spell: mageArmor, mode: "normal", payment: { kind: "slot", slotLevel: 2 } }, clock),
    );

    // Новый стор на том же хранилище — как повторное открытие приложения.
    const second = makeStore(repository);
    await second.getState().hydrate();
    expect(second.getState().session?.character.spellSlots[2]?.remaining).toBe(2);
    expect(second.getState().session?.journal).toHaveLength(1);
  });
});

describe("применение операций", () => {
  it("применяет операцию и сохраняет результат", async () => {
    const repository = createMemoryRepository();
    const store = makeStore(repository);
    await store.getState().hydrate();

    const error = store.getState().apply((session) =>
      castSpell(session, { spell: mageArmor, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock),
    );

    expect(error).toBeNull();
    expect(store.getState().session?.character.spellSlots[1]?.remaining).toBe(3);
    expect((await repository.load())?.character.spellSlots[1]?.remaining).toBe(3);
  });

  it("любая операция работает без правок стора", async () => {
    const store = makeStore();
    await store.getState().hydrate();
    store.getState().apply((session) =>
      castSpell(session, { spell: mageArmor, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock),
    );
    store.getState().apply((session) => longRest(session, clock));
    store.getState().apply((session) => undoLast(session));

    expect(store.getState().error).toBeNull();
    expect(store.getState().session?.character.spellSlots[1]?.remaining).toBe(3);
  });

  it("ошибку операции показывает, состояние не меняет", async () => {
    const store = makeStore();
    await store.getState().hydrate();
    const before = structuredClone(store.getState().session?.character);

    const error = store.getState().apply((session) =>
      castSpell(session, { spell: mageArmor, mode: "normal", payment: { kind: "none" } }, clock),
    );

    expect(error).toMatch(/требует способа оплаты/);
    expect(store.getState().error).toBe(error);
    expect(store.getState().session?.character).toEqual(before);
  });

  it("сообщение об ошибке снимается", async () => {
    const store = makeStore();
    await store.getState().hydrate();
    store.getState().apply(() => {
      throw new Error("сбой");
    });
    expect(store.getState().error).toBe("сбой");
    store.getState().dismissError();
    expect(store.getState().error).toBeNull();
  });

  it("операция до загрузки отклоняется внятно", () => {
    const store = makeStore();
    expect(store.getState().apply((session) => session)).toBe("Состояние ещё не загружено");
  });

  it("успешная операция снимает прежнюю ошибку", async () => {
    const store = makeStore();
    await store.getState().hydrate();
    store.getState().apply(() => {
      throw new Error("сбой");
    });
    store.getState().apply((session) => longRest(session, clock));
    expect(store.getState().error).toBeNull();
  });

  it("не-Error исключение тоже описывается", async () => {
    const store = makeStore();
    await store.getState().hydrate();
    expect(
      store.getState().apply(() => {
        throw "строка вместо ошибки";
      }),
    ).toBe("строка вместо ошибки");
  });
});

describe("сбой записи", () => {
  it("сообщается пользователю, а не проглатывается", async () => {
    const repository: SessionRepository = {
      load: async () => null,
      save: async () => {
        throw new Error("нет места");
      },
      clear: async () => undefined,
    };
    const store = makeStore(repository);
    await store.getState().hydrate();
    // Запись идёт вне ожидания hydrate — даём микрозадачам отработать.
    await vi.waitFor(() => {
      expect(store.getState().error).toMatch(/Не удалось сохранить состояние: нет места/);
    });
  });
});

describe("сброс", () => {
  it("забывает сохранённое и начинает заново", async () => {
    const repository = createMemoryRepository();
    const store = makeStore(repository);
    await store.getState().hydrate();
    store.getState().apply((session) =>
      castSpell(session, { spell: mageArmor, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock),
    );

    await store.getState().reset();

    expect(store.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
    expect(store.getState().session?.journal).toHaveLength(0);
    expect((await repository.load())?.character.spellSlots[1]?.remaining).toBe(4);
  });
});
