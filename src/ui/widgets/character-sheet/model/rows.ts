/**
 * Строки блоков листа. Чистые функции, а не разметка: состав листа проверяется без браузера, и
 * компонент остаётся тонким.
 *
 * Лист — только база персонажа: кто он, характеристики, здоровье, отметки мастера, владения.
 * Действующие числа боя живут в шапке «Игры», вещи и деньги — в «Сумке»: три экрана отвечают на
 * три разных вопроса, и дублирование чисел между ними заставляло бы сверять их взглядом.
 *
 * Ничего не считается: числа приезжают проекцией, здесь выбираются слова и порядок.
 */

import type {
  AbilityView,
  ChoicesView,
  ContributionView,
  SheetView,
  StatView,
} from "@/contract/views";

import {
  abilityLabel,
  orDash,
  sizeLabel,
  skillLabel,
  statLabel,
  trainingLabel,
} from "@/ui/entities/character/lib/labels";
import { signed } from "@/shared/language";

export type SheetRow = { labelRu: string; value: string; hint?: string };

/**
 * Что откроет «Править». Не строка: опечатка в одном из имён молча выключала бы шторку — блок
 * рисуется, кнопка нажимается, и ничего не происходит, а компилятор про это не знает.
 *
 * Характеристика едет целиком, а не именем: шторка правит ровно то, что показал блок, и второго
 * поиска той же записи по имени между блоком и шторкой не заводится.
 */
export type SheetEdit =
  | { block: "identity" | "level" | "health" | "marks" | "permanent" }
  | { block: "ability"; ability: AbilityView };

export type SheetBlockData = {
  id: string;
  titleRu: string;
  rows: SheetRow[];
  /** Какую шторку открывает «Править»: у блока характеристики она своя, а не общая. */
  edit: SheetEdit;
  /** Вторая кнопка блока: у «Кто он» уровень правится отдельно — он тянет за собой ресурсы. */
  secondary?: { labelRu: string; edit: SheetEdit };
};

/** Чем вклад двигает число — словами строки разбора, а не именем рода вклада. */
function contributionValue({ kind, value }: ContributionView): string {
  if (kind === "bonus") return signed(value);
  if (kind === "assignment") return `= ${value}`;
  return `база ${value}`;
}

/** Разбор величины строками: что действует и откуда взялось. */
function breakdownRows(stat: StatView): SheetRow[] {
  return stat.parts.map((part) => ({ labelRu: part.nameRu, value: contributionValue(part) }));
}

/**
 * Класс Доспеха: действующее число и всё, из чего оно сложилось.
 *
 * Итог здесь тот же, что в шапке «Игры», и это не два числа, а одно: считает его один код, и
 * разойтись им нечем — прежде здесь стояла собственная раскладка, и она с шапкой расходилась.
 */
function armorClassBlock(armorClass: StatView): SheetBlockData {
  return {
    id: "armorClass",
    titleRu: "Класс Доспеха",
    edit: { block: "permanent" },
    rows: [
      { labelRu: "Итог", value: String(armorClass.value) },
      ...breakdownRows(armorClass),
    ],
  };
}

/**
 * Откуда взялся действующий максимум хитов, когда он не равен базовому: снижения названы, но
 * место занимает одно число, а не четыре строки слагаемых. Целый максимум подсказки не требует —
 * объяснять нечего.
 *
 * Минус типографский: дефис в этой позиции на узком экране читается как перенос строки.
 */
function maximumOrigin({ maximumBase, bloodReduction, masterReduction }: SheetView["hitPoints"]): string | null {
  const parts = [
    bloodReduction === 0 ? null : `−${bloodReduction} кровью`,
    masterReduction === 0 ? null : `−${masterReduction} мастером`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : `${maximumBase} ${parts.join(", ")}`;
}

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

export function sheetBlocks(sheet: SheetView, stats: ChoicesView["stats"]): SheetBlockData[] {
  const { hitPoints } = sheet;
  const maximumHint = maximumOrigin(hitPoints);

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
      id: "health",
      titleRu: "Здоровье",
      edit: { block: "health" },
      rows: [
        {
          labelRu: "Хиты",
          value: `${hitPoints.current} из ${hitPoints.maximum}`,
          ...(hitPoints.temporary === 0
            ? {}
            : { hint: `${signed(hitPoints.temporary)} временных` }),
        },
        {
          labelRu: "Максимум",
          value: String(hitPoints.maximum),
          ...(maximumHint === null ? {} : { hint: maximumHint }),
        },
        {
          labelRu: "Кости хитов",
          value:
            hitPoints.hitDice === undefined
              ? "—"
              : `${hitPoints.hitDice.remaining} из ${hitPoints.hitDice.total} по d${hitPoints.hitDice.size}`,
        },
      ],
    },
    armorClassBlock(sheet.armorClass),
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
    /**
     * Постоянные вклады — свойство самого Торна: раса, дар, благословение, слово мастера. Вклад с
     * вещью правится у вещи в «Сумке», а этой карточке принадлежит тот, у которого вещи нет.
     */
    {
      id: "permanentContributions",
      titleRu: "Постоянные вклады",
      edit: { block: "permanent" },
      rows: sheet.permanentContributions.map((permanent) => ({
        labelRu: permanent.nameRu,
        value: contributionValue(permanent),
        hint: statLabel(stats, permanent.stat),
      })),
    },
    ...sheet.abilities.map(abilityBlock),
    {
      id: "proficiencies",
      titleRu: "Снаряжение и языки",
      edit: { block: "identity" },
      rows: [
        { labelRu: "Оружие", value: orDash(sheet.proficiencies.weapons.join(", ")) },
        { labelRu: "Доспехи", value: orDash(sheet.proficiencies.armor.join(", ")) },
        { labelRu: "Инструменты", value: orDash(sheet.proficiencies.tools.join(", ")) },
        { labelRu: "Языки", value: orDash(sheet.proficiencies.languages.join(", ")) },
      ],
    },
  ];
}
