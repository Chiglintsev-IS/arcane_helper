"use client";

import type { CharacterState } from "@/core/domain/assembly/state";
import type { InventoryItem, ItemKind } from "@/core/domain/equipment/schema";
import { CURRENCIES } from "@/core/domain/equipment/schema";
import { Equipment } from "@/core/domain/equipment/equipment";
import { CURRENCY_ABBR } from "@/ui/entities/character/lib/labels";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { signed } from "@/core/shared/language";

/**
 * Разделы сумки — по категории вещи. Порядок постоянен, пустой раздел остаётся на месте со своей
 * строкой ввода: раздел, появляющийся с первой вещью, заставлял бы искать, куда её ввести.
 */
const SECTIONS: { kind: ItemKind; titleRu: string; addLabelRu: string }[] = [
  { kind: "gear", titleRu: "Экипировка", addLabelRu: "Новая экипировка" },
  { kind: "consumable", titleRu: "Расходники", addLabelRu: "Новый расходник" },
  { kind: "ingredient", titleRu: "Ингредиенты", addLabelRu: "Новый ингредиент" },
  { kind: "other", titleRu: "Другое", addLabelRu: "Новая вещь" },
];

/** Категории, чей запас меняют прямо со строки: расходуют и пополняют счётом. */
const COUNTABLE_KINDS: readonly ItemKind[] = ["consumable", "ingredient", "other"];

/**
 * Вторая строка вещи: цена, прибавки, заметка — только то, что у вещи действительно есть.
 * Прибавка называется только у экипировки: у остальных она не действует, и показанное число лгало бы.
 */
export function itemMeta(item: InventoryItem): string {
  const bonuses =
    item.bonuses === undefined || item.kind !== "gear"
      ? []
      : [
          item.bonuses.spellcasting === 0 ? null : `магия ${signed(item.bonuses.spellcasting)}`,
          item.bonuses.armorClass === 0 ? null : `защита ${signed(item.bonuses.armorClass)}`,
          item.bonuses.savingThrows === 0 ? null : `спасброски ${signed(item.bonuses.savingThrows)}`,
        ].filter((part) => part !== null);
  return [
    ...(item.price === undefined ? [] : [`${item.price.amount} ${CURRENCY_ABBR[item.price.currency]}`]),
    ...bonuses,
    ...(item.note === undefined ? [] : [item.note]),
  ].join(" · ");
}

/**
 * Строка вещи: имя со счётом и подробностями — кнопка, открывающая вещь; справа — то, что с вещью
 * делают чаще всего. У экипировки это «надето», у счётных категорий — расход и пополнение.
 */
function ItemRow({
  item,
  onOpen,
  onToggleWorn,
  onAdjustCount,
}: {
  item: InventoryItem;
  onOpen: () => void;
  onToggleWorn: () => void;
  onAdjustCount: (delta: number) => void;
}) {
  const meta = itemMeta(item);
  const countable = COUNTABLE_KINDS.includes(item.kind);
  // Ноль — состояние: кончившийся расходник виден нулём, а не пропадает из списка.
  const countLabel = countable ? ` ×${item.count}` : item.count > 1 ? ` ×${item.count}` : "";

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть: ${item.nameRu}`}
        className="min-h-11 min-w-0 flex-1 rounded-lg px-1 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <span className={`block text-sm ${item.count === 0 && countable ? "text-slate-400 dark:text-slate-600" : ""}`}>
          {item.nameRu}
          {countLabel}
        </span>
        {meta === "" ? null : (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{meta}</span>
        )}
      </button>

      {item.kind === "gear" ? (
        <button
          type="button"
          role="switch"
          aria-checked={item.worn}
          aria-label={`Надето: ${item.nameRu}`}
          onClick={onToggleWorn}
          className={`min-h-11 shrink-0 rounded-lg border px-2 text-xs ${
            item.worn
              ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
              : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
          }`}
        >
          {item.worn ? "надето" : "в сумке"}
        </button>
      ) : null}

      {countable ? (
        <span className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label={`Потратить один: ${item.nameRu}`}
            disabled={item.count === 0}
            onClick={() => onAdjustCount(-1)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base disabled:opacity-40 dark:border-slate-800"
          >
            −
          </button>
          <button
            type="button"
            aria-label={`Добавить один: ${item.nameRu}`}
            onClick={() => onAdjustCount(1)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base dark:border-slate-800"
          >
            +
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
  character,
  onEditMoney,
  onEditArmor,
  onOpenItem,
  onAddItem,
  onToggleWorn,
  onAdjustCount,
}: {
  character: CharacterState;
  onEditMoney: () => void;
  onEditArmor: () => void;
  onOpenItem: (id: string) => void;
  onAddItem: (kind: ItemKind, nameRu: string) => void;
  onToggleWorn: (id: string) => void;
  onAdjustCount: (id: string, delta: number) => void;
}) {
  const { money, items } = character.equipment;
  const equipment = Equipment.of(character);

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
          {CURRENCIES.map((currency) => (
            <li key={currency}>
              <span className="text-slate-500 dark:text-slate-400">{CURRENCY_ABBR[currency]}</span>{" "}
              {money[currency]}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Доспех</h2>
          <button
            type="button"
            onClick={onEditArmor}
            aria-label="Править: Доспех"
            className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
          >
            Править
          </button>
        </div>
        <p className="text-sm tabular-nums">
          База КД {equipment.armorClassBase}
          {equipment.wornArmor !== undefined ? (
            <span className="text-slate-500 dark:text-slate-400"> · {equipment.wornArmor.nameRu}</span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400"> · без доспехов</span>
          )}
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
                    onToggleWorn={() => onToggleWorn(item.id)}
                    onAdjustCount={(delta) => onAdjustCount(item.id, delta)}
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
