"use client";

import { useState } from "react";

import type { InventoryItem, ItemKind } from "@/core/domain/character/state";
import { ITEM_KIND_LABELS } from "@/ui/entities/character/lib/labels";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";

/** Род вещи: пусто читается как обычное снаряжение, не зелье, не ингредиент, не хлам. */
const KIND_CHOICES: { kind: ItemKind | undefined; labelRu: string }[] = [
  { kind: undefined, labelRu: "обычная" },
  ...(Object.entries(ITEM_KIND_LABELS) as [ItemKind, string][]).map(([kind, labelRu]) => ({
    kind,
    labelRu,
  })),
];

/**
 * Одна вещь целиком: заметка, род, прибавки — и то, что с ней делают.
 *
 * Открывается нажатием на саму вещь в списке, а не кнопкой правки над списком: подробности нужны
 * той вещи, на которую смотрят, и до нажатия они места не занимают. Поэтому же заводится находка
 * одним названием — всё остальное дописывается здесь и только если понадобится.
 *
 * Количество полем не правится: его меняют расход и повторная находка того же названия. Поле рядом
 * с кнопкой «Потратить» показывало бы число, набранное до расхода, и сохранение возвращало бы
 * потраченное обратно.
 */
export function ItemSheet({
  item,
  onSave,
  onToggleWorn,
  onSpend,
  onRemove,
  onCancel,
}: {
  item: InventoryItem;
  onSave: (item: InventoryItem) => void;
  onToggleWorn: () => void;
  onSpend: () => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(item.note ?? "");
  const [kind, setKind] = useState<ItemKind | undefined>(item.kind);
  const [spellcasting, setSpellcasting] = useState(String(item.bonuses?.spellcasting ?? 0));
  const [armorClass, setArmorClass] = useState(String(item.bonuses?.armorClass ?? 0));
  const [savingThrows, setSavingThrows] = useState(String(item.bonuses?.savingThrows ?? 0));

  const numbers = {
    spellcasting: Number.parseInt(spellcasting, 10),
    armorClass: Number.parseInt(armorClass, 10),
    savingThrows: Number.parseInt(savingThrows, 10),
  };
  const valid = Object.values(numbers).every((value) => Number.isInteger(value));
  // Пустая прибавка не хранится вовсе: верёвка не участвует в счёте Класса Доспеха.
  const contributes = Object.values(numbers).some((value) => value !== 0);

  return (
    <EditSheetFrame
      // Количество стоит в заголовке, а не полем: его меняют расходом и повторной находкой.
      titleRu={item.count > 1 ? `${item.nameRu} ×${item.count}` : item.nameRu}
      canSave={valid}
      onCancel={onCancel}
      onSave={() =>
        onSave({
          id: item.id,
          nameRu: item.nameRu,
          worn: item.worn,
          count: item.count,
          ...(kind === undefined ? {} : { kind }),
          ...(note.trim() === "" ? {} : { note: note.trim() }),
          ...(contributes ? { bonuses: numbers } : {}),
        })
      }
    >
      {/*
       * Надеть, потратить и убрать стоят выше полей: за столом чаще делают именно это, а правка
       * количества и прибавок — событие однократное, при заведении вещи.
       */}
      <div className="flex gap-1">
        <button
          type="button"
          role="switch"
          aria-checked={item.worn}
          aria-label={`Надето: ${item.nameRu}`}
          onClick={onToggleWorn}
          className={`min-h-11 flex-1 rounded-lg border px-2 text-xs ${
            item.worn
              ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
              : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
          }`}
        >
          {item.worn ? "надето" : "в сумке"}
        </button>
        <button
          type="button"
          aria-label={`Потратить: ${item.nameRu}`}
          onClick={onSpend}
          className="min-h-11 flex-1 rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-800"
        >
          Потратить
        </button>
        <button
          type="button"
          aria-label={`Убрать: ${item.nameRu}`}
          onClick={onRemove}
          className="min-h-11 flex-1 rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-800"
        >
          Убрать
        </button>
      </div>

      <TextField labelRu="Заметка" value={note} onChange={setNote} />
      <div role="radiogroup" aria-label="Вид вещи" className="flex gap-1">
        {KIND_CHOICES.map((choice) => (
          <button
            key={choice.labelRu}
            type="button"
            role="radio"
            aria-checked={kind === choice.kind}
            aria-label={choice.labelRu}
            onClick={() => setKind(choice.kind)}
            className={`min-h-11 rounded-lg border px-2 text-xs ${
              kind === choice.kind
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {choice.labelRu}
          </button>
        ))}
      </div>
      <NumberField labelRu="К магии" value={spellcasting} onChange={setSpellcasting} />
      <NumberField labelRu="К защите" value={armorClass} onChange={setArmorClass} />
      <NumberField labelRu="Ко всем спасброскам" value={savingThrows} onChange={setSavingThrows} />
    </EditSheetFrame>
  );
}
