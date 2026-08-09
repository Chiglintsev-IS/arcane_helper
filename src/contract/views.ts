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
  /** Насколько максимум ниже базового: за столом важен разрыв, а не то, чем он вызван. */
  maximumReduction: whole,
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

/**
 * Вещь так, как её показывает список сумки: чем она является и сколько её у персонажа.
 *
 * Прибавки едут теми, что действуют: чьей категории они не положены, у того их не бывает вовсе —
 * это решает владелец вещи при записи, и второй такой проверки на экране не заводится.
 */
const itemViewSchema = z.object({
  id: word,
  nameRu: word,
  kind: word,
  bagCount: whole,
  wornCount: whole,
  price: z.object({ amount: whole, currency: word }).optional(),
  bonuses: z.array(z.object({ stat: word, value: whole })),
  note: text.optional(),
});

/**
 * Сумка: деньги, вещи и защита.
 *
 * Класс Доспеха стоит здесь потому, что здесь его и меняют — надевая и снимая. Число то же, что на
 * листе и в шапке «Игры»: считает его один код, и разойтись им нечем.
 */
export const bagViewSchema = z.object({
  /** Все монеты стола в порядке достоинства: исчезнувший ноль заставляет гадать, где он. */
  money: z.array(z.object({ currency: word, amount: whole })),
  items: z.array(itemViewSchema),
  armorClass: z.object({
    value: whole,
    /** Доспех, по которому считается защита; нет вовсе — доспеха на персонаже нет. */
    wornArmorNameRu: word.optional(),
  }),
});

/**
 * Действующие числа боя: чем платить и что мешает прямо сейчас.
 *
 * Отдельно от листа, потому что двигаются они каждый ход, а лист за сессию почти не меняется.
 * Хиты и Класс Доспеха сюда не повторяются: их считает лист, и второе такое же число разошлось бы
 * с первым молча.
 */
export const resourcesViewSchema = z.object({
  /** Ячейки по возрастанию уровня: порядок принадлежит правилам, а не порядку ключей состояния. */
  slots: z.array(z.object({ level: whole, remaining: whole, maximum: whole })),
  runes: z.object({ remaining: whole, maximum: whole }),
  spellPoints: whole,
  /** Ручная поправка Класса Доспеха: правится там же, где видна. */
  armorClassAdjustment: whole,
  passivePerception: whole,
  initiative: whole,
  /** Чем подавлены особенности вида: приложение это показывает, а решает мастер. */
  suppression: z.object({ firedUpon: z.boolean(), underDirectSunlight: z.boolean() }),
});

/**
 * Экономия хода: что осталось потратить и на каком раунде это происходит.
 *
 * Вне боя ходов нет, и правила отвечают «всё доступно» независимо от журнала — признак схватки
 * поэтому едет рядом, а не выводится показывающим из номера раунда.
 */
export const turnViewSchema = z.object({
  round: whole,
  inFight: z.boolean(),
  actionAvailable: z.boolean(),
  bonusActionAvailable: z.boolean(),
  reactionAvailable: z.boolean(),
});

/**
 * Строка списка заклинаний: карточка вместе с тем, чем она является для этого персонажа сейчас.
 *
 * Числа подставлены под него, а не взяты из книги: 2d8 у заговора — это его уровень. Подписи здесь
 * нет ни одной: род броска, роль и время накладывания едут словами правил, а слово, падеж и порядок
 * значков выбирает показывающий.
 */
export const spellRowViewSchema = z.object({
  id: word,
  nameRu: word,
  shortRulesRu: word,
  level: whole,
  castingTime: z.object({ type: word, value: whole.optional() }),
  range: z.object({ type: word, distanceFeet: whole.optional() }),
  area: z.object({ shape: word, sizeFeet: whole }).optional(),
  duration: z.object({ type: word, value: whole.optional() }),
  /** Что бросают: род броска и характеристика спасброска, если он есть. */
  resolution: z.object({ type: word, savingThrow: word.optional() }),
  concentration: z.boolean(),
  ritual: z.boolean(),
  /** Роль в бою: чем бить, чем закрыться, всё прочее. */
  role: word,

  /** Цена в ячейках прямо сейчас: 0 — ячейка не нужна. Ею упорядочен список и отобрана цена. */
  slotPrice: whole,
  /** Даст ли ячейка повыше больше, чем своя. */
  benefitsFromHigherSlot: z.boolean(),
  /** Творится ли ритуалом прямо сейчас: в бою ритуального способа нет вовсе. */
  ritualAvailable: z.boolean(),
  /** Готово к сотворению без подготовки: заговоры — всегда, прочее — по книге. */
  prepared: z.boolean(),
  /** Применимо ли в этой обстановке вообще: этим и отобран боевой список. */
  castableNow: z.boolean(),
  /** Первая причина, по которой сейчас нельзя; нет вовсе — можно. */
  unavailableReason: word.optional(),
  /** Эффект этого заклинания уже висит: строка не претендует на внимание, но из списка не уходит. */
  active: z.boolean(),
  /** Урон с учётом уровня персонажа: формула и её род. */
  damage: z.object({ formula: word, type: word }).optional(),
});

/**
 * Проверка концентрации, которой ответил последний урон.
 *
 * Вердикт едет перечислением, а не выводится из чисел показывающим: «не проходит даже 20» — вывод
 * из граней кости и порога, а не из вёрстки, и повторить его на экране значило бы завести второе
 * правило о том же.
 */
export const concentrationCheckViewSchema = z.object({
  dc: whole,
  modifier: whole,
  hasAdvantage: z.boolean(),
  /** Наименьший результат кости, который проходит. */
  minimumRoll: whole,
  /** Чем решается: любым броском, никаким или начиная с наименьшего. */
  outcome: word,
});

/**
 * Концентрация так, как её показывают: что держится, с какого раунда и чем срывается.
 *
 * Досягаемости и рода броска здесь нет: они у строки того же заклинания, и повторить их значило бы
 * прислать одно и то же дважды. Урон — есть: он посчитан по потраченной ячейке, а строка называет
 * цену собственного уровня.
 */
export const concentrationViewSchema = z.object({
  /** Чем держится; нет вовсе — карточки в контенте нет, и вести за правилами некуда. */
  spellId: word.optional(),
  nameRu: word,
  /** Ячейка, которой сотворено; 0 — ячейка не тратилась. */
  slotLevelUsed: whole,
  startedOnRound: whole,
  /** Начало вытеснено из обрезанного журнала: раунд — нижняя граница, а не точное число. */
  startApproximate: z.boolean(),
  durationRu: word,
  shortRulesRu: word,
  /** Урон с учётом потраченной ячейки. */
  damage: z.object({ formula: word, type: word }).optional(),
  /** Спасбросок Телосложения — единственный вид проверки концентрации. */
  save: whole,
  /** Ниже этой сложности проверка концентрации не бывает. */
  minimumDc: whole,
  /** Что требует последний полученный урон; нет вовсе — отвечать не на что. */
  checkAfterDamage: concentrationCheckViewSchema.optional(),
});

/**
 * Числа заклинателя: то, чем он колдует вообще, а не этим заклинанием.
 *
 * Стоят раз на персонажа, а не при каждой строке: от заклинания они не зависят, и повторить их в
 * каждой строке значило бы сорок раз прислать одно число.
 */
export const castingViewSchema = z.object({
  spellAttackModifier: whole,
  spellSaveDc: whole,
  /** Сколько заклинаний он вправе держать подготовленными и сколько держит. */
  preparedLimit: whole,
  preparedCount: whole,
});

export type ContributionView = z.infer<typeof contributionViewSchema>;
export type ConcentrationCheckView = z.infer<typeof concentrationCheckViewSchema>;
export type ConcentrationView = z.infer<typeof concentrationViewSchema>;
export type ResourcesView = z.infer<typeof resourcesViewSchema>;
export type TurnView = z.infer<typeof turnViewSchema>;
export type SpellRowView = z.infer<typeof spellRowViewSchema>;
export type CastingView = z.infer<typeof castingViewSchema>;
export type ItemView = z.infer<typeof itemViewSchema>;
export type BagView = z.infer<typeof bagViewSchema>;
export type StatView = z.infer<typeof statViewSchema>;
export type AbilityView = z.infer<typeof abilityViewSchema>;
export type SheetView = z.infer<typeof sheetViewSchema>;
