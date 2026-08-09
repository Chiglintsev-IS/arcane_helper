import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { toSheetView } from "@/core/presentation/views/sheetView";
import { sheetBlocks } from "./rows";

/** Проекцию строит настоящий презентер: подделка рядом проверяла бы себя, а не приложение. */
const blocksOf = (character: CharacterState) => sheetBlocks(toSheetView(character));

const blockById = (id: string) => blocksOf(createThorne()).find((block) => block.id === id);

describe("блоки листа", () => {
  it("лист — только база персонажа, порядком бумажного листа (FR-230)", () => {
    expect(blocksOf(createThorne()).map((block) => block.id)).toEqual([
      "identity",
      "health",
      "armorClass",
      "marks",
      "permanentContributions",
      "ability:strength",
      "ability:dexterity",
      "ability:constitution",
      "ability:intelligence",
      "ability:wisdom",
      "ability:charisma",
      "proficiencies",
    ]);
  });

  it("постоянные вклады — карточка листа: вклад без вещи принадлежит персонажу (FR-243)", () => {
    const blessed = {
      ...createThorne(),
      permanentContributions: [
        { nameRu: "Дар", contribution: { stat: "spellSaveDc", kind: "bonus", value: 1 } as const },
        { nameRu: "Проклятие", contribution: { stat: "armorClass", kind: "bonus", value: -1 } as const },
        {
          nameRu: "Слово мастера",
          contribution: { stat: "initiative", kind: "assignment", value: 5 } as const,
        },
      ],
    };
    const block = blocksOf(blessed).find((candidate) => candidate.id === "permanentContributions");

    expect(block?.edit).toEqual({ block: "permanent" });
    expect(block?.rows).toEqual([
      { labelRu: "Дар", value: "+1", hint: "КС спасброска" },
      { labelRu: "Проклятие", value: "−1", hint: "Класс Доспеха" },
      { labelRu: "Слово мастера", value: "= 5", hint: "Инициатива" },
    ]);
  });

  it("кто он — вид, возраст и класс с уровнем", () => {
    const rows = blockById("identity")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Вид", value: "Лунный тролль" });
    expect(rows).toContainEqual({ labelRu: "Класс", value: "Волшебник, 7" });
    expect(rows).toContainEqual({ labelRu: "Подкласс", value: "Создатель рун" });
  });

  it("незаполненное справочное поле называется прочерком, а не нулём", () => {
    expect(blockById("identity")?.rows).toContainEqual({ labelRu: "Возраст", value: "—" });
  });

  it("здоровье показывает действующее число, а снижения называет подсказкой (FR-240)", () => {
    const state = createThorne();
    const hurt = {
      ...state,
      hitPoints: { current: 30, maximumBase: 60, bloodReduction: 6, masterReduction: 4 },
    };
    const rows = blocksOf(hurt).find((block) => block.id === "health")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Хиты", value: "30 из 50" });
    expect(rows).toContainEqual({
      labelRu: "Максимум",
      value: "50",
      hint: "60 −6 кровью, −4 мастером",
    });
  });

  it("целый максимум подсказки не несёт: объяснять нечего", () => {
    const rows = blockById("health")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Максимум", value: "60" });
  });

  it("временные хиты видны на листе сразу, как только они есть (FR-240)", () => {
    const state = createThorne();
    const rows =
      blocksOf({ ...state, temporaryHitPoints: 5 }).find((block) => block.id === "health")?.rows ??
      [];
    expect(rows).toContainEqual({ labelRu: "Хиты", value: "60 из 60", hint: "+5 временных" });
  });

  it("состояние без Костей хитов называет их прочерком", () => {
    const { hitDice: _none, ...withoutDice } = createThorne();
    const rows = blocksOf(withoutDice).find((block) => block.id === "health")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Кости хитов", value: "—" });
  });

  it("отметки мастера читаются словами", () => {
    const state = createThorne();
    const marked = { ...state, exhaustion: 3, inspiration: true };
    const rows = blocksOf(marked).find((block) => block.id === "marks")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Истощение", value: "ступень 3" });
    expect(rows).toContainEqual({ labelRu: "Вдохновение", value: "есть" });
    expect(blockById("marks")?.rows).toContainEqual({ labelRu: "Истощение", value: "нет" });
  });

  it("постоянные вклады стоят своим блоком: имя, число и величина (FR-246)", () => {
    const withGift = {
      ...createThorne(),
      permanentContributions: [
        { nameRu: "Дар богов", contribution: { stat: "initiative", kind: "bonus", value: 5 } as const },
      ],
    };
    const rows =
      blocksOf(withGift).find((block) => block.id === "permanentContributions")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Дар богов", value: "+5", hint: "Инициатива" });
  });

  it("блок КД показывает итог и разбор с источниками", () => {
    const rows = blockById("armorClass")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Итог", value: "14" });
    expect(rows).toContainEqual({ labelRu: "Мантия +1", value: "+1" });
    expect(rows).toContainEqual({ labelRu: "Плащ защиты", value: "+1" });
  });

  it("надетый доспех виден в разборе своей базой", () => {
    const state = createThorne();
    const withArmor = {
      ...state,
      itemDefinitions: [
        ...state.itemDefinitions,
        { id: "scale-mail", nameRu: "Чешуйчатый доспех", kind: "gear" as const, armor: { base: 14 } },
      ],
      equipment: {
        ...state.equipment,
        worn: [...state.equipment.worn, { itemId: "scale-mail", count: 1 }],
      },
    };
    const rows = blocksOf(withArmor).find((block) => block.id === "armorClass")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Чешуйчатый доспех", value: "база 14" });
    expect(rows).toContainEqual({ labelRu: "Итог", value: "18" });
  });

  it("чисел боя и вещей на листе нет: их дом — шапка «Игры» и «Сумка» (FR-230)", () => {
    const ids = blocksOf(createThorne()).map((block) => block.id);
    expect(ids).not.toContain("combatNumbers");
    expect(ids).not.toContain("inventory");
    expect(ids).not.toContain("armorClassBase");
    expect(ids).not.toContain("itemBonuses");
  });

  it("характеристика держит значение, спасбросок и свои навыки — как на бумажном листе", () => {
    expect(blockById("ability:intelligence")?.rows).toEqual([
      { labelRu: "Значение", value: "18 (+4)" },
      { labelRu: "Спасбросок", value: "+8", hint: "владение" },
      { labelRu: "Магия", value: "+7", hint: "владение" },
      { labelRu: "История", value: "+4" },
      { labelRu: "Расследование", value: "+7", hint: "владение" },
      { labelRu: "Природа", value: "+7", hint: "владение" },
      { labelRu: "Религия", value: "+4" },
    ]);
  });

  it("характеристика без навыков — только значение и спасбросок", () => {
    expect(blockById("ability:constitution")?.rows).toEqual([
      { labelRu: "Значение", value: "16 (+3)" },
      { labelRu: "Спасбросок", value: "+4" },
    ]);
  });

  it("все восемнадцать навыков разложены по шести блокам и ни один не потерян", () => {
    const skillRows = blocksOf(createThorne())
      .filter((block) => block.id.startsWith("ability:"))
      // Значение и спасбросок есть у каждой характеристики; остальное — её навыки.
      .flatMap((block) => block.rows.slice(2));
    expect(skillRows).toHaveLength(18);
    expect(skillRows).toContainEqual({ labelRu: "Скрытность", value: "+2" });
  });

  it("владение и компетентность названы подсказкой", () => {
    const state = createThorne();
    const trained = { ...state, skills: { arcana: "expert" as const } };
    const rows = blocksOf(trained).find((block) => block.id === "ability:intelligence")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Магия", value: "+10", hint: "компетентность" });
  });

  it("спасбросок без владения подсказки не несёт", () => {
    expect(blockById("ability:strength")?.rows).toContainEqual({
      labelRu: "Спасбросок",
      value: "+0",
    });
  });

  it("отрицательный модификатор характеристики печатается тем же минусом, что в значке", () => {
    // Сила Торна — 8: модификатор −1, и минус обязан быть типографским, а не дефисом.
    expect(blockById("ability:strength")?.rows).toContainEqual({
      labelRu: "Значение",
      value: "8 (−1)",
    });
  });

  it("каждый блок называет свою шторку, а уровень правится второй кнопкой", () => {
    const wisdom = blockById("ability:wisdom")?.edit;
    // Шторка получает саму характеристику: второго поиска той же записи по имени не заводится.
    expect(wisdom?.block).toBe("ability");
    expect(wisdom?.block === "ability" ? wisdom.ability.id : null).toBe("wisdom");
    expect(blockById("identity")?.secondary).toEqual({
      labelRu: "Уровень",
      edit: { block: "level" },
    });
    // Снаряжение и языки правятся тем же окном, что и «Кто он»: это одна запись листа.
    expect(blockById("proficiencies")?.edit).toEqual({ block: "identity" });
  });

  it("пустой список владений называется прочерком", () => {
    expect(blockById("proficiencies")?.rows).toContainEqual({ labelRu: "Языки", value: "—" });
  });

  it("заполненный список владений перечисляется через запятую", () => {
    const state = createThorne();
    const armed = {
      ...state,
      proficiencies: { ...state.proficiencies, languages: ["Общий", "Великаний"] },
    };
    const rows = blocksOf(armed).find((block) => block.id === "proficiencies")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Языки", value: "Общий, Великаний" });
  });
});
