"use client";

import type { BagView, ChoicesView } from "@/contract/views";
import { currencyAbbr } from "@/ui/entities/character/lib/labels";
import { ItemRow } from "@/ui/entities/character/ui/ItemRow";
import { ItemSection } from "@/ui/shared/ui/ItemSection";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

/**
 * Разделы сумки — по категории счётной вещи. Порядок постоянен, пустой раздел остаётся на месте со
 * своей строкой ввода: раздел, появляющийся с первой вещью, заставлял бы искать, куда её ввести.
 *
 * Экипировки среди них нет: её надевают, и показывают её отдельно вместе с числом, которое от неё
 * зависит.
 */
const SECTIONS: { kind: string; titleRu: string; addLabelRu: string }[] = [
  { kind: "consumable", titleRu: "Расходники", addLabelRu: "Новый расходник" },
  { kind: "ingredient", titleRu: "Ингредиенты", addLabelRu: "Новый ингредиент" },
  { kind: "other", titleRu: "Другое", addLabelRu: "Новая вещь" },
];

/**
 * Сумка: деньги и счётные вещи по категориям.
 *
 * Компонент презентационный: состояние приходит параметрами, операции выбирает экран. Быстрый ввод
 * заводит вещь сразу в свою категорию — раздел и есть выбор категории, отдельного поля не нужно.
 */
export function Bag({
  bag,
  stats,
  onEditMoney,
  onOpenItem,
  onAddItem,
  onAdjustBagCount,
}: {
  bag: BagView;
  /** Величины с разбором: ими подписаны прибавки вещи. */
  stats: ChoicesView["stats"];
  onEditMoney: () => void;
  onOpenItem: (id: string) => void;
  onAddItem: (kind: string, nameRu: string) => void;
  onAdjustBagCount: (id: string, delta: number) => void;
}) {
  const { money, items, missingMaterials } = bag;
  // Уехавшее в список покупок из своей категории ушло: переезд, а не копия — один и тот же ноль,
  // стоящий в двух разделах, спрашивался бы дважды.
  const shopping = new Set(
    missingMaterials.flatMap((need) => (need.itemId === undefined ? [] : [need.itemId])),
  );

  return (
    <div className="flex flex-col gap-2">
      <section className={`flex items-center gap-3 rounded-xl px-3 py-2 ${SURFACE_GROUP}`}>
        <h2 className="shrink-0 text-sm font-semibold">Деньги</h2>
        {/* Все монеты стола всегда: исчезнувший ноль заставляет гадать, кончился или забыт. */}
        <ul
          aria-label="Кошелёк"
          className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums"
        >
          {money.map(({ currency, amount }) => (
            <li key={currency}>
              <span className="text-slate-600 dark:text-slate-400">{currencyAbbr(currency)}</span>{" "}
              {amount}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onEditMoney}
          aria-label="Править: Деньги"
          className={`min-h-11 shrink-0 rounded-lg px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Править
        </button>
      </section>

      {SECTIONS.map((section) => {
        const sectionItems = items.filter(
          (item) => item.kind === section.kind && !shopping.has(item.id),
        );
        return (
          <ItemSection
            key={section.kind}
            titleRu={section.titleRu}
            addLabelRu={section.addLabelRu}
            onAdd={(nameRu) => onAddItem(section.kind, nameRu)}
          >
            {sectionItems.length === 0 ? null : (
              <ul aria-label={section.titleRu} className="flex flex-col gap-0.5">
                {sectionItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    stats={stats}
                    onOpen={() => onOpenItem(item.id)}
                  >
                    {/*
                     * Запас стоит между расходом и пополнением: за столом со счётной вещью делают
                     * ровно это, и число, которое меняется, обязано стоять там, куда смотрят.
                     * Кончившееся видно нулём, и он же объясняет выключенный расход.
                     */}
                    <button
                      type="button"
                      aria-label={`Потратить один из сумки: ${item.nameRu}`}
                      disabled={item.bagCount === 0}
                      onClick={() => onAdjustBagCount(item.id, -1)}
                      className={`min-h-11 min-w-11 rounded-lg text-base disabled:opacity-40 ${SURFACE_CONTROL}`}
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center text-sm tabular-nums">
                      {item.bagCount}
                    </span>
                    <button
                      type="button"
                      aria-label={`Добавить один в сумку: ${item.nameRu}`}
                      onClick={() => onAdjustBagCount(item.id, 1)}
                      className={`min-h-11 min-w-11 rounded-lg text-base ${SURFACE_CONTROL}`}
                    >
                      +
                    </button>
                  </ItemRow>
                ))}
              </ul>
            )}
          </ItemSection>
        );
      })}
    </div>
  );
}
