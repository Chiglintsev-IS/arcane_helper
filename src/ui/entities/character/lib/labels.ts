/** Русские подписи листа. Домен отдаёт числа и идентификаторы — называет их экран. */

import type { DerivedId } from "@/core/domain/sheet/derived";
import type { Ability, SkillId } from "@/core/domain/character/skills";
import type { CreatureSize, Currency, ItemKind } from "@/core/domain/character/state";
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

export const DERIVED_LABELS: Record<DerivedId, string> = {
  proficiencyBonus: "Бонус мастерства",
  spellSaveDc: "КС спасброска",
  spellAttackModifier: "Атака заклинанием",
  preparedLimit: "Лимит подготовки",
  initiative: "Инициатива",
  passivePerception: "Пассивное восприятие",
};

export const SIZE_LABELS: Record<CreatureSize, string> = {
  tiny: "Крошечный",
  small: "Маленький",
  medium: "Средний",
  large: "Большой",
  huge: "Огромный",
  gargantuan: "Громадный",
};

export const TRAINING_LABELS = { proficient: "владение", expert: "компетентность" } as const;

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
