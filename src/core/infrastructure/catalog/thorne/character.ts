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
 * Найденное за столом стоит заметкой, а не раскрытым свойством: свойство перечня неотделимо от
 * своего направления, и записать его, не назвав направления, нельзя.
 */
type Revealed = { number: number; nameRu: string };

const INGREDIENTS: readonly {
  nameRu: string;
  count: number;
  note?: string;
  piecesPerPortion?: number;
  revealed?: readonly Revealed[];
  seen?: readonly string[];
}[] = [
  {
    nameRu: "Гольпера Большая",
    count: 32,
    revealed: [
      { number: 1, nameRu: "Снижение потребности в пище и воде" },
      { number: 2, nameRu: "Усиление выносливости" },
    ],
  },
  {
    nameRu: "Пыльца Гольперы Большой",
    count: 22,
    revealed: [
      { number: 1, nameRu: "Ускорение роста растений" },
      { number: 2, nameRu: "Усиление силы" },
    ],
  },
  {
    nameRu: "Пучок Дварской Хвори",
    count: 1,
    revealed: [
      { number: 1, nameRu: "Отвращение к пиву" },
      { number: 2, nameRu: "Ослабление выносливости" },
    ],
    seen: ["Отвращение к пиву — действует всегда при использовании. В перечне такого свойства нет"],
  },
  {
    nameRu: "Подорожник",
    count: 63,
    piecesPerPortion: 10,
    revealed: [
      { number: 1, nameRu: "Лечение здоровья" },
      { number: 2, nameRu: "Остановка кровотечения" },
    ],
  },
  { nameRu: "Болотный гриб [Я]", count: 1 },
  {
    nameRu: "Гриб неожиданность Зинаиды",
    count: 3,
    seen: [
      "Не исследован",
      "Говорят: сильное слабительное",
      "Говорят: галлюцинации",
      "При простом поедании — рвота",
    ],
  },
  { nameRu: "Листочки с дерева", count: 10, seen: ["Не исследованы"] },
  {
    nameRu: "Лунная роза",
    count: 0,
    seen: ["Свойств раскрыть не удалось", "Кончилась — найти ещё"],
  },
  {
    nameRu: "Корень какой-то",
    count: 2,
    note: "Когда съели то давало рандомом какие-то характеристики",
  },
  {
    nameRu: "Грибы карлика",
    count: 5,
    note: "Говорят что при поедании люди начинают видеть карликов",
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
  note?: string;
}[] = [
  { nameRu: "Сухпаёк", count: 7, kinds: ["consumable"] },
  { nameRu: "Брошь фракции лоялистов", count: 1, kinds: ["gear"] },
  { nameRu: "Свиток заклинания «Катапульта»", count: 5, kinds: ["consumable"] },
  {
    nameRu: "Рисунок древней руны с наковальни великана",
    count: 1,
    kinds: [],
    note: "Срисована с наковальни великана. Что она делает, мастер не называл.",
  },
  {
    nameRu: "Рисунок древней руны с факела",
    count: 1,
    kinds: [],
    note: "Срисована с факела. Похоже на руну освещения — стол этого не подтверждал.",
  },
  {
    nameRu: "Рисунок древней руны высасывания жидкости",
    count: 1,
    kinds: [],
    note: "Вода стекалась к этой руне.",
  },
  { nameRu: "Фреска из древнего храма", count: 0, kinds: [] },
];

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
      note: "1d4 к Скрытности в болотах",
    },
    {
      id: "gormongol",
      nameRu: "Кузнечный Молот Гормонголь",
      kinds: ["gear"],
      note: "Мифриловый. Растущий: меняется вместе с владельцем, но чисел под это мастер пока не назвал.",
    },
    ...CARRIED.map(({ nameRu, kinds, note }) => ({
      id: Items.idFromName(nameRu),
      nameRu,
      kinds,
      ...(note === undefined ? {} : { note }),
    })),
    ...INGREDIENTS.map(({ nameRu, note, piecesPerPortion, revealed, seen }) => ({
      id: Items.idFromName(nameRu),
      nameRu,
      kinds: ["ingredient"],
      ...(note === undefined ? {} : { note }),
      alchemy: {
        properties: revealed ?? [],
        ...(piecesPerPortion === undefined ? {} : { piecesPerPortion }),
        observations: (seen ?? []).map((textRu, index) => ({
          id: `${Items.idFromName(nameRu)}-${index + 1}`,
          textRu,
        })),
      },
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
