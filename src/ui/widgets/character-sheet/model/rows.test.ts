import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { sheetBlocks } from "./rows";

const blockById = (id: string) => sheetBlocks(createThorne()).find((block) => block.id === id);

const byTab = (tab: string) =>
  sheetBlocks(createThorne())
    .filter((block) => block.tab === tab)
    .map((block) => block.id);

describe("блоки листа", () => {
  it("вкладка «Персонаж» идёт порядком бумажного листа и держит действующие числа", () => {
    expect(byTab("character")).toEqual([
      "identity",
      "combatNumbers",
      "health",
      "marks",
      "ability:strength",
      "ability:dexterity",
      "ability:constitution",
      "ability:intelligence",
      "ability:wisdom",
      "ability:charisma",
      "proficiencies",
    ]);
  });

  it("вещи, доспех и прибавки живут одной вкладкой, а не тремя", () => {
    expect(byTab("items")).toEqual(["inventory", "armorClassBase", "itemBonuses"]);
  });

  it("строка вещи открывает её саму, а кнопки правки у списка нет", () => {
    expect(blockById("inventory")?.editable).toBe(false);
    expect(blockById("inventory")?.quickAddLabelRu).toBe("Новая вещь");
    expect(blockById("inventory")?.rows[0]?.openId).toBe("item:spellcasting-focus");
  });

  it("пустой инвентарь называется пустым, надетая вещь — своим вкладом", () => {
    const bare = createThorne();
    const empty = { ...bare, equipment: { ...bare.equipment, items: [] } };
    expect(sheetBlocks(empty).find((block) => block.id === "inventory")?.rows).toEqual([
      { labelRu: "Пусто", value: "—" },
    ]);

    const state = createThorne();
    const withRing = {
      ...state,
      equipment: {
        ...state.equipment,
        items: [
          {
            id: "ring",
            nameRu: "Кольцо защиты",
            worn: true,
            count: 1,
            bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
          },
        ],
      },
    };
    const rows = sheetBlocks(withRing).find((block) => block.id === "inventory")?.rows ?? [];
    expect(rows).toContainEqual({
      labelRu: "Кольцо защиты",
      value: "надето",
      hint: "защита +1, спасброски +1",
      openId: "item:ring",
    });
  });

  it("подсказка называет только то, что вещь действительно даёт", () => {
    const state = createThorne();
    const items = [
      {
        id: "staff",
        nameRu: "Посох",
        worn: false,
        count: 1,
        bonuses: { spellcasting: 1, armorClass: 0, savingThrows: 0 },
      },
      { id: "rope", nameRu: "Верёвка", worn: false, count: 1 },
    ];
    const rows =
      sheetBlocks({ ...state, equipment: { ...state.equipment, items } }).find(
        (block) => block.id === "inventory",
      )?.rows ?? [];

    expect(rows).toContainEqual({
      labelRu: "Посох",
      value: "в сумке",
      hint: "магия +1",
      openId: "item:staff",
    });
    // Верёвка в счёте не участвует, и подсказки у неё нет вовсе.
    expect(rows).toContainEqual({ labelRu: "Верёвка", value: "в сумке", openId: "item:rope" });
  });

  it("количество больше одной штуки и вид вещи показаны в «Инвентаре»", () => {
    const state = createThorne();
    const items = [
      { id: "healing-potion", nameRu: "Зелье лечения", worn: false, count: 3, kind: "potion" as const },
    ];
    const rows =
      sheetBlocks({ ...state, equipment: { ...state.equipment, items } }).find(
        (block) => block.id === "inventory",
      )?.rows ?? [];

    expect(rows).toContainEqual({
      labelRu: "Зелье лечения",
      value: "в сумке ×3",
      hint: "Зелье",
      openId: "item:healing-potion",
    });
  });

  it("заметка вещи попадает в подсказку рядом с прибавками", () => {
    const rows = blockById("inventory")?.rows ?? [];
    expect(rows).toContainEqual({
      labelRu: "Комплект болотной маскировки",
      value: "в сумке",
      hint: "1d4 к Скрытности в болотах",
      openId: "item:swamp-camouflage-kit",
    });
    expect(rows).toContainEqual({
      labelRu: "Плащ защиты",
      value: "надето",
      hint: "защита +1, спасброски +1",
      openId: "item:cloak-of-protection",
    });
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

  it("числа боя со знаком там, где он есть", () => {
    const rows = blockById("combatNumbers")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "КС спасброска", value: "16" });
    expect(rows).toContainEqual({ labelRu: "Атака заклинанием", value: "+8" });
    expect(rows).toContainEqual({ labelRu: "Класс Доспеха", value: "14" });
  });

  it("перебитое число помечено подсказкой", () => {
    const state = createThorne();
    const overridden = { ...state, overrides: { ...state.overrides, spellSaveDc: 18 } };
    const rows = sheetBlocks(overridden).find((block) => block.id === "combatNumbers")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "КС спасброска", value: "18", hint: "введено руками" });
  });

  it("здоровье показывает действующее число, а снижения называет подсказкой", () => {
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

  it("временные хиты видны на листе сразу, как только они есть", () => {
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
    expect(blockById("ability:wisdom")?.editId).toBe("ability:wisdom");
    expect(blockById("identity")?.secondary).toEqual({ labelRu: "Уровень", editId: "level" });
    // Снаряжение и языки правятся тем же окном, что и «Кто он»: это одна запись листа.
    expect(blockById("proficiencies")?.editId).toBe("identity");
  });

  it("отметки мастера читаются словами", () => {
    const state = createThorne();
    const marked = { ...state, exhaustion: 3, inspiration: true };
    const rows = sheetBlocks(marked).find((block) => block.id === "marks")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Истощение", value: "ступень 3" });
    expect(rows).toContainEqual({ labelRu: "Вдохновение", value: "есть" });
    expect(blockById("marks")?.rows).toContainEqual({ labelRu: "Истощение", value: "нет" });
  });

  it("прибавки без вещи показаны со знаком и у Торна равны нулю", () => {
    expect(blockById("itemBonuses")?.rows).toContainEqual({ labelRu: "К защите", value: "+0" });
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
