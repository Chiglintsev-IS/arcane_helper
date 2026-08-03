/**
 * Начальное состояние Торна.
 *
 * Числа — с листа персонажа и из документа расы, сведены в.
 * Производные значения записаны фактическими, а не вычисленными: предметы их сдвигают.
 */

import { characterStateSchema, type CharacterState } from "@/core/domain/character/state";
import { arcaneRecoveryBudget, spellSlotsForLevel } from "@/core/domain/arcana/slots";

/** Ячейки берём из движка, чтобы таблица уровней жила в одном месте. */
const SLOTS = spellSlotsForLevel(7);
/** Дневной бюджет восстановления из той же формулы, что и у движка. */
const ARCANE_RECOVERY_BUDGET = arcaneRecoveryBudget(7);

const RAW: unknown = {
  id: "thorne",
  name: "Торн",
  className: "Волшебник",
  level: 7,

  species: "Лунный тролль",
  subclass: "Создатель рун",
  // Возраст не назван игроком: пустое поле честнее выдуманного.
  age: 0,
  size: "large",
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
  },
  proficiencies: { weapons: [], armor: [], tools: [], languages: [] },
  overrides: { saves: {}, skills: {} },
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
  reactionAvailable: true,

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

  turnTracking: { actionAvailable: true, bonusActionAvailable: true },
  arcaneRecovery: { maximum: ARCANE_RECOVERY_BUDGET, remaining: ARCANE_RECOVERY_BUDGET },

  hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
  equipment: {
    // База 10 — доспехов нет.
    armorClassBase: 10,
    // Каждая прибавка Торна принадлежит названной вещи, поэтому прибавок без вещи у него нет.
    otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    items: [
      {
        id: "spellcasting-focus",
        nameRu: "Магическая фокусировка +1",
        kind: "gear",
        worn: true,
        bonuses: { spellcasting: 1, armorClass: 0, savingThrows: 0 },
      },
      {
        id: "robe",
        nameRu: "Мантия +1",
        kind: "gear",
        worn: true,
        bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
      },
      {
        id: "cloak-of-protection",
        nameRu: "Плащ защиты",
        kind: "gear",
        worn: true,
        bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
      },
      {
        // Прибавка кубиком и по обстановке: приложение её не считает, поэтому она заметка.
        id: "swamp-camouflage-kit",
        nameRu: "Комплект болотной маскировки",
        kind: "other",
        worn: false,
        note: "1d4 к Скрытности в болотах",
      },
    ],
    components: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: [] },
  },
  // Одна кость за уровень, размер по классу: волшебник — d6. Расовые «11 очков здоровья»
  // на счёт костей не влияют: это надбавка к максимуму, а не замена кости.
  hitDice: { total: 7, size: 6, remaining: 7 },
  // Рун столько же, сколько бонус мастерства.
  runes: { maximum: 3, remaining: 3 },
  spellPoints: { remaining: 0 },
  suppression: { firedUpon: false, underDirectSunlight: false },

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
