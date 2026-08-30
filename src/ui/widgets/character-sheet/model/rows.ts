import type { AbilityView, SheetView } from "@/contract/views";

import {
  abilityLabel,
  orDash,
  SAVE_LABEL,
  skillLabel,
  trainingGlyph,
  trainingLabel,
} from "@/ui/entities/character/lib/labels";
import { editName } from "@/ui/shared/ui/buttonLabels";
import { signed } from "@/shared/language";

export type SheetRow = { labelRu: string; value: string; hint?: string };

/**
 * Не строка: опечатка в одном из имён молча выключала бы шторку — блок рисуется, кнопка нажимается,
 * и ничего не происходит, а компилятор про это не знает.
 */
export type SheetEdit =
  | { block: "identity" | "level" | "proficiencies" | "languages" }
  | { block: "ability"; ability: AbilityView };

export type SheetBlockData = {
  id: string;
  titleRu: string;
  rows: SheetRow[];
  edit?: SheetEdit;
  secondary?: { labelRu: string; edit: SheetEdit };
  features?: SheetView["features"];
};

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
  edit: SheetEdit;
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
      edit: { block: "ability", ability },
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
      edit: { block: "identity" },
      secondary: { labelRu: "Уровень", edit: { block: "level" } },
      rows: [
        { labelRu: "Имя", value: orDash(sheet.name) },
        { labelRu: "Вид", value: orDash(sheet.species) },
        { labelRu: "Возраст", value: orDash(sheet.age) },
        { labelRu: "Класс", value: `${sheet.className}, ${sheet.level}` },
        { labelRu: "Подкласс", value: orDash(sheet.subclass) },
      ],
    },
    {
      id: "proficiencies",
      titleRu: "Владения",
      edit: { block: "proficiencies" },
      rows: [
        { labelRu: "Оружие", value: orDash(sheet.proficiencies.weapons.join(", ")) },
        { labelRu: "Доспехи", value: orDash(sheet.proficiencies.armor.join(", ")) },
        { labelRu: "Инструменты", value: orDash(sheet.proficiencies.tools.join(", ")) },
      ],
    },
    {
      id: "languages",
      titleRu: "Языки",
      edit: { block: "languages" },
      rows: [{ labelRu: "Знает", value: orDash(sheet.proficiencies.languages.join(", ")) }],
    },
    {
      id: "features",
      titleRu: "Особенности",
      rows: [],
      features: sheet.features,
    },
  ];
}
