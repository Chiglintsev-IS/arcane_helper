/**
 * Собранное ядро целиком: договор, провод, хендлер, контроллер и хранилище вместе.
 *
 * Прогон говорит с ядром так же, как отображение, — командами через клиент договора. Поэтому он
 * заодно доказывает, что сообщения сериализуемы: локальный провод гоняет их через JSON.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/contract/client";
import type { ArcaneApi } from "@/contract/port";
import type { Snapshot } from "@/contract/snapshot";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";
import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";
import type { Spell } from "@/core/domain/catalog/spell";
import { exportSnapshot } from "@/core/application/dataExchange";
import type { Clock } from "@/core/application/ports/clock";
import { toPersisted, type SessionRepository } from "@/core/application/ports/sessionRepository";
import { createSession } from "@/core/application/session";
import { createLocalTransport } from "@/core/presentation/localTransport";

import { createCore } from "./composition";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));
const mageArmor = spells.get("mage-armor")!;
const NOW = "2026-07-31T18:00:00.000Z";
const BUILT_IN_COUNT = loadThorneSpells().length;
/**
 * Сколько строк показывает приложение: заговоры и записи книги.
 *
 * Пул встроенного контента шире книги — из него запись в книгу добавляют, — поэтому строк меньше,
 * чем карточек, и число берётся у персонажа, а не у каталога.
 */
const KNOWN_COUNT = createThorne().cantripIds.length + createThorne().spellbookSpellIds.length;

function testClock(): Clock {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 6, 31, 18, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
  };
}

let clock: Clock;
let attempt: number;

beforeEach(() => {
  clock = testClock();
  attempt = 0;
});

function connect(repository: SessionRepository = createMemoryRepository()) {
  const core = createCore({
    repository,
    clock,
    createInitialCharacter: createThorne,
    loadBuiltInCatalog: loadThorneSpells,
  });
  const api: ArcaneApi = createClient(createLocalTransport(core));
  return { api };
}

/** Что ядро рассказало о себе: единственное чтение, и прогон пользуется тем же. */
async function shown(api: ArcaneApi): Promise<Snapshot> {
  return api.open();
}

/** Остаток ячеек уровня: их спрашивают чаще всего остального. */
function slotsLeft(snapshot: Snapshot, level: number): number {
  return snapshot.resources.slots.find((slot) => slot.level === level)?.remaining ?? 0;
}

/** Каждая попытка своя: одинаковый идентификатор ядро сочло бы повтором и не применило бы. */
function envelope(command: Parameters<ArcaneApi["execute"]>[0]["command"]) {
  attempt += 1;
  return { commandId: `command-${attempt}`, command };
}

function castMageArmor(slotLevel: number) {
  return envelope({
    kind: "cast_spell" as const,
    spellId: mageArmor.id,
    mode: "normal",
    payment: { kind: "slot" as const, slotLevel },
  });
}

/** Файл с тем же составом карточек, но переписанным названием: возврат к встроенным заметен. */
function renamedCatalogFile(): string {
  const catalog = loadThorneSpells().map((spell) =>
    spell.id === "shield" ? { ...spell, nameRu: "Щит по-домашнему" } : spell,
  );
  return JSON.stringify(exportSnapshot(createThorne(), catalog, NOW));
}

/** Своя карточка, которой в сборке нет: после неё возврат к встроенным ломал бы книгу. */
const HOMEBREW: Spell = { ...mageArmor, id: "thorne-signature", nameRu: "Подпись Торна" };

function homebrewCatalogFile(): string {
  const character = {
    ...createThorne(),
    spellbookSpellIds: [...createThorne().spellbookSpellIds, HOMEBREW.id],
  };
  return JSON.stringify(exportSnapshot(character, [...loadThorneSpells(), HOMEBREW], NOW));
}

describe("открытие сессии", () => {
  it("на пустом хранилище начинает с чистого персонажа и сразу сохраняет", async () => {
    const repository = createMemoryRepository();
    const { api } = connect(repository);

    await api.open();

    expect((await shown(api)).sheet.name).toBe("Торн");
    // Немедленная запись: закрытие приложения сразу после старта не теряет состояние.
    expect(await repository.load()).not.toBeNull();
  });

  it("читает сохранённое состояние вместо создания нового", async () => {
    const wounded = withDamage(createThorne(), 43);
    const { api } = connect(
      createMemoryRepository(toPersisted(createSession(wounded), NOW, null)),
    );

    await api.open();

    expect((await shown(api)).sheet.hitPoints.current).toBe(17);
  });

  it("повторное открытие ничего не пересоздаёт", async () => {
    const { api } = connect();
    await api.open();
    await api.execute(castMageArmor(1));

    await api.open();

    expect(slotsLeft(await shown(api), 1)).toBe(3);
  });

  it("на повреждённом хранилище отказывает и не затирает данные", async () => {
    const repository = createMemoryRepository({ schemaVersion: 1, savedAt: "", character: {} });
    const { api } = connect(repository);

    await expect(api.open()).rejects.toThrow(/повреждено/);
    // Второе открытие отказывает так же: повреждённое осталось на месте и ждёт ручной выгрузки.
    await expect(api.open()).rejects.toThrow(/повреждено/);
  });

  it("на сохранении новее версии сообщает про обновление приложения", async () => {
    const { api } = connect(
      createMemoryRepository({
        ...toPersisted(createSession(createThorne()), NOW, null),
        schemaVersion: 99,
      }),
    );

    await expect(api.open()).rejects.toThrow(/обновите приложение/);
  });

  it("состояние переживает перезапуск приложения", async () => {
    const repository = createMemoryRepository();
    const first = connect(repository);
    await first.api.open();
    await first.api.execute(castMageArmor(2));

    // Новое ядро на том же хранилище — как повторное открытие приложения.
    const second = connect(repository);
    const snapshot = await second.api.open();

    expect(slotsLeft(snapshot, 2)).toBe(2);
    expect(snapshot.log).toHaveLength(1);
  });
});

describe("применение команд", () => {
  it("применяет команду и сохраняет результат", async () => {
    const repository = createMemoryRepository();
    const { api } = connect(repository);
    await api.open();

    const result = await api.execute(castMageArmor(1));

    expect(result.ok).toBe(true);
    expect(slotsLeft(await shown(api), 1)).toBe(3);
    expect((await repository.load())?.character.spellSlots[1]?.remaining).toBe(3);
  });

  it("версия снимка растёт с каждой применённой командой", async () => {
    const { api } = connect();
    const opened = await api.open();
    const first = await api.execute(castMageArmor(1));
    const second = await api.execute(envelope({ kind: "long_rest" }));

    expect(opened.version).toBe(0);
    expect(first.ok && first.snapshot.version).toBe(1);
    expect(second.ok && second.snapshot.version).toBe(2);
  });

  it("любая команда работает без правок сборки", async () => {
    const { api } = connect();
    await api.open();

    await api.execute(castMageArmor(1));
    await api.execute(envelope({ kind: "long_rest" }));
    await api.execute(envelope({ kind: "undo_last" }));

    expect(slotsLeft(await shown(api), 1)).toBe(3);
  });

  it("отказ по правилам возвращается причиной, состояние не меняет", async () => {
    const { api } = connect();
    await api.open();
    const before = await shown(api);

    const result = await api.execute(
      envelope({
        kind: "cast_spell",
        spellId: mageArmor.id,
        mode: "normal",
        payment: { kind: "none" },
      }),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reasonRu).toMatch(/требует способа оплаты/);
    expect(await shown(api)).toEqual(before);
  });

  it("заклинание, которого нет в каталоге, отклоняется с причиной", async () => {
    const { api } = connect();
    await api.open();

    const result = await api.execute(
      envelope({
        kind: "cast_spell",
        spellId: "нет-такого",
        mode: "normal",
        payment: { kind: "slot", slotLevel: 1 },
      }),
    );

    expect(!result.ok && result.reasonRu).toMatch(/карточки «нет-такого» в каталоге нет/);
  });

  it("слово не из списка правил отклоняется с причиной", async () => {
    const { api } = connect();
    await api.open();

    const result = await api.execute(
      envelope({
        kind: "cast_spell",
        spellId: mageArmor.id,
        mode: "как-нибудь",
        payment: { kind: "slot", slotLevel: 1 },
      }),
    );

    expect(!result.ok && result.reasonRu).toMatch(/способ сотворения/);
  });

  it("сбой записи не проглатывается", async () => {
    const repository: SessionRepository = {
      load: async () => null,
      loadRaw: async () => null,
      save: async () => {
        throw new Error("нет места");
      },
      clear: async () => undefined,
    };
    const { api } = connect(repository);

    await expect(api.open()).rejects.toThrow(/Не удалось сохранить состояние: нет места/);
  });

  it("сбой записи не-ошибкой тоже называется словами", async () => {
    const repository: SessionRepository = {
      load: async () => null,
      loadRaw: async () => null,
      save: async () => {
        throw "хранилище недоступно";
      },
      clear: async () => undefined,
    };
    const { api } = connect(repository);

    await expect(api.open()).rejects.toThrow(/хранилище недоступно/);
  });
});

describe("узнавание повтора", () => {
  it("одна попытка, доставленная дважды, применяется один раз", async () => {
    const { api } = connect();
    await api.open();
    const attemptEnvelope = castMageArmor(1);

    await api.execute(attemptEnvelope);
    await api.execute(attemptEnvelope);

    expect(slotsLeft(await shown(api), 1)).toBe(3);
    expect((await shown(api)).log).toHaveLength(1);
  });

  it("повтор отвечает нынешним снимком, а не отказом", async () => {
    const { api } = connect();
    await api.open();
    const attemptEnvelope = castMageArmor(1);

    const first = await api.execute(attemptEnvelope);
    const repeat = await api.execute(attemptEnvelope);

    expect(first.ok && repeat.ok).toBe(true);
    if (!first.ok || !repeat.ok) return;
    expect(repeat.snapshot.version).toBe(first.snapshot.version);
  });

  it("разные попытки одной и той же команды применяются каждая", async () => {
    const { api } = connect();
    await api.open();

    await api.execute(castMageArmor(1));
    await api.execute(castMageArmor(1));

    expect(slotsLeft(await shown(api), 1)).toBe(2);
  });
});

describe("каталог заклинаний (FR-123)", () => {
  it("до импорта играем встроенным каталогом", async () => {
    const { api } = connect();
    await api.open();

    expect((await shown(api)).spells).toHaveLength(KNOWN_COUNT);
    expect((await shown(api)).catalogSource).toBe("built_in");
  });

  it("встроенный каталог в хранилище не попадает", async () => {
    // Копия встроенных карточек заморозила бы книгу на дате установки.
    const repository = createMemoryRepository();
    const { api } = connect(repository);
    await api.open();

    expect((await repository.load())?.spellCatalog).toBeUndefined();
  });

  it("импорт подменяет каталог целиком", async () => {
    const { api } = connect();
    await api.open();

    const result = await api.execute(
      envelope({ kind: "import_snapshot", raw: renamedCatalogFile() }),
    );

    expect(result.ok).toBe(true);
    expect((await shown(api)).catalogSource).toBe("imported");
    expect((await shown(api)).spells.find((row) => row.id === "shield")?.nameRu).toBe(
      "Щит по-домашнему",
    );
  });

  it("импортированный каталог переживает перезапуск", async () => {
    const repository = createMemoryRepository();
    const first = connect(repository);
    await first.api.open();
    await first.api.execute(envelope({ kind: "import_snapshot", raw: homebrewCatalogFile() }));

    const second = connect(repository);
    await second.api.open();

    expect((await shown(second.api)).spells).toHaveLength(KNOWN_COUNT + 1);
    expect((await shown(second.api)).catalogSource).toBe("imported");
    expect((await shown(second.api)).spells.map((row) => row.id)).toContain("thorne-signature");
  });

  it("импорт начинает лог заново: отменять нечего", async () => {
    const { api } = connect();
    await api.open();
    await api.execute(castMageArmor(1));

    await api.execute(envelope({ kind: "import_snapshot", raw: renamedCatalogFile() }));

    expect((await shown(api)).log).toHaveLength(0);
    expect(slotsLeft(await shown(api), 1)).toBe(4);
  });

  it("файл без персонажа отклоняется с причиной", async () => {
    const { api } = connect();
    await api.open();

    const result = await api.execute(envelope({ kind: "import_snapshot", raw: JSON.stringify({ spells: [] }) }));

    expect(!result.ok && result.reasonRu).toMatch(/character/);
  });

  it("ссылка в пустоту не проходит и не оставляет половины импорта", async () => {
    const repository = createMemoryRepository();
    const { api } = connect(repository);
    await api.open();

    // Файл, до которого разбор бы не допустил: карточки своего заклинания в нём нет.
    const broken = { ...JSON.parse(homebrewCatalogFile()), spells: loadThorneSpells() };
    const result = await api.execute(
      envelope({ kind: "import_snapshot", raw: JSON.stringify(broken) }),
    );

    expect(!result.ok && result.reasonRu).toMatch(/thorne-signature/);
    expect((await shown(api)).catalogSource).toBe("built_in");
    expect((await shown(api)).spells.map((row) => row.id)).not.toContain("thorne-signature");
    expect((await repository.load())?.spellCatalog).toBeUndefined();
  });

  it("возврат к встроенному каталогу восстанавливает карточки сборки", async () => {
    const repository = createMemoryRepository();
    const { api } = connect(repository);
    await api.open();
    await api.execute(envelope({ kind: "import_snapshot", raw: renamedCatalogFile() }));

    const result = await api.execute(envelope({ kind: "restore_built_in_catalog" }));

    expect(result.ok).toBe(true);
    expect((await shown(api)).catalogSource).toBe("built_in");
    expect((await shown(api)).spells.find((row) => row.id === "shield")?.nameRu).toBe("Щит");
    expect((await repository.load())?.spellCatalog).toBeUndefined();
  });

  it("возврат, который оставил бы подготовленное без карточки, отклоняется", async () => {
    const { api } = connect();
    await api.open();
    await api.execute(envelope({ kind: "import_snapshot", raw: homebrewCatalogFile() }));

    const result = await api.execute(envelope({ kind: "restore_built_in_catalog" }));

    expect(!result.ok && result.reasonRu).toMatch(/thorne-signature/);
    // Каталог остался прежним: молча выбросить карточку из книги приложение не вправе.
    expect((await shown(api)).spells).toHaveLength(KNOWN_COUNT + 1);
    expect((await shown(api)).catalogSource).toBe("imported");
  });

  it("книга сохранения следует каталогу сборки: убранная карточка снимается, а не запирает игру", async () => {
    const thorne = createThorne();
    const stale = {
      ...thorne,
      spellbookSpellIds: [...thorne.spellbookSpellIds, "disguise-self"],
      preparedSpellIds: [...thorne.preparedSpellIds, "disguise-self"],
    };
    const { api } = connect(createMemoryRepository(toPersisted(createSession(stale), NOW, null)));

    await api.open();
    const result = await api.execute(envelope({ kind: "start_combat" }));

    expect(result.ok).toBe(true);
    expect((await shown(api)).spells).toHaveLength(KNOWN_COUNT);
  });

  it("сохранение, сделанное до своего каталога, открывается со встроенным", async () => {
    const wounded = withDamage(createThorne(), 43);
    const { api } = connect(
      createMemoryRepository(toPersisted(createSession(wounded), NOW, null)),
    );

    await api.open();

    expect((await shown(api)).sheet.hitPoints.current).toBe(17);
    expect((await shown(api)).spells).toHaveLength(KNOWN_COUNT);
    expect((await shown(api)).catalogSource).toBe("built_in");
  });

  it("обычное действие не теряет загруженный каталог", async () => {
    const repository = createMemoryRepository();
    const { api } = connect(repository);
    await api.open();
    await api.execute(envelope({ kind: "import_snapshot", raw: renamedCatalogFile() }));

    await api.execute(envelope({ kind: "long_rest" }));

    expect((await shown(api)).catalogSource).toBe("imported");
    expect((await repository.load())?.spellCatalog).toHaveLength(BUILT_IN_COUNT);
  });
});

describe("сброс", () => {
  it("забывает сделанное и начинает заново", async () => {
    const repository = createMemoryRepository();
    const { api } = connect(repository);
    await api.open();
    await api.execute(castMageArmor(1));

    await api.execute(envelope({ kind: "reset" }));

    expect(slotsLeft(await shown(api), 1)).toBe(4);
    expect((await shown(api)).log).toHaveLength(0);
    expect((await repository.load())?.character.spellSlots[1]?.remaining).toBe(4);
  });

  it("возвращает и встроенный каталог: начать заново значит начать со сборки", async () => {
    const repository = createMemoryRepository();
    const { api } = connect(repository);
    await api.open();
    await api.execute(envelope({ kind: "import_snapshot", raw: homebrewCatalogFile() }));

    await api.execute(envelope({ kind: "reset" }));

    expect((await shown(api)).spells).toHaveLength(KNOWN_COUNT);
    expect((await shown(api)).catalogSource).toBe("built_in");
    expect((await repository.load())?.spellCatalog).toBeUndefined();
  });

  it("начать заново можно и поверх непрочитанного сохранения", async () => {
    // Так выглядит сохранение, которое разбор отвергает: снимок на месте, состояния в нём нет.
    const repository = createMemoryRepository({ schemaVersion: 1, savedAt: "", character: {} });
    const { api } = connect(repository);
    await expect(api.open()).rejects.toThrow(/повреждено/);

    const result = await api.execute(envelope({ kind: "reset" }));

    // Чистое состояние прежнего не читает, поэтому и не зависит от того, разобралось ли оно.
    expect(result.ok).toBe(true);
    expect((await shown(api)).sheet.name).toBe("Торн");
    expect((await repository.load())?.character.spellSlots[1]?.remaining).toBe(4);
  });
});

describe("до открытия сессии", () => {
  it("хранилища ядро не трогает, пока его не спросили", async () => {
    const repository = createMemoryRepository();
    connect(repository);

    // Сборка ядра сама по себе не читает и не пишет: сессия открывается первым обращением.
    expect(await repository.load()).toBeNull();
  });

  it("команда открывает сессию сама: намерение не теряется", async () => {
    const { api } = connect();

    await api.execute(envelope({ kind: "long_rest" }));

    expect((await shown(api)).log).toHaveLength(1);
  });
});
