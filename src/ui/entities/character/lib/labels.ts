/** Русские подписи листа. Домен отдаёт числа и идентификаторы — называет их экран. */

import type { StatChoiceView } from "@/contract/views";
import { CURRENCY_ABBREVIATIONS } from "@/shared/language";

const ABILITY_LABELS: Readonly<Record<string, string>> = {
  strength: "Сила",
  dexterity: "Ловкость",
  constitution: "Телосложение",
  intelligence: "Интеллект",
  wisdom: "Мудрость",
  charisma: "Харизма",
};

const SKILL_LABELS: Readonly<Record<string, string>> = {
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
] as const;

export const DERIVED_LABELS: Record<(typeof DERIVED_STAT_IDS)[number], string> = {
  proficiencyBonus: "Бонус мастерства",
  spellSaveDc: "КС спасброска",
  spellAttackModifier: "Атака заклинанием",
  preparedLimit: "Лимит подготовки",
  initiative: "Инициатива",
  passivePerception: "Пассивное восприятие",
};

/** Величины, у которых имя ничем не уточняется: подпись у каждой своя. */
const SINGULAR_STAT_IDS = [...DERIVED_STAT_IDS, "armorClass", "speed"] as const;

const SINGULAR_STAT_LABELS: Record<(typeof SINGULAR_STAT_IDS)[number], string> = {
  ...DERIVED_LABELS,
  armorClass: "Класс Доспеха",
  speed: "Скорость",
};

/**
 * Подпись по слову правил.
 *
 * Слово приезжает проекцией строкой, поэтому подпись ищется, а не берётся ключом: словарь подписей
 * — выбор слов, а список слов принадлежит правилам, и второй его копии здесь нет. Незнакомое слово
 * показывается как есть: пропасть с экрана молча оно не вправе.
 */
function labelOf(labels: Readonly<Record<string, string>>, word: string): string {
  return labels[word] ?? word;
}

export function abilityLabel(ability: string): string {
  return labelOf(ABILITY_LABELS, ability);
}

export function skillLabel(skill: string): string {
  return labelOf(SKILL_LABELS, skill);
}

export function sizeLabel(size: string): string {
  return labelOf(SIZE_LABELS, size);
}

export function trainingLabel(training: string): string {
  return labelOf(TRAINING_LABELS, training);
}

export function currencyLabel(currency: string): string {
  return labelOf(CURRENCY_LABELS, currency);
}

export function currencyAbbr(currency: string): string {
  return labelOf(CURRENCY_ABBREVIATIONS, currency);
}

export function itemKindLabel(kind: string): string {
  return labelOf(ITEM_KIND_LABELS, kind);
}

export function armorCategoryLabel(category: string): string {
  return labelOf(ARMOR_CATEGORY_LABELS, category);
}

/**
 * Подпись величины: ею называют строку разбора — «откуда взялось это число».
 *
 * Имя величины составное, и разбирает его не подпись: разбор приезжает перечнем от того, кто имя и
 * составил. Своё знание о форме имени разошлось бы с составителем при первой же её правке — молча, и
 * сразу у восемнадцати навыков.
 */
export function statLabel(stats: readonly StatChoiceView[], stat: string): string {
  const named = stats.find((candidate) => candidate.id === stat);
  if (named?.of === undefined) return labelOf(SINGULAR_STAT_LABELS, stat);
  if (named.kind === "save") return `Спасбросок: ${abilityLabel(named.of)}`;
  if (named.kind === "skill") return skillLabel(named.of);
  return abilityLabel(named.of);
}

/** Имя особенности волшебника: его называет и своя шторка, и привал, и предпросмотр смены уровня. */
export const ARCANE_RECOVERY_LABEL = "Магическое восстановление";

const SIZE_LABELS: Readonly<Record<string, string>> = {
  tiny: "Крошечный",
  small: "Маленький",
  medium: "Средний",
  large: "Большой",
  huge: "Огромный",
  gargantuan: "Громадный",
};

const TRAINING_LABELS: Readonly<Record<string, string>> = {
  proficient: "владение",
  expert: "компетентность",
};

/** Род доспеха и род вещи словами: перечень приезжает от правил, слово к слову — здесь. */
const ARMOR_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  light: "Лёгкий",
  medium: "Средний",
  heavy: "Тяжёлый",
};

const ITEM_KIND_LABELS: Readonly<Record<string, string>> = {
  gear: "Экипировка",
  consumable: "Расходник",
  ingredient: "Ингредиент",
  other: "Другое",
};

/** Полные имена монет — для полей правки кошелька. */
const CURRENCY_LABELS: Readonly<Record<string, string>> = {
  gold: "Золото",
  silver: "Серебро",
  copper: "Медь",
};

/** Пустое справочное поле — прочерк: ноль здесь читался бы как настоящий ноль. */
export function orDash(value: string | number): string {
  return value === "" || value === 0 ? "—" : String(value);
}
