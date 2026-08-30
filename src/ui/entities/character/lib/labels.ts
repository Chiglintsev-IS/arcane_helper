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
  spellSaveDc: "Сложность спасброска врага",
  spellAttackModifier: "Попадание заклинанием",
  preparedLimit: "Заклинаний в подготовке",
  initiative: "Инициатива",
  passivePerception: "Пассивная внимательность",
};

/** Что величина значит за столом: имя правил само за себя не говорит. */
const SINGULAR_STAT_HINTS: Record<(typeof SINGULAR_STAT_IDS)[number], string> = {
  proficiencyBonus: "прибавка там, где есть владение",
  spellSaveDc: "выше — врагу труднее спастись от вашего заклинания",
  spellAttackModifier: "прибавка к броску попадания, урона не трогает",
  preparedLimit: "сколько заклинаний готовите за день",
  initiative: "бросок на порядок хода",
  passivePerception: "замечаете без броска",
  armorClass: "во что труднее попасть",
  speed: "футов за ход",
};

export function statHint(stat: string): string | undefined {
  const hints: Readonly<Record<string, string>> = SINGULAR_STAT_HINTS;
  return hints[stat];
}

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

export function statKindLabel(kind: string): string {
  return labelOf(STAT_KIND_LABELS, kind);
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

const ITEM_KIND_LABELS: Readonly<Record<string, string>> = {
  gear: "Экипировка",
  consumable: "Расходник",
  ingredient: "Ингредиент",
};

const STAT_KIND_LABELS: Readonly<Record<string, string>> = {
  singular: "Числа листа",
  ability: "Характеристики",
  save: "Спасброски",
  skill: "Навыки",
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
