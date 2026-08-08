/**
 * Общий набор тестов для любой реализации порта хранилища.
 *
 * Взаимозаменяемость реализаций проверяется одинаковыми тестами, а не обещанием в комментарии:
 * если браузерная и оперативная версии разойдутся в поведении, упадёт одна и та же проверка.
 */

import { expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { Character } from "@/core/domain/assembly/character";
import {
  parsePersisted,
  StorageCorruptedError,
  StorageVersionError,
  toPersisted,
  type PersistedSession,
  type SessionRepository,
} from "@/core/application/ports/sessionRepository";
import { createSession } from "@/core/application/session";

const SAVED_AT = "2026-07-31T18:00:00.000Z";

/** Снимок на встроенном каталоге: карточки в записи не лежат. */
function snapshot() {
  return toPersisted(createSession(createThorne()), SAVED_AT, null);
}

/**
 * @param createRepository — фабрика чистого хранилища; каждый тест получает своё, иначе
 * тесты видят данные друг друга и проходят по случайности.
 */
export function describeRepositoryContract(
  createRepository: () => SessionRepository | Promise<SessionRepository>,
): void {
  it("пустое хранилище возвращает null, а не бросает", async () => {
    const repository = await createRepository();
    expect(await repository.load()).toBeNull();
  });

  it("сохранённое читается без изменений", async () => {
    const repository = await createRepository();
    const stored = snapshot();
    await repository.save(stored);
    expect(await repository.load()).toEqual(stored);
  });

  it("повторная запись заменяет прежнюю", async () => {
    const repository = await createRepository();
    const stored = snapshot();
    await repository.save(stored);

    const wounded = {
      ...stored,
      character: { ...stored.character, hitPoints: { ...stored.character.hitPoints, current: 12 } },
    };
    await repository.save(wounded);

    const loaded = await repository.load();
    expect(loaded?.character.hitPoints.current).toBe(12);
  });

  it("очистка убирает данные", async () => {
    const repository = await createRepository();
    await repository.save(snapshot());
    await repository.clear();
    expect(await repository.load()).toBeNull();
  });

  it("очистка пустого хранилища не ошибка", async () => {
    const repository = await createRepository();
    await expect(repository.clear()).resolves.toBeUndefined();
  });

  it("изменение объекта после записи не меняет сохранённое", async () => {
    const repository = await createRepository();
    // Свой изменяемый объект: тип состояния править на месте не даёт, а хранилище обязано держаться
    // и против того, кто пришёл из нетипизированного кода — браузерная база сериализует переданное.
    const hitPoints = { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 };
    const base = snapshot();
    await repository.save({ ...base, character: { ...base.character, hitPoints } });

    hitPoints.current = 1;

    const loaded = await repository.load();
    expect(loaded?.character.hitPoints.current).toBe(60);
  });

  it("журнал переживает запись и чтение", async () => {
    const repository = await createRepository();
    const stored = {
      ...snapshot(),
      journal: [
        {
          id: "id-1",
          at: SAVED_AT,
          kind: "spell_cast",
          summaryRu: "Доспехи мага — ячейкой 1 уровня",
          undoPatch: { inspiration: false },
          spellId: "mage-armor",
          slotLevel: 1,
          actionUsed: "action",
        },
      ],
    } satisfies PersistedSession;
    await repository.save(stored);
    expect((await repository.load())?.journal).toEqual(stored.journal);
  });

  it("каталог заклинаний переживает запись и чтение (FR-123)", async () => {
    const repository = await createRepository();
    const catalog = loadThorneSpells().map((spell) =>
      spell.id === "shield" ? { ...spell, nameRu: "Щит по-домашнему" } : spell,
    );
    await repository.save(toPersisted(createSession(createThorne()), SAVED_AT, catalog));

    const loaded = await repository.load();
    expect(loaded?.spellCatalog).toHaveLength(29);
    expect(loaded?.spellCatalog?.find((spell) => spell.id === "shield")?.nameRu).toBe(
      "Щит по-домашнему",
    );
  });

  it("запись без каталога читается: играем встроенным (NFR-003)", async () => {
    // Так выглядит сохранение, сделанное до. Обновление приложения не вправе его потерять.
    const repository = await createRepository();
    await repository.save(snapshot());
    const loaded = await repository.load();

    expect(loaded).not.toBeNull();
    expect(loaded?.spellCatalog).toBeUndefined();
  });

  it("сохранённый каталог без нужной карточки не загружается (FR-123)", async () => {
    // Ссылочная целостность после подмены каталога — инвариант хранилища, а не свойство файла.
    const repository = await createRepository();
    const withoutShield = loadThorneSpells().filter((spell) => spell.id !== "shield");
    await repository.save(toPersisted(createSession(createThorne()), SAVED_AT, withoutShield));

    await expect(repository.load()).rejects.toThrow(StorageCorruptedError);
    await expect(repository.load()).rejects.toThrow(/shield/);
  });
}

/** Проверки самого разбора, не зависящие от реализации. */
export function describeParsingContract(): void {
  it("порченое состояние отвергает целиком: молча начать с чистого листа — потерять игру", () => {
    // Так выглядело бы содержимое после неудачной миграции: снимок на месте, состояния в нём нет.
    expect(() => parsePersisted({ ...snapshot(), character: { id: "thorne" } })).toThrow(
      StorageCorruptedError,
    );
  });

  it("версию новее отклоняет отдельной ошибкой: старое приложение, новые данные", () => {
    expect(() => parsePersisted({ ...snapshot(), schemaVersion: 99 })).toThrow(StorageVersionError);
  });

  it("отклоняет null и не объект", () => {
    expect(() => parsePersisted(null)).toThrow(StorageCorruptedError);
    expect(() => parsePersisted("строка")).toThrow(StorageCorruptedError);
  });

  it("снимок отмены прежней формы приводится вместе с состоянием (FR-233)", () => {
    const base = snapshot();
    const stored = {
      ...base,
      journal: [
        {
          id: "old-entry",
          at: SAVED_AT,
          kind: "sheet_edited",
          summaryRu: "Добавлено: Зелье",
          undoPatch: {
            equipment: {
              ...base.character.equipment,
              items: [{ id: "potion", nameRu: "Зелье", kind: "potion", worn: true, count: 15000 }],
            },
          },
        },
      ],
    };

    const parsed = parsePersisted(stored);
    // Отмена старой записи обязана возвращать вещь новой формы: род переведён, вещь и запас
    // разведены по разным местам, счёт обрезан пределом. Расходник надетым не бывает, и его
    // запас переходит в сумку, а не в надетое, даже если старая запись утверждала обратное.
    expect(parsed.journal[0]?.undoPatch?.itemDefinitions?.[0]).toMatchObject({
      kind: "consumable",
    });
    expect(parsed.journal[0]?.undoPatch?.equipment?.bag?.[0]).toMatchObject({
      itemId: "potion",
      count: 9999,
    });

    // Запись, не являющаяся объектом со снимком, не приводится и не роняет разбор молча:
    // её отвергнет схема с указанием поля.
    expect(() => parsePersisted({ ...base, journal: ["не запись"] })).toThrow(StorageCorruptedError);
  });

  it("сообщает, какое поле не прошло проверку", () => {
    const broken = { ...snapshot(), savedAt: "" };
    expect(() => parsePersisted(broken)).toThrow(/savedAt/);
  });

  it("версию старее приводит, а не отвергает: обновление не теряет данных", () => {
    const legacy = snapshot();
    // Полей нынешней формы у версии 1 не было — из образца они убираются вместе с их владельцами.
    const { abilities, equipment, hitPoints, permanentContributions, ...character } =
      legacy.character;
    const before = parsePersisted({
      ...legacy,
      schemaVersion: 1,
      character: {
        ...character,
        intelligence: abilities.intelligence,
        spellSaveDc: 16,
        spellAttackModifier: 8,
        constitutionSaveModifier: 4,
        armorClass: { base: 10, dexterityModifier: 2, itemBonus: 2 },
        hitPoints: { current: hitPoints.current, maximum: hitPoints.maximumBase, maximumReduction: 0 },
      },
    });
    const totals = Character.of(before.character).sheet;
    // Числа версии 1 действуют прежними: перебивка стала постоянным назначением.
    expect(totals.value("spellSaveDc")).toBe(16);
    // Прибавка версии 1 не называла вещи — она читается постоянным вкладом персонажа: 10 + 2 + 2.
    expect(totals.value("armorClass")).toBe(14);
  });

  it("испорченное сохранение остаётся повреждением, сколько бы ни стояло в версии", () => {
    const broken = { ...snapshot(), schemaVersion: 0, character: { id: "thorne" } };
    expect(() => parsePersisted(broken)).toThrow(StorageCorruptedError);
  });
}
