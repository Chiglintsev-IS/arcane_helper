/**
 * «Последняя подсказка» строкой списка действий.
 *
 * Особенность предыстории, а не заклинание, — но спрашивают о ней там же, где спрашивают «что я
 * могу сделать»: значком в ряду ресурсов она отвечала только «сколько осталось» и не отвечала «что
 * это вообще такое». Строка называет её полным именем, пересказывает повод и открывается в чтение.
 *
 * Ход она не занимает: её тратят вслед за проваленной проверкой, а не в свой ход, — и потому
 * переключатели времени накладывания её не находят.
 *
 * Кончившаяся остаётся на месте: её спрашивают ровно тогда, когда её уже нет.
 */

import type { ResourcesView } from "@/contract/views";
import { combatRole } from "@/ui/entities/spell/lib/format";
import { lastHintTraits } from "@/ui/shared/model/actionTraits";
import { ActionRow } from "@/ui/shared/ui/ActionRow";

/** Повод, по которому подсказку тратят. Список закрыт: алхимия в него не входит. */
export const LAST_HINT_SHORT_RU =
  "Проваленная проверка Интеллекта про руны, надпись, шифр, ритуал, головоломку или магический " +
  "механизм: бросок повторяется, к новому результату прибавляется бонус мастерства.";

/** Отказ называет причину словами: одно слово «подсказка» не говорит, что с ней не так. */
export const LAST_HINT_SPENT_RU = "уже потрачена, вернётся долгим отдыхом";

export function LastHintRow({
  resources,
  onOpen,
}: {
  resources: ResourcesView;
  onOpen: () => void;
}) {
  const { lastHint } = resources;
  const spent = lastHint.remaining <= 0;

  return (
    <ActionRow
      nameRu={lastHint.nameRu}
      role={combatRole(lastHintTraits(lastHint.nameRu).role)}
      onOpen={onOpen}
    >
      {/*
       * Каста у подсказки нет, и строка каста несёт одну цену — заряд. Запас смыслового цвета не
       * берёт: отвечают слово и само число, как и в ряду ресурсов.
       */}
      <span className="text-[0.84375rem] text-ink-quiet">
        заряд {lastHint.remaining}/{lastHint.maximum}
      </span>

      <span className="text-xs text-ink-soft">{LAST_HINT_SHORT_RU}</span>

      {spent ? (
        <span className="text-xs font-medium text-reaction">
          Недоступно: {LAST_HINT_SPENT_RU}
        </span>
      ) : null}
    </ActionRow>
  );
}
