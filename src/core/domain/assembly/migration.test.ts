import { Character } from "@/core/domain/assembly/character";
import { saveStatId, skillStatId } from "@/core/domain/shared/stats";
import { describe, expect, it } from "vitest";

import { z } from "zod";

import { arcaneRecoveryBudget } from "@/core/domain/arcana/slots";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { fieldsOf } from "@/core/domain/shared/fields";
import { FIRE_SUPPRESSION_TURN_STARTS } from "@/core/domain/vitality/blood";
import { Items } from "@/core/domain/items/items";
import { migrateCharacterState, migrateUndoPatch } from "./migration";
import { characterStateSchema } from "./state";

const listOf = (value: unknown): unknown[] => z.array(z.unknown()).parse(value);

const VERSION_ONE = {
  id: "thorne",
  name: "Торн",
  className: "Волшебник",
  level: 7,
  intelligence: 18,
  spellSaveDc: 16,
  spellAttackModifier: 8,
  constitutionSaveModifier: 4,
  cantripIds: [],
  spellbookSpellIds: [],
  preparedSpellIds: [],
  spellSlots: { 1: { maximum: 4, remaining: 4 } },
  reactionAvailable: true,
  activeEffects: [],
  roleplayProfile: {
    tone: ["sarcastic"],
    magicThemes: [],
    speechStyle: "…",
    gestureStyle: "…",
    prohibitedThemes: [],
    maximumPhraseLength: 15,
  },
  turnTracking: { actionAvailable: true, bonusActionAvailable: true },
  arcaneRecoveryAvailable: true,
  hitPoints: { current: 51, maximum: 51, maximumReduction: 9 },
  armorClass: { base: 10, dexterityModifier: 2, itemBonus: 2 },
  runes: { maximum: 3, remaining: 3 },
  spellPoints: { remaining: 0, createdAt: null },
  suppression: { firedUpon: false, underDirectSunlight: false },
  spellNotes: {},
  roleplayPreferences: {},
};

describe("приведение состояния версии 1", () => {
  it("числа, введённые руками, снимаются, а считанные из основания остаются", () => {
    const state = characterStateSchema.parse(migrateCharacterState(VERSION_ONE));
    const sheet = Character.of(state).sheet;
    expect(sheet.value("spellSaveDc")).toBe(15);
    expect(sheet.value("spellAttackModifier")).toBe(7);
    expect(sheet.value(saveStatId("constitution"))).toBe(0);
    expect(sheet.value("armorClass")).toBe(12);
  });

  it("Интеллект переносится, Ловкость выводится из модификатора, остальные неизвестны", () => {
    const state = characterStateSchema.parse(migrateCharacterState(VERSION_ONE));
    expect(state.abilities.intelligence).toBe(18);
    expect(state.abilities.dexterity).toBe(14);
    expect(state.abilities.strength).toBe(10);
  });

  it("состояние версии 2 проходит насквозь", () => {
    const already = {
      ...VERSION_ONE,
      abilities: {
        strength: 8,
        dexterity: 14,
        constitution: 16,
        intelligence: 18,
        wisdom: 12,
        charisma: 8,
      },
    };
    expect(fieldsOf(migrateCharacterState(already)).abilities).toEqual(already.abilities);
  });

  it("максимум разбирается на базу и снижение кровью", () => {
    const state = characterStateSchema.parse(migrateCharacterState(VERSION_ONE));
    expect(state.hitPoints).toEqual({
      current: 51,
      maximumBase: 60,
      bloodReduction: 9,
      masterReduction: 0,
    });
  });

  it("состояние нынешней формы проходит насквозь: снаряжение знает про инвентарь", () => {
    const already = {
      ...VERSION_ONE,
      abilities: createThorne().abilities,
      equipment: createThorne().equipment,
      arcaneRecovery: createThorne().arcaneRecovery,
      suppression: createThorne().suppression,
    };
    expect(migrateCharacterState(already)).toBe(already);
  });

  it("версия 2 доносит компоненты, а числа, введённые руками, снимает", () => {
    const versionTwo = {
      ...VERSION_ONE,
      abilities: createThorne().abilities,
      itemBonuses: { spellcasting: 1, armorClass: 2, savingThrows: 1 },
      armorClass: { base: 13 },
      equipment: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: ["identify"] },
      hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
    };
    const state = characterStateSchema.parse(migrateCharacterState(versionTwo));

    expect(Character.of(state).sheet.value("armorClass")).toBe(12);
    expect(Character.of(state).sheet.value("spellSaveDc")).toBe(15);
    expect(Character.of(state).sheet.value(saveStatId("wisdom"))).toBe(1);
    expect(state.itemDefinitions.map((item) => item.nameRu)).toEqual([
      "Магическая фокусировка",
      "жемчужина стоимостью не менее 100 зм",
    ]);
    expect(state.equipment.worn.map((entry) => entry.itemId)).toEqual(["spellcasting-focus"]);
  });

  it("версия 2 без снаряжения и без прибавок получает умолчания и остаётся без компонентов", () => {
    const bare = {
      ...VERSION_ONE,
      abilities: createThorne().abilities,
      armorClass: undefined,
      equipment: undefined,
      hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
    };
    const state = characterStateSchema.parse(migrateCharacterState(bare));

    expect(Character.of(state).sheet.value("armorClass")).toBe(12);
    expect(state.equipment.components).toBeUndefined();
  });

  it("версия 1 со снаряжением переносит компоненты вместе с прибавками", () => {
    const withComponents = {
      ...VERSION_ONE,
      equipment: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: [] },
    };
    const state = characterStateSchema.parse(migrateCharacterState(withComponents));
    expect(state.equipment.components?.componentPouch).toBe(false);
    expect(Character.of(state).sheet.value("armorClass")).toBe(12);
  });

  it("перебивки навыков и спасбросков снимаются: числа считаются заново", () => {
    const overridden = {
      ...createThorne(),
      overrides: { saves: { wisdom: 9 }, skills: { arcana: 12 } },
    };
    const state = characterStateSchema.parse(migrateCharacterState(overridden));
    const sheet = Character.of(state).sheet;

    expect(sheet.value(saveStatId("wisdom"))).toBe(5);
    expect(sheet.value(skillStatId("arcana"))).toBe(7);
  });

  it("вклад эффекта прежней формы становится вкладом в величину", () => {
    const withEffect = (armorClass: unknown) => ({
      ...createThorne(),
      activeEffects: [
        {
          id: "e-1",
          nameRu: "Доспехи мага",
          startedAt: "2026-07-31T12:00:00.000Z",
          duration: { type: "hours", value: 8 },
          isConcentration: false,
          slotLevelUsed: 1,
          armorClass,
          endConditionRu: "Держится 8 часов.",
        },
      ],
    });
    const contributionsOf = (state: unknown): unknown =>
      fieldsOf(listOf(fieldsOf(state).activeEffects)[0]).contributions;

    expect(contributionsOf(migrateCharacterState(withEffect({ kind: "base_override", value: 13 })))).toEqual([
      { stat: "armorClass", kind: "method", method: { family: "spell", base: 13 } },
    ]);
    expect(contributionsOf(migrateCharacterState(withEffect({ kind: "bonus", value: 5 })))).toEqual([
      { stat: "armorClass", kind: "bonus", value: 5 },
    ]);
    expect(contributionsOf(migrateCharacterState(withEffect({ kind: "bonus" })))).toEqual([]);
  });

  it("прибавка без вещи снимается, где бы она ни лежала — у персонажа или в снаряжении", () => {
    const base = createThorne();
    const legacy = {
      ...base,
      miscBonuses: { spellcasting: 0, armorClass: 3, savingThrows: 0, лихость: 5 },
      equipment: {
        ...base.equipment,
        otherBonuses: { spellcasting: 0, armorClass: 9, savingThrows: 0 },
      },
    };
    const state = characterStateSchema.parse(migrateCharacterState(legacy));

    expect(Character.of(state).sheet.value("armorClass")).toBe(14);
    expect("miscBonuses" in state).toBe(false);
  });

  it("вещи, уже разведённые по местам, приводятся и без снаряжения прежней формы", () => {
    const base = createThorne();
    const legacy = {
      ...base,
      itemDefinitions: [
        {
          id: "cloak",
          nameRu: "Плащ",
          kind: "gear",
          bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
        },
      ],
    };
    const state = characterStateSchema.parse(migrateCharacterState(legacy));

    expect(state.itemDefinitions[0]).toEqual({
      id: "cloak",
      nameRu: "Плащ",
      kinds: ["gear"],
      bonuses: { armorClass: 1 },
    });
  });

  it("прибавки прежних слов, равные нулю, вещи не достаются вовсе", () => {
    const base = createThorne();
    const legacy = {
      ...base,
      itemDefinitions: [
        {
          id: "cloak",
          nameRu: "Плащ",
          kind: "gear",
          bonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
        },
      ],
    };
    const state = characterStateSchema.parse(migrateCharacterState(legacy));

    expect(state.itemDefinitions[0]).toEqual({ id: "cloak", nameRu: "Плащ", kinds: ["gear"] });
  });

  it("вещь в снаряжении прежней формы приводится до разведения по местам", () => {
    const base = createThorne();
    const legacy = {
      ...base,
      itemDefinitions: [
        {
          id: "cloak",
          nameRu: "Плащ",
          kind: "gear",
          bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
        },
      ],
      equipment: {
        ...base.equipment,
        items: [
          {
            id: "ring",
            nameRu: "Кольцо",
            kind: "gear",
            bonuses: { spellcasting: 1, armorClass: 1, savingThrows: 0 },
          },
        ],
      },
    };
    const state = characterStateSchema.parse(migrateCharacterState(legacy));

    expect(state.itemDefinitions[0]?.bonuses).toEqual({ armorClass: 1 });
    expect(state.itemDefinitions[1]?.bonuses).toEqual({
      spellSaveDc: 1,
      spellAttackModifier: 1,
      armorClass: 1,
    });
  });

  it("не объект остаётся собой: испорченные данные отвергнет схема, а не приведение", () => {
    expect(migrateCharacterState(null)).toBeNull();
    expect(migrateCharacterState("сломано")).toBe("сломано");
  });

  it("сохранение без слагаемых защиты и без производных получает нули", () => {
    const bare = {
      ...VERSION_ONE,
      intelligence: undefined,
      spellSaveDc: undefined,
      spellAttackModifier: undefined,
      constitutionSaveModifier: undefined,
      armorClass: undefined,
      hitPoints: undefined,
    };
    const migrated = fieldsOf(migrateCharacterState(bare));
    const abilities = fieldsOf(migrated.abilities);
    expect(abilities.intelligence).toBe(10);
    expect(abilities.dexterity).toBe(10);
    expect("overrides" in migrated).toBe(false);
    expect("miscBonuses" in migrated).toBe(false);
  });

  describe("признак магического восстановления становится дневным бюджетом", () => {
    const budget = arcaneRecoveryBudget(VERSION_ONE.level);

    it("доступный флаг переносится как полный бюджет", () => {
      const migrated = fieldsOf(
        migrateCharacterState({ ...VERSION_ONE, arcaneRecoveryAvailable: true }),
      );
      expect(migrated.arcaneRecovery).toEqual({ maximum: budget, remaining: budget });
    });

    it("потраченный флаг переносится как нулевой остаток — тот же бюджет, но исчерпанный", () => {
      const migrated = fieldsOf(
        migrateCharacterState({ ...VERSION_ONE, arcaneRecoveryAvailable: false }),
      );
      expect(migrated.arcaneRecovery).toEqual({ maximum: budget, remaining: 0 });
    });

    it("уже приведённое состояние не трогается", () => {
      const already = { ...VERSION_ONE, arcaneRecovery: { maximum: 4, remaining: 2 } };
      const migrated = fieldsOf(migrateCharacterState(already));
      expect(migrated.arcaneRecovery).toEqual({ maximum: 4, remaining: 2 });
    });

    it("испорченный уровень получает нулевой бюджет вместо падения", () => {
      const corrupted = { ...VERSION_ONE, level: "семь" };
      const migrated = fieldsOf(migrateCharacterState(corrupted));
      expect(migrated.arcaneRecovery).toEqual({ maximum: 0, remaining: 0 });
    });

    it("сохранение вовсе без признака приведению не подлежит", () => {
      const { arcaneRecoveryAvailable: _omitted, ...withoutFlag } = VERSION_ONE;
      const migrated = fieldsOf(migrateCharacterState(withoutFlag));
      expect(migrated.arcaneRecovery).toBeUndefined();
    });

    it("не объекту приведение не нужно", () => {
      expect(migrateCharacterState(null)).toBeNull();
      expect(migrateCharacterState("не состояние")).toBe("не состояние");
    });
  });

  describe("род вещи становится категорией, а место надетой вещи — независимым счётом", () => {
    const withLegacyItems = (items: unknown[]) => {
      const state = createThorne();
      return { ...state, itemDefinitions: [], equipment: { ...state.equipment, items } };
    };
    const definitionsOf = (migrated: unknown): unknown[] =>
      listOf(fieldsOf(migrated).itemDefinitions);
    const bagOf = (migrated: unknown): unknown[] =>
      listOf(fieldsOf(fieldsOf(migrated).equipment).bag);
    const wornOf = (migrated: unknown): unknown[] =>
      listOf(fieldsOf(fieldsOf(migrated).equipment).worn);

    it("зелье — расходник, хлам — «другое», ингредиент остаётся собой", () => {
      const migrated = migrateCharacterState(
        withLegacyItems([
          { id: "potion", nameRu: "Зелье", kind: "potion" },
          { id: "junk", nameRu: "Черепок", kind: "junk" },
          { id: "dust", nameRu: "Пыль", kind: "ingredient" },
        ]),
      );
      expect(definitionsOf(migrated).map((item) => fieldsOf(item).kinds)).toEqual([
        ["consumable"],
        [],
        ["ingredient"],
      ]);
    });

    it("вещь без рода опознаётся по прибавке или базе доспеха, голая вещь остаётся «другим»", () => {
      const migrated = migrateCharacterState(
        withLegacyItems([
          { id: "ring", nameRu: "Кольцо", bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 } },
          { id: "breastplate", nameRu: "Кираса", armorBase: 14 },
          { id: "rope", nameRu: "Верёвка" },
        ]),
      );
      expect(definitionsOf(migrated).map((item) => fieldsOf(item).kinds)).toEqual([
        ["gear"],
        ["gear"],
        [],
      ]);
      expect(fieldsOf(definitionsOf(migrated)[1]).armor).toBeUndefined();
    });

    it("надетость вне экипировки снимается: запас надетого зелья идёт в сумку, не в надетое", () => {
      const migrated = migrateCharacterState(
        withLegacyItems([{ id: "potion", nameRu: "Зелье", kind: "potion", worn: true }]),
      );
      expect(fieldsOf(definitionsOf(migrated)[0]).kinds).toEqual(["consumable"]);
      expect(bagOf(migrated).map((entry) => fieldsOf(entry).itemId)).toEqual(["potion"]);
      expect(wornOf(migrated)).toEqual([]);
    });

    it("доспех вне экипировки снимается, прибавка действует при себе, сохранение читается", () => {
      const migrated = migrateCharacterState(
        withLegacyItems([
          {
            id: "potion",
            nameRu: "Зелье",
            kind: "potion",
            bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
            armor: { base: 16 },
          },
        ]),
      );
      expect(definitionsOf(migrated)[0]).toEqual({
        id: "potion",
        nameRu: "Зелье",
        kinds: ["consumable"],
        bonuses: { armorClass: 1 },
        worksCarried: true,
      });
      expect(characterStateSchema.safeParse(migrated).success).toBe(true);
    });

    it("прибавка вещи, названная величиной, остаётся собой; выдуманное слово — не прибавка", () => {
      const migrated = migrateCharacterState(
        withLegacyItems([
          {
            id: "ring",
            nameRu: "Кольцо",
            kind: "gear",
            bonuses: { spellcasting: 1, initiative: 2, лихость: 5 },
          },
        ]),
      );
      expect(fieldsOf(definitionsOf(migrated)[0]).bonuses).toEqual({
        spellSaveDc: 1,
        spellAttackModifier: 1,
        initiative: 2,
      });
    });

    it("надетый ингредиент прежней сборки остаётся собой, его запас идёт в сумку", () => {
      const migrated = migrateCharacterState(
        withLegacyItems([{ id: "dust", nameRu: "Пыль", kind: "ingredient", worn: true }]),
      );
      expect(definitionsOf(migrated)[0]).toEqual({ id: "dust", nameRu: "Пыль", kinds: ["ingredient"] });
      expect(bagOf(migrated).map((entry) => fieldsOf(entry).itemId)).toEqual(["dust"]);
      expect(wornOf(migrated)).toEqual([]);
    });

    it("счёт выше предела обрезается пределом: старое сохранение обязано читаться", () => {
      const migrated = migrateCharacterState(
        withLegacyItems([{ id: "arrows", nameRu: "Стрелы", kind: "other", count: 15000 }]),
      );
      expect(fieldsOf(bagOf(migrated)[0]).count).toBe(9999);
    });

    it("снимок отмены приводится так же, как состояние", () => {
      const patch = {
        equipment: {
          armorClassBase: 10,
          otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
          items: [{ id: "potion", nameRu: "Зелье", kind: "potion", worn: true }],
        },
      };
      const migrated = migrateUndoPatch(patch);
      expect(definitionsOf(migrated)[0]).toEqual({
        id: "potion",
        nameRu: "Зелье",
        kinds: ["consumable"],
      });
      expect(bagOf(migrated).map((entry) => fieldsOf(entry).itemId)).toEqual(["potion"]);
      expect(wornOf(migrated)).toEqual([]);
      const bare = { hitPoints: { current: 1 } };
      expect(migrateUndoPatch(bare)).toBe(bare);
    });

    it("состояние с новыми категориями проходит насквозь той же ссылкой", () => {
      const fresh = createThorne();
      expect(migrateCharacterState(fresh)).toBe(fresh);
    });

    it("порченые записи проходят как есть: их отвергнет схема, а не приведение", () => {
      const migrated = migrateCharacterState(withLegacyItems(["не вещь", null]));
      expect(definitionsOf(migrated)).toEqual(["не вещь", null]);
      expect(bagOf(migrated)).toEqual([]);
      expect(wornOf(migrated)).toEqual([]);
    });

    it("состояние без списка вещей приведению не подлежит", () => {
      const state = createThorne();
      const broken = { ...state, equipment: { ...state.equipment, items: "не список" } };
      expect(migrateCharacterState(broken)).toBe(broken);
    });
  });

  describe("«прибавки без вещи» снимаются вместе со своим прежним полем", () => {
    const bonuses = { spellcasting: 1, armorClass: 2, savingThrows: 0 };
    const legacyState = () => {
      const state = fieldsOf(createThorne());
      return {
        ...state,
        equipment: { ...fieldsOf(state.equipment), otherBonuses: bonuses },
      };
    };

    it("прибавка без вещи не переезжает никуда: она снимается", () => {
      const migrated = fieldsOf(migrateCharacterState(legacyState()));
      expect("otherBonuses" in fieldsOf(migrated.equipment)).toBe(false);
      expect("miscBonuses" in migrated).toBe(false);
      expect(
        Character.of(characterStateSchema.parse(migrated)).sheet.value("armorClass"),
      ).toBe(14);
    });

    it("состояние без прежнего поля проходит насквозь той же ссылкой", () => {
      const fresh = createThorne();
      expect(migrateCharacterState(fresh)).toBe(fresh);
    });

    it("снимок отмены приводится так же, как состояние", () => {
      const patch = { equipment: { items: [], otherBonuses: bonuses } };
      const migrated = fieldsOf(migrateUndoPatch(patch));
      expect("miscBonuses" in migrated).toBe(false);
      expect("otherBonuses" in fieldsOf(migrated.equipment)).toBe(false);
    });
  });

  describe("хранимая база защиты уходит из снаряжения", () => {
    it("база не переезжает никуда: доспехом вещь больше не бывает", () => {
      const state = createThorne();
      const migrated = migrateCharacterState({
        ...state,
        itemDefinitions: [],
        equipment: {
          ...state.equipment,
          armorClassBase: 16,
          items: [{ id: "mail", nameRu: "Кольчуга", kind: "gear", worn: true }],
        },
      });

      const equipment = fieldsOf(fieldsOf(migrated).equipment);
      expect("armorClassBase" in equipment).toBe(false);
      expect(fieldsOf(listOf(fieldsOf(migrated).itemDefinitions)[0]).armor).toBeUndefined();
      expect(characterStateSchema.safeParse(migrated).success).toBe(true);
    });
  });

  describe("поправка к КД получает типизированный признак", () => {
    const legacyAdjustment = {
      id: "adjustment",
      nameRu: "Поправка к КД",
      startedAt: "2026-07-31T12:00:00.000Z",
      duration: { type: "special" },
      isConcentration: false,
      slotLevelUsed: 0,
      armorClass: { kind: "bonus", value: 2 },
      endConditionRu: "Снимается вручную.",
    };
    const withEffects = (activeEffects: unknown[]) => ({ ...createThorne(), activeEffects });
    const effectsOf = (migrated: unknown): unknown[] =>
      listOf(fieldsOf(migrated).activeEffects);

    it("эффект прежней формы с именем и вкладом получает признак", () => {
      const migrated = migrateCharacterState(withEffects([legacyAdjustment]));
      expect(fieldsOf(effectsOf(migrated)[0]).manualKind).toBe("armorAdjustment");
    });

    it("статус того же имени без вклада в КД признака не получает", () => {
      const { armorClass: _none, ...namesake } = legacyAdjustment;
      const migrated = migrateCharacterState(withEffects([namesake]));
      expect(fieldsOf(effectsOf(migrated)[0]).manualKind).toBeUndefined();
    });

    it("эффект нынешней формы проходит насквозь той же ссылкой", () => {
      const { armorClass: _converted, ...current } = legacyAdjustment;
      const marked = withEffects([
        {
          ...current,
          duration: { type: "until_removed" },
          manualKind: "armorAdjustment",
          contributions: [],
        },
      ]);
      expect(migrateCharacterState(marked)).toBe(marked);

      const foreign = withEffects([{ ...legacyAdjustment, nameRu: "Прикрытие союзника" }]);
      expect(fieldsOf(effectsOf(migrateCharacterState(foreign))[0]).manualKind).toBeUndefined();
    });

    it("порченая запись эффекта проходит как есть: её отвергнет схема, а не приведение", () => {
      const migrated = migrateCharacterState(withEffects(["не эффект", null]));
      expect(effectsOf(migrated)).toEqual(["не эффект", null]);
    });

    it("состояние без списка эффектов приведению не подлежит", () => {
      const broken = { ...createThorne(), activeEffects: "не список" };
      expect(migrateCharacterState(broken)).toBe(broken);
    });

    it("снимок отмены приводится так же, как состояние", () => {
      const patch = { activeEffects: [legacyAdjustment] };
      expect(fieldsOf(effectsOf(migrateUndoPatch(patch))[0]).manualKind).toBe("armorAdjustment");
    });
  });

  describe("особый срок прежней формы", () => {
    const legacyUntimed = (overrides: Record<string, unknown>) => ({
      id: "legacy",
      nameRu: "Проклятие",
      startedAt: "2026-07-31T12:00:00.000Z",
      duration: { type: "special" },
      isConcentration: false,
      slotLevelUsed: 0,
      contributions: [],
      endConditionRu: "Пока мастер не снимет.",
      ...overrides,
    });

    const durationTypesOf = (migrated: unknown): unknown[] =>
      listOf(fieldsOf(migrated).activeEffects).map(
        (effect) => fieldsOf(fieldsOf(effect).duration).type,
      );

    it("прежний особый срок расходится по тому, чем он кончался", () => {
      const migrated = migrateCharacterState({
        ...createThorne(),
        activeEffects: [
          legacyUntimed({ id: "familiar", spellId: "find-familiar" }),
          legacyUntimed({ id: "status" }),
        ],
      });

      expect(durationTypesOf(migrated)).toEqual(["until_spell_ends", "until_removed"]);
    });

    it("снимок отмены получает тот же срок, что и состояние", () => {
      const patch = { activeEffects: [legacyUntimed({ spellId: "web" })] };
      expect(durationTypesOf(migrateUndoPatch(patch))).toEqual(["until_spell_ends"]);
    });
  });

  it("не объекту приведение не нужно", () => {
      expect(migrateCharacterState(null)).toBeNull();
      expect(migrateCharacterState("не состояние")).toBe("не состояние");
    });

  describe("поля, которые перестали принадлежать персонажу, читаются и отбрасываются", () => {
    const legacy = VERSION_FIVE;
    const forgotten = { turnTracking: legacy.turnTracking, reactionAvailable: legacy.reactionAvailable };

    it("сохранение прежней версии открывается", () => {
      expect(characterStateSchema.safeParse(migrateCharacterState(legacy)).success).toBe(true);
    });

    it("прочитанное состояние их не несёт: экономию хода считает лог, режим держит оболочка", () => {
      const state = characterStateSchema.parse(migrateCharacterState(legacy));
      expect(state).not.toHaveProperty("reactionAvailable");
      expect(state).not.toHaveProperty("turnTracking");
      expect(state).not.toHaveProperty("screenMode");
    });

    it("снимок отмены их теряет, а поля, которые состояние знает, оставляет", () => {
      const patch = { ...forgotten, spellSlots: legacy.spellSlots };
      expect(migrateUndoPatch(patch)).toEqual({ spellSlots: legacy.spellSlots });
    });

    it("снимок из одних забытых полей перестаёт быть снимком: возвращать по нему нечего", () => {
      expect(migrateUndoPatch(forgotten)).toBeNull();
    });

    it("пустой снимок пустым и остаётся: событие ничего не стоило, и снимок не потерян", () => {
      const nothingSpent = {};
      expect(migrateUndoPatch(nothingSpent)).toBe(nothingSpent);
    });
  });
});

const {
  intelligence: _derivedIntelligence,
  spellSaveDc: _derivedSaveDc,
  spellAttackModifier: _derivedAttack,
  constitutionSaveModifier: _derivedSave,
  armorClass: _derivedArmorClass,
  arcaneRecoveryAvailable: _recoveryFlag,
  hitPoints: _oneMaximum,
  ...UNCHANGED
} = VERSION_ONE;

const SPLIT_HIT_POINTS = { current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 };

const COMPONENTS = { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: ["identify"] };

const VERSION_TWO = {
  ...UNCHANGED,
  abilities: createThorne().abilities,
  itemBonuses: { spellcasting: 0, armorClass: 2, savingThrows: 0 },
  armorClass: { base: 10 },
  equipment: COMPONENTS,
  arcaneRecoveryAvailable: true,
  hitPoints: SPLIT_HIT_POINTS,
};

const VERSION_THREE = {
  ...UNCHANGED,
  abilities: createThorne().abilities,
  arcaneRecovery: { maximum: 4, remaining: 4 },
  hitPoints: SPLIT_HIT_POINTS,
  equipment: {
    otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    items: [
      { id: "healing-potion", nameRu: "Зелье лечения", kind: "potion", count: 2 },
      { id: "rope", nameRu: "Верёвка", kind: "junk", worn: true, count: 1 },
    ],
    components: COMPONENTS,
  },
};

const VERSION_FOUR = {
  ...UNCHANGED,
  abilities: createThorne().abilities,
  arcaneRecovery: { maximum: 4, remaining: 4 },
  hitPoints: SPLIT_HIT_POINTS,
  equipment: {
    armorClassBase: 16,
    otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    items: [{ id: "chain-mail", nameRu: "Кольчуга", kind: "gear", worn: true, count: 1 }],
    components: COMPONENTS,
  },
};

const VERSION_FIVE = {
  ...createThorne(),
  reactionAvailable: false,
  turnTracking: { enabled: true, actionAvailable: false, bonusActionAvailable: false },
  screenMode: "book",
};

const VERSION_SIX = createThorne();

describe("сохранение каждой версии открывается целиком, и числа за столом не едут", () => {
  it.each([
    ["1", VERSION_ONE, { current: 51, maximumBase: 60, armorClass: 12, saveDc: 15 }],
    ["2", VERSION_TWO, { current: 51, maximumBase: 60, armorClass: 12, saveDc: 15 }],
    ["3", VERSION_THREE, { current: 51, maximumBase: 60, armorClass: 12, saveDc: 15 }],
    ["4", VERSION_FOUR, { current: 51, maximumBase: 60, armorClass: 12, saveDc: 15 }],
    ["5", VERSION_FIVE, { current: 60, maximumBase: 60, armorClass: 14, saveDc: 16 }],
    ["6", VERSION_SIX, { current: 60, maximumBase: 60, armorClass: 14, saveDc: 16 }],
  ])("версия %s", (_version, save, expected) => {
    const state = characterStateSchema.parse(migrateCharacterState(save));
    const sheet = Character.of(state).sheet;

    expect(state.hitPoints.current).toBe(expected.current);
    expect(state.hitPoints.maximumBase).toBe(expected.maximumBase);
    expect(state.spellSlots[1]?.remaining).toBe(4);
    expect(sheet.value("spellSaveDc")).toBe(expected.saveDc);
    expect(sheet.value("armorClass")).toBe(expected.armorClass);
  });

  it("рода вещей версии 3 становятся признаками, надетость вне экипировки снимается", () => {
    const state = characterStateSchema.parse(migrateCharacterState(VERSION_THREE));
    expect(state.itemDefinitions.map((item) => item.kinds)).toEqual([
      ["consumable"],
      [],
      ["gear"],
      [],
    ]);
    expect(state.equipment.bag.map((entry) => entry.itemId)).toEqual([
      "healing-potion",
      "rope",
      Items.idFromName("жемчужина стоимостью не менее 100 зм"),
    ]);
    expect(state.equipment.worn.map((entry) => entry.itemId)).toEqual(["spellcasting-focus"]);
  });
});

describe("отметка фокусировки становится вещью", () => {
  const FLAG = "spellcastingFocus";

  const components = (spellcastingFocus: boolean) => ({
    componentPouch: false,
    materialsForSpellIds: [],
    spellcastingFocus,
  });

  const withItems = () => {
    const thorne = createThorne();
    return {
      ...thorne,
      itemDefinitions: thorne.itemDefinitions.map(({ spellcastingFocus: _moved, ...item }) => item),
      equipment: { ...thorne.equipment, components: components(true) },
    };
  };

  const withoutItems = (spellcastingFocus: boolean) => {
    const { itemDefinitions: _none, ...thorne } = createThorne();
    return { ...thorne, equipment: { bag: [], components: components(spellcastingFocus) } };
  };

  const componentsOf = (save: unknown): Record<string, unknown> =>
    fieldsOf(fieldsOf(fieldsOf(migrateCharacterState(save)).equipment).components);

  it("отметка фокусировки становится надетой вещью", () => {
    const state = characterStateSchema.parse(migrateCharacterState(withItems()));
    const focus = state.itemDefinitions.filter((item) => item.spellcastingFocus === true);

    expect(focus.map((item) => item.nameRu)).toEqual(["Магическая фокусировка +1"]);
    expect(state.equipment.worn).toEqual(createThorne().equipment.worn);
    expect(componentsOf(withItems())).not.toHaveProperty(FLAG);
  });

  it("снятая отметка вещи не заводит: фокусировки у персонажа не было", () => {
    const state = characterStateSchema.parse(migrateCharacterState(withoutItems(false)));

    expect(state.itemDefinitions).toEqual([]);
    expect(state.equipment.worn).toEqual([]);
    expect(componentsOf(withoutItems(false))).not.toHaveProperty(FLAG);
  });

  it("отметке без вещи приведение заводит вещь: фокусировка не теряется", () => {
    const state = characterStateSchema.parse(migrateCharacterState(withoutItems(true)));
    const [focus] = state.itemDefinitions;

    expect(focus?.nameRu).toBe("Магическая фокусировка");
    expect(focus?.spellcastingFocus).toBe(true);
    expect(state.equipment.worn).toEqual([{ itemId: focus?.id, count: 1 }]);
    expect(focus?.bonuses).toBeUndefined();
  });

  it("снимок отмены доносит отметку на самой вещи", () => {
    const stored = createThorne().itemDefinitions.filter((item) => item.spellcastingFocus === true);
    const patch = {
      itemDefinitions: stored.map(({ spellcastingFocus: _moved, ...item }) => item),
    };
    const returned = listOf(fieldsOf(migrateUndoPatch(patch)).itemDefinitions);

    expect(returned.map((item) => fieldsOf(item).spellcastingFocus)).toEqual([true]);
  });
});

describe("подавление огнём прежней формы", () => {
  it("признак огня прежней формы становится сроком", () => {
    const burned = characterStateSchema.parse(
      migrateCharacterState({
        ...VERSION_ONE,
        suppression: { firedUpon: true, underDirectSunlight: false },
      }),
    );
    expect(burned.suppression.firedUponTurnStarts).toBe(FIRE_SUPPRESSION_TURN_STARTS);

    const cooled = characterStateSchema.parse(migrateCharacterState(VERSION_ONE));
    expect(cooled.suppression.firedUponTurnStarts).toBe(0);
  });

  it("снимок отмены со старым признаком приводится вместе с состоянием", () => {
    const patch = migrateUndoPatch({
      suppression: { firedUpon: true, underDirectSunlight: false },
    });
    expect(fieldsOf(fieldsOf(patch).suppression).firedUponTurnStarts).toBe(
      FIRE_SUPPRESSION_TURN_STARTS,
    );
  });
});

describe("отметка купленного компонента становится вещью", () => {
  const LIST = "materialsForSpellIds";

  const withBought = (spellIds: unknown) => {
    const thorne = createThorne();
    return {
      ...thorne,
      equipment: {
        ...thorne.equipment,
        components: { componentPouch: false, [LIST]: spellIds },
      },
    };
  };

  const componentsOf = (save: unknown): Record<string, unknown> =>
    fieldsOf(fieldsOf(fieldsOf(migrateCharacterState(save)).equipment).components);

  it("купленный компонент прежнего сохранения становится вещью в сумке", () => {
    const state = characterStateSchema.parse(migrateCharacterState(withBought(["identify"])));
    const pearl = state.itemDefinitions.find((item) => item.nameRu.startsWith("жемчужина"));

    expect(pearl).toMatchObject({ kinds: [], price: { amount: 100, currency: "gold" } });
    expect(state.equipment.bag).toContainEqual({ itemId: pearl?.id, count: 1 });
    expect(componentsOf(withBought(["identify"]))).not.toHaveProperty(LIST);
  });

  it("пустой список вещей не заводит, а сумку Торна оставляет как была", () => {
    const state = characterStateSchema.parse(migrateCharacterState(withBought([])));

    expect(state.itemDefinitions).toEqual(createThorne().itemDefinitions);
    expect(state.equipment.bag).toEqual(createThorne().equipment.bag);
    expect(componentsOf(withBought([]))).not.toHaveProperty(LIST);
  });

  it("незнакомое заклинание вещи не получает: назвать её нечем", () => {
    const state = characterStateSchema.parse(migrateCharacterState(withBought(["fireball", 7])));

    expect(state.itemDefinitions).toEqual(createThorne().itemDefinitions);
    expect(state.equipment.bag).toEqual(createThorne().equipment.bag);
  });

  it("уже заведённая вещь второй не становится", () => {
    const once = fieldsOf(migrateCharacterState(withBought(["identify"])));
    const again = characterStateSchema.parse(
      migrateCharacterState({
        ...once,
        equipment: {
          ...fieldsOf(once.equipment),
          components: { componentPouch: false, [LIST]: ["identify"] },
        },
      }),
    );
    const pearls = (name: string) => name.startsWith("жемчужина");

    expect(again.itemDefinitions.filter((item) => pearls(item.nameRu))).toHaveLength(1);
    expect(again.equipment.bag.filter((entry) => pearls(entry.itemId))).toHaveLength(1);
  });

  it("порченую запись приведение не разбирает: отвечает за неё объявление", () => {
    const brokenList = withBought("identify");
    expect(migrateCharacterState(brokenList)).toBe(brokenList);

    const thorne = createThorne();
    const brokenBag = {
      ...thorne,
      equipment: { bag: "порча", components: { componentPouch: false, [LIST]: ["identify"] } },
    };
    expect(migrateCharacterState(brokenBag)).toBe(brokenBag);
    expect(() => characterStateSchema.parse(migrateCharacterState(brokenBag))).toThrow();
  });
});
