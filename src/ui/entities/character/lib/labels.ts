/** Русские подписи листа. Домен отдаёт числа и идентификаторы — называет их экран. */

import {
  ABILITIES,
  SKILL_IDS,
  abilityStatId,
  saveStatId,
  skillStatId,
  type Ability,
  type ArmorCategory,
  type SkillId,
  type StatId,
} from "@/core/domain/shared/stats";
import type { CreatureSize } from "@/core/domain/character/schema";
import type { Currency } from "@/core/domain/equipment/schema";
import type { ItemKind } from "@/core/domain/items/schema";
import { CURRENCY_ABBREVIATIONS } from "@/core/shared/language";

export const ABILITY_LABELS: Record<Ability, string> = {
  strength: "Сила",
  dexterity: "Ловкость",
  constitution: "Телосложение",
  intelligence: "Интеллект",
  wisdom: "Мудрость",
  charisma: "Харизма",
};

export const SKILL_LABELS: Record<SkillId, string> = {
  acrobatics: "Акробатика",
  animalHandling: "Уход за животными",
  arcana: "Магия",
  athletics: "Атлетика",
  deception: "Обман",
  history: "История",
  insight: "Проницательность",
  intimidation: "Запугивание",
  investigation: "Расследование",
  medicine: "Медицина",
  nature: "Природа",
  perception: "Восприятие",
  performance: "Выступление",
  persuasion: "Убеждение",
  religion: "Религия",
  sleightOfHand: "Ловкость рук",
  stealth: "Скрытность",
  survival: "Выживание",
};

/** Величины, которые лист показывает отдельной строкой, — в порядке этой строки. */
export const DERIVED_STAT_IDS = [
  "proficiencyBonus",
  "spellSaveDc",
  "spellAttackModifier",
  "preparedLimit",
  "initiative",
  "passivePerception",
] as const satisfies readonly StatId[];

export const DERIVED_LABELS: Record<(typeof DERIVED_STAT_IDS)[number], string> = {
  proficiencyBonus: "Бонус мастерства",
  spellSaveDc: "КС спасброска",
  spellAttackModifier: "Атака заклинанием",
  preparedLimit: "Лимит подготовки",
  initiative: "Инициатива",
  passivePerception: "Пассивное восприятие",
};

/** Величины, у которых имя ничем не уточняется: подпись у каждой своя. */
const SINGULAR_STAT_IDS = [
  ...DERIVED_STAT_IDS,
  "armorClass",
  "speed",
] as const satisfies readonly StatId[];

const SINGULAR_STAT_LABELS: Record<(typeof SINGULAR_STAT_IDS)[number], string> = {
  ...DERIVED_LABELS,
  armorClass: "Класс Доспеха",
  speed: "Скорость",
};

/** Подпись величины: ею называют строку разбора — «откуда взялось это число». */
export function statLabel(stat: StatId): string {
  for (const id of SINGULAR_STAT_IDS) {
    if (stat === id) return SINGULAR_STAT_LABELS[id];
  }
  for (const ability of ABILITIES) {
    if (stat === abilityStatId(ability)) return ABILITY_LABELS[ability];
    if (stat === saveStatId(ability)) return `Спасбросок: ${ABILITY_LABELS[ability]}`;
  }
  for (const skill of SKILL_IDS) {
    if (stat === skillStatId(skill)) return SKILL_LABELS[skill];
  }
  return stat;
}

/** Имя особенности волшебника: его называет и своя шторка, и привал, и предпросмотр смены уровня. */
export const ARCANE_RECOVERY_LABEL = "Магическое восстановление";

export const SIZE_LABELS: Record<CreatureSize, string> = {
  tiny: "Крошечный",
  small: "Маленький",
  medium: "Средний",
  large: "Большой",
  huge: "Огромный",
  gargantuan: "Громадный",
};

export const TRAINING_LABELS = { proficient: "владение", expert: "компетентность" } as const;

/** Ярлыки прибавок: их называют и лист, и шторка вещи, и шторка прочих прибавок. */
export const ARMOR_CATEGORY_LABELS: Record<ArmorCategory, string> = {
  light: "Лёгкий",
  medium: "Средний",
  heavy: "Тяжёлый",
};

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  gear: "Экипировка",
  consumable: "Расходник",
  ingredient: "Ингредиент",
  other: "Другое",
};

/** Полные имена монет — для полей правки кошелька. */
export const CURRENCY_LABELS: Record<Currency, string> = {
  gold: "Золото",
  silver: "Серебро",
  copper: "Медь",
};

/** Сокращения монет — для значков и цены: «50 зм» произносится, полное имя — нет. */
export const CURRENCY_ABBR: Record<Currency, string> = CURRENCY_ABBREVIATIONS;

/** Пустое справочное поле — прочерк: ноль здесь читался бы как настоящий ноль. */
export function orDash(value: string | number): string {
  return value === "" || value === 0 ? "—" : String(value);
}
