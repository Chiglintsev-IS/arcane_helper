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
  arcana: "Аркана",
  athletics: "Атлетика",
  deception: "Обман",
  history: "История",
  insight: "Проницательность",
  intimidation: "Запугивание",
  investigation: "Анализ",
  medicine: "Медицина",
  nature: "Природа",
  perception: "Внимательность",
  performance: "Выступление",
  persuasion: "Убеждение",
  religion: "Религия",
  sleightOfHand: "Ловкость рук",
  stealth: "Скрытность",
  survival: "Выживание",
};

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
  passivePerception: "Пассивная внимательность",
};

export const SHEET_FIELD_LABELS = {
  speed: "Скорость",
  size: "Размер",
} as const;

const SINGULAR_STAT_IDS = [...DERIVED_STAT_IDS, "armorClass", "speed"] as const;

const SINGULAR_STAT_LABELS: Record<(typeof SINGULAR_STAT_IDS)[number], string> = {
  ...DERIVED_LABELS,
  armorClass: "Класс Доспеха",
  speed: SHEET_FIELD_LABELS.speed,
};

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

export function trainingGlyph(training: string): string {
  return labelOf(TRAINING_GLYPHS, training);
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

export function statLabel(stats: readonly StatChoiceView[], stat: string): string {
  const named = stats.find((candidate) => candidate.id === stat);
  if (named?.of === undefined) return labelOf(SINGULAR_STAT_LABELS, stat);
  if (named.kind === "save") return `${SAVE_LABEL}: ${abilityLabel(named.of)}`;
  if (named.kind === "skill") return skillLabel(named.of);
  return abilityLabel(named.of);
}

export const SAVE_LABEL = "Спасбросок";
export const SAVE_ABBR = "спас";

const STAT_FAMILY_LABELS: Readonly<Record<string, string>> = {
  saves: "Все спасброски",
};

export function statFamilyLabel(family: string): string {
  return labelOf(STAT_FAMILY_LABELS, family);
}

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

const TRAINING_GLYPHS: Readonly<Record<string, string>> = {
  proficient: "●",
  expert: "◆",
};

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

const CURRENCY_LABELS: Readonly<Record<string, string>> = {
  gold: "Золото",
  silver: "Серебро",
  copper: "Медь",
};

export const DASH = "—";

export function orDash(value: string | number): string {
  return value === "" || value === 0 ? DASH : String(value);
}
