/**
 * Проекции: посчитанное, каким его показывают.
 *
 * Разница со снимком состояния — в том, кто считал. Здесь уже нет ни ячеек, из которых выводят
 * остаток, ни вкладов, которые надо сложить: числа сложены владельцами правил, и читающей стороне
 * остаётся выбрать слова и порядок. Пока проекция не покрыла экран, тот считает сам — временно и
 * видимо, а не тайно.
 *
 * Слов правил здесь нет перечислениями: имена характеристик, навыков, размеров, величин и родов
 * вклада приходят строками. Перечень был бы вторым списком тех же слов и разъехался бы с первым на
 * первой же правке правил, а подпись к слову — дело показывающего.
 */

import { z } from "zod";

/** Слово правил: договор ручается за непустую строку, за смысл — владелец списка. */
const word = z.string().min(1);

/** Справочное поле бывает пустым: незаполненное имя — не ошибка, а прочерк на экране. */
const text = z.string();

const whole = z.number().int();

/**
 * Вклад так, как его показывают: чей он, чем двигает число и на сколько.
 *
 * Кем вклад отвергнут, здесь не бывает: «кольчуга победила „Доспехи мага“» — ответ на вопрос,
 * которого за столом не задают.
 */
export const contributionViewSchema = z.object({
  nameRu: word,
  /** Род вклада: способ счёта, прибавка или назначение. */
  kind: word,
  value: whole,
});

/** Величина вместе с разбором: итог и то, из чего он сложился. */
export const statViewSchema = z.object({
  value: whole,
  parts: z.array(contributionViewSchema),
});

const skillViewSchema = z.object({
  id: word,
  value: whole,
  /** Степень владения; нет вовсе — навык не тренирован. */
  training: word.optional(),
});

/**
 * Характеристика со всем, что от неё считается: сама она, её модификатор, спасбросок и её навыки.
 *
 * Одной записью, а не четырьмя словарями: так устроен бумажный лист, и так по нему ищут глазами.
 */
const abilityViewSchema = z.object({
  id: word,
  score: whole,
  modifier: whole,
  save: whole,
  saveProficient: z.boolean(),
  skills: z.array(skillViewSchema),
});

const hitPointsViewSchema = z.object({
  current: whole,
  /** Действующий максимум: то, во что упирается лечение. */
  maximum: whole,
  maximumBase: whole,
  bloodReduction: whole,
  masterReduction: whole,
  temporary: whole,
  /** Костей хитов может не быть вовсе: состояние приехало из чужой сборки. */
  hitDice: z.object({ remaining: whole, total: whole, size: whole }).optional(),
});

/**
 * Лист персонажа: база, отметки мастера и всё, что из них следует.
 *
 * Действующих чисел боя здесь нет — ячеек, рун, очков, эффектов: у них своя проекция, потому что
 * меняются они каждый ход, а лист за сессию почти не двигается.
 */
export const sheetViewSchema = z.object({
  name: text,
  species: text,
  age: whole,
  size: word,
  speed: whole,
  className: text,
  level: whole,
  subclass: text,

  hitPoints: hitPointsViewSchema,
  armorClass: statViewSchema,

  exhaustion: whole,
  inspiration: z.boolean(),

  /** Постоянные вклады — свойства самого персонажа: раса, дар, благословение, слово мастера. */
  permanentContributions: z.array(contributionViewSchema.extend({ stat: word })),

  abilities: z.array(abilityViewSchema),

  proficiencies: z.object({
    weapons: z.array(word),
    armor: z.array(word),
    tools: z.array(word),
    languages: z.array(word),
  }),
});

export type ContributionView = z.infer<typeof contributionViewSchema>;
export type StatView = z.infer<typeof statViewSchema>;
export type AbilityView = z.infer<typeof abilityViewSchema>;
export type SheetView = z.infer<typeof sheetViewSchema>;
