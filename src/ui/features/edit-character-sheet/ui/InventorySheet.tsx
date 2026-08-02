"use client";

import { useState } from "react";

import type { CharacterState, InventoryItem } from "@/core/domain/character/state";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";

/**
 * Инвентарь: список вещей, надетое и вклад в числа.
 *
 * Правка идёт по одной вещи, а не таблицей: за столом добавляют одну находку, а не переписывают
 * сумку. Пустая прибавка не хранится вовсе — верёвка не участвует в счёте Класса Доспеха.
 */
export function InventorySheet({
  character,
  onAdd,
  onRemove,
  onToggleWorn,
  onCancel,
}: {
  character: CharacterState;
  onAdd: (item: InventoryItem) => void;
  onRemove: (id: string) => void;
  onToggleWorn: (id: string) => void;
  onCancel: () => void;
}) {
  const [nameRu, setNameRu] = useState("");
  const [note, setNote] = useState("");
  const [spellcasting, setSpellcasting] = useState("0");
  const [armorClass, setArmorClass] = useState("0");
  const [savingThrows, setSavingThrows] = useState("0");

  const numbers = {
    spellcasting: Number.parseInt(spellcasting, 10),
    armorClass: Number.parseInt(armorClass, 10),
    savingThrows: Number.parseInt(savingThrows, 10),
  };
  const valid =
    nameRu.trim() !== "" && Object.values(numbers).every((value) => Number.isInteger(value));
  const contributes = Object.values(numbers).some((value) => value !== 0);

  return (
    <EditSheetFrame
      titleRu="Вещи"
      canSave={valid}
      onCancel={onCancel}
      onSave={() =>
        onAdd({
          // Имя и есть опознание: вводить отдельный код за столом никто не станет.
          id: nameRu.trim().toLowerCase().replaceAll(" ", "-"),
          nameRu: nameRu.trim(),
          worn: false,
          ...(note.trim() === "" ? {} : { note: note.trim() }),
          ...(contributes ? { bonuses: numbers } : {}),
        })
      }
    >
      <ul className="flex flex-col gap-1">
        {character.equipment.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{item.nameRu}</span>
            <span className="flex gap-1">
              <button
                type="button"
                role="switch"
                aria-checked={item.worn}
                aria-label={`Надето: ${item.nameRu}`}
                onClick={() => onToggleWorn(item.id)}
                className={`min-h-11 rounded-lg border px-2 text-xs ${
                  item.worn
                    ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                    : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
                }`}
              >
                {item.worn ? "надето" : "в сумке"}
              </button>
              <button
                type="button"
                aria-label={`Убрать: ${item.nameRu}`}
                onClick={() => onRemove(item.id)}
                className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-800"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>

      <TextField labelRu="Новая вещь" value={nameRu} onChange={setNameRu} />
      <TextField labelRu="Заметка" value={note} onChange={setNote} />
      <NumberField labelRu="К магии" value={spellcasting} onChange={setSpellcasting} />
      <NumberField labelRu="К защите" value={armorClass} onChange={setArmorClass} />
      <NumberField labelRu="Ко всем спасброскам" value={savingThrows} onChange={setSavingThrows} />
    </EditSheetFrame>
  );
}
