// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { AbilitySheet } from "./AbilitySheet";
import { HealthSheet } from "./HealthSheet";
import { IdentitySheet } from "./IdentitySheet";
import { ItemSheet } from "./ItemSheet";
import { MoneySheet } from "./MoneySheet";
import { ItemBonusesSheet } from "./ItemBonusesSheet";
import { LevelSheet } from "./LevelSheet";
import { MarksSheet } from "./MarksSheet";
import { OverrideSheet } from "./OverrideSheet";

afterEach(cleanup);

describe("шторки правки листа", () => {
  it("характеристика: шторка держит значение, спасбросок и её навыки", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet
        ability="intelligence"
        character={createThorne()}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    // Ровно пять навыков Интеллекта и ни одного чужого: блок и шторка держат одно и то же.
    expect(screen.getByRole("radiogroup", { name: "Магия" })).toBeDefined();
    expect(screen.queryByRole("radiogroup", { name: "Скрытность" })).toBeNull();

    const field = screen.getByLabelText("Значение");
    await userEvent.clear(field);
    await userEvent.type(field, "20");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Владения приходят из листа и возвращаются нетронутыми: правили значение, а не навыки.
    expect(onSave).toHaveBeenCalledWith({
      ability: "intelligence",
      score: 20,
      saveProficient: true,
      skills: { arcana: "proficient", investigation: "proficient", nature: "proficient" },
    });
  });

  it("характеристика: значение вне диапазона не сохраняется", async () => {
    render(
      <AbilitySheet
        ability="strength"
        character={createThorne()}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );

    const field = screen.getByLabelText("Значение");
    await userEvent.clear(field);
    await userEvent.type(field, "31");

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("характеристика: владение спасброском снимается переключателем", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet
        ability="intelligence"
        character={createThorne()}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Владение спасброском" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].saveProficient).toBe(false);
  });

  it("уровень: показывает, что изменится, до подтверждения", async () => {
    render(<LevelSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "8");

    expect(screen.getByText(/Ячейки 4 уровня: 1 → 2/)).toBeDefined();
    expect(screen.getByText(/Кости хитов: 7 → 8/)).toBeDefined();
    expect(screen.getByText(/Лимит подготовки: 11 → 12/)).toBeDefined();
  });

  it("уровень: рост бонуса мастерства двигает руны", async () => {
    render(<LevelSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "9");

    expect(screen.getByText(/Руны: 3 → 4/)).toBeDefined();
  });

  it("уровень: вне диапазона 1–20 перечня изменений нет и сохранить нельзя", async () => {
    render(<LevelSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "21");

    expect(screen.queryByText(/Ячейки/)).toBeNull();
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("уровень: максимум хитов подсказывает среднее, но не подставляет", () => {
    render(<LevelSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Базовый максимум хитов")).toHaveProperty("value", "60");
    expect(screen.getByText(/среднее за уровень: \+7/)).toBeDefined();
  });

  it("уровень: сохранение отдаёт уровень и введённый максимум", async () => {
    const onSave = vi.fn();
    render(<LevelSheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    const level = screen.getByLabelText("Уровень");
    await userEvent.clear(level);
    await userEvent.type(level, "8");
    const maximum = screen.getByLabelText("Базовый максимум хитов");
    await userEvent.clear(maximum);
    await userEvent.type(maximum, "66");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ level: 8, hitPointMaximumBase: 66 });
  });

  it("отметки мастера: ступень истощения от нуля до шести", async () => {
    const onSave = vi.fn();
    render(<MarksSheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("radio", { name: "Ступень 3" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ exhaustion: 3, inspiration: false });
  });

  it("отметки мастера: вдохновение переключается", async () => {
    const onSave = vi.fn();
    render(<MarksSheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    await userEvent.click(screen.getByLabelText("Вдохновение"));
    await userEvent.click(screen.getByRole("radio", { name: "Без истощения" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ exhaustion: 0, inspiration: true });
  });

  it("здоровье: снижение кровью показано, но не правится", () => {
    const state = createThorne();
    const hurt = {
      ...state,
      hitPoints: { current: 40, maximumBase: 60, bloodReduction: 6, masterReduction: 0 },
    };
    render(<HealthSheet character={hurt} onSave={() => {}} onCancel={() => {}} />);

    expect(screen.getByText(/Снижение кровью — 6/)).toBeDefined();
    expect(screen.queryByLabelText("Снижение кровью")).toBeNull();
  });

  it("здоровье: максимум ниже уже снятого кровью не сохраняется", async () => {
    const state = createThorne();
    const hurt = {
      ...state,
      hitPoints: { current: 40, maximumBase: 60, bloodReduction: 6, masterReduction: 0 },
    };
    render(<HealthSheet character={hurt} onSave={() => {}} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));
    await userEvent.type(screen.getByLabelText("Базовый максимум"), "6");

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("здоровье: пустое поле показывает прочерк вместо действующего максимума", async () => {
    render(<HealthSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));

    expect(screen.getByText(/Действующий максимум станет —/)).toBeDefined();
  });

  it("здоровье: сохранение отдаёт базу и снижение мастера", async () => {
    const onSave = vi.fn();
    render(<HealthSheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Снижение мастера"));
    await userEvent.type(screen.getByLabelText("Снижение мастера"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ maximumBase: 60, masterReduction: 10 });
  });

  it("перебивка: «По формуле» снимает введённое руками", async () => {
    const onSave = vi.fn();
    render(
      <OverrideSheet
        id="spellSaveDc"
        formulaValue={16}
        currentValue={18}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "По формуле" }));

    expect(onSave).toHaveBeenCalledWith(null);
  });

  it("перебивка: введённое число сохраняется, формула названа рядом", async () => {
    const onSave = vi.fn();
    render(
      <OverrideSheet
        id="spellSaveDc"
        formulaValue={16}
        currentValue={16}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("По формуле — 16.")).toBeDefined();
    await userEvent.clear(screen.getByLabelText("Значение"));
    await userEvent.type(screen.getByLabelText("Значение"), "18");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith(18);
  });

  it("перебивка: пустое поле не сохраняется", async () => {
    render(
      <OverrideSheet
        id="initiative"
        formulaValue={2}
        currentValue={2}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Значение"));

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("характеристика: навык переключается в три состояния", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet
        ability="intelligence"
        character={createThorne()}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const arcana = screen.getByRole("radiogroup", { name: "Магия" });
    await userEvent.click(within(arcana).getByRole("radio", { name: "компетентность" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].skills).toEqual({
      arcana: "expert",
      investigation: "proficient",
      nature: "proficient",
    });
  });

  it("характеристика: «нет» убирает навык, а не записывает значение", async () => {
    const onSave = vi.fn();
    const state = createThorne();
    render(
      <AbilitySheet
        ability="intelligence"
        character={{ ...state, skills: { arcana: "proficient" } }}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const arcana = screen.getByRole("radiogroup", { name: "Магия" });
    await userEvent.click(within(arcana).getByRole("radio", { name: "нет" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].skills).toEqual({});
  });

  it("кто он: список владений режется по запятой, пустая строка даёт пустой список", async () => {
    const onSave = vi.fn();
    render(<IdentitySheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText("Языки"), "общий, троллий ,");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].proficiencies.languages).toEqual(["общий", "троллий"]);
    expect(onSave.mock.calls[0]?.[0].proficiencies.tools).toEqual([]);
  });

  it("кто он: размер выбирается кнопкой, возраст числом", async () => {
    const onSave = vi.fn();
    render(<IdentitySheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("radio", { name: "Огромный" }));
    await userEvent.clear(screen.getByLabelText("Возраст"));
    await userEvent.type(screen.getByLabelText("Возраст"), "142");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].size).toBe("huge");
    expect(onSave.mock.calls[0]?.[0].age).toBe(142);
  });

  it("кто он: пустое имя не сохраняется", async () => {
    render(<IdentitySheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Имя"));

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("вещь: категория, заметка и цена дописываются к уже заведённой вещи (FR-235)", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{ id: "свиток", nameRu: "Свиток огненного шара", kind: "other", worn: false, count: 1 }}
        onSave={onSave}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Расходник" }));
    await userEvent.type(screen.getByLabelText("Заметка"), "3 уровень, КС 15");
    await userEvent.type(screen.getByLabelText("Цена"), "150");
    await userEvent.click(screen.getByRole("radio", { name: "Монета: зм" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({
      id: "свиток",
      nameRu: "Свиток огненного шара",
      kind: "consumable",
      worn: false,
      count: 1,
      price: { amount: 150, currency: "gold" },
      note: "3 уровень, КС 15",
    });
  });

  it("вещь: прибавки видны только у экипировки, и смена категории снимает вещь (FR-238)", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{
          id: "кольцо",
          nameRu: "Кольцо защиты",
          kind: "gear",
          worn: true,
          count: 1,
          bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
        }}
        onSave={onSave}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("К защите")).toBeDefined();

    await userEvent.click(screen.getByRole("radio", { name: "Другое" }));
    // Поля прибавок ушли вместе с категорией: зелье действует, когда его пьют, а не когда несут.
    expect(screen.queryByLabelText("К защите")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onSave).toHaveBeenCalledWith({
      id: "кольцо",
      nameRu: "Кольцо защиты",
      kind: "other",
      worn: false,
      count: 1,
    });
  });

  it("вещь: счёт полем не правится — он живёт расходом и пополнением на строке (FR-241)", () => {
    render(
      <ItemSheet
        item={{ id: "зелье", nameRu: "Зелье лечения", kind: "consumable", worn: false, count: 2 }}
        onSave={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    // Поля нет вовсе: набранное до расхода число вернуло бы потраченный экземпляр обратно.
    expect(screen.queryByLabelText("Количество")).toBeNull();
    // Запас при этом виден: он стоит в заголовке шторки.
    expect(screen.getByRole("dialog", { name: "Правка: Зелье лечения ×2" })).toBeDefined();
  });

  it("вещь: пустая цена — вещь без цены, а не цена ноль", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{
          id: "зелье",
          nameRu: "Зелье лечения",
          kind: "consumable",
          worn: false,
          count: 1,
          price: { amount: 50, currency: "gold" },
        }}
        onSave={onSave}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Цена"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({
      id: "зелье",
      nameRu: "Зелье лечения",
      kind: "consumable",
      worn: false,
      count: 1,
    });
  });

  it("вещь: дробная цена не сохраняется", async () => {
    render(
      <ItemSheet
        item={{ id: "зелье", nameRu: "Зелье лечения", kind: "consumable", worn: false, count: 1 }}
        onSave={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText("Цена"), "1.5");
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("вещь: пустая прибавка экипировки не сохраняется полем нулей", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{ id: "шлем", nameRu: "Шлем", kind: "gear", worn: false, count: 1 }}
        onSave={onSave}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onSave).toHaveBeenCalledWith({ id: "шлем", nameRu: "Шлем", kind: "gear", worn: false, count: 1 });
  });

  it("вещь: пустое поле прибавки у экипировки не сохраняется", async () => {
    render(
      <ItemSheet
        item={{ id: "шлем", nameRu: "Шлем", kind: "gear", worn: false, count: 1 }}
        onSave={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("К защите"));
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("вещь: удаление стоит в её же шторке (FR-241)", async () => {
    const onRemove = vi.fn();
    render(
      <ItemSheet
        item={{ id: "зелье", nameRu: "Зелье лечения", kind: "consumable", worn: false, count: 2 }}
        onSave={() => {}}
        onRemove={onRemove}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Убрать: Зелье лечения" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("деньги: три монеты стола правятся итогом (FR-242)", async () => {
    const onSave = vi.fn();
    render(
      <MoneySheet
        money={{ gold: 15, silver: 30, copper: 12 }}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const gold = screen.getByLabelText("Золото");
    await userEvent.clear(gold);
    await userEvent.type(gold, "215");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ gold: 215, silver: 30, copper: 12 });
  });

  it("деньги: отрицательное и пустое не сохраняются", async () => {
    render(
      <MoneySheet money={{ gold: 15, silver: 0, copper: 0 }} onSave={() => {}} onCancel={() => {}} />,
    );

    const gold = screen.getByLabelText("Золото");
    await userEvent.clear(gold);
    await userEvent.type(gold, "-5");
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);

    await userEvent.clear(gold);
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("прибавки предметов: отрицательная принимается", async () => {
    const onSave = vi.fn();
    render(<ItemBonusesSheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    const field = screen.getByLabelText("К защите");
    await userEvent.clear(field);
    await userEvent.type(field, "-1");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ spellcasting: 0, armorClass: -1, savingThrows: 0 });
  });

  it("прибавки предметов: пустое поле не сохраняется", async () => {
    render(<ItemBonusesSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("К магии"));

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("отмена закрывает шторку, ничего не сохраняя", async () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(<MarksSheet character={createThorne()} onSave={onSave} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
