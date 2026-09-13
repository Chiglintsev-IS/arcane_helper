import { type CharacterState, characterStateSchema } from "@/core/domain/assembly/state";
import { arcaneRecoveryBudget, spellSlotsForLevel } from "@/core/domain/arcana/slots";
import { runesMaximum } from "@/core/domain/arcana/runes";
import { proficiencyBonus } from "@/core/domain/character/abilities";
import { RELIABLE_FIELD_KIT } from "@/core/domain/crafting/apparatus";
import { Items } from "@/core/domain/items/items";

/**
 * Ингредиент опознаётся слугом своего названия: партия списывает порции по названию вида, и другой
 * идентификатор разорвал бы связь знания об ингредиенте с запасом в сумке.
 *
 * Запас держат порциями: справочник стола считает ими, и мера в штуках только прибавляла бы
 * пересчёт между тем, что записал мастер, и тем, что видит игрок.
 *
 * Направление свойства ремесло пока не хранит, а без него запись перечня неполна: у свойств чужих
 * направлений оно стоит наблюдением рядом — там же, где поиск, сбор и выход с источника.
 */
type Revealed = { number: number; nameRu: string };

const INGREDIENTS: readonly {
  nameRu: string;
  count: number;
  gold?: number;
  wanted?: true;
  revealed?: readonly Revealed[];
  notes: readonly string[];
}[] = [
  {
    nameRu: "Частичка плода большой гальперы",
    count: 32,
    gold: 85,
    revealed: [
      { number: 1, nameRu: "Снижение потребности в пище и воде" },
      { number: 2, nameRu: "Усиление характеристики (Выносливость)" },
    ],
    notes: [
      "Плод великаньей яблони. Порция — 250 г свежей мякоти вместе с соком.",
      "Найти — СЛ 8 Мудрость (Внимательность) у плодоносящей гальперы; собрать — СЛ 8 Интеллект (Травничество); каждые 250 г куска дают порцию",
    ],
  },
  {
    nameRu: "Пыльца большой гальперы",
    count: 22,
    gold: 15,
    revealed: [
      { number: 1, nameRu: "Ускорение роста растений" },
      { number: 2, nameRu: "Усиление характеристики (Сила)" },
    ],
    notes: [
      "Порция — 20 г очищенной сухой пыльцы. Оптовая партия обычно дешевле.",
      "Найти — СЛ 10 Мудрость (Внимательность) на цветущей гальпере; собрать — СЛ 12 Интеллект (Травничество); шар около 30 сантиметров даёт 4к20 + 40 порций",
    ],
  },
  {
    nameRu: "Дварфийская хворь",
    count: 4,
    gold: 15,
    revealed: [
      { number: 1, nameRu: "Отвращение к пиву" },
      { number: 2, nameRu: "Ослабление характеристики (Выносливость)" },
    ],
    notes: [
      "Порция — колония: 25 г свежей или 8 г сухой.",
      "Две порции хвори друг с другом активируют «Отвращение к пиву» без второго вида — отдельно утверждённое исключение стола",
      "Найти — СЛ 12 Мудрость (Внимательность) у старых шахт, пивных погребов и заброшенных поселений; собрать — СЛ 13 Интеллект (Травничество); 1к4 порций с зрелой колонии",
    ],
  },
  {
    nameRu: "Подорожник",
    count: 48,
    gold: 5,
    revealed: [
      { number: 1, nameRu: "Лечение здоровья" },
      { number: 2, nameRu: "Остановка кровотечения" },
      { number: 3, nameRu: "Сопротивление типу урона (ядовитый)" },
    ],
    notes: [
      "Порция — пучок 8–10 листьев, около 40 г.",
      "Найти — СЛ 9 Мудрость (Внимательность) на влажных обочинах, лугах и по краям болот; собрать — СЛ 7 Интеллект (Травничество); 1к6 + 1 порций с заросли",
      "Рядом с болотами порцию берут за 2–3 золотых",
    ],
  },
  {
    nameRu: "Болотный гриб",
    count: 16,
    gold: 1,
    revealed: [{ number: 1, nameRu: "Противоядие" }],
    notes: [
      "Порция — 3 средних плодовых тела: около 60 г свежих или 15 г сухих.",
      "2-е свойство — направление «Синтез ядов»: реакция обнаружена, но без навыка и профильного модуля точный эффект не раскрыть",
      "Найти — СЛ 8 Мудрость (Внимательность) на сырых кочках и у гниющих пней; собрать — СЛ 7 Интеллект (Травничество); 1к4 + 2 порции с грибницы",
    ],
  },
  {
    nameRu: "«Неожиданность Зинаиды»",
    count: 3,
    revealed: [{ number: 1, nameRu: "Диарея" }],
    notes: [
      "Порция — зрелое плодовое тело, 50–70 г. Расчётная ценность 1 350 золотых: устойчивого рынка почти нет.",
      "Сырая мякоть вызывает рвоту: это проявление сырого образца, свойств оно не раскрывает",
      "Найти — СЛ 17 Мудрость (Внимательность) во влажных местах со следами старой магии; собрать — СЛ 15 Интеллект (Травничество); 1к4 + 1 порций с колонии",
    ],
  },
  {
    nameRu: "Листья «Язвы семейной»",
    count: 2,
    revealed: [
      { number: 1, nameRu: "Омоложение" },
      { number: 2, nameRu: "Регенерация здоровья" },
    ],
    notes: [
      "Порция — 10 зрелых листьев, около 25 г. Расчётная ценность 3 300 золотых: устойчивого рынка почти нет.",
      "Найти — СЛ 10 Мудрость (Внимательность), если дерево уже найдено; собрать — СЛ 14 Интеллект (Травничество); 1к6 + 2 порции за безопасный сбор, повторный требует восстановления кроны",
    ],
  },
  {
    nameRu: "Корень мандрагоры",
    count: 2,
    revealed: [
      { number: 1, nameRu: "Постоянное усиление случайной характеристики" },
      { number: 2, nameRu: "Полное восстановление здоровья" },
    ],
    notes: [
      "Порция — зрелый очищенный корень. Спрос крайне высокий, устойчивого рынка почти нет: одни скрытые свойства оценивают не менее чем в 13 500 золотых.",
      "2-е — очень редкое свойство: сложность его исследования была 16",
      "Одной порции хватает на зелье 1-го свойства без второго вида, и для такого рецепта свойство считается очень редким; ступень обработки поднимает прирост: обычная +1, усиленная +2 (+3 к сложности), концентрированная +3 (+6)",
      "Сырая порция — спасбросок усвоения СЛ 18: успех даёт +1 к случайной характеристике навсегда, натуральная 20 — +2; провал — месяц помехи на проверки и спасброски Силы, Ловкости и Выносливости и тяжёлые приступы диареи. Торн выбросил натуральную 20 и получил +2 к Силе",
      "Найти — СЛ 15 Мудрость (Внимательность) в старых влажных почвах, насыщенных маной; собрать — СЛ 16 Интеллект (Травничество); зрелое растение даёт одну порцию",
    ],
  },
  {
    nameRu: "Грибы карлика",
    count: 5,
    gold: 90,
    revealed: [
      { number: 1, nameRu: "Галлюцинации" },
      { number: 2, nameRu: "Уменьшение существа" },
    ],
    notes: [
      "Порция — зрелое плодовое тело, 25–35 г.",
      "Найти — СЛ 14 Мудрость (Внимательность) в сырых корневых пустотах и тёмных участках старого болота; собрать — СЛ 11 Интеллект (Травничество); 1к6 порций с грибницы",
    ],
  },
  {
    nameRu: "Лунная роза",
    count: 0,
    wanted: true,
    notes: [],
  },
];

/**
 * Природа вещи и запас в сумке стоят одной строкой: разойдясь, они дали бы вещь без запаса или
 * запас без вещи. Пустой набор признаков — это «другое»: находку не заставляют опознаваться.
 */
const CARRIED: readonly {
  nameRu: string;
  count: number;
  kinds: readonly string[];
  notes?: readonly string[];
}[] = [
  { nameRu: "Сухпаёк", count: 7, kinds: ["consumable"] },
  { nameRu: "Брошь фракции лоялистов", count: 1, kinds: ["gear"] },
  { nameRu: "Свиток заклинания «Катапульта»", count: 5, kinds: ["consumable"] },
  {
    nameRu: "Рисунок древней руны с наковальни великана",
    count: 1,
    kinds: [],
    notes: ["Срисована с наковальни великана. Что она делает, мастер не называл"],
  },
  {
    nameRu: "Рисунок древней руны с факела",
    count: 1,
    kinds: [],
    notes: ["Срисована с факела. Похоже на руну освещения — стол этого не подтверждал"],
  },
  {
    nameRu: "Рисунок древней руны высасывания жидкости",
    count: 1,
    kinds: [],
    notes: ["Вода стекалась к этой руне"],
  },
  { nameRu: "Фреска из древнего храма", count: 0, kinds: [] },
];

/** Заметки приходят списком слов: идентичность им даёт вещь, при которой они записаны. */
function written(nameRu: string, textsRu: readonly string[]): readonly { id: string; textRu: string }[] {
  return textsRu.map((textRu, index) => ({
    id: `${Items.idFromName(nameRu)}-${index + 1}`,
    textRu,
  }));
}

const LEVEL = 8;

const SLOTS = spellSlotsForLevel(LEVEL);
const ARCANE_RECOVERY_BUDGET = arcaneRecoveryBudget(LEVEL);
const RUNES_MAXIMUM = runesMaximum(proficiencyBonus(LEVEL));

const RAW: unknown = {
  id: "thorne",
  name: "Торн",
  className: "Волшебник",
  level: LEVEL,

  species: "Лунный тролль",
  subclass: "Создатель рун",
  age: 0,
  size: "medium",
  speed: 30,

  abilities: {
    strength: 8,
    dexterity: 14,
    constitution: 16,
    intelligence: 20,
    wisdom: 12,
    charisma: 8,
  },
  saveProficiencies: ["intelligence", "wisdom"],
  skills: {
    arcana: "proficient",
    investigation: "proficient",
    nature: "proficient",
    perception: "proficient",
    sleightOfHand: "proficient",
    survival: "proficient",
  },
  proficiencies: {
    weapons: ["Кинжал", "Дротик", "Праща", "Боевой посох", "Лёгкий арбалет"],
    armor: [],
    tools: [],
    languages: [],
  },
  features: [
    {
      nameRu: "Рунный почерк",
      summaryRu:
        "Минута изучения записи отвечает, один ли у двух записей автор, есть ли позднейшая вставка, менялась ли структура.",
    },
  ],
  exhaustion: 0,
  inspiration: false,

  cantripIds: ["shocking-grasp", "ray-of-frost", "message", "mending"],
  spellbookSpellIds: [
    "shield",
    "absorb-elements",
    "feather-fall",
    "mage-armor",
    "magic-missile",
    "catapult",
    "chromatic-orb",
    "alarm",
    "detect-magic",

    "arcane-vigor",
    "web",
    "rimes-binding-ice",
    "tashas-mind-whip",
    "enlarge-reduce",
    "see-invisibility",
    "blindness-deafness",

    "counterspell",
    "dispel-magic",
    "lightning-bolt",
    "slow",
    "thunder-step",
    "haste",
    "intellect-fortress",
    "tidal-wave",

    "polymorph",
    "storm-sphere",
    "ice-storm",
    "vitriolic-sphere",
    "evards-black-tentacles",
  ],
  preparedSpellIds: [
    "shield",
    "mage-armor",
    "magic-missile",

    "web",
    "rimes-binding-ice",
    "enlarge-reduce",
    "see-invisibility",

    "lightning-bolt",
    "slow",
    "thunder-step",
    "intellect-fortress",

    "ice-storm",
    "vitriolic-sphere",
  ],

  spellSlots: SLOTS,

  activeEffects: [],

  arcaneRecovery: { maximum: ARCANE_RECOVERY_BUDGET, remaining: ARCANE_RECOVERY_BUDGET },

  hitPoints: { current: 60, maximumBase: 69, bloodReduction: 0, masterReduction: 0 },
  itemDefinitions: [
    {
      id: "spellcasting-focus",
      nameRu: "Магическая фокусировка +1",
      kinds: ["gear"],
      spellcastingFocus: true,
      bonuses: { spellSaveDc: 1, spellAttackModifier: 1 },
    },
    {
      id: "robe",
      nameRu: "Мантия +1",
      kinds: ["gear"],
      bonuses: { armorClass: 1 },
    },
    {
      id: "cloak-of-protection",
      nameRu: "Плащ защиты",
      kinds: ["gear"],
      bonuses: {
        armorClass: 1,
        "save:strength": 1,
        "save:dexterity": 1,
        "save:constitution": 1,
        "save:intelligence": 1,
        "save:wisdom": 1,
        "save:charisma": 1,
      },
    },
    {
      id: "swamp-camouflage-kit",
      nameRu: "Комплект болотной маскировки",
      kinds: ["gear"],
      notes: written("Комплект болотной маскировки", ["1d4 к Скрытности в болотах"]),
    },
    {
      id: "gormongol",
      nameRu: "Кузнечный Молот Гормонголь",
      kinds: ["gear"],
      notes: written("Кузнечный Молот Гормонголь", [
        "Мифриловый",
        "Растущий: меняется вместе с владельцем, но чисел под это мастер пока не назвал",
      ]),
    },
    ...CARRIED.map(({ nameRu, kinds, notes }) => ({
      id: Items.idFromName(nameRu),
      nameRu,
      kinds,
      notes: written(nameRu, notes ?? []),
    })),
    ...INGREDIENTS.map(({ nameRu, gold, revealed, notes }) => ({
      id: Items.idFromName(nameRu),
      nameRu,
      kinds: ["ingredient"],
      ...(gold === undefined ? {} : { price: { amount: gold, currency: "gold" } }),
      notes: written(nameRu, notes),
      alchemy: { properties: revealed ?? [] },
    })),
  ],
  equipment: {
    bag: [
      { itemId: "swamp-camouflage-kit", count: 1 },
      { itemId: "gormongol", count: 1 },
      ...CARRIED.map(({ nameRu, count }) => ({ itemId: Items.idFromName(nameRu), count })),
      ...INGREDIENTS.map(({ nameRu, count }) => ({ itemId: Items.idFromName(nameRu), count })),
    ],
    worn: [
      { itemId: "spellcasting-focus", count: 1 },
      { itemId: "robe", count: 1 },
      { itemId: "cloak-of-protection", count: 1 },
    ],
    wanted: INGREDIENTS.filter(({ wanted }) => wanted === true).map(({ nameRu }) =>
      Items.idFromName(nameRu),
    ),
    money: { gold: 7800, silver: 110, copper: 0 },
    components: { componentPouch: false },
  },
  hitDice: { total: LEVEL, size: 6, remaining: LEVEL },
  runes: { maximum: RUNES_MAXIMUM, remaining: RUNES_MAXIMUM },
  suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },

  alchemyApparatus: RELIABLE_FIELD_KIT,

  spellNotes: {},
};

export function createThorne(): CharacterState {
  return characterStateSchema.parse(structuredClone(RAW));
}
