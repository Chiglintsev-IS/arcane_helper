/**
 * Строки блоков листа. Чистые функции, а не разметка: состав листа проверяется без браузера, и
 * компонент остаётся тонким.
 *
 * Лист — только база персонажа: кто он, характеристики, отметки мастера, владения. Действующие
 * числа боя живут в шапке «Игры», вещи и деньги — в «Сумке»: три экрана отвечают на три разных
 * вопроса, и дублирование чисел между ними заставляло бы сверять их взглядом.
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
  sizeLabel,
  skillLabel,
  trainingLabel,
} from "@/ui/entities/character/lib/labels";
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
  | { block: "identity" | "level" | "marks" | "proficiencies" | "languages" }
  | { block: "ability"; ability: AbilityView };

export type SheetBlockData = {
  id: string;
  titleRu: string;
  rows: SheetRow[];
  /**
   * Какую шторку открывает кнопка правки: у блока характеристики она своя, а не общая. Нет вовсе —
   * блок не правят, и кнопки у него не бывает.
   */
  edit?: SheetEdit;
  /** Вторая кнопка блока: у «Кто он» уровень правится отдельно — он тянет за собой ресурсы. */
  secondary?: { labelRu: string; edit: SheetEdit };
  /** Особенности блока: название и фраза под ним, а не значение у правого края. */
  features?: SheetView["features"];
};

/**
 * Блок одной характеристики: значение с модификатором, спасбросок, её навыки.
 *
 * Так устроен бумажный лист, и по нему ищут глазами: «спасбросок Телосложения» находят под
 * Телосложением, а не в отдельном списке из шести строк, где рядом стоят чужие числа.
 */
function abilityBlock(ability: AbilityView): SheetBlockData {
  return {
    id: `ability:${ability.id}`,
    titleRu: abilityLabel(ability.id),
    edit: { block: "ability", ability },
    rows: [
      {
        labelRu: "Значение",
        value: `${ability.score} (${signed(ability.modifier)})`,
      },
      {
        labelRu: "Спасбросок",
        value: signed(ability.save),
        ...(ability.saveProficient ? { hint: "владение" } : {}),
      },
      ...ability.skills.map((skill) => ({
        labelRu: skillLabel(skill.id),
        value: signed(skill.value),
        ...(skill.training === undefined ? {} : { hint: trainingLabel(skill.training) }),
      })),
    ],
  };
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
        { labelRu: "Размер", value: sizeLabel(sheet.size) },
        { labelRu: "Скорость", value: `${sheet.speed} футов` },
        { labelRu: "Класс", value: `${sheet.className}, ${sheet.level}` },
        { labelRu: "Подкласс", value: orDash(sheet.subclass) },
      ],
    },
    {
      id: "marks",
      titleRu: "Отметки мастера",
      edit: { block: "marks" },
      rows: [
        {
          labelRu: "Истощение",
          value: sheet.exhaustion === 0 ? "нет" : `ступень ${sheet.exhaustion}`,
        },
        { labelRu: "Вдохновение", value: sheet.inspiration ? "есть" : "нет" },
      ],
    },
    ...sheet.abilities.map(abilityBlock),
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
