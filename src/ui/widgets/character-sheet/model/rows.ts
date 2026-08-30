/**
 * Строки листа. Чистые функции, а не разметка: состав листа проверяется без браузера, и компонент
 * остаётся тонким.
 *
 * Лист отвечает на два разных вопроса и потому делится надвое. «Броски» — то, что называют вслух в
 * ответ на просьбу мастера бросить: характеристика, её спасбросок, её навыки. «Кто он» — то, что
 * спрашивают раз за вечер: имя, вид, класс, владения, языки, особенности. Числа боя живут в шапке
 * «Игры», вещи и деньги — в «Сумке», отметки мастера — там же, где их ставят, то есть в «Игре».
 *
 * Класс Доспеха складывается из характеристик, доспеха, заклинаний и слова мастера — то есть из
 * того, что двигает игра, а не лист. Числа, которое лист не вправе изменить, на листе и нет.
 *
 * Ничего не считается: числа приезжают проекцией, здесь выбираются слова и порядок.
 */

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
 * Что откроет кнопка правки. Не строка: опечатка в одном из имён молча выключала бы шторку — блок
 * рисуется, кнопка нажимается, и ничего не происходит, а компилятор про это не знает.
 *
 * Характеристика едет целиком, а не именем: шторка правит ровно то, что показал блок, и второго
 * поиска той же записи по имени между блоком и шторкой не заводится.
 */
export type SheetEdit =
  | { block: "identity" | "level" | "proficiencies" | "languages" }
  | { block: "ability"; ability: AbilityView };

export type SheetBlockData = {
  id: string;
  titleRu: string;
  rows: SheetRow[];
  /** Какую шторку открывает кнопка правки. Нет вовсе — блок не правят, и кнопки у него не бывает. */
  edit?: SheetEdit;
  /** Вторая кнопка блока: у «Кто он» уровень правится отдельно — он тянет за собой ресурсы. */
  secondary?: { labelRu: string; edit: SheetEdit };
  /** Особенности блока: название и фраза под ним, а не значение у правого края. */
  features?: SheetView["features"];
};

/**
 * Отметка степени владения при числе: знак и слово, которым знак назван.
 *
 * Слово едет вместе со знаком, а не вместо него: у числа стоит знак, у легенды — слово, и разойтись
 * им нельзя, иначе легенда объяснит не тот знак.
 */
export type TrainingMark = { glyph: string; labelRu: string };

function trainingMark(training: string): TrainingMark {
  return { glyph: trainingGlyph(training), labelRu: trainingLabel(training) };
}

/** Отметка владения: она стоит при числах гроссбуха, и её же объясняет легенда полосы мастерства. */
export const PROFICIENT_MARK: TrainingMark = trainingMark("proficient");

/** Навык в строке гроссбуха: подпись, число и отметка владения, если оно есть. */
export type LedgerSkill = {
  id: string;
  labelRu: string;
  value: string;
  training?: TrainingMark;
};

/**
 * Характеристика гроссбуха: шапка группы со своими числами и её навыки под ней.
 *
 * Так устроен бумажный лист, и по нему ищут глазами: «спасбросок Телосложения» находят под
 * Телосложением, а не в отдельном списке из шести строк, где рядом стоят чужие числа.
 */
export type LedgerAbility = {
  id: string;
  titleRu: string;
  /** Само значение характеристики: оно стоит при имени мелко — бросают не им, а модификатором. */
  score: string;
  modifier: string;
  save: string;
  saveTraining?: TrainingMark;
  /**
   * Чем шапка зовётся голосом: числа столбцов подписаны в ней словами, а не местом в сетке.
   *
   * Имя собрано целиком потому, что шапка — кнопка: своё имя кнопка забирает у содержимого, и без
   * него модификатор со спасброском не читались бы вслух вовсе.
   */
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
    /**
     * Размера и скорости здесь нет: их называют, пока ходят по полю боя, и живут они в шапке
     * «Игры» — рядом с тем, чем в этот ход платят, а не там, где заводят имя и подкласс.
     */
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
    /**
     * Чем он умеет пользоваться. Слова «снаряжение» здесь нет: снаряжение — то, что лежит в сумке,
     * а владение оружием и доспехами остаётся при Торне и голым.
     */
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
    /**
     * Языки стоят своей карточкой: за столом их спрашивают отдельным вопросом — «а он поймёт, что
     * там написано» — и ответ ищут не среди инструментов.
     */
    {
      id: "languages",
      titleRu: "Языки",
      edit: { block: "languages" },
      rows: [{ labelRu: "Знает", value: orDash(sheet.proficiencies.languages.join(", ")) }],
    },
    /**
     * Особенности: то, чем персонаж располагает по происхождению. Правки у карточки нет — руками
     * особенность не заводят, — а название с фразой под ним стоят вместо строки со значением:
     * справку читают вслух, и в треть экрана она не встаёт.
     */
    {
      id: "features",
      titleRu: "Особенности",
      rows: [],
      features: sheet.features,
    },
  ];
}
