/**
 * Помощники компонентных тестов: настоящее ядро на хранилище в памяти.
 *
 * Моков здесь нет намеренно. Компонент проверяется на том же ядре, что работает в приложении, и
 * через тот же провод — включая сериализацию сообщений. Иначе прогон подтверждает поведение мока, а
 * не приложения, и первым же несериализуемым полем расходится с сетью.
 */

import { render, type RenderResult, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";
import type { Clock } from "@/core/application/ports/clock";
import { createCore } from "@/core/composition";
import { connectStores, StoreProvider } from "@/ui/app/providers/stores";
import type { AppStores } from "@/ui/shared/model/storeContext";

// Автоматической очистки нет: тесты не пользуются глобалями vitest.
afterEach(cleanup);
afterEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});

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

/**
 * Идёт ли бой. Отметка ставится той же командой, что и кнопкой на экране: хранимого признака
 * «бой идёт» нет, и подделать его подстановкой в состояние нельзя.
 */
export type PlaySituation = { inFight?: boolean };

/** Готовые сторы с открытой сессией: компонент рендерится сразу с данными. */
export async function createTestStores(
  character: CharacterState = createThorne(),
  situation: PlaySituation = {},
): Promise<AppStores> {
  const clock = testClock();
  const stores = connectStores(
    createCore({
      repository: createMemoryRepository(),
      clock,
      createInitialCharacter: () => character,
      loadBuiltInCatalog: loadThorneSpells,
    }),
    clock,
  );
  await stores.session.getState().hydrate();
  if (situation.inFight === true) {
    await stores.session.getState().execute({ kind: "start_combat" });
  }
  return stores;
}

export type RenderWithStores = RenderResult & { stores: AppStores };

/** Рендер внутри провайдера сторов. */
export async function renderWithStores(
  ui: ReactElement,
  character?: CharacterState,
  situation: PlaySituation = {},
): Promise<RenderWithStores> {
  const stores = await createTestStores(character ?? createThorne(), situation);
  const result = render(<StoreProvider stores={stores}>{ui}</StoreProvider>);
  return { ...result, stores };
}
