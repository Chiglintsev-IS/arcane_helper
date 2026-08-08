/**
 * Строки блоков листа. Чистые функции, а не разметка: состав листа проверяется без браузера, и
 * компонент остаётся тонким.
 *
 * Лист — только база персонажа: кто он, характеристики, здоровье, отметки мастера, владения.
 * Действующие числа боя живут в шапке «Игры», вещи и деньги — в «Сумке»: три экрана отвечают на
 * три разных вопроса, и дублирование чисел между ними заставляло бы сверять их взглядом.
 */

import { Character } from "@/core/domain/assembly/character";
import { skillsOfAbility } from "@/core/domain/character/skills";
import {
  ABILITIES,
  abilityStatId,
  saveStatId,
  skillStatId,
  type Ability,
  type StatContribution,
} from "@/core/domain/shared/stats";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Sheet } from "@/core/domain/sheet/sheet";
import { Vitality } from "@/core/domain/vitality/vitality";
import {
  ABILITY_LABELS,
  orDash,
  SIZE_LABELS,
  SKILL_LABELS,
  statLabel,
  TRAINING_LABELS,
} from "@/ui/entities/character/lib/labels";
import { signed } from "@/core/shared/language";

export type SheetRow = { labelRu: string; value: string; hint?: string };

/**
 * Что откроет «Править». Не строка: опечатка в одном из имён молча выключала бы шторку — блок
 * рисуется, кнопка нажимается, и ничего не происходит, а компилятор про это не знает.
 *
 * Характеристика названа своим полем, а не приставкой в имени: разбирать строку обратно значит
 * заводить второй разбор рядом с первым и однажды их рассогласовать.
 */
export type SheetEdit =
  | { block: "identity" | "level" | "health" | "marks" | "permanent" }
  | { block: "ability"; ability: Ability };

export type SheetBlockData = {
  id: string;
  titleRu: string;
  rows: SheetRow[];
  /** Какую шторку открывает «Править»: у блока характеристики она своя, а не общая. */
  edit: SheetEdit;
  /** Вторая кнопка блока: у «Кто он» уровень правится отдельно — он тянет за собой ресурсы. */
  secondary?: { labelRu: string; edit: SheetEdit };
};

/** Чем вклад двигает число — словами строки разбора, а не именем вида вклада. */
function contributionValue(contribution: StatContribution): string {
  if (contribution.kind === "bonus") return signed(contribution.value);
  if (contribution.kind === "assignment") return `= ${contribution.value}`;
  return `база ${contribution.method.base}`;
}

/**
 * Разбор величины строками: что действует и откуда взялось.
 *
 * Непринятые вклады не показываются: «кольчуга победила „Доспехи мага“» — ответ на вопрос, которого
 * за столом не задают, а строка на узком экране стоит места.
 */
function breakdownRows(sheet: Sheet, stat: Parameters<Sheet["value"]>[0]): SheetRow[] {
  return sheet
    .breakdown(stat)
    .parts.filter((part) => part.applied)
    .map((part) => ({
      labelRu: part.source.nameRu,
      value: contributionValue(part.contribution),
    }));
}

/**
 * Класс Доспеха: действующее число и всё, из чего оно сложилось.
 *
 * Итог здесь тот же, что в шапке «Игры», и это не два числа, а одно: считает его один код, и
 * разойтись им нечем — прежде здесь стояла собственная раскладка, и она с шапкой расходилась.
 */
function armorClassBlock(character: CharacterState): SheetBlockData {
  const sheet = Character.of(character).sheet;
  return {
    id: "armorClass",
    titleRu: "Класс Доспеха",
    edit: { block: "permanent" },
    rows: [
      { labelRu: "Итог", value: String(sheet.value("armorClass")) },
      ...breakdownRows(sheet, "armorClass"),
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
function maximumOrigin(character: CharacterState): string | null {
  const { maximumBase, bloodReduction, masterReduction } = character.hitPoints;
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
function abilityBlock(character: CharacterState, ability: Ability): SheetBlockData {
  const totals = Character.of(character).sheet;
  return {
    id: `ability:${ability}`,
    titleRu: ABILITY_LABELS[ability],
    edit: { block: "ability", ability },
    rows: [
      {
        labelRu: "Значение",
        value: `${totals.value(abilityStatId(ability))} (${signed(totals.abilityModifier(ability))})`,
      },
      {
        labelRu: "Спасбросок",
        value: signed(totals.value(saveStatId(ability))),
        ...(character.saveProficiencies.includes(ability) ? { hint: "владение" } : {}),
      },
      ...skillsOfAbility(ability).map((id) => {
        const training = character.skills[id];
        return {
          labelRu: SKILL_LABELS[id],
          value: signed(totals.value(skillStatId(id))),
          ...(training === undefined ? {} : { hint: TRAINING_LABELS[training] }),
        };
      }),
    ],
  };
}

export function sheetBlocks(character: CharacterState): SheetBlockData[] {
  const { hitPoints } = character;
  const maximumHint = maximumOrigin(character);

  return [
    {
      id: "identity",
      titleRu: "Кто он",
      edit: { block: "identity" },
      secondary: { labelRu: "Уровень", edit: { block: "level" } },
      rows: [
        { labelRu: "Имя", value: orDash(character.name) },
        { labelRu: "Вид", value: orDash(character.species) },
        { labelRu: "Возраст", value: orDash(character.age) },
        { labelRu: "Размер", value: SIZE_LABELS[character.size] },
        { labelRu: "Скорость", value: `${character.speed} футов` },
        { labelRu: "Класс", value: `${character.className}, ${character.level}` },
        { labelRu: "Подкласс", value: orDash(character.subclass) },
      ],
    },
    {
      id: "health",
      titleRu: "Здоровье",
      edit: { block: "health" },
      rows: [
        {
          labelRu: "Хиты",
          value: `${hitPoints.current} из ${Vitality.of(character).maximum}`,
          ...(character.temporaryHitPoints === 0
            ? {}
            : { hint: `${signed(character.temporaryHitPoints)} временных` }),
        },
        {
          labelRu: "Максимум",
          value: String(Vitality.of(character).maximum),
          ...(maximumHint === null ? {} : { hint: maximumHint }),
        },
        {
          labelRu: "Кости хитов",
          value:
            character.hitDice === undefined
              ? "—"
              : `${character.hitDice.remaining} из ${character.hitDice.total} по d${character.hitDice.size}`,
        },
      ],
    },
    armorClassBlock(character),
    {
      id: "marks",
      titleRu: "Отметки мастера",
      edit: { block: "marks" },
      rows: [
        {
          labelRu: "Истощение",
          value: character.exhaustion === 0 ? "нет" : `ступень ${character.exhaustion}`,
        },
        { labelRu: "Вдохновение", value: character.inspiration ? "есть" : "нет" },
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
      rows: character.permanentContributions.map(({ nameRu, contribution }) => ({
        labelRu: nameRu,
        value: contributionValue(contribution),
        hint: statLabel(contribution.stat),
      })),
    },
    ...ABILITIES.map((ability) => abilityBlock(character, ability)),
    {
      id: "proficiencies",
      titleRu: "Снаряжение и языки",
      edit: { block: "identity" },
      rows: [
        { labelRu: "Оружие", value: orDash(character.proficiencies.weapons.join(", ")) },
        { labelRu: "Доспехи", value: orDash(character.proficiencies.armor.join(", ")) },
        { labelRu: "Инструменты", value: orDash(character.proficiencies.tools.join(", ")) },
        { labelRu: "Языки", value: orDash(character.proficiencies.languages.join(", ")) },
      ],
    },
  ];
}
