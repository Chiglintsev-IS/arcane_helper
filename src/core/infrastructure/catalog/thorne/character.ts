/**
 * Начальное состояние Торна.
 *
 * Числа — с листа персонажа и из документа расы, сведены в.
 * Производные значения записаны фактическими, а не вычисленными: предметы их сдвигают.
 */

import { type CharacterState, characterStateSchema } from "@/core/domain/assembly/state";
import { arcaneRecoveryBudget, spellSlotsForLevel } from "@/core/domain/arcana/slots";
import { runesMaximum } from "@/core/domain/arcana/runes";
import { proficiencyBonus } from "@/core/domain/character/abilities";
import { RELIABLE_FIELD_KIT } from "@/core/domain/crafting/apparatus";

/** Ячейки берём из движка, чтобы таблица уровней жила в одном месте. */
const SLOTS = spellSlotsForLevel(7);
/** Дневной бюджет восстановления из той же формулы, что и у движка. */
const ARCANE_RECOVERY_BUDGET = arcaneRecoveryBudget(7);
/** Максимум рун из той же формулы, что и у движка. */
const RUNES_MAXIMUM = runesMaximum(proficiencyBonus(7));

const RAW: unknown = {
  id: "thorne",
  name: "Торн",
  className: "Волшебник",
  level: 7,

  species: "Лунный тролль",
  subclass: "Создатель рун",
  // Возраст не назван игроком: пустое поле честнее выдуманного.
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
  // Владение спасбросками волшебника; Телосложение не подтверждено и потому не отмечено.
  saveProficiencies: ["intelligence", "wisdom"],
  skills: {
    arcana: "proficient",
    investigation: "proficient",
    nature: "proficient",
    perception: "proficient",
    sleightOfHand: "proficient",
    survival: "proficient",
  },
  /**
   * Владения волшебника из «Книги игрока»: пять видов оружия и ни одного доспеха — класс не даёт
   * владения доспехами вовсе. Инструменты и языки игроком не названы и потому пусты: пустой список
   * честнее правдоподобного.
   */
  proficiencies: {
    weapons: ["Кинжал", "Дротик", "Праща", "Боевой посох", "Лёгкий арбалет"],
    armor: [],
    tools: [],
    languages: [],
  },
  /**
   * Особенность предыстории «Нерадивый ученик», записанная её словами: чисел она не двигает, и
   * приложение по ней не считает ничего — минуту изучения и ответ ведёт стол.
   */
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
  // Двадцать пять записей книги: состав назван игроком.
  spellbookSpellIds: [
    "shield",
    "absorb-elements",
    "feather-fall",
    "mage-armor",
    "disguise-self",
    "find-familiar",
    "detect-magic",
    "identify",
    "unseen-servant",

    "misty-step",
    "mirror-image",
    "arcane-vigor",
    "web",
    "invisibility",
    "rimes-binding-ice",
    "vortex-warp",
    "tashas-mind-whip",

    "counterspell",
    "dispel-magic",
    "hypnotic-pattern",
    "lightning-bolt",
    "blink",
    "fly",

    "polymorph",
    "dimension-door",
  ],
  /**
   * Стартовый набор подготовки — 11 из 11.
   *
   * Ритуалы в него не входят: подготовка им не нужна, и место в лимите они занимали бы зря.
   * Набор — предложение спеки, а не выбор игрока: он пересобирается в «Книге» одним нажатием на
   * строку.
   */
  preparedSpellIds: [
    "shield",
    "absorb-elements",
    "mage-armor",
    "misty-step",
    "mirror-image",
    "web",
    "invisibility",
    "counterspell",
    "hypnotic-pattern",
    "lightning-bolt",
    "polymorph",
  ],

  spellSlots: SLOTS,

  activeEffects: [],

  roleplayProfile: {
    tone: ["sarcastic", "mysterious"],
    magicThemes: ["руны", "молнии", "холод", "алхимические символы"],
    speechStyle: "Короткие формулы и язвительные замечания",
    gestureStyle: "Рисует знаки пальцами, посохом или мелом",
    preferredElements: ["электричество", "холод", "сила"],
    prohibitedThemes: ["огонь"],
    maximumPhraseLength: 15,
  },

  arcaneRecovery: { maximum: ARCANE_RECOVERY_BUDGET, remaining: ARCANE_RECOVERY_BUDGET },

  hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
  itemDefinitions: [
    {
      id: "spellcasting-focus",
      nameRu: "Магическая фокусировка +1",
      kind: "gear",
      spellcastingFocus: true,
      bonuses: { spellSaveDc: 1, spellAttackModifier: 1 },
    },
    {
      id: "robe",
      nameRu: "Мантия +1",
      kind: "gear",
      bonuses: { armorClass: 1 },
    },
    {
      id: "cloak-of-protection",
      nameRu: "Плащ защиты",
      kind: "gear",
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
      // Прибавка кубиком и по обстановке: приложение её не считает, поэтому она заметка.
      id: "swamp-camouflage-kit",
      nameRu: "Комплект болотной маскировки",
      kind: "other",
      note: "1d4 к Скрытности в болотах",
    },
  ],
  equipment: {
    bag: [{ itemId: "swamp-camouflage-kit", count: 1 }],
    worn: [
      { itemId: "spellcasting-focus", count: 1 },
      { itemId: "robe", count: 1 },
      { itemId: "cloak-of-protection", count: 1 },
    ],
    components: { componentPouch: false },
  },
  // Одна кость за уровень, размер по классу: волшебник — d6. Расовые «11 очков здоровья»
  // на счёт костей не влияют: это надбавка к максимуму, а не замена кости.
  hitDice: { total: 7, size: 6, remaining: 7 },
  runes: { maximum: RUNES_MAXIMUM, remaining: RUNES_MAXIMUM },
  spellPoints: { remaining: 0 },
  suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },

  /**
   * Мастерская: надёжные походные комплекты по двум изученным направлениям. Синтезу ядов Торн не
   * обучен и набора токсиколога не держит — работа с ядовитым свойством идёт импровизацией, а
   * бонуса мастерства проверке не достаётся.
   */
  alchemyApparatus: { potions: RELIABLE_FIELD_KIT, transmutation: RELIABLE_FIELD_KIT },
  studiedDirections: ["potions", "transmutation"],

  spellNotes: {},
  roleplayPreferences: {},
};

/**
 * Свежее состояние Торна. Каждый вызов возвращает новый объект: состояние изменяемое,
 * и общий экземпляр протёк бы между тестами и сессиями.
 */
export function createThorne(): CharacterState {
  return characterStateSchema.parse(structuredClone(RAW));
}
