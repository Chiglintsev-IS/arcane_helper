import type { AbilityView, SheetView } from "@/contract/views";

import {
  abilityLabel,
  SAVE_LABEL,
  SHEET_FIELD_LABELS,
  sizeLabel,
  skillLabel,
  trainingGlyph,
  trainingLabel,
} from "@/ui/entities/character/lib/labels";
import type { IdentityField } from "@/ui/features/edit-character-sheet/ui/IdentityFieldForm";
import { LEVEL_LABEL } from "@/ui/features/edit-character-sheet/ui/LevelForm";
import { feet } from "@/ui/shared/lib/spellLabels";
import { editName } from "@/ui/shared/ui/buttonLabels";
import { signed } from "@/shared/language";

/** Поле, которое правит строка: опечатка в строковом имени молча выключала бы её правку. */
export type SheetField = IdentityField | "level";

/** Строка записанного: `null` — не записано, и это сказано словом, а не прочерком. */
export type SheetRow = { field: SheetField; labelRu: string; value: string | null };

export type SheetBlockData = {
  id: string;
  titleRu: string;
  rows: SheetRow[];
  features?: SheetView["features"];
};

const OWN_SPEED_LABEL = "Своя скорость";

function written(value: string): string | null {
  return value === "" ? null : value;
}

function listed(values: readonly string[]): string | null {
  return written(values.join(", "));
}

export type TrainingMark = { glyph: string; labelRu: string };

function trainingMark(training: string): TrainingMark {
  return { glyph: trainingGlyph(training), labelRu: trainingLabel(training) };
}

export const PROFICIENT_MARK: TrainingMark = trainingMark("proficient");

export type LedgerSkill = {
  id: string;
  labelRu: string;
  value: string;
  training?: TrainingMark;
};

export type LedgerAbility = {
  id: string;
  titleRu: string;
  score: string;
  modifier: string;
  save: string;
  saveTraining?: TrainingMark;
  /** Своё имя кнопка забирает у содержимого: без него числа столбцов не читались бы вслух вовсе. */
  accessibleName: string;
  ability: AbilityView;
  skills: LedgerSkill[];
};

export function abilityLedger(sheet: SheetView): LedgerAbility[] {
  return sheet.abilities.map((ability) => {
    const titleRu = abilityLabel(ability.id);
    const modifier = signed(ability.modifier);
    const save = signed(ability.save);
    const owned = ability.saveProficient ? `, ${PROFICIENT_MARK.labelRu}` : "";

    return {
      id: ability.id,
      titleRu,
      score: `${ability.score}`,
      modifier,
      save,
      ...(ability.saveProficient ? { saveTraining: PROFICIENT_MARK } : {}),
      accessibleName:
        `${titleRu} ${ability.score}, ${modifier}, ` +
        `${SAVE_LABEL} ${save}${owned}. ${editName(titleRu)}`,
      ability,
      skills: ability.skills.map((skill) => ({
        id: skill.id,
        labelRu: skillLabel(skill.id),
        value: signed(skill.value),
        ...(skill.training === undefined ? {} : { training: trainingMark(skill.training) }),
      })),
    };
  });
}

export function sheetBlocks(sheet: SheetView): SheetBlockData[] {
  return [
    {
      id: "identity",
      titleRu: "Кто он",
      rows: [
        { field: "name", labelRu: "Имя", value: written(sheet.name) },
        { field: "species", labelRu: "Вид", value: written(sheet.species) },
        { field: "age", labelRu: "Возраст", value: sheet.age === 0 ? null : String(sheet.age) },
        { field: "className", labelRu: "Класс", value: written(sheet.className) },
        { field: "level", labelRu: LEVEL_LABEL, value: String(sheet.level) },
        { field: "subclass", labelRu: "Подкласс", value: written(sheet.subclass) },
        { field: "size", labelRu: SHEET_FIELD_LABELS.size, value: sizeLabel(sheet.size) },
        { field: "speed", labelRu: OWN_SPEED_LABEL, value: feet(sheet.speedBase) },
      ],
    },
    {
      id: "proficiencies",
      titleRu: "Владения",
      rows: [
        { field: "weapons", labelRu: "Оружие", value: listed(sheet.proficiencies.weapons) },
        { field: "armor", labelRu: "Доспехи", value: listed(sheet.proficiencies.armor) },
        { field: "tools", labelRu: "Инструменты", value: listed(sheet.proficiencies.tools) },
      ],
    },
    {
      id: "languages",
      titleRu: "Языки",
      rows: [{ field: "languages", labelRu: "Знает", value: listed(sheet.proficiencies.languages) }],
    },
    {
      id: "features",
      titleRu: "Особенности",
      rows: [],
      features: sheet.features,
    },
  ];
}
