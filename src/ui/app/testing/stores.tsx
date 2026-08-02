/**
 * Помощники компонентных тестов: настоящие сторы на хранилище в памяти.
 *
 * Моков здесь нет намеренно. Компонент проверяется на тех же операциях состояния, что работают в
 * приложении, иначе тест подтверждает поведение мока, а не приложения.
 */

import { render, type RenderResult, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { createCastDraftStore } from "@/ui/features/cast-spell/model/castDraftStore";
import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";
import type { Clock } from "@/core/application/session";
import { createSessionStore } from "@/ui/entities/session/model/sessionStore";
import { StoreProvider, type AppStores } from "@/ui/app/providers/stores";

// Автоматической очистки нет: тесты не пользуются глобалями vitest.
afterEach(cleanup);

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));

/** Карточка по идентификатору: тесты называют заклинания, а не индексы. */
export function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

export const testSpells = loadThorneSpells();

/** Детерминированные часы: снимки и записи журнала не должны зависеть от времени прогона. */
export function testClock(): Clock {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 6, 31, 18, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
  };
}

/** Готовые сторы с загруженным состоянием: компонент рендерится сразу с данными. */
export async function createTestStores(
  character: CharacterState = createThorne(),
): Promise<AppStores> {
  const clock = testClock();
  const session = createSessionStore({
    repository: createMemoryRepository(),
    clock,
    createInitialCharacter: () => character,
    loadBuiltInCatalog: loadThorneSpells,
  });
  await session.getState().hydrate();
  return { session, draft: createCastDraftStore(), clock };
}

export type RenderWithStores = RenderResult & { stores: AppStores };

/** Рендер внутри провайдера сторов. */
export async function renderWithStores(
  ui: ReactElement,
  character?: CharacterState,
): Promise<RenderWithStores> {
  const stores = character === undefined ? await createTestStores() : await createTestStores(character);
  const result = render(<StoreProvider stores={stores}>{ui}</StoreProvider>);
  return { ...result, stores };
}
