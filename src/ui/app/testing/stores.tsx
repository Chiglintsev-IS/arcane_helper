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

import type { Snapshot } from "@/contract/snapshot";
import type { SpellRowView } from "@/contract/views";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";
import type { Clock } from "@/core/application/ports/clock";
import type { Command } from "@/contract/commands";
import { createSession, type LiveSession } from "@/core/application/session";
import { applyCommand } from "@/core/presentation/controller";
import { toSnapshot } from "@/core/presentation/presenter";
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
 * Обстановка прогона: идёт ли бой и какими карточками играют.
 *
 * Отметка боя ставится той же командой, что и кнопкой на экране: хранимого признака «бой идёт» нет,
 * и подделать его подстановкой в состояние нельзя. Каталог подменяется целиком — так проверяется
 * то, чего в книге Торна нет: у всех его карточек по одному варианту отыгрыша на категорию.
 */
export type PlaySituation = { inFight?: boolean; catalog?: readonly Spell[] };

/**
 * Снимок настоящего ядра без сторов и без ожидания.
 *
 * Нужен там, где проверяется не экран, а то, что он показывает: проекции строит тот же презентер,
 * что и в приложении, поэтому прогон не может разойтись с ним, оставшись зелёным.
 *
 * Обстановка набирается командами, а не подстановкой чисел: израсходованное действие и начатый бой
 * — следствия сыгранного, и словарь признаков рядом с ними разошёлся бы с правилами молча.
 */
export function testSnapshot(
  character: CharacterState = createThorne(),
  commands: readonly Command[] = [],
): Snapshot {
  const clock = testClock();
  const builtInCatalog = loadThorneSpells();
  let live: LiveSession = {
    session: createSession(character),
    spellCatalog: builtInCatalog,
    spellCatalogSource: "built_in",
  };

  commands.forEach((command, index) => {
    live = applyCommand(live, command, { ...clock, commandId: `command-${index}` }, {
      builtInCatalog,
      createInitialCharacter: () => character,
    });
  });

  return toSnapshot(live, commands.length);
}

/** Начатый бой: та же команда, что и кнопкой на экране. */
export const IN_FIGHT: readonly Command[] = [{ kind: "start_combat" }];

/** Строки списка заклинаний из настоящего снимка: их спрашивают чаще всего остального. */
export function testSpellRows(
  character: CharacterState = createThorne(),
  commands: readonly Command[] = [],
): SpellRowView[] {
  return testSnapshot(character, commands).spells;
}

/** Строка одного заклинания: прогон называет заклинания, а не места в списке. */
export function testSpellRow(
  id: string,
  character: CharacterState = createThorne(),
  commands: readonly Command[] = [],
): SpellRowView {
  const found = testSpellRows(character, commands).find((row) => row.id === id);
  if (found === undefined) throw new Error(`нет строки ${id}`);
  return found;
}

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
      loadBuiltInCatalog: () => [...(situation.catalog ?? loadThorneSpells())],
    }),
    clock,
  );
  await stores.session.getState().hydrate();
  if (situation.inFight === true) {
    await stores.session.getState().execute({ kind: "start_combat" });
  }
  return stores;
}

/**
 * Что стор показывает сейчас: тот же снимок, по которому рисует экран.
 *
 * Прогон смотрит туда же, куда игрок: состояния у отображения нет, и «проверить по персонажу»
 * означало бы проверять не то, что он увидит.
 */
export function shown(stores: AppStores): Snapshot {
  const { snapshot } = stores.session.getState();
  if (snapshot === null) throw new Error("сессия ещё не открыта");
  return snapshot;
}

/** Остаток ячеек уровня: их спрашивают чаще всего остального. */
export function slotsLeft(stores: AppStores, level: number): number {
  return shown(stores).resources.slots.find((slot) => slot.level === level)?.remaining ?? 0;
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
