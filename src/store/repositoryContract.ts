/**
 * Общий набор тестов для любой реализации порта хранилища.
 *
 * Взаимозаменяемость реализаций проверяется одинаковыми тестами, а не обещанием в комментарии:
 * если браузерная и оперативная версии разойдутся в поведении, упадёт одна и та же проверка.
 */

import { expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import {
  parsePersisted,
  StorageCorruptedError,
  StorageVersionError,
  toPersisted,
  type SessionRepository,
} from "./repository";
import { createSession } from "./session";

const SAVED_AT = "2026-07-31T18:00:00.000Z";

function snapshot() {
  return toPersisted(createSession(createThorne()), SAVED_AT);
}

/**
 * @param createRepository — фабрика чистого хранилища; каждый тест получает своё, иначе
 *   тесты видят данные друг друга и проходят по случайности.
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
    await repository.save(snapshot());

    const wounded = snapshot();
    wounded.character.hitPoints.current = 12;
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
    const stored = snapshot();
    await repository.save(stored);
    stored.character.hitPoints.current = 1;
    const loaded = await repository.load();
    expect(loaded?.character.hitPoints.current).toBe(60);
  });

  it("повреждённое содержимое не загружается и не затирается", async () => {
    const repository = await createRepository();
    await repository.save(snapshot());
    // Портим уже сохранённое так, как это сделала бы неудачная миграция.
    await repository.save({ ...snapshot(), character: { id: "thorne" } } as never);
    await expect(repository.load()).rejects.toThrow(StorageCorruptedError);
  });

  it("сохранение более новой версии отклоняется отдельной ошибкой", async () => {
    const repository = await createRepository();
    await repository.save({ ...snapshot(), schemaVersion: 99 } as never);
    await expect(repository.load()).rejects.toThrow(StorageVersionError);
  });

  it("журнал переживает запись и чтение", async () => {
    const repository = await createRepository();
    const stored = snapshot();
    stored.journal = [
      {
        id: "id-1",
        at: SAVED_AT,
        kind: "spell_cast",
        summaryRu: "Доспехи мага — ячейкой 1 уровня",
        undoPatch: { reactionAvailable: true },
        spellId: "mage-armor",
        slotLevel: 1,
        actionUsed: "action",
      },
    ];
    await repository.save(stored);
    expect((await repository.load())?.journal).toEqual(stored.journal);
  });
}

/** Проверки самого разбора, не зависящие от реализации. */
export function describeParsingContract(): void {
  it("отклоняет null и не объект", () => {
    expect(() => parsePersisted(null)).toThrow(StorageCorruptedError);
    expect(() => parsePersisted("строка")).toThrow(StorageCorruptedError);
  });

  it("сообщает, какое поле не прошло проверку", () => {
    const broken = { ...snapshot(), savedAt: "" };
    expect(() => parsePersisted(broken)).toThrow(/savedAt/);
  });

  it("версию старее считает поводом для миграции, а не ошибкой версии", () => {
    // Версии 0 ещё не существовало, но структура отличается — это повреждение, не «обновите приложение».
    expect(() => parsePersisted({ ...snapshot(), schemaVersion: 0 })).toThrow(StorageCorruptedError);
  });
}
