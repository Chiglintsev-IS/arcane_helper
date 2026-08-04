import { longRest } from "@/core/application/useCases/rest";
import { castSpell } from "@/core/application/useCases/casting";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { Spell } from "@/core/domain/catalog/spell";
import { exportSnapshot, type ExportFile } from "@/core/application/dataExchange";
import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";
import { toPersisted, type SessionRepository } from "@/core/application/ports/sessionRepository";
import { createSession, undoLast, type Clock } from "@/core/application/session";
import { createSessionStore } from "@/ui/entities/session/model/sessionStore";
import { withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));
const mageArmor = spells.get("mage-armor")!;
const NOW = "2026-07-31T18:00:00.000Z";

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
  return createSessionStore({
    repository,
    clock,
    createInitialCharacter: createThorne,
    loadBuiltInCatalog: loadThorneSpells,
  });
}

/** Файл с тем же составом карточек, но переписанным названием: возврат к встроенным заметен. */
function renamedCatalogFile(): ExportFile {
  const catalog = loadThorneSpells().map((spell) =>
    spell.id === "shield" ? { ...spell, nameRu: "Щит по-домашнему" } : spell,
  );
  return exportSnapshot(createThorne(), catalog, NOW);
}

/** Своя карточка, которой в сборке нет: после неё возврат к встроенным ломал бы книгу. */
const HOMEBREW: Spell = { ...mageArmor, id: "thorne-signature", nameRu: "Подпись Торна" };

function homebrewCatalogFile(): ExportFile {
  const character = {
    ...createThorne(),
    spellbookSpellIds: [...createThorne().spellbookSpellIds, HOMEBREW.id],
  };
  return exportSnapshot(character, [...loadThorneSpells(), HOMEBREW], NOW);
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
    const wounded = withDamage(createThorne(), 43);
    const repository = createMemoryRepository(
      toPersisted(createSession(wounded), NOW, null),
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
      ...toPersisted(createSession(createThorne()), NOW, null),
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

describe("каталог заклинаний (FR-123)", () => {
  it("до импорта играем встроенным каталогом", async () => {
    const store = makeStore();
    await store.getState().hydrate();

    expect(store.getState().spellCatalog).toHaveLength(29);
    expect(store.getState().spellCatalogSource).toBe("built_in");
  });

  it("встроенный каталог в хранилище не попадает", async () => {
    // Копия встроенных карточек заморозила бы книгу на дате установки.
    const repository = createMemoryRepository();
    const store = makeStore(repository);
    await store.getState().hydrate();

    expect((await repository.load())?.spellCatalog).toBeUndefined();
  });

  it("импорт подменяет каталог целиком", async () => {
    const store = makeStore();
    await store.getState().hydrate();

    expect(store.getState().importSnapshot(renamedCatalogFile())).toBeNull();
    expect(store.getState().spellCatalogSource).toBe("imported");
    expect(store.getState().spellCatalog.find((spell) => spell.id === "shield")?.nameRu).toBe(
      "Щит по-домашнему",
    );
  });

  it("импортированный каталог переживает перезапуск", async () => {
    const repository = createMemoryRepository();
    const first = makeStore(repository);
    await first.getState().hydrate();
    first.getState().importSnapshot(homebrewCatalogFile());

    const second = makeStore(repository);
    await second.getState().hydrate();

    expect(second.getState().spellCatalog).toHaveLength(30);
    expect(second.getState().spellCatalogSource).toBe("imported");
    expect(second.getState().session?.character.spellbookSpellIds).toContain("thorne-signature");
  });

  it("импорт начинает журнал заново: отменять нечего", async () => {
    const store = makeStore();
    await store.getState().hydrate();
    store.getState().apply((session) =>
      castSpell(session, { spell: mageArmor, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock),
    );

    store.getState().importSnapshot(renamedCatalogFile());
    expect(store.getState().session?.journal).toHaveLength(0);
    expect(store.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
  });

  it("ссылка в пустоту не проходит и не оставляет половины импорта (FR-122)", async () => {
    const repository = createMemoryRepository();
    const store = makeStore(repository);
    await store.getState().hydrate();

    // Файл, до которого разбор бы не допустил: карточки своего заклинания в нём нет.
    const broken = homebrewCatalogFile();
    const reason = store.getState().importSnapshot({ ...broken, spells: loadThorneSpells() });

    expect(reason).toMatch(/thorne-signature/);
    expect(store.getState().error).toBe(reason);
    expect(store.getState().spellCatalogSource).toBe("built_in");
    expect(store.getState().session?.character.spellbookSpellIds).not.toContain("thorne-signature");
    expect((await repository.load())?.spellCatalog).toBeUndefined();
  });

  it("возврат к встроенному каталогу восстанавливает карточки сборки", async () => {
    const repository = createMemoryRepository();
    const store = makeStore(repository);
    await store.getState().hydrate();
    store.getState().importSnapshot(renamedCatalogFile());

    expect(store.getState().restoreBuiltInCatalog()).toBeNull();
    expect(store.getState().spellCatalogSource).toBe("built_in");
    expect(store.getState().spellCatalog.find((spell) => spell.id === "shield")?.nameRu).toBe("Щит");
    expect((await repository.load())?.spellCatalog).toBeUndefined();
  });

  it("возврат, который оставил бы подготовленное без карточки, отклоняется", async () => {
    const store = makeStore();
    await store.getState().hydrate();
    store.getState().importSnapshot(homebrewCatalogFile());

    const reason = store.getState().restoreBuiltInCatalog();
    expect(reason).toMatch(/thorne-signature/);
    // Каталог остался прежним: молча выбросить карточку из книги приложение не вправе.
    expect(store.getState().spellCatalog).toHaveLength(30);
    expect(store.getState().spellCatalogSource).toBe("imported");
  });

  it("после того как своя карточка убрана из книги, возврат проходит", async () => {
    const store = makeStore();
    await store.getState().hydrate();
    store.getState().importSnapshot(homebrewCatalogFile());

    store.getState().apply((session) => ({
      ...session,
      character: {
        ...session.character,
        spellbookSpellIds: session.character.spellbookSpellIds.filter(
          (id) => id !== "thorne-signature",
        ),
      },
    }));

    expect(store.getState().restoreBuiltInCatalog()).toBeNull();
    expect(store.getState().spellCatalog).toHaveLength(29);
  });

  it("обе операции до загрузки отклоняются, а не пишут поверх непрочитанного", () => {
    const store = makeStore();
    expect(store.getState().importSnapshot(renamedCatalogFile())).toBe(
      "Состояние ещё не загружено",
    );
    expect(store.getState().restoreBuiltInCatalog()).toBe("Состояние ещё не загружено");
  });

  it("сохранение, сделанное до FR-123, открывается со встроенным каталогом (NFR-003)", async () => {
    const wounded = withDamage(createThorne(), 43);
    const store = makeStore(createMemoryRepository(toPersisted(createSession(wounded), NOW, null)));
    await store.getState().hydrate();

    expect(store.getState().session?.character.hitPoints.current).toBe(17);
    expect(store.getState().spellCatalog).toHaveLength(29);
    expect(store.getState().spellCatalogSource).toBe("built_in");
  });

  it("обычное действие не теряет загруженный каталог", async () => {
    const repository = createMemoryRepository();
    const store = makeStore(repository);
    await store.getState().hydrate();
    store.getState().importSnapshot(renamedCatalogFile());

    store.getState().apply((session) => longRest(session, clock));

    expect(store.getState().spellCatalogSource).toBe("imported");
    expect((await repository.load())?.spellCatalog).toHaveLength(29);
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

  it("возвращает и встроенный каталог: начать заново значит начать со сборки", async () => {
    const repository = createMemoryRepository();
    const store = makeStore(repository);
    await store.getState().hydrate();
    store.getState().importSnapshot(homebrewCatalogFile());

    await store.getState().reset();

    expect(store.getState().spellCatalog).toHaveLength(29);
    expect(store.getState().spellCatalogSource).toBe("built_in");
    expect((await repository.load())?.spellCatalog).toBeUndefined();
  });
});
