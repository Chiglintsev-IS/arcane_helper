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
  revealed?: readonly Revealed[];
  seen?: readonly string[];
}[] = [
  {
    nameRu: "Гольпера Большая",
    count: 32,
    revealed: [
      { number: 1, nameRu: "Снижение потребности в пище и воде" },
      { number: 2, nameRu: "Усиление характеристики" },
    ],
  },
  {
    nameRu: "Пыльца Гольперы Большой",
    count: 22,
    revealed: [
      { number: 1, nameRu: "Ускорение роста растений" },
      { number: 2, nameRu: "Усиление характеристики" },
    ],
  },
  {
    nameRu: "Пучок Дварской Хвори",
    count: 1,
    revealed: [{ number: 2, nameRu: "Ослабление характеристики" }],
    seen: ["Отвращение к пиву — действует всегда при использовании. В перечне такого свойства нет"],
  },
  {
    nameRu: "Подорожник",
    count: 9,
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
];

const SLOTS = spellSlotsForLevel(7);
const ARCANE_RECOVERY_BUDGET = arcaneRecoveryBudget(7);
const RUNES_MAXIMUM = runesMaximum(proficiencyBonus(7));

const RAW: unknown = {
  id: "thorne",
  name: "Торн",
  className: "Волшебник",
  level: 7,

  species: "Лунный тролль",
  subclass: "Создатель рун",
  age: 0,
  size: "medium",
  speed: 30,

  abilities: {
    strength: 8,
    dexterity: 14,
    constitution: 16,
    intelligence: 18,
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
    "alarm",
    "detect-magic",

    "arcane-vigor",
    "web",
    "rimes-binding-ice",
    "tashas-mind-whip",
    "enlarge-reduce",
    "see-invisibility",

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
    "vitriolic-sphere",
  ],
  preparedSpellIds: [
    "shield",
    "absorb-elements",
    "mage-armor",
    "magic-missile",
    "intellect-fortress",
    "web",
    "thunder-step",
    "counterspell",
    "slow",
    "lightning-bolt",
    "storm-sphere",
  ],

  spellSlots: SLOTS,

  activeEffects: [],

  arcaneRecovery: { maximum: ARCANE_RECOVERY_BUDGET, remaining: ARCANE_RECOVERY_BUDGET },

  hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
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
      kinds: [],
      note: "1d4 к Скрытности в болотах",
    },
    {
      id: "gormongol",
      nameRu: "Кузнечный Молот Гормонголь",
      kinds: ["gear"],
      note: "Мифриловый. Растущий: меняется вместе с владельцем, но чисел под это мастер пока не назвал.",
    },
    ...INGREDIENTS.map(({ nameRu, revealed, seen }) => ({
      id: Items.idFromName(nameRu),
      nameRu,
      kinds: ["ingredient"],
      alchemy: {
        properties: revealed ?? [],
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
      ...INGREDIENTS.map(({ nameRu, count }) => ({ itemId: Items.idFromName(nameRu), count })),
    ],
    worn: [
      { itemId: "spellcasting-focus", count: 1 },
      { itemId: "robe", count: 1 },
      { itemId: "cloak-of-protection", count: 1 },
    ],
    components: { componentPouch: false },
  },
  hitDice: { total: 7, size: 6, remaining: 7 },
  runes: { maximum: RUNES_MAXIMUM, remaining: RUNES_MAXIMUM },
  suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },

  alchemyApparatus: { potions: RELIABLE_FIELD_KIT, transmutation: RELIABLE_FIELD_KIT },
  studiedDirections: ["potions", "transmutation"],

  spellNotes: {},
};

export function createThorne(): CharacterState {
  return characterStateSchema.parse(structuredClone(RAW));
}
