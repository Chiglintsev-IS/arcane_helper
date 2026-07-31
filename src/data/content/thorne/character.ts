/**
 * Начальное состояние Торна.
 *
 * Числа — с листа персонажа и из документа расы, сведены в docs/content.md#персонаж.
 * Производные значения записаны фактическими, а не вычисленными: предметы их сдвигают (OQ-11).
 */

import { characterStateSchema, type CharacterState } from "@/data/schemas/character";
import { spellSlotsForLevel } from "@/rules/slots";

/** Ячейки берём из движка, чтобы таблица уровней жила в одном месте. */
const SLOTS = spellSlotsForLevel(7);

const RAW: unknown = {
  id: "thorne",
  name: "Торн",
  className: "Волшебник",
  level: 7,

  intelligence: 18,
  // КС 16 и атака +8 включают +1 от предмета на магию; спасбросок Телосложения +4 — это 3 от
  // Телосложения 16 плюс 1 от предмета на защиту, владения нет.
  spellSaveDc: 16,
  spellAttackModifier: 8,
  constitutionSaveModifier: 4,

  cantripIds: ["shocking-grasp", "ray-of-frost", "message", "mending"],
  // Двадцать пять записей книги: состав назван игроком, состав и решения — docs/content.md.
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
   * Стартовый набор подготовки — 11 из 11 (docs/content.md#предлагаемый-стартовый-набор-подготовки).
   *
   * Ритуалы в него не входят: подготовка им не нужна (FR-103), и место в лимите они занимали бы зря.
   * Набор — предложение спеки, а не выбор игрока: он пересобирается в «Книге» одним нажатием на
   * строку (FR-214).
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
  arcaneRecoveryAvailable: true,

  hitPoints: { current: 60, maximum: 60, maximumReduction: 0 },
  // База 10 — доспехов нет; предметы дают +2, что выведено из КД 14 на листе (OQ-02).
  armorClass: { base: 10, dexterityModifier: 2, itemBonus: 2 },

  // Рун столько же, сколько бонус мастерства (F-13).
  runes: { maximum: 3, remaining: 3 },
  spellPoints: { remaining: 0, createdAt: null },
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
