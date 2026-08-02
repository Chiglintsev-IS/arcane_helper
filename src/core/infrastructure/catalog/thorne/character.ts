/**
 * Начальное состояние Торна.
 *
 * Числа — с листа персонажа и из документа расы, сведены в.
 * Производные значения записаны фактическими, а не вычисленными: предметы их сдвигают.
 */

import { characterStateSchema, type CharacterState } from "@/core/domain/character/state";
import { spellSlotsForLevel } from "@/core/domain/arcana/slots";

/** Ячейки берём из движка, чтобы таблица уровней жила в одном месте. */
const SLOTS = spellSlotsForLevel(7);

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
  // Владения навыками игроком не названы.
  skills: {},
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
  arcaneRecoveryAvailable: true,

  hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
  // Рун столько же, сколько бонус мастерства.
  // Одна кость за уровень, размер по классу: волшебник — d6. Расовые «11 очков здоровья»
  // на счёт костей не влияют, пока это надбавка к максимуму, а не замена кости, пункт 3.
  // Ответ игрока на (2026-08-01): фокусировка есть, и она «+1» — эта прибавка уже учтена
  // в КС 16 и атаке +8. Мешочка с компонентами нет, дорогих компонентов не куплено.
  equipment: {
    // База 10 — доспехов нет.
    armorClassBase: 10,
    /**
     * Прибавки без вещи: сами предметы игроком не названы, и выдумывать им имена нельзя.
     * Выведено из листа: КС 16 и атака +8 дают +1 к магии, КД 14 при базе 10 и Ловкости 14 — +2 к
     * защите, спасбросок Телосложения +4 при Телосложении 16 — +1 ко всем спасброскам.
     */
    otherBonuses: { spellcasting: 1, armorClass: 2, savingThrows: 1 },
    items: [],
    components: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: [] },
  },
  hitDice: { total: 7, size: 6, remaining: 7 },
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
