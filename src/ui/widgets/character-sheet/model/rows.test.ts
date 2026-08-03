import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { sheetBlocks } from "./rows";

const blockById = (id: string) => sheetBlocks(createThorne()).find((block) => block.id === id);

describe("блоки листа", () => {
  it("лист — только база персонажа, порядком бумажного листа (FR-230)", () => {
    expect(sheetBlocks(createThorne()).map((block) => block.id)).toEqual([
      "identity",
      "health",
      "armorClass",
      "marks",
      "miscBonuses",
      "ability:strength",
      "ability:dexterity",
      "ability:constitution",
      "ability:intelligence",
      "ability:wisdom",
      "ability:charisma",
      "proficiencies",
    ]);
  });

  it("прочие прибавки — карточка листа: вклад без вещи принадлежит персонажу (FR-243)", () => {
    const state = createThorne();
    const blessed = { ...state, miscBonuses: { spellcasting: 1, armorClass: -1, savingThrows: 0 } };
    const block = sheetBlocks(blessed).find((candidate) => candidate.id === "miscBonuses");
    expect(block?.edit).toEqual({ block: "miscBonuses" });
    expect(block?.rows).toEqual([
      { labelRu: "К магии", value: "+1" },
      { labelRu: "К защите", value: "−1" },
      { labelRu: "Ко всем спасброскам", value: "+0" },
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
    const rows = sheetBlocks(hurt).find((block) => block.id === "health")?.rows ?? [];
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
      sheetBlocks({ ...state, temporaryHitPoints: 5 }).find((block) => block.id === "health")
        ?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Хиты", value: "60 из 60", hint: "+5 временных" });
  });

  it("состояние без Костей хитов называет их прочерком", () => {
    const { hitDice: _none, ...withoutDice } = createThorne();
    const rows = sheetBlocks(withoutDice).find((block) => block.id === "health")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Кости хитов", value: "—" });
  });

  it("отметки мастера читаются словами", () => {
    const state = createThorne();
    const marked = { ...state, exhaustion: 3, inspiration: true };
    const rows = sheetBlocks(marked).find((block) => block.id === "marks")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Истощение", value: "ступень 3" });
    expect(rows).toContainEqual({ labelRu: "Вдохновение", value: "есть" });
    expect(blockById("marks")?.rows).toContainEqual({ labelRu: "Истощение", value: "нет" });
  });

  it("перебитое число — отметка мастера: стоит в его блоке с подсказкой (FR-230)", () => {
    const state = createThorne();
    const overridden = { ...state, overrides: { ...state.overrides, spellSaveDc: 18, initiative: 5 } };
    const rows = sheetBlocks(overridden).find((block) => block.id === "marks")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "КС спасброска", value: "18", hint: "введено руками" });
    expect(rows).toContainEqual({ labelRu: "Инициатива", value: "+5", hint: "введено руками" });
    // Не перебитое в отметках не перечисляется: формула — не отметка.
    expect(rows?.some((row) => row.labelRu === "Атака заклинанием")).toBe(false);
  });

  it("перебивки открываются второй кнопкой блока отметок", () => {
    expect(blockById("marks")?.secondary).toEqual({
      labelRu: "Перебивки",
      edit: { block: "combatNumbers" },
    });
  });

  it("блок КД показывает слагаемые и подсказку по надетому доспеху", () => {
    const rows = blockById("armorClass")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "База", value: "10", hint: "без доспехов" });
    expect(rows).toContainEqual({ labelRu: "Ловкость", value: "+2" });
    expect(rows).toContainEqual({ labelRu: "Вещи", value: "+2" });
  });

  it("перебивка базы КД меняет подсказку на \"введено руками\"", () => {
    const state = createThorne();
    const overridden = { ...state, overrides: { ...state.overrides, armorClassBase: 12 } };
    const rows = sheetBlocks(overridden).find((block) => block.id === "armorClass")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "База", value: "12", hint: "введено руками" });
  });

  it("надетый доспех называется в подсказке базы КД", () => {
    const state = createThorne();
    const withArmor = {
      ...state,
      equipment: {
        ...state.equipment,
        items: [
          ...state.equipment.items,
          { id: "scale-mail", nameRu: "Чешуйчатый доспех", kind: "gear" as const, worn: true, count: 1, armorBase: 14 },
        ],
      },
    };
    const rows = sheetBlocks(withArmor).find((block) => block.id === "armorClass")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "База", value: "14", hint: "Чешуйчатый доспех" });
  });

  it("чисел боя и вещей на листе нет: их дом — шапка «Игры» и «Сумка» (FR-230)", () => {
    const ids = sheetBlocks(createThorne()).map((block) => block.id);
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
    const skillRows = sheetBlocks(createThorne())
      .filter((block) => block.id.startsWith("ability:"))
      // Значение и спасбросок есть у каждой характеристики; остальное — её навыки.
      .flatMap((block) => block.rows.slice(2));
    expect(skillRows).toHaveLength(18);
    expect(skillRows).toContainEqual({ labelRu: "Скрытность", value: "+2" });
  });

  it("владение и компетентность названы подсказкой", () => {
    const state = createThorne();
    const trained = { ...state, skills: { arcana: "expert" as const } };
    const rows = sheetBlocks(trained).find((block) => block.id === "ability:intelligence")?.rows ?? [];
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
    expect(blockById("ability:wisdom")?.edit).toEqual({ block: "ability", ability: "wisdom" });
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
    const rows = sheetBlocks(armed).find((block) => block.id === "proficiencies")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Языки", value: "Общий, Великаний" });
  });
});
