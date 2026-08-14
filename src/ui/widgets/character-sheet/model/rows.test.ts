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
      "marks",
      "ability:strength",
      "ability:dexterity",
      "ability:constitution",
      "ability:intelligence",
      "ability:wisdom",
      "ability:charisma",
      "proficiencies",
      "languages",
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

  it("отметки мастера читаются словами", () => {
    const state = createThorne();
    const marked = { ...state, exhaustion: 3, inspiration: true };
    const rows = blocksOf(marked).find((block) => block.id === "marks")?.rows ?? [];
    expect(rows).toContainEqual({ labelRu: "Истощение", value: "ступень 3" });
    expect(rows).toContainEqual({ labelRu: "Вдохновение", value: "есть" });
    expect(blockById("marks")?.rows).toContainEqual({ labelRu: "Истощение", value: "нет" });
  });

  it("чисел боя и вещей на листе нет: их дом — шапка «Игры» и «Сумка» (FR-230)", () => {
    const ids = blocksOf(createThorne()).map((block) => block.id);
    expect(ids).not.toContain("combatNumbers");
    expect(ids).not.toContain("inventory");
    expect(ids).not.toContain("armorClassBase");
    expect(ids).not.toContain("itemBonuses");
    // Хиты и Кости хитов двигает игра: их дом — шапка «Игры» и «Привал», а не лист.
    expect(ids).not.toContain("health");
    expect(blocksOf(createThorne()).flatMap((block) => block.rows.map((row) => row.labelRu))).not
      .toContain("Кости хитов");
  });

  it("Класса Доспеха на листе нет: надетое и заклинания двигают его в «Игре» (FR-230)", () => {
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
    // Ни блока, ни разбора, ни строки итога: КД на листе не показывают, потому что не правят.
    expect(blocksOf(withArmor).map((block) => block.id)).not.toContain("armorClass");
    expect(blocksOf(withArmor).flatMap((block) => block.rows.map((row) => row.labelRu))).not.toContain(
      "Чешуйчатый доспех",
    );
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
    // У владений и языков своя шторка: правят их порознь, потому что и спрашивают порознь.
    expect(blockById("proficiencies")?.edit).toEqual({ block: "proficiencies" });
    expect(blockById("languages")?.edit).toEqual({ block: "languages" });
  });

  it("владения и языки стоят порознь, а снаряжения на листе нет вовсе (FR-230)", () => {
    const state = createThorne();
    const armed = {
      ...state,
      proficiencies: {
        ...state.proficiencies,
        tools: ["Алхимические принадлежности", "Инструменты кузнеца"],
        languages: ["Общий", "Великаний"],
      },
    };
    const proficiencies = blocksOf(armed).find((block) => block.id === "proficiencies");
    const languages = blocksOf(armed).find((block) => block.id === "languages");

    // Владение вещью — умение самого Торна; снаряжение — то, что лежит в сумке, и слова этого здесь нет.
    expect(blocksOf(armed).map((block) => block.titleRu)).not.toContain("Снаряжение и языки");
    expect(proficiencies?.rows).toContainEqual({
      labelRu: "Инструменты",
      value: "Алхимические принадлежности, Инструменты кузнеца",
    });
    expect(proficiencies?.rows.map((row) => row.labelRu)).toEqual(["Оружие", "Доспехи", "Инструменты"]);
    expect(languages?.rows).toEqual([{ labelRu: "Знает", value: "Общий, Великаний" }]);
  });

  it("пустой список владений называется прочерком", () => {
    expect(blockById("languages")?.rows).toContainEqual({ labelRu: "Знает", value: "—" });
    expect(blockById("proficiencies")?.rows).toContainEqual({ labelRu: "Доспехи", value: "—" });
  });
});
