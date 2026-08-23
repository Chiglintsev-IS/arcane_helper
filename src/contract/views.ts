/**
 * Проекции: посчитанное, каким его показывают.
 *
 * Разница со снимком состояния — в том, кто считал. Здесь уже нет ни ячеек, из которых выводят
 * остаток, ни вкладов, которые надо сложить: числа сложены владельцами правил, и читающей стороне
 * остаётся выбрать слова и порядок. Пока проекция не покрыла экран, тот считает сам — временно и
 * видимо, а не тайно.
 *
 * Слов правил здесь нет перечислениями: имена характеристик, навыков, размеров, величин и родов
 * вклада приходят строками. Перечисление было бы вторым списком тех же слов и разъехалось бы с
 * первым на первой же правке правил, а подпись к слову — дело показывающего. Сам список при этом
 * ездит — данными, от владельца, там, где поле выбора предлагает из него выбрать.
 */

import { z } from "zod";

import { paymentSchema } from "./commands";

/** Слово правил: договор ручается за непустую строку, за смысл — владелец списка. */
const word = z.string().min(1);

/** Справочное поле бывает пустым: незаполненное имя — не ошибка, а прочерк на экране. */
const text = z.string();

const whole = z.number().int();

/**
 * Величина, названная вместе с разбором имени: чем она является и к чему относится.
 *
 * Разбор приезжает от того, кто имя составил. Разбирать `save:dexterity` на стороне показывающего
 * значило бы завести второе знание о форме имени, и оно разошлось бы с составителем молча.
 */
const statChoiceSchema = z.object({
  id: word,
  /** Сама по себе, характеристика, её спасбросок или навык. */
  kind: word,
  /** Характеристика или навык, к которым величина относится; нет вовсе — величина сама по себе. */
  of: word.optional(),
});

/**
 * Перечни выбора: закрытые списки правил, из которых игрок выбирает, и границы, в которых набирает.
 *
 * Состояния в них нет ни в одном: список того, что бывает, у персонажа не спрашивают. Едут они теми
 * же перечнями, которыми пользуются сами правила, — поэтому пополнение перечня доходит до поля
 * выбора без правок на другой стороне. Подписей здесь нет: выбор слова — дело показывающего.
 *
 * Границы стоят рядом с перечнями, потому что отвечают на тот же вопрос: что поле вправе предложить.
 * Показать предел — чтение, а не проверка; проверяет набранное владелец инварианта.
 */
export const choicesViewSchema = z.object({
  stats: z.array(statChoiceSchema),
  creatureSizes: z.array(word),
  itemKinds: z.array(word),
  armorCategories: z.array(word),
  currencies: z.array(word),
  /** Степени владения навыком; отсутствия владения в перечне нет — это снятая степень, а не третья. */
  skillTrainings: z.array(word),
  /** Кому руна: перечень тех, между кем выбирают, когда руна цель выбирает. */
  runeTargets: z.array(word),
  exhaustionSteps: z.array(whole),
  characterLevel: z.object({ minimum: whole, maximum: whole }),
  abilityScore: z.object({ minimum: whole, maximum: whole }),
  /** Направления алхимии и качества оснащения: из них собирают мастерскую. */
  alchemyDirections: z.array(word),
  apparatusGrades: z.array(word),
  /** Закрытый перечень свойств с их направлениями и ступени редкости: из них раскрывают. */
  alchemicalProperties: z.array(z.object({ nameRu: word, direction: word })),
  alchemicalRarities: z.array(word),
  /** Номера, под которыми свойство бывает раскрыто. */
  propertyNumbers: z.array(whole),
  /** Формы проявления состава: те же таблицы, которыми рецепт и оценивается. */
  recipeForm: z.object({
    /** Стандартная форма: с неё начинают, и отличия от неё и стоят сложности. */
    standard: z.object({
      duration: word.nullable(),
      onset: word,
      fullRepeats: whole,
      reach: word,
      application: word,
      resistance: word,
      purification: word.nullable(),
    }),
    durations: z.array(word),
    onsets: z.array(word),
    reaches: z.array(word),
    applications: z.array(word),
    resistances: z.array(word),
    limitations: z.array(word),
    purifications: z.array(word),
  }),
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
 * Особенность: название и то, что она даёт, — словами. Чисел здесь нет вовсе: величину двигает
 * вклад, и складывает её лист.
 */
const characterFeatureViewSchema = z.object({ nameRu: word, summaryRu: word });

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
  /** Скорость, которая действует прямо сейчас: с прибавками вещей и действующего. */
  speed: whole,
  /** Скорость, которую правят: своя скорость персонажа, без чужих прибавок. */
  speedBase: whole,
  className: text,
  level: whole,
  subclass: text,

  hitPoints: hitPointsViewSchema,
  /**
   * Итог защиты — числом и без разбора: складывают его характеристики, доспех, заклинания и слово
   * мастера, а показывает шапка «Игры». На «Листе» его нет: лист не меняет того, что двигает игра.
   */
  armorClass: whole,

  exhaustion: whole,
  inspiration: z.boolean(),

  abilities: z.array(abilityViewSchema),

  proficiencies: z.object({
    weapons: z.array(word),
    armor: z.array(word),
    tools: z.array(word),
    languages: z.array(word),
  }),

  features: z.array(characterFeatureViewSchema),
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
  /**
   * Те же прибавки фактами: число вещь называет один раз, и при нём стоит всё, что оно двигает, а
   * равная прибавка всем величинам семейства зовётся в этом перечне одним именем, а не столькими,
   * сколько в семействе величин. Сколько чисел вещь называет и что считать семейством, решают
   * правила — показывающий названное не пересобирает и обратно не разворачивает. Правят прибавки
   * перечнем выше: там у каждой величины своё число, и правка целится в величину.
   */
  bonusFacts: z.array(
    z.object({
      value: whole,
      /** Что это число двигает: одну величину (`stat`) или целое семейство (`family`). */
      targets: z.array(
        z.object({
          kind: word,
          /** Имя величины или имя семейства — смотря что названо родом. */
          id: word,
        }),
      ),
    }),
  ),
  /** База защиты и род доспеха; нет вовсе — вещь доспехом не является. */
  armor: z.object({ base: whole, category: word.optional() }).optional(),
  /** Вещь, которой проводят магию: надетая, она закрывает материальные компоненты без стоимости. */
  spellcastingFocus: z.boolean(),
  note: text.optional(),
  /**
   * Чем вещь требуется: заклинания, называющие её своим материалом. Пусто — не требует никто.
   *
   * Собран перечень обходом карточек, а не хранится при вещи: вещь про своих потребителей не знает,
   * и записанный при ней перечень разошёлся бы с содержимым при первом же пополнении.
   */
  neededForRu: z.array(word),
});

/**
 * Нужное, чего в сумке нет: чем оно называется, во что обойдётся и кто его требует.
 *
 * Запаса у строки нет ни у одной — она и стоит здесь потому, что запаса нет. Заводили вещь или
 * ещё нет, видно по записи: у заведённой она есть, и тогда строка ею открывается и ею пополняется,
 * а у названной одной лишь карточкой записи нет вовсе.
 */
const missingMaterialViewSchema = z.object({
  /** Карточка, которой вещь заводят: цену и судьбу она называет сама. */
  spellId: word,
  nameRu: word,
  price: z.object({ amount: whole, currency: word }).optional(),
  /** Сгорает ли применением: такое покупают впрок. */
  consumed: z.boolean(),
  /** Заклинания, называющие этот компонент. */
  neededForRu: z.array(word),
  /** Закрывает ли надетая фокусировка: без такого творят, и покупка не срочна. */
  coveredByFocus: z.boolean(),
  /** Запись о вещи в сумке; нет вовсе — вещь ещё не заводили, и открывать нечего. */
  itemId: word.optional(),
  /** Заметка заведённой вещи: переезд не отнимает у строки ничего из написанного рукой. */
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
  /**
   * Чего не хватает: нужное, которого в сумке нет, срочное впереди несрочного.
   *
   * Требуемое с пустым запасом едет сюда, а из своих вещей на это время уходит: перед вылазкой ноль
   * ищут в списке покупок, а не по категориям, и две строки на один ноль спрашивались бы дважды.
   */
  missingMaterials: z.array(missingMaterialViewSchema),
  armorClass: z.object({
    value: whole,
    /** Доспех, по которому считается защита; нет вовсе — доспеха на персонаже нет. */
    wornArmorNameRu: word.optional(),
  }),
});

/**
 * Раскрытое свойство: под каким номером стоит, как называется и какой оно редкости.
 *
 * Номер едет числом, а не порядком в списке: он говорит, насколько глубоко свойство было скрыто, и
 * второе, раскрытое через нераскрытое первое, остаётся вторым.
 */
const revealedPropertyViewSchema = z.object({
  number: whole,
  nameRu: word,
  rarity: word,
});

/**
 * Знание об ингредиенте: вид и то, что у него раскрыто.
 *
 * Сколько порций лежит в сумке, здесь не едет и не поедет: на этот вопрос отвечает сумка, а два
 * места для одного числа расходятся молча. Общего числа свойств вида тоже нет — потолок правил не
 * факт вида, и знаменателя, которого стол не установил, договор не обещает.
 */
const ingredientKnowledgeViewSchema = z.object({
  nameRu: word,
  /** По возрастанию номера; пусто — вид записан, а узнать про него ещё ничего не успели. */
  properties: z.array(revealedPropertyViewSchema),
  /** Установил ли стол, что свойств больше нет: только отсюда счёт раскрытого берёт знаменатель. */
  propertiesExhausted: z.boolean(),
});

/**
 * Что игрок узнал об ингредиентах и чем он работает.
 *
 * Мастерская едет рядом со знанием, а не отдельной проекцией: оба ответа читает один экран, и
 * пределы работы объясняются ровно тем набором, который тут же и правят.
 */
export const craftingViewSchema = z.object({
  ingredients: z.array(ingredientKnowledgeViewSchema),
  workshop: z.object({
    /** Только направления с записанным набором: отсутствие записи и есть «набора нет». */
    apparatus: z.array(z.object({ direction: word, gradeRu: word })),
    studiedDirections: z.array(word),
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
  runes: z.object({ nameRu: z.string(), remaining: whole, maximum: whole }),
  /** Последняя подсказка: одно применение до долгого отдыха. Истраченная едет нулём, а не пропажей. */
  lastHint: z.object({ nameRu: z.string(), remaining: whole, maximum: whole }),
  /** Ручная поправка Класса Доспеха: правится там же, где видна. */
  armorClassAdjustment: whole,
  passivePerception: whole,
  initiative: whole,
  /**
   * Спасёт ли руна провал прямо сейчас: она есть и реакция не потрачена. Оба условия — правила, и
   * сложить их на экране значило бы завести второй ответ на вопрос, которым откажет само сотворение.
   */
  wardingSigilAvailable: z.boolean(),
  /** Чем подавлены особенности вида: приложение это показывает, а решает мастер. */
  suppression: z.object({ firedUpon: z.boolean(), underDirectSunlight: z.boolean() }),
});

/**
 * Восстановление: что вернут час и конец боя и почему операция сейчас не идёт.
 *
 * Причина едет словами и приходит от той операции, которая ими и откажет: погашенная кнопка обязана
 * называть ровно то, чем ответил бы отказ, а второй экземпляр фразы разошёлся бы с первым молча.
 * Нет причины — операция идёт.
 */
export const recoveryViewSchema = z.object({
  /**
   * Что сделает следующий отмеченный час: вернёт ступень снижённого максимума и даст регенерации
   * дойти до половины. Два нуля — часу нечего менять.
   */
  nextHour: z.object({
    maximumReturned: whole,
    healed: whole,
    unavailabilityRu: word.optional(),
  }),
  /** Сколько хитов вернёт окончание боя; ноль — лечить нечего. */
  combatEndRecovery: whole,
  /**
   * Сколько длится короткий отдых, словами правил. Приходит готовым, потому что длительность —
   * правило игры: набранная в подписи, она разошлась бы с той, которую называет отказ в бою.
   */
  shortRestDurationRu: word,
  shortRestUnavailabilityRu: word.optional(),
  longRestUnavailabilityRu: word.optional(),
  /**
   * Магическое восстановление: остаток дневного бюджета уровней ячеек и что им можно вернуть.
   *
   * Возвращать нечего — список пуст: уровень без единой потраченной ячейки правила не предлагают, и
   * второй отбор того же на экране разошёлся бы с первым.
   */
  arcaneRecovery: z.object({
    remaining: whole,
    unavailabilityRu: word.optional(),
    recoverable: z.array(z.object({ level: whole, spent: whole })),
  }),
});

/**
 * Действующий эффект так, как его показывают: чем он назван, чем кончится и что требует каждый ход.
 *
 * Вкладов числами здесь нет: их считает лист, и повторить их значило бы прислать одно число дважды.
 * Есть признак того, что вклад в защиту у эффекта имеется, — им подписывают, откуда взялась защита.
 */
export const activeEffectViewSchema = z.object({
  id: word,
  nameRu: word,
  endConditionRu: word,
  /** Тот самый эффект, которым держится концентрация: он показывается отдельной карточкой. */
  isConcentration: z.boolean(),
  /** Двигает ли эффект Класс Доспеха: «Доспехи мага» на союзника видно только так. */
  changesArmorClass: z.boolean(),
  /** Число, которым эффект держится за столом; нет вовсе — оно уже названо самим эффектом. */
  noteRu: word.optional(),
  /** Что придётся делать каждый ход, пока эффект держится; нет вовсе — эффект висит сам. */
  repeatableAction: z.object({ label: word, description: word }).optional(),
});

/**
 * Экономия хода: что осталось потратить и на каком раунде это происходит.
 *
 * Вне боя ходов нет, и правила отвечают «всё доступно» независимо от лога — признак схватки
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
 * Способ сотворить заклинание: чем платить, во что это обойдётся и что мешает именно ему.
 *
 * Вердикт стоит у каждого способа, а не один на строку: ячейкой третьего уровня заклинание
 * сотворится, а вторым — нет, и «недоступно» без указания способа не отвечает ни на один вопрос
 * игрока. Способов у строки всегда хотя бы один: даже несотворимое называет, чем его сотворяли бы.
 *
 * Объявления и шагов здесь нет: они зависят ещё и от набранного — цели, руны, брошенных костей, — и
 * приходят ответом на вопрос. Прислать их с каждым способом значило бы прислать сорок текстов ради
 * одного показанного.
 */
export const castOptionViewSchema = z.object({
  /** Режим словом правил: обычное сотворение, ритуал, заговор. */
  mode: word,
  payment: paymentSchema,
  /** Уровень сотворения этим способом; нет вовсе — у заговора и ритуала его не бывает. */
  castLevel: whole.optional(),
  /** Способ, которому мешает меньше всего: с него мастер и начинает. Ровно один в списке. */
  suggested: z.boolean(),
  available: z.boolean(),
  /** Что мешает: код — чтобы отобрать по шагам мастера, фраза — чтобы показать. */
  warnings: z.array(z.object({ code: word, reasonRu: word })),
  /** Во сколько хитов обойдётся ячейка, созданная кровью; нет вовсе — платят не кровью. */
  hitPointCost: whole.optional(),
  /** На сколько минут дольше обычного идёт накладывание. */
  extraMinutes: whole.optional(),
  /** Урон именно этой ячейкой: он растёт с её уровнем, а не с уровнем заклинания. */
  damage: z.object({ formula: word, type: word }).optional(),
});

/**
 * Вариант отыгрыша: готовая фраза карточки или написанная игроком, с его же пометками на ней.
 *
 * Счётчика показов здесь нет: ротацию решают правила отыгрыша, и наружу едет её ответ — какой
 * вариант показать. Второй счёт по числам разошёлся бы с ним при первой же правке порядка.
 */
export const roleplayVariantViewSchema = z.object({
  id: word,
  text: word,
  /** Написан игроком: идёт первым в своей категории. */
  own: z.boolean(),
  favorite: z.boolean(),
  disabled: z.boolean(),
  /** Что показать при открытии категории; ровно один включённый вариант на категорию. */
  suggested: z.boolean(),
});

/** Категория отыгрыша со всеми её вариантами, включая отключённые: их возвращают там же. */
export const roleplayCategoryViewSchema = z.object({
  id: word,
  variants: z.array(roleplayVariantViewSchema),
});

const pointSchema = z.object({ x: z.number(), y: z.number() });

/**
 * Фигура рисунка в единицах листа: окружность, отрезок, ломаная, дуга или число.
 *
 * Дуга приезжает концами и флагами, а не углами: посчитать концы значит взять синус с косинусом, а
 * счёт — не дело рисующего. Пунктир едет признаком: чем он нарисован — толщиной штриха и промежутка
 * — решает перо.
 */
const diagramFigureSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("circle"),
    at: pointSchema,
    radius: z.number(),
    dashed: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("line"),
    from: pointSchema,
    to: pointSchema,
    dashed: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("polyline"),
    points: z.array(pointSchema),
    /** Замкнутая ломаная: последняя точка соединяется с первой. */
    closed: z.boolean().optional(),
    dashed: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("arc"),
    from: pointSchema,
    to: pointSchema,
    radius: z.number(),
    /** Которая из четырёх дуг: большая ли и в какую сторону ведётся. */
    largeArc: z.boolean(),
    sweep: z.boolean(),
    dashed: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("number"), at: pointSchema, size: z.number(), value: whole }),
]);

/**
 * Схема ритуала, приехавшая начерченной.
 *
 * Имён знаков здесь нет ни одного: словарь знаков закрыт, принадлежит контенту и стережётся его
 * разбором, а рисующей стороне достаётся то, что и рисуется. Вторая таблица знаков у показывающего
 * разошлась бы с первой молча — и молча же не нарисовала бы заведённый знак.
 */
export const diagramViewSchema = z.object({
  /** Сторона листа: рисунок приходит в её единицах, а во что его растянуть — дело показывающего. */
  side: z.number(),
  /**
   * Слои в порядке рисования — том же, в каком их выводят рукой. Слой назван словом правил схемы:
   * по нему рисунок разбирают и глазом, и прогоном.
   */
  marks: z.array(z.object({ layer: word, figures: z.array(diagramFigureSchema) })),
  captionRu: word,
});

/**
 * Карточка заклинания: то, что о нём написано в книге.
 *
 * Отдельно от строки, потому что отвечает на другой вопрос: строка говорит, чем заклинание является
 * для этого персонажа сейчас, а карточка — что о нём вообще известно, и от персонажа не зависит
 * ничем. Числа сюда не повторяются: дальность, длительность, урон и цена стоят в строке, и второй
 * их экземпляр разошёлся бы с первым молча.
 */
export const spellCardViewSchema = z.object({
  nameEn: word,
  school: word,
  fullRulesRu: word,
  higherLevelsRu: word.optional(),
  tacticalAdviceRu: word.optional(),
  /** Кого берут целью: род цели словом правил и предел числа целей. */
  targeting: z.object({ type: word, maximumTargets: whole.optional() }),
  /** Что даёт успех и что провал того броска, который называет строка. */
  successEffectRu: word.optional(),
  failureEffectRu: word.optional(),
  /** На что срабатывает реакция; нет вовсе — заклинание реакцией не творится. */
  reaction: z.object({ textRu: word }).optional(),
  /**
   * Что требуется, чтобы заклинание сработало: голос, руки и вещь в руке.
   *
   * Материального компонента может не быть вовсе — тогда и требовать нечего. Заменяет ли его
   * фокусировка, здесь не сказано: это про персонажа, а не про заклинание.
   */
  components: z.object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.object({ textRu: word, consumed: z.boolean() }).optional(),
  }),
  /** Что произносят и что показывают руками: слова книги, а не выбор игрока. */
  roleplay: z.object({ incantation: word, gesture: word }),
  /** Схема ритуала, начерченная; нет вовсе — ритуалом заклинание не творится. */
  ritualDiagram: diagramViewSchema.optional(),
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
  /** Заговор: платы не требует, руну не принимает и уровнем ячейки не усиливается. */
  cantrip: z.boolean(),
  /** Расходует ли сотворение Кости хитов: сколько их позволено бросить, зависит от ячейки. */
  spendsHitDice: z.boolean(),
  /** Нужен собственный материальный компонент: фокусировка его не заменяет. */
  ownComponentRequired: z.boolean(),
  /** Лежит ли компонент этого заклинания в сумке: он вещь, и наличие его — её запас. */
  ownComponentCarried: z.boolean(),
  /** Закрыт ли материал надетой фокусировкой: закрытому не нужно ни вещи, ни покупки. */
  materialCoveredByFocus: z.boolean(),
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
  /** Нельзя ли сейчас — чем бы это ни объяснялось: своей причиной строки или общей причиной списка. */
  unavailable: z.boolean(),
  /**
   * Первая причина, по которой сейчас нельзя именно это заклинание; нет вовсе — либо можно, либо
   * закрыт весь список сразу, и тогда причину называет он, а не строка.
   */
  unavailableReason: word.optional(),
  /** Эффект этого заклинания уже висит: строка не претендует на внимание, но из списка не уходит. */
  active: z.boolean(),
  /** Урон с учётом уровня персонажа: формула и её род. */
  damage: z.object({ formula: word, type: word }).optional(),
  /** Каким станет Класс Доспеха, если сотворить; нет вовсе — защиты заклинание не трогает. */
  armorClassIfCast: whole.optional(),

  /**
   * Чем сотворить и во что это обойдётся, по способу на запись.
   *
   * Пустым не бывает, и это записано формой, а не обещанием в тексте: заклинание, которое сотворить
   * нечем, называет тот способ, которым его сотворяли бы.
   */
  castOptions: z.tuple([castOptionViewSchema], castOptionViewSchema),
  /** Что требуется произнести, показать и приложить: перечень словами, а не «В, С, М». */
  componentReminders: z.array(word),

  /**
   * Что сделать и что сказать мастеру — способом, который предложит мастер применения.
   *
   * Едет со строкой, а не отдельным ответом на «расскажи про это заклинание»: способ выбирают
   * правила, и спросить их дважды значит однажды получить два разных ответа на один вопрос.
   */
  instructions: z.array(word),
  announcement: z.object({
    text: word,
    /** Чего в объявлении не хватает и почему: пробел назван, а не замолчан. */
    gaps: z.array(z.object({ placeholder: word.optional(), reasonRu: word })),
  }),

  /** Заметка игрока: домашнее правило или напоминание; нет вовсе — не писал. */
  note: text.optional(),
  /**
   * Отыгрыш у этого персонажа: категории с вариантами, пометками и ротацией.
   *
   * Стоит в строке, а не в карточке: любимое, отключённое и то, что показать следующим, — свойства
   * игрока, а не книги. Категория, в которой не осталось включённых вариантов, не приезжает вовсе:
   * выбирать в ней нечего.
   */
  roleplayCategories: z.array(roleplayCategoryViewSchema),
  /** Что о заклинании написано: полные правила, отыгрыш и всё, чего в строке нет. */
  card: spellCardViewSchema,
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
  /** Начало вытеснено из обрезанного лога: раунд — нижняя граница, а не точное число. */
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
  /** Модификатор заклинательной характеристики: им прибавляют к броскам, которые называет карточка. */
  spellcastingModifier: whole,
  /** Сколько заклинаний он вправе держать подготовленными и сколько держит. */
  preparedLimit: whole,
  preparedCount: whole,
  /**
   * Закрыты ли дешёвые материальные компоненты фокусировкой или мешочком; нет вовсе — про
   * снаряжение персонажа ничего не известно, и вердикта о компонентах не бывает.
   */
  freeComponentsCovered: z.boolean().optional(),
});

export type ActiveEffectView = z.infer<typeof activeEffectViewSchema>;
export type ConcentrationCheckView = z.infer<typeof concentrationCheckViewSchema>;
export type ConcentrationView = z.infer<typeof concentrationViewSchema>;
export type ResourcesView = z.infer<typeof resourcesViewSchema>;
export type RecoveryView = z.infer<typeof recoveryViewSchema>;
export type TurnView = z.infer<typeof turnViewSchema>;
export type CastOptionView = z.infer<typeof castOptionViewSchema>;
export type DiagramFigure = z.infer<typeof diagramFigureSchema>;
export type RoleplayVariantView = z.infer<typeof roleplayVariantViewSchema>;
export type RoleplayCategoryView = z.infer<typeof roleplayCategoryViewSchema>;
export type DiagramView = z.infer<typeof diagramViewSchema>;
export type SpellCardView = z.infer<typeof spellCardViewSchema>;
export type SpellRowView = z.infer<typeof spellRowViewSchema>;
export type CastingView = z.infer<typeof castingViewSchema>;
export type ItemView = z.infer<typeof itemViewSchema>;
export type MissingMaterialView = z.infer<typeof missingMaterialViewSchema>;
export type BagView = z.infer<typeof bagViewSchema>;
export type CraftingView = z.infer<typeof craftingViewSchema>;
export type IngredientKnowledgeView = z.infer<typeof ingredientKnowledgeViewSchema>;
export type StatChoiceView = z.infer<typeof statChoiceSchema>;
export type ChoicesView = z.infer<typeof choicesViewSchema>;
export type AbilityView = z.infer<typeof abilityViewSchema>;
export type SheetView = z.infer<typeof sheetViewSchema>;
