/**
 * Разбор прочитанного из хранилища на настоящем сохранении игрока.
 *
 * Слепок снят с телефона: версия 1, журнал с записями о бое, ходе и реакции. Поэтому он лежит здесь
 * целиком, а не удобной выжимкой — сохранение не открывалось именно тем, чего выжимка не показала бы.
 */

import { describe, expect, it } from "vitest";

import { parsePersisted } from "./sessionRepository";

/** Ход и реакция, какими их держало состояние версии 1: обоих полей у состояния больше нет. */
const LEGACY_TURN_TRACKING = { enabled: false, actionAvailable: true, bonusActionAvailable: true };

const PLAYER_SAVE = {
  schemaVersion: 1,
  savedAt: "2026-07-31T15:29:26.868Z",
  character: {
    id: "thorne",
    name: "Торн",
    className: "Волшебник",
    level: 7,
    intelligence: 18,
    spellSaveDc: 16,
    spellAttackModifier: 8,
    constitutionSaveModifier: 4,
    cantripIds: ["shocking-grasp", "ray-of-frost", "message", "mending"],
    spellbookSpellIds: [
      "shield",
      "absorb-elements",
      "mage-armor",
      "disguise-self",
      "find-familiar",
      "detect-magic",
      "identify",
      "unseen-servant",
    ],
    preparedSpellIds: ["shield", "absorb-elements", "mage-armor", "disguise-self"],
    spellSlots: {
      1: { maximum: 4, remaining: 4 },
      2: { maximum: 3, remaining: 3 },
      3: { maximum: 3, remaining: 3 },
      4: { maximum: 1, remaining: 1 },
    },
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
    turnTracking: { enabled: true, actionAvailable: true, bonusActionAvailable: true },
    arcaneRecoveryAvailable: true,
    hitPoints: { current: 60, maximum: 60, maximumReduction: 0 },
    armorClass: { base: 10, dexterityModifier: 2, itemBonus: 2 },
    runes: { maximum: 3, remaining: 3 },
    spellPoints: { remaining: 0, createdAt: null },
    suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },
    spellNotes: {},
    roleplayPreferences: {},
  },
  journal: [
    {
      id: "f1adbf6b-73b8-43c1-ac1a-2468fd9bcc34",
      at: "2026-07-31T15:29:26.868Z",
      kind: "manual_adjustment",
      summaryRu: "Учёт хода включён",
      undoPatch: { turnTracking: LEGACY_TURN_TRACKING },
    },
    {
      id: "1a3f9c22-0b52-4d1e-9a44-6d0d1b6f7c31",
      at: "2026-07-31T15:31:02.104Z",
      kind: "combat_started",
      summaryRu: "Бой начат",
      undoPatch: { turnTracking: LEGACY_TURN_TRACKING, reactionAvailable: true },
    },
    {
      id: "7c5b2d18-4e6a-4f70-8a2c-3f9b1d5e0a44",
      at: "2026-07-31T15:33:47.512Z",
      kind: "reaction_cast",
      summaryRu: "Щит — реакцией",
      spellId: "shield",
      slotLevel: 1,
      actionUsed: "reaction",
      undoPatch: {
        reactionAvailable: true,
        spellSlots: {
          1: { maximum: 4, remaining: 4 },
          2: { maximum: 3, remaining: 3 },
          3: { maximum: 3, remaining: 3 },
          4: { maximum: 1, remaining: 1 },
        },
      },
    },
  ],
};

describe("настоящее сохранение игрока", () => {
  it("сохранение версии 1 с записями о бое, ходе и реакции читается целиком", () => {
    const parsed = parsePersisted(PLAYER_SAVE);

    expect(parsed.character.level).toBe(7);
    expect(parsed.character.hitPoints.current).toBe(60);
    expect(parsed.character.spellSlots[4]?.remaining).toBe(1);
    expect(parsed.journal.map((entry) => entry.summaryRu)).toEqual([
      "Учёт хода включён",
      "Бой начат",
      "Щит — реакцией",
    ]);
  });

  it("снимок отмены теряет поля, которых состояние не знает, и остаётся тем, что знает", () => {
    const parsed = parsePersisted(PLAYER_SAVE);

    expect(parsed.journal[0]?.undoPatch).toBeNull();
    expect(parsed.journal[1]?.undoPatch).toBeNull();
    expect(parsed.journal[2]?.undoPatch?.spellSlots?.[1]?.remaining).toBe(4);
    expect(parsed.journal[2]?.undoPatch).not.toHaveProperty("reactionAvailable");
  });

  it("записи без идентификатора попытки читаются: версия формата от него не выросла", () => {
    const parsed = parsePersisted(PLAYER_SAVE);

    expect(parsed.journal).toHaveLength(3);
    expect(parsed.journal[2]).not.toHaveProperty("commandId");
  });

  it("идентификатор попытки переживает запись и чтение", () => {
    const [first, ...rest] = PLAYER_SAVE.journal;
    const marked = { ...PLAYER_SAVE, journal: [{ ...first, commandId: "command-1" }, ...rest] };

    expect(parsePersisted(marked).journal[0]?.commandId).toBe("command-1");
  });
});
