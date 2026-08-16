"use client";

import { useState } from "react";

import type { ChoicesView, SheetView } from "@/contract/views";
import { sizeLabel } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

/** Справочная часть листа: что шторка набирает и отдаёт владельцу. Что из этого он примет — его дело. */
type IdentityPatch = {
  name: string;
  species: string;
  className: string;
  subclass: string;
  age: number;
  size: string;
  speed: number;
};

export function IdentitySheet({
  sheet,
  choices,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  /** Лист: начальные значения полей. */
  sheet: SheetView;
  /** Из чего выбирают: размеры существа перечнем правил. */
  choices: ChoicesView;
  onSave: (patch: IdentityPatch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(sheet.name);
  const [species, setSpecies] = useState(sheet.species);
  const [className, setClassName] = useState(sheet.className);
  const [subclass, setSubclass] = useState(sheet.subclass);
  const [ageText, setAgeText] = useState(String(sheet.age));
  const [size, setSize] = useState(sheet.size);
  const [speedText, setSpeedText] = useState(String(sheet.speed));

  const required = useRequiredNumbers();
  const age = requiredFieldNumber(ageText);
  const speed = requiredFieldNumber(speedText);

  return (
    <EditSheetFrame
      titleRu="Кто он"
      error={error}
      onCancel={onCancel}
      onSave={() =>
        required.ask([age, speed], () =>
          onSave({
            name: name.trim(),
            species: species.trim(),
            className: className.trim(),
            subclass: subclass.trim(),
            age,
            size,
            speed,
          }),
        )
      }
    >
      <TextField labelRu="Имя" value={name} onChange={setName} />
      <TextField labelRu="Вид" value={species} onChange={setSpecies} />
      <TextField labelRu="Класс" value={className} onChange={setClassName} />
      <TextField labelRu="Подкласс" value={subclass} onChange={setSubclass} />
      <NumberField
        labelRu="Возраст"
        value={ageText}
        onChange={required.touching(setAgeText)}
        min={0}
        reasonRu={required.reasonOf(age)}
      />

      <div role="radiogroup" aria-label="Размер" className="flex flex-wrap gap-1">
        {choices.creatureSizes.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={size === option}
            aria-label={sizeLabel(option)}
            onClick={() => setSize(option)}
            className={`min-h-11 rounded-lg px-2 text-sm ${
              size === option
                ? "bg-action/20 font-medium text-action-strong dark:text-action"
                : `text-slate-600 dark:text-slate-400 ${SURFACE_GROUP}`
            }`}
          >
            {sizeLabel(option)}
          </button>
        ))}
      </div>

      <NumberField
        labelRu="Скорость"
        value={speedText}
        onChange={required.touching(setSpeedText)}
        min={0}
        reasonRu={required.reasonOf(speed)}
      />
    </EditSheetFrame>
  );
}
