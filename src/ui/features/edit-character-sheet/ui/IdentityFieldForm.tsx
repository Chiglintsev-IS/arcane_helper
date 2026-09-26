"use client";

import { useState } from "react";

import type { ChoicesView, SheetView } from "@/contract/views";
import { sizeLabel } from "@/ui/entities/character/lib/labels";
import { asList } from "@/ui/features/edit-character-sheet/lib/lists";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { FieldForm, UNSENT, WRITTEN, type WriteAnswer } from "@/ui/shared/ui/FieldForm";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { SURFACE_CHOSEN, SURFACE_GROUP } from "@/ui/shared/ui/surface";

import { NumberField } from "./EditSheetFrame";

type Proficiencies = SheetView["proficiencies"];

export type IdentityPatch = Partial<{
  name: string;
  species: string;
  className: string;
  subclass: string;
  age: number;
  size: string;
  speed: number;
  proficiencies: Proficiencies;
}>;

type TextKey = "name" | "species" | "className" | "subclass";
type NumberKey = "age" | "speed";

export type IdentityField = TextKey | NumberKey | keyof Proficiencies | "size";

const TEXT_KEYS: readonly string[] = ["name", "species", "className", "subclass"];
const NUMBER_KEYS: readonly string[] = ["age", "speed"];

function isText(field: IdentityField): field is TextKey {
  return TEXT_KEYS.includes(field);
}

function isNumber(field: IdentityField): field is NumberKey {
  return NUMBER_KEYS.includes(field);
}

const NUMBER_VALUES: Record<NumberKey, (sheet: SheetView) => number> = {
  age: (sheet) => sheet.age,
  speed: (sheet) => sheet.speedBase,
};

/** Правка одной строки «Кто он»: форма раскрывается под строкой и пишет только своё поле. */
export function IdentityFieldForm({
  field,
  labelRu,
  sheet,
  choices,
  onWrite,
  onClose,
}: {
  field: IdentityField;
  labelRu: string;
  sheet: SheetView;
  choices: ChoicesView;
  onWrite: (patch: IdentityPatch) => WriteAnswer;
  onClose: () => void;
}) {
  if (field === "size") {
    return (
      <SizeForm
        labelRu={labelRu}
        ownerRu={sheet.name}
        size={sheet.size}
        sizes={choices.creatureSizes}
        onWrite={(size) => onWrite({ size })}
        onClose={onClose}
      />
    );
  }
  if (isNumber(field)) {
    return (
      <NumberForm
        labelRu={labelRu}
        ownerRu={sheet.name}
        value={NUMBER_VALUES[field](sheet)}
        onWrite={(value) => onWrite({ [field]: value })}
        onClose={onClose}
      />
    );
  }
  if (isText(field)) {
    return (
      <TextForm
        labelRu={labelRu}
        ownerRu={sheet.name}
        value={sheet[field]}
        onWrite={(text) => onWrite({ [field]: text })}
        onClose={onClose}
      />
    );
  }
  const proficiencies = sheet.proficiencies;
  return (
    <TextForm
      labelRu={labelRu}
      ownerRu={sheet.name}
      value={proficiencies[field].join(", ")}
      onWrite={(text) => onWrite({ proficiencies: { ...proficiencies, [field]: asList(text) } })}
      onClose={onClose}
    />
  );
}

function TextForm({
  labelRu,
  ownerRu,
  value,
  onWrite,
  onClose,
}: {
  labelRu: string;
  ownerRu: string;
  value: string;
  onWrite: (text: string) => WriteAnswer;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState(value);

  return (
    <FieldForm
      titleRu={labelRu}
      subtitleRu={ownerRu}
      answerRu={BUTTON_LABELS.save}
      onWrite={() => (typed.trim() === value.trim() ? WRITTEN : onWrite(typed.trim()))}
      onClose={onClose}
    >
      <GrowingField labelRu={labelRu} value={typed} autoFocus onChange={setTyped} />
    </FieldForm>
  );
}

function NumberForm({
  labelRu,
  ownerRu,
  value,
  onWrite,
  onClose,
}: {
  labelRu: string;
  ownerRu: string;
  value: number;
  onWrite: (value: number) => WriteAnswer;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState(String(value));
  const required = useRequiredNumbers();
  const number = requiredFieldNumber(typed);

  return (
    <FieldForm
      titleRu={labelRu}
      subtitleRu={ownerRu}
      answerRu={BUTTON_LABELS.save}
      onWrite={() => {
        required.ask([number], () => {});
        if (!required.typed(number)) return UNSENT;
        return number === value ? WRITTEN : onWrite(number);
      }}
      onClose={onClose}
    >
      <NumberField
        labelRu={labelRu}
        value={typed}
        onChange={required.touching(setTyped)}
        min={0}
        reasonRu={required.reasonOf(number)}
      />
    </FieldForm>
  );
}

function SizeForm({
  labelRu,
  ownerRu,
  size,
  sizes,
  onWrite,
  onClose,
}: {
  labelRu: string;
  ownerRu: string;
  size: string;
  sizes: ChoicesView["creatureSizes"];
  onWrite: (size: string) => WriteAnswer;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState(size);

  return (
    <FieldForm
      titleRu={labelRu}
      subtitleRu={ownerRu}
      answerRu={BUTTON_LABELS.save}
      choice
      onWrite={() => (chosen === size ? WRITTEN : onWrite(chosen))}
      onClose={onClose}
    >
      <div role="radiogroup" aria-label={labelRu} className="flex flex-wrap gap-1">
        {sizes.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={chosen === option}
            aria-label={sizeLabel(option)}
            onClick={() => setChosen(option)}
            className={`min-h-11 px-2 text-sm ${
              chosen === option ? `${SURFACE_CHOSEN} font-medium` : `text-ink-quiet ${SURFACE_GROUP}`
            }`}
          >
            {sizeLabel(option)}
          </button>
        ))}
      </div>
    </FieldForm>
  );
}
