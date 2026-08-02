# Навыки, предметы и инициатива Торна — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Внести три названных игроком факта о Торне — владения навыками, домашнее правило инициативы
и состав снаряжения — так, чтобы производные числа считались, а не хранились.

**Architecture:** Формула инициативы меняется в домене характеристик и получает вторую
характеристику из уже существующего входа счёта производных. Прибавки предметов переезжают с поля
«прибавки без вещи» на именованные вещи инвентаря — сумма та же, источник другой. Ситуативная
прибавка («1d4 к Скрытности в болотах») хранится заметкой вещи и в числа не входит; чтобы заметка не
была невидимой, строка инвентаря на листе начинает её показывать.

**Tech Stack:** TypeScript, Zod, Vitest, React, Next.js.

## Global Constraints

- Спека этой работы: `.superpowers/specs/2026-08-02-thorne-skills-items-initiative-design.md`.
- Документация, интерфейс и контент — русский; код, идентификаторы, имена файлов — английский.
- В коде запрещены номера требований (`FR-###`), ссылки на `docs/…` и пути к документам. За этим
  следит `npm run check:layers`.
- Документ домена хранит состояние, а не летопись: правки в `docs/domains/*`, `docs/glossary.md` и
  `docs/open-questions.md` — точечные (строка правила, ячейка таблицы, статус вопроса). Разделов
  «что изменилось» не добавлять.
- Комментарий в коде — запах. Оставлять только то, что из кода не следует.
- **Не коммитить и не индексировать.** Правки остаются в рабочем дереве; `git add` и `git commit`
  делает игрок сам. Вместо шага «Commit» каждая задача кончается прогоном проверок.
- Полная проверка репозитория:
  `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`

## Файлы

| Файл | Ответственность | Задача |
|---|---|---|
| `src/core/domain/character/abilities.ts` | формула инициативы | 1 |
| `src/core/domain/character/abilities.test.ts` | прогон формулы | 1 |
| `src/core/domain/sheet/derived.ts` | передача обеих характеристик в формулу | 1 |
| `src/core/domain/sheet/derived.test.ts` | числа Торна и перебивки | 1, 2 |
| `src/ui/screens/combat/ui/CombatScreen.test.tsx` | шапка ресурсов | 1, 2 |
| `docs/domains/character.md` | правило инициативы, лист Торна | 1, 2, 3 |
| `docs/glossary.md` | строка «Инициатива» | 1 |
| `docs/decisions.md` | `ADR-0026` | 1 |
| `src/core/infrastructure/catalog/thorne/character.ts` | содержание Торна | 2, 3 |
| `src/core/domain/character/state.test.ts` | «Торн заполнен целиком» | 2, 3 |
| `src/ui/widgets/character-sheet/model/rows.test.ts` | строки блоков листа | 2, 3 |
| `src/ui/features/edit-character-sheet/ui/sheets.test.tsx` | шторка характеристики | 2 |
| `docs/open-questions.md` | статусы OQ-02, OQ-11, OQ-38 | 2, 3 |
| `src/core/domain/equipment/equipment.test.ts` | сумма прибавок | 3 |
| `src/core/application/useCases/equipment.test.ts` | правка снаряжения сценарием | 3 |
| `docs/domains/equipment.md` | правило о ситуативной прибавке | 3 |
| `src/ui/widgets/character-sheet/model/rows.ts` | заметка в строке инвентаря | 4 |
| `src/ui/features/edit-character-sheet/ui/InventorySheet.tsx` | ввод заметки | 4 |

---

## Task 1: Инициатива по домашнему правилу стола

**Files:**
- Modify: `src/core/domain/character/abilities.ts:83-85`
- Modify: `src/core/domain/character/abilities.test.ts:93-95`
- Modify: `src/core/domain/sheet/derived.ts:107`
- Modify: `src/core/domain/sheet/derived.test.ts:18`
- Modify: `src/ui/screens/combat/ui/CombatScreen.test.tsx:372`
- Modify: `docs/domains/character.md`, `docs/glossary.md`, `docs/decisions.md`

**Interfaces:**
- Consumes: `abilityModifier(score: number): number` из того же файла.
- Produces: `initiativeModifier(input: { dexterity: number; wisdom: number }): number`. Прежняя
  сигнатура с одним числом исчезает; единственный вызов — в счёте производных.

- [ ] **Step 1: Переписать прогон формулы на новое правило**

В `src/core/domain/character/abilities.test.ts` заменить блок строк 93–95:

```ts
  it("инициатива — половина суммы модификаторов Ловкости и Мудрости", () => {
    // Торн: Ловкость 14 (+2), Мудрость 12 (+1).
    expect(initiativeModifier({ dexterity: 14, wisdom: 12 })).toBe(1);
    expect(initiativeModifier({ dexterity: 14, wisdom: 14 })).toBe(2);
    // Округление вниз работает и на отрицательной сумме: (−1 + −2) ÷ 2 = −1,5.
    expect(initiativeModifier({ dexterity: 8, wisdom: 6 })).toBe(-2);
  });
```

- [ ] **Step 2: Убедиться, что прогон падает**

Run: `npx vitest run src/core/domain/character/abilities.test.ts -t "инициатива"`
Expected: FAIL — типовая ошибка либо `toBe(1)` против полученного `NaN`.

- [ ] **Step 3: Переписать формулу**

В `src/core/domain/character/abilities.ts` заменить строки 83–85:

```ts
/**
 * Инициатива: половина суммы модификаторов Ловкости и Мудрости, округляя вниз.
 *
 * Это домашнее правило стола: по правилам 5e инициатива равна модификатору Ловкости.
 */
export function initiativeModifier(input: { dexterity: number; wisdom: number }): number {
  return Math.floor((abilityModifier(input.dexterity) + abilityModifier(input.wisdom)) / 2);
}
```

- [ ] **Step 4: Убедиться, что прогон проходит**

Run: `npx vitest run src/core/domain/character/abilities.test.ts`
Expected: PASS

- [ ] **Step 5: Провести обе характеристики до счёта производных**

В `src/core/domain/sheet/derived.ts` заменить строку 107:

```ts
    initiative:
      overrides.initiative ??
      initiativeModifier({
        dexterity: sheet.abilities.dexterity,
        wisdom: sheet.abilities.wisdom,
      }),
```

- [ ] **Step 6: Поправить ожидание в прогоне производных и добавить прогон на Мудрость**

В `src/core/domain/sheet/derived.test.ts` строка 18 становится:

```ts
    expect(sheet.initiative).toBe(1);
```

После теста «числа Торна сходятся с листом персонажа без единой перебивки» (после строки 24)
добавить:

```ts
  it("инициатива двигается за Мудростью, а не только за Ловкостью", () => {
    const state = createThorne();
    // Ловкость 14 (+2), Мудрость 16 (+3): (2 + 3) ÷ 2 вниз.
    expect(sheetOf({ ...state, abilities: { ...state.abilities, wisdom: 16 } }).initiative).toBe(2);
  });
```

- [ ] **Step 7: Поправить шапку ресурсов в компонентном прогоне**

В `src/ui/screens/combat/ui/CombatScreen.test.tsx` строка 372:

```ts
    expect(screen.getByText("Инициатива +1")).toBeDefined();
```

- [ ] **Step 8: Прогнать всё, что задето**

Run: `npx vitest run src/core/domain src/ui/screens/combat`
Expected: PASS

- [ ] **Step 9: Записать правило в документ персонажа**

В `docs/domains/character.md` в разделе «Правила» (строки 101–102) заменить предложение
`Инициатива: модификатор Ловкости.` на:

```
Инициатива: половина суммы модификаторов Ловкости и Мудрости, округляя вниз — домашнее правило
стола ([ADR-0026](../decisions.md#adr-0026)).
```

В таблице «Лист Торна» строку `| Инициатива | +2 | Ловкость 14 |` заменить на:

```
| Инициатива | +1 | (Ловкость +2 + Мудрость +1) ÷ 2 вниз |
```

- [ ] **Step 10: Поправить строку глоссария**

В `docs/glossary.md` строка 41 — заменить содержимое последней колонки:

```
| Инициатива | Initiative | `initiativeModifier` | Половина суммы модификаторов Ловкости и Мудрости, округляя вниз — домашнее правило стола ([ADR-0026](decisions.md#adr-0026)) |
```

- [ ] **Step 11: Записать ADR-0026**

В конец `docs/decisions.md` дописать (после последнего разделителя `---`):

```markdown
## ADR-0026

**Инициатива считается по домашнему правилу стола**

**Статус:** Принято · 2026-08-02

**Контекст.** По правилам 5e инициатива равна модификатору Ловкости. За столом действует другое
правило: половина суммы модификаторов Ловкости и Мудрости, округляя вниз. Для Торна это +1, а не +2 —
число, которое приложение называет в начале боя и которое игрок сверяет с листом.

**Варианты.**

1. **Оставить формулу правил, задать +1 перебивкой.** Число перестало бы двигаться за правкой
   Ловкости или Мудрости и молча разошлось бы с листом при первой же смене характеристики.
2. **Сделать формулу настраиваемой.** Персонаж один и стол один; развилка без второго потребителя
   стоит дороже, чем даёт.
3. **Заменить формулу домашним правилом.** Выбран.

**Выбор.** Счёт инициативы берёт обе характеристики.

**Последствия.**

- Инициатива двигается за правкой и Ловкости, и Мудрости.
- Перебивка остаётся доступной наравне с любым производным числом, но Торну не нужна.
- Возврат к правилу 5e стоит правки одной формулы.

---
```

Строку `> Обновлено: 2026-08-01` в начале файла заменить на `> Обновлено: 2026-08-02`.

- [ ] **Step 12: Прогнать проверки репозитория**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test`
Expected: PASS. Правки оставить неиндексированными.

---

## Task 2: Владения навыками Торна

**Files:**
- Modify: `src/core/infrastructure/catalog/thorne/character.ts:37-38`
- Modify: `src/core/domain/character/state.test.ts:242-267`
- Modify: `src/core/domain/sheet/derived.test.ts:12-38,68`
- Modify: `src/ui/widgets/character-sheet/model/rows.test.ts:121-129`
- Modify: `src/ui/features/edit-character-sheet/ui/sheets.test.tsx:268`
- Modify: `src/ui/screens/combat/ui/CombatScreen.test.tsx:377`
- Modify: `docs/domains/character.md`, `docs/open-questions.md`

**Interfaces:**
- Consumes: `SkillTraining = "proficient" | "expert"` и `SkillId` из домена навыков; поле
  `skills: Partial<Record<SkillId, SkillTraining>>` состояния персонажа — оба уже существуют.
- Produces: содержание Торна с четырьмя владениями. Ни одной новой сигнатуры.

- [ ] **Step 1: Записать ожидаемые числа прогоном**

В `src/core/domain/sheet/derived.test.ts` в тест «числа Торна сходятся с листом персонажа без единой
перебивки» после строки с `armorClassParts` добавить:

```ts
    expect(sheet.skill("arcana")).toBe(7);
    expect(sheet.skill("investigation")).toBe(7);
    expect(sheet.skill("nature")).toBe(7);
    expect(sheet.skill("perception")).toBe(4);
    expect(sheet.passivePerception).toBe(14);
```

В том же файле заменить тест «навык без владения — только модификатор характеристики» (строки 26–28)
— Магия у Торна теперь с владением, поэтому пример берётся из ненатренированного навыка:

```ts
  it("навык без владения — только модификатор характеристики", () => {
    expect(sheetOf().skill("history")).toBe(4);
  });
```

Заменить тест «пассивное восприятие считается от Мудрости» (строки 36–38):

```ts
  it("пассивное восприятие считается от навыка Восприятия", () => {
    expect(sheetOf().passivePerception).toBe(14);
  });
```

Строку 68 заменить — перебитый бонус мастерства доходит и до навыка с владением:

```ts
    expect(overridden.skill("arcana")).toBe(9);
```

- [ ] **Step 2: Записать состав владений прогоном состояния**

В `src/core/domain/character/state.test.ts` в тест «Торн заполнен целиком» после строки
`expect(thorneState.saveProficiencies).toEqual(["intelligence", "wisdom"]);` добавить:

```ts
    expect(thorneState.skills).toEqual({
      arcana: "proficient",
      investigation: "proficient",
      nature: "proficient",
      perception: "proficient",
    });
```

- [ ] **Step 3: Убедиться, что оба прогона падают**

Run: `npx vitest run src/core/domain/sheet/derived.test.ts src/core/domain/character/state.test.ts`
Expected: FAIL — `skill("arcana")` возвращает 4, `passivePerception` — 11, `skills` — `{}`.

- [ ] **Step 4: Внести владения в содержание Торна**

В `src/core/infrastructure/catalog/thorne/character.ts` заменить строки 37–38 (комментарий
«Владения навыками игроком не названы.» и пустой объект):

```ts
  skills: {
    arcana: "proficient",
    investigation: "proficient",
    nature: "proficient",
    perception: "proficient",
  },
```

- [ ] **Step 5: Убедиться, что прогоны проходят**

Run: `npx vitest run src/core/domain/sheet/derived.test.ts src/core/domain/character/state.test.ts`
Expected: PASS

- [ ] **Step 6: Поправить строки блока Интеллекта на листе**

Владение показывается подсказкой, поэтому у трёх строк из пяти она появляется. В
`src/ui/widgets/character-sheet/model/rows.test.ts` заменить строки 121–129:

```ts
    expect(blockById("ability:intelligence")?.rows).toEqual([
      { labelRu: "Значение", value: "18 (+4)" },
      { labelRu: "Спасбросок", value: "+8", hint: "владение" },
      { labelRu: "Магия", value: "+7", hint: "владение" },
      { labelRu: "История", value: "+4" },
      { labelRu: "Расследование", value: "+7", hint: "владение" },
      { labelRu: "Природа", value: "+7", hint: "владение" },
      { labelRu: "Религия", value: "+4" },
    ]);
```

- [ ] **Step 7: Поправить ожидание шторки характеристики**

Шторка Интеллекта берёт начальное состояние из владений персонажа, поэтому сохранение возвращает и
соседние навыки той же характеристики. В `src/ui/features/edit-character-sheet/ui/sheets.test.tsx`
строка 268:

```ts
    expect(onSave.mock.calls[0]?.[0].skills).toEqual({
      arcana: "expert",
      investigation: "proficient",
      nature: "proficient",
    });
```

- [ ] **Step 8: Поправить пассивное восприятие в шапке**

В `src/ui/screens/combat/ui/CombatScreen.test.tsx` строка 377:

```ts
    expect(screen.getByText("Пассивное восприятие 14")).toBeDefined();
```

- [ ] **Step 9: Прогнать всё**

Run: `npm run test`
Expected: PASS

- [ ] **Step 10: Внести владения в лист Торна**

В `docs/domains/character.md` в таблицу «Лист Торна» после строки `| Бонус мастерства | +3 | вычислено |`
добавить две строки:

```
| Владения навыками | Магия, Расследование, Природа, Восприятие | игрок |
| Пассивное восприятие | 14 | 10 + 4 (Восприятие) |
```

- [ ] **Step 11: Закрыть OQ-38**

В `docs/open-questions.md` в строке таблицы `| [OQ-38](#oq-38) | ...` заменить статус на
`**закрыт**`, а кто решает — на `—`. В самом разделе `## OQ-38` заменить строку статуса на:

```
**Статус:** Закрыт — владения названы игроком 2026-08-02 · **Блокирует:** ничего
```

и заменить абзац «Что сделано до ответа» на ответ:

```
**Ответ игрока (2026-08-02).** Владение Магией, Расследованием, Природой и Восприятием;
компетентности нет ни в одном. Пассивное восприятие Торна равно 14.
```

Строку `> Обновлено: 2026-08-01` в начале файла заменить на `> Обновлено: 2026-08-02`.

- [ ] **Step 12: Прогнать проверки репозитория**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test`
Expected: PASS. Правки оставить неиндексированными.

---

## Task 3: Прибавки переезжают с безымянного поля на четыре вещи

**Files:**
- Modify: `src/core/infrastructure/catalog/thorne/character.ts:115-132`
- Modify: `src/core/domain/character/state.test.ts:257-263`
- Modify: `src/core/domain/equipment/equipment.test.ts:71-75`
- Modify: `src/core/application/useCases/equipment.test.ts:52-58,71-79`
- Modify: `src/ui/widgets/character-sheet/model/rows.test.ts:36-37,178-180`
- Modify: `docs/domains/equipment.md`, `docs/domains/character.md`, `docs/open-questions.md`

**Interfaces:**
- Consumes: `InventoryItem = { id: string; nameRu: string; worn: boolean; note?: string; bonuses?: ItemBonuses }`
  и `ItemBonuses = { spellcasting: number; armorClass: number; savingThrows: number }` из схемы
  состояния — оба уже существуют.
- Produces: четыре вещи в содержании Торна с идентификаторами `spellcasting-focus`, `robe`,
  `cloak-of-protection`, `swamp-camouflage-kit`. Задача 4 опирается на поле `note` последней из них.

- [ ] **Step 1: Записать состав снаряжения прогоном состояния**

В `src/core/domain/character/state.test.ts` заменить строки 257–263:

```ts
    expect(thorneState.equipment.otherBonuses).toEqual({
      spellcasting: 0,
      armorClass: 0,
      savingThrows: 0,
    });
    expect(thorneState.equipment.armorClassBase).toBe(10);
    expect(thorneState.equipment.items.map((item) => item.nameRu)).toEqual([
      "Магическая фокусировка +1",
      "Мантия +1",
      "Плащ защиты",
      "Комплект болотной маскировки",
    ]);

    const kit = thorneState.equipment.items.at(-1);
    expect(kit?.note).toBe("1d4 к Скрытности в болотах");
    expect(kit?.bonuses).toBeUndefined();
    expect(kit?.worn).toBe(false);
```

- [ ] **Step 2: Убедиться, что прогон падает**

Run: `npx vitest run src/core/domain/character/state.test.ts -t "Торн заполнен целиком"`
Expected: FAIL — `items` пуст, `otherBonuses` равны `{ spellcasting: 1, armorClass: 2, savingThrows: 1 }`.

- [ ] **Step 3: Внести вещи в содержание Торна**

В `src/core/infrastructure/catalog/thorne/character.ts` заменить строки 116–132 целиком (четыре
комментария перед `equipment` и весь блок `equipment`) на:

```ts
  equipment: {
    // База 10 — доспехов нет.
    armorClassBase: 10,
    // Каждая прибавка Торна принадлежит названной вещи, поэтому прибавок без вещи у него нет.
    otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    items: [
      {
        id: "spellcasting-focus",
        nameRu: "Магическая фокусировка +1",
        worn: true,
        bonuses: { spellcasting: 1, armorClass: 0, savingThrows: 0 },
      },
      {
        id: "robe",
        nameRu: "Мантия +1",
        worn: true,
        bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
      },
      {
        id: "cloak-of-protection",
        nameRu: "Плащ защиты",
        worn: true,
        bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
      },
      {
        // Прибавка кубиком и по обстановке: приложение её не считает, поэтому она заметка.
        id: "swamp-camouflage-kit",
        nameRu: "Комплект болотной маскировки",
        worn: false,
        note: "1d4 к Скрытности в болотах",
      },
    ],
    components: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: [] },
  },
```

Два комментария, оставшиеся без своих полей, поставить над теми полями, которые они описывают:
`// Рун столько же, сколько бонус мастерства.` — над `runes`, а комментарий про одну кость за
уровень и расовые «11 очков здоровья» — над `hitDice`.

- [ ] **Step 4: Убедиться, что прогон проходит**

Run: `npx vitest run src/core/domain/character/state.test.ts`
Expected: PASS

- [ ] **Step 5: Переписать прогон прибавок без вещи**

Обнулить прибавки без вещи больше не значит обнулить итог: вещи считаются отдельно. В
`src/core/domain/equipment/equipment.test.ts` заменить тест на строках 71–75:

```ts
  it("прибавки без вещи складываются с надетыми вещами, а не заменяют их", () => {
    const changed = gear().withOtherBonuses({ spellcasting: 2, armorClass: 0, savingThrows: 0 });
    expect(changed.otherBonuses.spellcasting).toBe(2);
    // Вещи Торна дают +1 к магии, +2 к защите и +1 к спасброскам.
    expect(changed.bonuses).toEqual({ spellcasting: 3, armorClass: 2, savingThrows: 1 });
  });
```

- [ ] **Step 6: Поправить прогоны сценария правки снаряжения**

В `src/core/application/useCases/equipment.test.ts` строка 56 — у Торна теперь есть свои вещи,
поэтому пустым список после удаления кольца не станет:

```ts
    expect(gone.character.equipment.items.some((item) => item.id === "ring")).toBe(false);
```

Строки 71–79 — к прибавке без вещи прибавляется фокусировка:

```ts
  it("прибавки без вещи двигают КС заклинаний", () => {
    const richer = editOtherBonuses(
      session(),
      { spellcasting: 3, armorClass: 2, savingThrows: 1 },
      clock,
    );
    // 8 + 3 (мастерство) + 4 (Интеллект) + 3 (без вещи) + 1 (фокусировка).
    expect(Sheet.of(richer.character).spellSaveDc).toBe(19);
    expect(richer.journal[0]?.summaryRu).toBe("Правка прибавок без вещи");
  });
```

- [ ] **Step 7: Поправить прогоны строк листа**

В `src/ui/widgets/character-sheet/model/rows.test.ts` заменить строки 36–37 так, чтобы пустой
инвентарь проверялся на пустом состоянии, а не на Торне:

```ts
  it("пустой инвентарь называется пустым, надетая вещь — своим вкладом", () => {
    const bare = createThorne();
    const empty = { ...bare, equipment: { ...bare.equipment, items: [] } };
    expect(sheetBlocks(empty).find((block) => block.id === "inventory")?.rows).toEqual([
      { labelRu: "Пусто", value: "—" },
    ]);
```

Остальная часть теста (со строки 39) остаётся как есть.

Заменить тест на строках 178–180 — прибавок без вещи у Торна больше нет, и блок обязан это
показывать:

```ts
  it("прибавки без вещи показаны со знаком и у Торна равны нулю", () => {
    expect(blockById("itemBonuses")?.rows).toContainEqual({ labelRu: "К защите", value: "+0" });
  });
```

- [ ] **Step 8: Прогнать всё**

Run: `npm run test`
Expected: PASS. Числа `Класс Доспеха 14`, `КС спасброска 16` и `Атака заклинанием +8` в прогоне
`rows.test.ts` обязаны остаться прежними: сумма прибавок не менялась.

- [ ] **Step 9: Записать правило о ситуативной прибавке**

В `docs/domains/equipment.md` в раздел «Правила» (после абзаца про компоненты) добавить:

```
Прибавка, зависящая от обстановки или требующая броска, хранится заметкой вещи и в числа листа не
входит: приложение не бросает кубиков и обстановки не знает, а сложенная в модификатор такая
прибавка была бы верна только в одном месте на карте.
```

- [ ] **Step 10: Внести состав снаряжения в лист Торна**

В `docs/domains/character.md` в таблице «Лист Торна» заменить строку
`| Предметы | +2 к защите, +1 ко всем спасброскам, +1 к магии | [OQ-11](../open-questions.md#oq-11) |`
на:

```
| Предметы | магическая фокусировка +1 (магия), мантия +1 (защита), плащ защиты (защита и спасброски), комплект болотной маскировки | игрок |
```

Два абзаца под таблицей (тот, что выводит вклад защиты из арифметики, и следующий за ним про
«числа с предметами уже учтены») заменить одним:

```
Вклад снаряжения — +2 к Классу Доспеха, +1 ко всем спасброскам и +1 к магии — складывается из
надетых вещей и в числах таблицы уже учтён. Владение спасброском Телосложения не подтверждено
([OQ-05](../open-questions.md#oq-05)): в таблице стоит +4 без владения — это число приложение и
называет при проверке концентрации.
```

- [ ] **Step 11: Закрыть OQ-02 и OQ-11**

В `docs/open-questions.md` в таблице заменить статусы обеих строк на `**закрыт**`, а колонку «кто
решает» — на `—`.

В разделе `## OQ-02` заменить строку статуса на:

```
**Статус:** Закрыт — состав назван игроком 2026-08-02 · **Блокирует:** ничего
```

и заменить тело раздела (всё после строки статуса и до разделителя `---`) на:

```
**Ответ игрока (2026-08-02).** +2 к Классу Доспеха складываются из мантии +1 и плаща защиты; плащ же
даёт +1 ко всем спасброскам. Действуют ли прибавки при надетых доспехах и щите, не проверялось:
доспехов Торн не носит.
```

В разделе `## OQ-11` заменить строку статуса на:

```
**Статус:** Закрыт — предметы названы игроком 2026-08-02 · **Блокирует:** ничего
```

и заменить тело раздела (всё после строки статуса и до разделителя `---`) на:

```
**Ответ игрока (2026-08-02).** Производные числа сдвигают три вещи: магическая фокусировка +1
(магия), мантия +1 (защита) и плащ защиты (защита и спасброски). Каждая прибавка хранится на своей
вещи, поэтому снятое перестаёт считаться. Действует ли предметный +1 на проверку Интеллекта, этим
ответом не решено — [OQ-25](#oq-25).
```

- [ ] **Step 12: Прогнать проверки репозитория**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test`
Expected: PASS. Правки оставить неиндексированными.

---

## Task 4: Заметка вещи видна на листе и вводится с экрана

**Files:**
- Modify: `src/ui/widgets/character-sheet/model/rows.ts:187-206`
- Modify: `src/ui/widgets/character-sheet/model/rows.test.ts`
- Modify: `src/ui/features/edit-character-sheet/ui/InventorySheet.tsx:27-54,88-91`
- Modify: `src/ui/features/edit-character-sheet/ui/sheets.test.tsx`

**Interfaces:**
- Consumes: поле `note?: string` вещи из схемы состояния и `signed(value: number): string` из
  подписей листа — оба уже существуют.
- Produces: строка инвентаря, чья подсказка складывается из прибавок и заметки; шторка «Вещи» с
  полем «Заметка». Новых экспортов нет.

- [ ] **Step 1: Записать прогоном, что заметка видна**

В `src/ui/widgets/character-sheet/model/rows.test.ts` после теста «подсказка называет только то, что
вещь действительно даёт» (после строки 76) добавить:

```ts
  it("заметка вещи попадает в подсказку рядом с прибавками", () => {
    const rows = blockById("inventory")?.rows ?? [];
    expect(rows).toContainEqual({
      labelRu: "Комплект болотной маскировки",
      value: "в сумке",
      hint: "1d4 к Скрытности в болотах",
    });
    expect(rows).toContainEqual({
      labelRu: "Плащ защиты",
      value: "надето",
      hint: "защита +1, спасброски +1",
    });
  });
```

- [ ] **Step 2: Убедиться, что прогон падает**

Run: `npx vitest run src/ui/widgets/character-sheet/model/rows.test.ts -t "заметка вещи"`
Expected: FAIL — у комплекта подсказки нет вовсе.

- [ ] **Step 3: Собирать подсказку из прибавок и заметки**

В `src/ui/widgets/character-sheet/model/rows.ts` перед функцией, строящей блоки, добавить:

```ts
function bonusParts(bonuses: ItemBonuses | undefined): string[] {
  if (bonuses === undefined) return [];
  return [
    bonuses.spellcasting === 0 ? null : `магия ${signed(bonuses.spellcasting)}`,
    bonuses.armorClass === 0 ? null : `защита ${signed(bonuses.armorClass)}`,
    bonuses.savingThrows === 0 ? null : `спасброски ${signed(bonuses.savingThrows)}`,
  ].filter((part) => part !== null);
}
```

Дописать `ItemBonuses` в импорт типов из состояния персонажа (строка 9):

```ts
import type { CharacterState, ItemBonuses } from "@/core/domain/character/state";
```

Заменить строки 187–206 (ветку `rows` блока инвентаря):

```ts
      rows:
        character.equipment.items.length === 0
          ? [{ labelRu: "Пусто", value: "—" }]
          : character.equipment.items.map((item) => {
              const hint = [
                ...bonusParts(item.bonuses),
                ...(item.note === undefined ? [] : [item.note]),
              ].join(", ");
              return {
                labelRu: item.nameRu,
                value: item.worn ? "надето" : "в сумке",
                ...(hint === "" ? {} : { hint }),
              };
            }),
```

- [ ] **Step 4: Убедиться, что прогон проходит**

Run: `npx vitest run src/ui/widgets/character-sheet/model/rows.test.ts`
Expected: PASS — включая прежние тесты про верёвку без подсказки и посох с «магия +1».

- [ ] **Step 5: Записать прогоном ввод заметки**

В `src/ui/features/edit-character-sheet/ui/sheets.test.tsx` рядом с прочими прогонами шторок
добавить:

```ts
  it("вещи: заметка сохраняется вместе с вещью, пустая не хранится", async () => {
    const onAdd = vi.fn();
    render(
      <InventorySheet
        character={createThorne()}
        onAdd={onAdd}
        onRemove={() => {}}
        onToggleWorn={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText("Новая вещь"), "Сапоги следопыта");
    await userEvent.type(screen.getByLabelText("Заметка"), "1d4 к Скрытности в лесу");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onAdd.mock.calls[0]?.[0]).toEqual({
      id: "сапоги-следопыта",
      nameRu: "Сапоги следопыта",
      worn: false,
      note: "1d4 к Скрытности в лесу",
    });
  });
```

`InventorySheet` в импортах файла нет — дописать строку рядом с прочими импортами шторок:

```ts
import { InventorySheet } from "./InventorySheet";
```

- [ ] **Step 6: Убедиться, что прогон падает**

Run: `npx vitest run src/ui/features/edit-character-sheet/ui/sheets.test.tsx -t "заметка сохраняется"`
Expected: FAIL — поля «Заметка» на экране нет.

- [ ] **Step 7: Добавить поле заметки в шторку вещей**

В `src/ui/features/edit-character-sheet/ui/InventorySheet.tsx` после строки 30 добавить состояние:

```ts
  const [note, setNote] = useState("");
```

В вызове `onAdd` (строки 47–53) после `worn: false,` добавить:

```ts
          ...(note.trim() === "" ? {} : { note: note.trim() }),
```

После поля «Новая вещь» (строка 88) добавить:

```tsx
      <TextField labelRu="Заметка" value={note} onChange={setNote} />
```

- [ ] **Step 8: Убедиться, что прогон проходит**

Run: `npx vitest run src/ui/features/edit-character-sheet/ui/sheets.test.tsx`
Expected: PASS

- [ ] **Step 9: Записать поведение экрана в документ**

В `docs/screens.md` строку 231 `- **«Инвентарь»** — вещи: что надето и что даёт.` заменить на:

```
- **«Инвентарь»** — вещи: что надето, что даёт числами и что даёт по обстановке заметкой.
```

- [ ] **Step 10: Прогнать полную проверку репозитория**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`
Expected: PASS. Правки оставить неиндексированными.

- [ ] **Step 11: Прогнать сквозной сценарий**

Run: `npm run test:e2e`
Expected: PASS. Сценарий сотворения чисел листа не проверяет, но опирается на КС 16 и атаку +8 —
если он упал, значит сумма прибавок сдвинулась и виновата задача 3.
