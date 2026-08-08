/**
 * Словарь величин и форма вклада в них.
 *
 * Знают его все контексты, он не знает никого — как словарь монет и по той же причине: имя, которым
 * контексты называют друг другу предмет разговора, не принадлежит ни одному из них. Снаряжение,
 * каталог и эффекты называют цель вклада, не заглядывая в лист; лист складывает принесённое, не
 * спрашивая, кто прислал.
 *
 * Отправителя в форме вклада нет вовсе: заклинание, зелье и слово мастера приходят неразличимыми, и
 * счёт от происхождения не зависит. Кто прислал — знает тот, кто показывает разбор, и узнаёт это не
 * из вклада, а из пары «источник и вклад».
 */

import { z } from "zod";

export const ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

export type Ability = (typeof ABILITIES)[number];

export const SKILL_IDS = [
  "acrobatics",
  "animalHandling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleightOfHand",
  "stealth",
  "survival",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

/** Величины, имя которых ничем не уточняется: их по одной штуке на персонажа. */
const SINGULAR_STAT_IDS = [
  "armorClass",
  "spellSaveDc",
  "spellAttackModifier",
  "initiative",
  "passivePerception",
  "preparedLimit",
  "proficiencyBonus",
  "speed",
] as const;

type AbilityStatId = `ability:${Ability}`;
type SaveStatId = `save:${Ability}`;
type SkillStatId = `skill:${SkillId}`;

export type StatId =
  | (typeof SINGULAR_STAT_IDS)[number]
  | AbilityStatId
  | SaveStatId
  | SkillStatId;

/** Имя величины характеристики: само значение, а не её модификатор. */
export function abilityStatId(ability: Ability): AbilityStatId {
  return `ability:${ability}`;
}

export function saveStatId(ability: Ability): SaveStatId {
  return `save:${ability}`;
}

export function skillStatId(skill: SkillId): SkillStatId {
  return `skill:${skill}`;
}

export const STAT_IDS: readonly StatId[] = [
  ...SINGULAR_STAT_IDS,
  ...ABILITIES.map(abilityStatId),
  ...ABILITIES.map(saveStatId),
  ...SKILL_IDS.map(skillStatId),
];

export function isStatId(value: string): value is StatId {
  return STAT_IDS.some((id) => id === value);
}

/**
 * Категории доспеха — слово, которым вещь называет свою природу.
 *
 * Стоит рядом с величинами, а не у формулы: предел Ловкости по категории считает владелец Класса
 * Доспеха, а кольчуга обязана уметь сказать, что она тяжёлая, не зная про этот предел ничего.
 */
export const ARMOR_CATEGORIES = ["light", "medium", "heavy"] as const;

export type ArmorCategory = (typeof ARMOR_CATEGORIES)[number];

/**
 * Способ счёта, принесённый снаружи: род и факты, которыми владелец величины достраивает формулу.
 *
 * Род нужен для применимости: «Доспехи мага» действуют, пока не принесён способ от доспеха, и это
 * видно по составу принесённого, а не запросом чужого состояния.
 */
export type StatMethod =
  | {
      readonly family: "armor";
      readonly base: number;
      /** Не названа — предела нет: находка без опознанной категории Ловкость не режет. */
      readonly category?: ArmorCategory | undefined;
    }
  | { readonly family: "spell"; readonly base: number };

/**
 * Три вида вклада, и других не бывает: способ счёта соперничает с другими способами, прибавка
 * складывается с прибавками, назначение побеждает всё.
 */
export type StatContribution =
  | { readonly stat: StatId; readonly kind: "method"; readonly method: StatMethod }
  | { readonly stat: StatId; readonly kind: "bonus"; readonly value: number }
  | { readonly stat: StatId; readonly kind: "assignment"; readonly value: number };

/**
 * Откуда вклад пришёл — то, что показывают в разборе.
 *
 * Стоит рядом со вкладом, а не внутри него: счёт источника не читает вовсе, а вопрос «почему число
 * такое» без него не отвечается. Родов три — надетое, действующее и постоянное свойство персонажа;
 * заклинание и зелье среди действующего неразличимы, потому что для счёта они и есть одно.
 * Название — то, чем игрок вещь или заклинание назвал; подпись из него строит отображение.
 */
export type ContributionSource = {
  readonly origin: "item" | "effect" | "permanent";
  readonly nameRu: string;
};

/** Пара, которой контексты отвечают листу: чей вклад и какой. */
export type SourcedContribution = {
  readonly source: ContributionSource;
  readonly contribution: StatContribution;
};

/** Прибавки вещи и персонажа: величина и число. Ноль не хранится — он ни на что не влияет. */
export const statBonusesSchema = z.partialRecord(z.enum(STAT_IDS), z.number().int());

const statId = z.enum(STAT_IDS, { error: "Такой величины не бывает" });

const statMethodSchema = z.discriminatedUnion("family", [
  z.object({
    family: z.literal("armor"),
    base: z.number().int().positive(),
    category: z.enum(ARMOR_CATEGORIES).optional(),
  }),
  z.object({ family: z.literal("spell"), base: z.number().int().positive() }),
]);

export const statContributionSchema = z.discriminatedUnion("kind", [
  z.object({ stat: statId, kind: z.literal("method"), method: statMethodSchema }),
  z.object({ stat: statId, kind: z.literal("bonus"), value: z.number().int() }),
  z.object({ stat: statId, kind: z.literal("assignment"), value: z.number().int() }),
]);
