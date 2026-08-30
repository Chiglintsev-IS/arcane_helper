import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { toSheetView } from "@/core/presentation/views/sheetView";
import { abilityLedger, sheetBlocks } from "./rows";

const blocksOf = (character: CharacterState) => sheetBlocks(toSheetView(character));
const ledgerOf = (character: CharacterState) => abilityLedger(toSheetView(character));

const blockById = (id: string) => blocksOf(createThorne()).find((block) => block.id === id);
const abilityById = (id: string) => ledgerOf(createThorne()).find((ability) => ability.id === id);

describe("«Кто он» — то, что спрашивают раз за вечер", () => {
  it("карточки называют персонажа и его владения, а бросков среди них нет (FR-230)", () => {
    expect(blocksOf(createThorne()).map((block) => block.id)).toEqual([
      "identity",
      "proficiencies",
      "languages",
      "features",
    ]);
  });

  it("особенности стоят своей карточкой и читаются фразой (FR-230)", () => {
    const block = blockById("features");

    expect(block?.features?.map((feature) => feature.nameRu)).toEqual(["Рунный почерк"]);
    expect(block?.features?.[0]?.summaryRu).toContain("Минута изучения записи");
    expect(block?.rows).toEqual([]);
    expect(block?.edit).toBeUndefined();
  });

  it("особенностей нет ни одной — карточка остаётся пустым списком", () => {
    const featureless = blocksOf({ ...createThorne(), features: [] });
    expect(featureless.find((block) => block.id === "features")?.features).toEqual([]);
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

  it("размера и скорости здесь нет: их называют, пока ходят, и живут они в шапке «Игры»", () => {
    const labels = (blockById("identity")?.rows ?? []).map((row) => row.labelRu);
    expect(labels).toEqual(["Имя", "Вид", "Возраст", "Класс", "Подкласс"]);
  });

  it("отметок мастера на листе нет: их ставят там, где мастер их и называет (FR-232)", () => {
    const marked = blocksOf({ ...createThorne(), exhaustion: 3, inspiration: true });
    expect(marked.map((block) => block.id)).not.toContain("marks");
    expect(marked.flatMap((block) => block.rows.map((row) => row.labelRu))).not.toContain(
      "Истощение",
    );
  });

  it("чисел боя и вещей на листе нет: их дом — шапка «Игры» и «Сумка» (FR-230)", () => {
    const ids = blocksOf(createThorne()).map((block) => block.id);
    expect(ids).not.toContain("combatNumbers");
    expect(ids).not.toContain("inventory");
    expect(ids).not.toContain("armorClassBase");
    expect(ids).not.toContain("itemBonuses");
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
    expect(blocksOf(withArmor).map((block) => block.id)).not.toContain("armorClass");
    expect(blocksOf(withArmor).flatMap((block) => block.rows.map((row) => row.labelRu))).not.toContain(
      "Чешуйчатый доспех",
    );
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

  it("каждая карточка называет свою шторку, а уровень правится второй кнопкой", () => {
    expect(blockById("identity")?.secondary).toEqual({
      labelRu: "Уровень",
      edit: { block: "level" },
    });
    expect(blockById("proficiencies")?.edit).toEqual({ block: "proficiencies" });
    expect(blockById("languages")?.edit).toEqual({ block: "languages" });
  });
});

describe("«Броски» — гроссбух того, чем отвечают на просьбу бросить", () => {
  it("шесть характеристик порядком бумажного листа, ни одной лишней", () => {
    expect(ledgerOf(createThorne()).map((ability) => ability.id)).toEqual([
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ]);
  });

  it("характеристика держит значение, модификатор, спасбросок и свои навыки", () => {
    const intelligence = abilityById("intelligence");

    expect(intelligence?.titleRu).toBe("Интеллект");
    expect(intelligence?.score).toBe("18");
    expect(intelligence?.modifier).toBe("+4");
    expect(intelligence?.save).toBe("+8");
    expect(intelligence?.skills).toEqual([
      { id: "arcana", labelRu: "Аркана", value: "+7", training: { glyph: "●", labelRu: "владение" } },
      { id: "history", labelRu: "История", value: "+4" },
      { id: "investigation", labelRu: "Анализ", value: "+7", training: { glyph: "●", labelRu: "владение" } },
      { id: "nature", labelRu: "Природа", value: "+7", training: { glyph: "●", labelRu: "владение" } },
      { id: "religion", labelRu: "Религия", value: "+4" },
    ]);
  });

  it("у Телосложения навыков нет — группа состоит из одной шапки", () => {
    expect(abilityById("constitution")?.skills).toEqual([]);
    expect(abilityById("constitution")?.modifier).toBe("+3");
  });

  it("все восемнадцать навыков разложены по шести группам и ни один не потерян", () => {
    const skills = ledgerOf(createThorne()).flatMap((ability) => ability.skills);
    expect(skills).toHaveLength(18);
    expect(skills).toContainEqual({ id: "stealth", labelRu: "Скрытность", value: "+2" });
  });

  it("владение отмечено знаком, и знак назван словом — иначе точка ничего не значит", () => {
    expect(abilityById("intelligence")?.saveTraining).toEqual({ glyph: "●", labelRu: "владение" });
    expect(abilityById("strength")?.saveTraining).toBeUndefined();
  });

  it("компетентность носит свой знак: она входит в число дважды и читается иначе", () => {
    const trained = ledgerOf({ ...createThorne(), skills: { arcana: "expert" as const } });
    const arcana = trained
      .flatMap((ability) => ability.skills)
      .find((skill) => skill.id === "arcana");
    expect(arcana).toEqual({
      id: "arcana",
      labelRu: "Аркана",
      value: "+10",
      training: { glyph: "◆", labelRu: "компетентность" },
    });
  });

  it("отрицательный модификатор печатается тем же минусом, что и в значке", () => {
    expect(abilityById("strength")?.modifier).toBe("−1");
  });

  it("шапка зовётся голосом целиком: числа столбцов подписаны словами, а не местом в сетке", () => {
    expect(abilityById("intelligence")?.accessibleName).toBe(
      "Интеллект 18, +4, Спасбросок +8, владение. Правка: Интеллект",
    );
    expect(abilityById("strength")?.accessibleName).toBe(
      "Сила 8, −1, Спасбросок +0. Правка: Сила",
    );
  });

  it("группа называет свою шторку и отдаёт ей саму характеристику", () => {
    const wisdom = abilityById("wisdom")?.edit;
    expect(wisdom?.block).toBe("ability");
    expect(wisdom?.block === "ability" ? wisdom.ability.id : null).toBe("wisdom");
  });
});
