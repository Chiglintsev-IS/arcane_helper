/**
 * Строки блоков листа. Чистые функции, а не разметка: состав листа проверяется без браузера, и
 * компонент остаётся тонким.
 *
 * Лист — только база персонажа: кто он, характеристики, здоровье, отметки мастера, владения.
 * Действующие числа боя живут в шапке «Игры», вещи и деньги — в «Сумке»: три экрана отвечают на
 * три разных вопроса, и дублирование чисел между ними заставляло бы сверять их взглядом.
 */

import { Character } from "@/core/domain/character/character";
import { ABILITIES, skillsOfAbility } from "@/core/domain/character/skills";
import type { Ability } from "@/core/domain/character/skills";
import type { CharacterState } from "@/core/domain/character/state";
import { Sheet } from "@/core/domain/sheet/sheet";
import { Vitality } from "@/core/domain/vitality/vitality";
import {
  ABILITY_LABELS,
  DERIVED_LABELS,
  orDash,
  SIZE_LABELS,
  SKILL_LABELS,
  TRAINING_LABELS,
} from "@/ui/entities/character/lib/labels";
import { signed } from "@/core/shared/language";

export type SheetRow = { labelRu: string; value: string; hint?: string };

export type SheetBlockData = {
  id: string;
  titleRu: string;
  rows: SheetRow[];
  /** Какую шторку открывает «Править»: у блока характеристики она своя, а не общая. */
  editId: string;
  /** Вторая кнопка блока: у «Кто он» уровень правится отдельно — он тянет за собой ресурсы. */
  secondary?: { labelRu: string; editId: string };
};

const OVERRIDDEN_HINT = "введено руками";

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

/** Число со знаком показывают модификаторы; КС, КД и пороги — без него. */
const SIGNED_DERIVED = new Set(["spellAttackModifier", "initiative", "proficiencyBonus"]);

/**
 * Блок одной характеристики: значение с модификатором, спасбросок, её навыки.
 *
 * Так устроен бумажный лист, и по нему ищут глазами: «спасбросок Телосложения» находят под
 * Телосложением, а не в отдельном списке из шести строк, где рядом стоят чужие числа.
 */
function abilityBlock(character: CharacterState, ability: Ability): SheetBlockData {
  const sheet = Character.of(character).base;
  const totals = Sheet.of(character);
  return {
    id: `ability:${ability}`,
    titleRu: ABILITY_LABELS[ability],
    editId: `ability:${ability}`,
    rows: [
      {
        labelRu: "Значение",
        value: `${character.abilities[ability]} (${signed(sheet.modifier(ability))})`,
      },
      {
        labelRu: "Спасбросок",
        value: signed(totals.savingThrow(ability)),
        ...(character.saveProficiencies.includes(ability) ? { hint: "владение" } : {}),
      },
      ...skillsOfAbility(ability).map((id) => {
        const training = character.skills[id];
        return {
          labelRu: SKILL_LABELS[id],
          value: signed(totals.skill(id)),
          ...(training === undefined ? {} : { hint: TRAINING_LABELS[training] }),
        };
      }),
    ],
  };
}

export function sheetBlocks(character: CharacterState): SheetBlockData[] {
  const { hitPoints } = character;
  const maximumHint = maximumOrigin(character);
  /**
   * Перебитые мастером числа — под его отметками: постоянная поправка мастера того же рода, что
   * истощение и вдохновение. Не перебитое здесь не перечисляется — формула не отметка.
   */
  const overriddenNumbers: SheetRow[] = Sheet.of(character)
    .derived()
    .filter((number) => number.overridden)
    .map((number) => ({
      labelRu: DERIVED_LABELS[number.id],
      value: SIGNED_DERIVED.has(number.id) ? signed(number.value) : String(number.value),
      hint: OVERRIDDEN_HINT,
    }));

  return [
    {
      id: "identity",
      titleRu: "Кто он",
      editId: "identity",
      secondary: { labelRu: "Уровень", editId: "level" },
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
      editId: "health",
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
    {
      id: "marks",
      titleRu: "Отметки мастера",
      editId: "marks",
      secondary: { labelRu: "Перебивки", editId: "combatNumbers" },
      rows: [
        {
          labelRu: "Истощение",
          value: character.exhaustion === 0 ? "нет" : `ступень ${character.exhaustion}`,
        },
        { labelRu: "Вдохновение", value: character.inspiration ? "есть" : "нет" },
        ...overriddenNumbers,
      ],
    },
    /**
     * Прочие прибавки — свойство самого Торна: благословение, дар, обучение. Прибавка с вещью
     * правится у вещи в «Сумке», а этой карточке принадлежит вклад, у которого вещи нет.
     */
    {
      id: "miscBonuses",
      titleRu: "Прочие прибавки",
      editId: "miscBonuses",
      rows: [
        { labelRu: "К магии", value: signed(character.miscBonuses.spellcasting) },
        { labelRu: "К защите", value: signed(character.miscBonuses.armorClass) },
        { labelRu: "Ко всем спасброскам", value: signed(character.miscBonuses.savingThrows) },
      ],
    },
    ...ABILITIES.map((ability) => abilityBlock(character, ability)),
    {
      id: "proficiencies",
      titleRu: "Снаряжение и языки",
      editId: "identity",
      rows: [
        { labelRu: "Оружие", value: orDash(character.proficiencies.weapons.join(", ")) },
        { labelRu: "Доспехи", value: orDash(character.proficiencies.armor.join(", ")) },
        { labelRu: "Инструменты", value: orDash(character.proficiencies.tools.join(", ")) },
        { labelRu: "Языки", value: orDash(character.proficiencies.languages.join(", ")) },
      ],
    },
  ];
}
