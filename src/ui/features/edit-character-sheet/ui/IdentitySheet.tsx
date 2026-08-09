"use client";

import { useState } from "react";

import type { SheetView } from "@/contract/views";
import { CREATURE_SIZES, type CreatureSize } from "@/core/domain/character/schema";
import { sizeLabel } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";

/**
 * Список владений вводится строкой через запятую: четыре отдельных редактора списков стоили бы
 * четырёх экранов ради данных, которые за всю игру правят однажды.
 *
 * Пустая строка даёт пустой список, а не список с пустой строкой: схема пустых имён не принимает.
 */
function asList(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/** Справочная часть листа: что шторка набирает и отдаёт владельцу. Что из этого он примет — его дело. */
type IdentityPatch = {
  name: string;
  species: string;
  className: string;
  subclass: string;
  age: number;
  size: string;
  speed: number;
  proficiencies: { weapons: string[]; armor: string[]; tools: string[]; languages: string[] };
};

export function IdentitySheet({
  sheet,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  /** Лист: начальные значения полей. */
  sheet: SheetView;
  onSave: (patch: IdentityPatch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(sheet.name);
  const [species, setSpecies] = useState(sheet.species);
  const [className, setClassName] = useState(sheet.className);
  const [subclass, setSubclass] = useState(sheet.subclass);
  const [ageText, setAgeText] = useState(String(sheet.age));
  const [size, setSize] = useState<CreatureSize | string>(sheet.size);
  const [speedText, setSpeedText] = useState(String(sheet.speed));
  const [weapons, setWeapons] = useState(sheet.proficiencies.weapons.join(", "));
  const [armor, setArmor] = useState(sheet.proficiencies.armor.join(", "));
  const [tools, setTools] = useState(sheet.proficiencies.tools.join(", "));
  const [languages, setLanguages] = useState(sheet.proficiencies.languages.join(", "));

  const age = requiredFieldNumber(ageText);
  const speed = requiredFieldNumber(speedText);

  return (
    <EditSheetFrame
      titleRu="Кто он"
      error={error}
      onCancel={onCancel}
      onSave={() =>
        onSave({
          name: name.trim(),
          species: species.trim(),
          className: className.trim(),
          subclass: subclass.trim(),
          age,
          size,
          speed,
          proficiencies: {
            weapons: asList(weapons),
            armor: asList(armor),
            tools: asList(tools),
            languages: asList(languages),
          },
        })
      }
    >
      <TextField labelRu="Имя" value={name} onChange={setName} />
      <TextField labelRu="Вид" value={species} onChange={setSpecies} />
      <TextField labelRu="Класс" value={className} onChange={setClassName} />
      <TextField labelRu="Подкласс" value={subclass} onChange={setSubclass} />
      <NumberField labelRu="Возраст" value={ageText} onChange={setAgeText} min={0} />

      <div role="radiogroup" aria-label="Размер" className="flex flex-wrap gap-1">
        {CREATURE_SIZES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={size === option}
            aria-label={sizeLabel(option)}
            onClick={() => setSize(option)}
            className={`min-h-11 rounded-lg border px-2 text-sm ${
              size === option
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {sizeLabel(option)}
          </button>
        ))}
      </div>

      <NumberField labelRu="Скорость" value={speedText} onChange={setSpeedText} min={0} />

      <TextField labelRu="Оружие" value={weapons} onChange={setWeapons} />
      <TextField labelRu="Доспехи" value={armor} onChange={setArmor} />
      <TextField labelRu="Инструменты" value={tools} onChange={setTools} />
      <TextField labelRu="Языки" value={languages} onChange={setLanguages} />
    </EditSheetFrame>
  );
}
