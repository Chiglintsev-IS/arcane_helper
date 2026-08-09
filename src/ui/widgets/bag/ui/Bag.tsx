"use client";

import type { BagView, ItemView } from "@/contract/views";
import { currencyAbbr, statLabel } from "@/ui/entities/character/lib/labels";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { signed } from "@/shared/language";

/**
 * Разделы сумки — по категории вещи. Порядок постоянен, пустой раздел остаётся на месте со своей
 * строкой ввода: раздел, появляющийся с первой вещью, заставлял бы искать, куда её ввести.
 */
const SECTIONS: { kind: string; titleRu: string; addLabelRu: string }[] = [
  { kind: "gear", titleRu: "Экипировка", addLabelRu: "Новая экипировка" },
  { kind: "consumable", titleRu: "Расходники", addLabelRu: "Новый расходник" },
  { kind: "ingredient", titleRu: "Ингредиенты", addLabelRu: "Новый ингредиент" },
  { kind: "other", titleRu: "Другое", addLabelRu: "Новая вещь" },
];

/** Вторая строка вещи: цена, прибавки, заметка — только то, что у вещи действительно есть. */
export function itemMeta(item: ItemView): string {
  return [
    ...(item.price === undefined ? [] : [`${item.price.amount} ${currencyAbbr(item.price.currency)}`]),
    ...item.bonuses.map((bonus) => `${statLabel(bonus.stat)} ${signed(bonus.value)}`),
    ...(item.note === undefined ? [] : [item.note]),
  ].join(" · ");
}

/**
 * Строка вещи: имя со счётом и подробностями — кнопка, открывающая вещь; справа — то, что с вещью
 * делают чаще всего. Запас в сумке правится всегда; у экипировки рядом стоит второй счёт — надето.
 */
function ItemRow({
  item,
  onOpen,
  onAdjustBagCount,
  onAdjustWornCount,
}: {
  item: ItemView;
  onOpen: () => void;
  onAdjustBagCount: (delta: number) => void;
  onAdjustWornCount: (delta: number) => void;
}) {
  const meta = itemMeta(item);
  // Ноль — состояние: кончившийся расходник виден нулём, а не пропадает из списка.
  const countLabel =
    item.kind === "gear"
      ? ` · сумка ${item.bagCount} · надето ${item.wornCount}`
      : item.bagCount === 1
        ? ""
        : ` ×${item.bagCount}`;

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть: ${item.nameRu}`}
        className="min-h-11 min-w-0 flex-1 rounded-lg px-1 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <span
          className={`block text-sm ${item.bagCount === 0 && item.wornCount === 0 ? "text-slate-400 dark:text-slate-600" : ""}`}
        >
          {item.nameRu}
          {countLabel}
        </span>
        {meta === "" ? null : (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{meta}</span>
        )}
      </button>

      <span className="flex shrink-0 gap-1">
        <button
          type="button"
          aria-label={`Потратить один из сумки: ${item.nameRu}`}
          disabled={item.bagCount === 0}
          onClick={() => onAdjustBagCount(-1)}
          className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base disabled:opacity-40 dark:border-slate-800"
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Добавить один в сумку: ${item.nameRu}`}
          onClick={() => onAdjustBagCount(1)}
          className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base dark:border-slate-800"
        >
          +
        </button>
      </span>

      {item.kind === "gear" ? (
        <span className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label={`Снять один: ${item.nameRu}`}
            disabled={item.wornCount === 0}
            onClick={() => onAdjustWornCount(-1)}
            className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs disabled:opacity-40 dark:border-slate-800"
          >
            снять
          </button>
          <button
            type="button"
            aria-label={`Надеть один: ${item.nameRu}`}
            disabled={item.bagCount === 0}
            onClick={() => onAdjustWornCount(1)}
            className="min-h-11 rounded-lg border border-action bg-action/10 px-2 text-xs font-medium text-action-strong disabled:opacity-40 dark:text-action"
          >
            надеть
          </button>
        </span>
      ) : null}
    </li>
  );
}

/**
 * Сумка: деньги и вещи по категориям.
 *
 * Компонент презентационный: состояние приходит параметрами, операции выбирает экран. Быстрый ввод
 * заводит вещь сразу в свою категорию — раздел и есть выбор категории, отдельного поля не нужно.
 */
export function Bag({
  bag,
  onEditMoney,
  onOpenItem,
  onAddItem,
  onAdjustBagCount,
  onAdjustWornCount,
}: {
  bag: BagView;
  onEditMoney: () => void;
  onOpenItem: (id: string) => void;
  onAddItem: (kind: string, nameRu: string) => void;
  onAdjustBagCount: (id: string, delta: number) => void;
  onAdjustWornCount: (id: string, delta: number) => void;
}) {
  const { money, items, armorClass } = bag;

  return (
    <div className="flex flex-col gap-2">
      <section className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Деньги</h2>
          <button
            type="button"
            onClick={onEditMoney}
            aria-label="Править: Деньги"
            className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
          >
            Править
          </button>
        </div>
        {/* Все монеты стола всегда: исчезнувший ноль заставляет гадать, кончилось или забыто. */}
        <ul aria-label="Кошелёк" className="flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums">
          {money.map(({ currency, amount }) => (
            <li key={currency}>
              <span className="text-slate-500 dark:text-slate-400">{currencyAbbr(currency)}</span>{" "}
              {amount}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Доспех</h2>
        <p className="text-sm tabular-nums">
          КД {armorClass.value}
          <span className="text-slate-500 dark:text-slate-400">
            {" · "}
            {armorClass.wornArmorNameRu ?? "без доспехов"}
          </span>
        </p>
      </section>

      {SECTIONS.map((section) => {
        const sectionItems = items.filter((item) => item.kind === section.kind);
        return (
          <section
            key={section.kind}
            className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
          >
            <h2 className="text-sm font-semibold">{section.titleRu}</h2>
            {sectionItems.length === 0 ? null : (
              <ul aria-label={section.titleRu} className="flex flex-col gap-0.5">
                {sectionItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onOpen={() => onOpenItem(item.id)}
                    onAdjustBagCount={(delta) => onAdjustBagCount(item.id, delta)}
                    onAdjustWornCount={(delta) => onAdjustWornCount(item.id, delta)}
                  />
                ))}
              </ul>
            )}
            <QuickAddField labelRu={section.addLabelRu} onAdd={(nameRu) => onAddItem(section.kind, nameRu)} />
          </section>
        );
      })}
    </div>
  );
}
