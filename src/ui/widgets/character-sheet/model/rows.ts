/**
 * Строки блоков листа. Чистые функции, а не разметка: состав листа проверяется без браузера, и
 * компонент остаётся тонким.
 */

import { Character } from "@/core/domain/character/character";
import { ABILITIES, skillsOfAbility } from "@/core/domain/character/skills";
import type { Ability } from "@/core/domain/character/skills";
import type { CharacterState, ItemBonuses } from "@/core/domain/character/state";
import { effectiveArmorClass } from "@/core/domain/effects/armorClass";
import { Sheet } from "@/core/domain/sheet/sheet";
import { Vitality } from "@/core/domain/vitality/vitality";
import {
  ABILITY_LABELS,
  DERIVED_LABELS,
  orDash,
  signed,
  SIZE_LABELS,
  SKILL_LABELS,
  TRAINING_LABELS,
} from "@/ui/entities/character/lib/labels";

export type SheetRow = { labelRu: string; value: string; hint?: string };

/** Вклад вещи словами: нулевое слагаемое не называется, иначе верёвка выглядит участницей счёта. */
function bonusParts(bonuses: ItemBonuses | undefined): string[] {
  if (bonuses === undefined) return [];
  return [
    bonuses.spellcasting === 0 ? null : `магия ${signed(bonuses.spellcasting)}`,
    bonuses.armorClass === 0 ? null : `защита ${signed(bonuses.armorClass)}`,
    bonuses.savingThrows === 0 ? null : `спасброски ${signed(bonuses.savingThrows)}`,
  ].filter((part) => part !== null);
}

/**
 * Вкладки листа. Лист — итог, и первая вкладка так и называется: она складывает базу персонажа,
 * вещи и вмешательство мастера. Остальные три показывают слагаемые порознь, чтобы правка знала,
 * куда идти: характеристику правят у персонажа, кольцо — в инвентаре.
 */
export const SHEET_TABS = ["total", "character", "equipment", "inventory"] as const;

export type SheetTab = (typeof SHEET_TABS)[number];

export type SheetBlockData = {
  id: string;
  tab: SheetTab;
  titleRu: string;
  rows: SheetRow[];
  /** Блок без правки — тот, чьи числа считаются целиком из соседних блоков. */
  editable: boolean;
  /** Какую шторку открывает «Править»: у блока характеристики она своя, а не общая. */
  editId: string;
  /** Вторая кнопка блока: у «Кто он» уровень правится отдельно — он тянет за собой ресурсы. */
  secondary?: { labelRu: string; editId: string };
};

const OVERRIDDEN_HINT = "введено руками";

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
    tab: "character",
    titleRu: ABILITY_LABELS[ability],
    editable: true,
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
  const totals = Sheet.of(character);
  const { hitPoints } = character;

  const combatNumbers: SheetRow[] = totals.derived().map((number) => ({
    labelRu: DERIVED_LABELS[number.id],
    value: SIGNED_DERIVED.has(number.id) ? signed(number.value) : String(number.value),
    ...(number.overridden ? { hint: OVERRIDDEN_HINT } : {}),
  }));
  combatNumbers.push({ labelRu: "Класс Доспеха", value: String(effectiveArmorClass(character)) });

  return [
    {
      id: "identity",
      tab: "character",
      titleRu: "Кто он",
      editable: true,
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
      id: "combatNumbers",
      tab: "total",
      titleRu: "Числа боя",
      editable: true,
      editId: "combatNumbers",
      rows: combatNumbers,
    },
    {
      id: "health",
      tab: "total",
      titleRu: "Здоровье",
      editable: true,
      editId: "health",
      rows: [
        { labelRu: "Базовый максимум", value: String(hitPoints.maximumBase) },
        { labelRu: "Снижение кровью", value: String(hitPoints.bloodReduction) },
        { labelRu: "Снижение мастера", value: String(hitPoints.masterReduction) },
        { labelRu: "Действующий максимум", value: String(Vitality.of(character).maximum) },
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
      tab: "total",
      titleRu: "Отметки мастера",
      editable: true,
      editId: "marks",
      rows: [
        {
          labelRu: "Истощение",
          value: character.exhaustion === 0 ? "нет" : `ступень ${character.exhaustion}`,
        },
        { labelRu: "Вдохновение", value: character.inspiration ? "есть" : "нет" },
      ],
    },
    ...ABILITIES.map((ability) => abilityBlock(character, ability)),
    {
      id: "armorClassBase",
      tab: "equipment",
      titleRu: "Доспех",
      editable: true,
      editId: "armorClassBase",
      rows: [{ labelRu: "База Класса Доспеха", value: String(character.equipment.armorClassBase) }],
    },
    {
      id: "itemBonuses",
      tab: "equipment",
      titleRu: "Прибавки без вещи",
      editable: true,
      editId: "itemBonuses",
      rows: [
        { labelRu: "К магии", value: signed(character.equipment.otherBonuses.spellcasting) },
        { labelRu: "К защите", value: signed(character.equipment.otherBonuses.armorClass) },
        { labelRu: "Ко всем спасброскам", value: signed(character.equipment.otherBonuses.savingThrows) },
      ],
    },
    {
      id: "inventory",
      tab: "inventory",
      titleRu: "Вещи",
      editable: true,
      editId: "inventory",
      rows:
        character.equipment.items.length === 0
          ? [{ labelRu: "Пусто", value: "—" }]
          : character.equipment.items.map((item) => {
              const hint = [
                ...bonusParts(item.bonuses),
                ...(item.note === undefined ? [] : [item.note]),
              ].join(", ");
              return {
                labelRu: item.nameRu,
                value: item.worn ? "надето" : "в сумке",
                ...(hint === "" ? {} : { hint }),
              };
            }),
    },
    {
      id: "proficiencies",
      tab: "character",
      titleRu: "Снаряжение и языки",
      editable: true,
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
