# Магия крови и руны в мастере применения — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** обмен хитов на очки проходит тот же мастер, что и заклинания, а руна выбирается блоком на шаге выбора ячейки.

**Architecture:** из `CastWizard` выделяется презентационная оболочка `WizardShell` (шапка, тело, футер). На ней строятся два мастера: существующий `CastWizard` и новый `BloodMagicWizard` из двух-трёх шагов. Числа рун переезжают в новый модуль правил `src/rules/runes.ts`, тексты обмена — в существующий `src/rules/announcement.ts`. `BloodMagicPanel` удаляется, её чужие блоки уже существуют в других местах, кроме переключателя солнца — он переезжает в шапку ресурсов.

**Tech Stack:** Next.js, TypeScript (strict), Tailwind, Zustand, Vitest + Testing Library, Playwright.

**Спека:** [2026-07-31-blood-magic-and-rune-in-wizard-design.md](../specs/2026-07-31-blood-magic-and-rune-in-wizard-design.md)

## Global Constraints

- Документация, интерфейс и контент — по-русски; код, имена файлов и сообщения коммитов — по-английски.
- Имена в коде берутся из [glossary.md](../../glossary.md): `rune`, `runePool`, `spellPoints`, `slot`. Синонимы не изобретать.
- Порог покрытия — 100 % по `src/rules`, `src/store`, `src/data`. Новый модуль правил обязан быть покрыт целиком.
- Один коммит — код и спека вместе. Изменилось поведение — правится файл фичи в том же коммите.
- Минимальная высота интерактивного элемента — 44 пикселя (`min-h-11`); экран проверки — iPhone SE, 320 пикселей.
- Курс ступени и цены в очках не хардкодить в компонентах: только через `src/rules/bloodMagic.ts`.
- Проверка после каждой задачи: `npm run typecheck && npx vitest run <файлы задачи>`. Перед последним коммитом — `npm run check:docs && npm run typecheck && npm run test:coverage && npm run build`.

## Конфликт с параллельной работой

В рабочем дереве есть незакоммиченные правки `CombatScreen.tsx`, `src/data/content/thorne/index.ts` и новый `src/rules/restrictions.ts` — их делает другая сессия. Задачи 1–5 их не касаются. Задачи 6 и 7 трогают `ResourceHeader.tsx` и `CombatScreen.tsx` — выполнять только после того, как та работа закоммичена.

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/rules/runes.ts` (создать) | числовые эффекты рун от уровня ячейки и их русские формулировки |
| `src/rules/runes.test.ts` (создать) | покрытие `runeEffect` на всех уровнях |
| `src/rules/announcement.ts` (изменить) | плюс `bloodExchangeInstructions` и `bloodExchangeAnnouncement`; плюс фраза руны в объявлении заклинания |
| `src/components/cast/WizardShell.tsx` (создать) | шапка, прокручиваемое тело и футер мастера; ничего не знает о заклинаниях |
| `src/components/cast/CastWizard.tsx` (изменить) | переезд на оболочку, блок выбора руны на шаге ячейки |
| `src/components/cast/BloodMagicWizard.tsx` (создать) | мастер обмена: доступность, объём, итог |
| `src/components/cast/BloodMagicWizard.test.tsx` (создать) | инвариант «до подтверждения ничего не тронуто», списание, предупреждения |
| `src/store/castDraftStore.ts` (изменить) | поле `rune` в черновике и его сброс при смене оплаты |
| `src/components/combat/ResourceHeader.tsx` (изменить) | переключатель «под солнцем» и значок подавления солнцем |
| `src/components/combat/CombatScreen.tsx` (изменить) | строка «Магия крови» открывает мастер; панель и её обработчики убраны |
| `src/components/combat/BloodMagicPanel.tsx` + тест (удалить) | — |

---

### Task 1: Числовые эффекты рун

**Files:**
- Create: `src/rules/runes.ts`
- Test: `src/rules/runes.test.ts`

**Interfaces:**
- Produces: `RuneKind = "life" | "war" | "wind"`, `RUNE_KINDS: readonly RuneKind[]`, `RUNE_NAMES: Record<RuneKind, string>`, `runeEffect(kind: RuneKind, slotLevel: number): { value: number; textRu: string }`.

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, expect, it } from "vitest";
import { RulesError } from "@/rules/abilities";
import { runeEffect, RUNE_KINDS, RUNE_NAMES } from "@/rules/runes";

describe("руна жизни (FR-152)", () => {
  it("даёт по 5 временных хитов за уровень ячейки", () => {
    expect(runeEffect("life", 1).value).toBe(5);
    expect(runeEffect("life", 4).value).toBe(20);
  });

  it("называет эффект словами, а не числом без единиц", () => {
    expect(runeEffect("life", 3).textRu).toBe(
      "15 временных хитов союзникам в пределах 30 футов",
    );
  });
});

describe("руна войны (FR-152)", () => {
  it("даёт половину уровня вверх, но не меньше +1", () => {
    expect(runeEffect("war", 1).value).toBe(1);
    expect(runeEffect("war", 2).value).toBe(1);
    expect(runeEffect("war", 3).value).toBe(2);
    expect(runeEffect("war", 4).value).toBe(2);
  });

  it("называет эффект со знаком", () => {
    expect(runeEffect("war", 3).textRu).toBe(
      "+2 к броскам атаки союзников в пределах 30 футов до конца вашего следующего хода",
    );
  });
});

describe("руна ветра (FR-152)", () => {
  it("даёт по 5 футов за уровень ячейки", () => {
    expect(runeEffect("wind", 2).value).toBe(10);
  });

  it("называет и скорость, и защиту от атак вдогонку", () => {
    expect(runeEffect("wind", 4).textRu).toBe(
      "+20 футов к скорости и защита от атак вдогонку до начала вашего следующего хода",
    );
  });
});

describe("границы", () => {
  it("руна применяется только к ячейке 1…9 уровня", () => {
    expect(() => runeEffect("life", 0)).toThrow(RulesError);
    expect(() => runeEffect("life", 10)).toThrow(RulesError);
    expect(() => runeEffect("life", 1.5)).toThrow(RulesError);
  });

  it("словарь названий покрывает все руны", () => {
    for (const kind of RUNE_KINDS) {
      expect(RUNE_NAMES[kind].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/runes.test.ts`
Expected: FAIL — `Failed to resolve import "@/rules/runes"`.

- [ ] **Step 3: Написать модуль**

```ts
/**
 * Руны создателя рун (FR-152).
 *
 * Числа взяты из материала Unearthed Arcana и перенесены в
 * docs/features/F-13-runes.md#fr-152. Источник неофициальный, подтверждения мастера нет — OQ-14.
 * Менять их следует здесь и в спеке одновременно.
 *
 * Эффект зависит от уровня ячейки, поэтому руна выбирается там же, где ячейка: на одном экране
 * число пересчитывается на глазах.
 */

import { RulesError } from "./abilities";
import { MAXIMUM_SPELL_LEVEL, MINIMUM_SPELL_LEVEL } from "./slots";

export const RUNE_KINDS = ["life", "war", "wind"] as const;

export type RuneKind = (typeof RUNE_KINDS)[number];

/** Название в родительном падеже: подпись читается как «Руна жизни». */
export const RUNE_NAMES: Record<RuneKind, string> = {
  life: "жизни",
  war: "войны",
  wind: "ветра",
};

export type RuneEffect = {
  value: number;
  /** Готовая формулировка для объявления мастеру и для подписи варианта. */
  textRu: string;
};

/** Футов и временных хитов за уровень ячейки. */
const PER_LEVEL = 5;

function assertSlotLevel(slotLevel: number): void {
  if (
    !Number.isInteger(slotLevel) ||
    slotLevel < MINIMUM_SPELL_LEVEL ||
    slotLevel > MAXIMUM_SPELL_LEVEL
  ) {
    throw new RulesError(`Уровень ячейки вне допустимого диапазона: ${slotLevel}`);
  }
}

export function runeEffect(kind: RuneKind, slotLevel: number): RuneEffect {
  assertSlotLevel(slotLevel);

  switch (kind) {
    case "life": {
      const value = PER_LEVEL * slotLevel;
      return { value, textRu: `${value} временных хитов союзникам в пределах 30 футов` };
    }
    case "war": {
      // Минимум +1: половина первого уровня вверх и так равна единице, но правило названо
      // отдельно, и без него ячейка 1 уровня читалась бы как «+0,5».
      const value = Math.max(1, Math.ceil(slotLevel / 2));
      return {
        value,
        textRu:
          `+${value} к броскам атаки союзников в пределах 30 футов` +
          " до конца вашего следующего хода",
      };
    }
    case "wind": {
      const value = PER_LEVEL * slotLevel;
      return {
        value,
        textRu:
          `+${value} футов к скорости и защита от атак вдогонку` +
          " до начала вашего следующего хода",
      };
    }
  }
}
```

`MINIMUM_SPELL_LEVEL` (1) и `MAXIMUM_SPELL_LEVEL` (9) уже экспортируются из [`src/rules/slots.ts:10-11`](../../../src/rules/slots.ts); `RulesError` — из [`src/rules/abilities.ts`](../../../src/rules/abilities.ts).

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/rules/runes.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/rules/runes.ts src/rules/runes.test.ts
git commit -m "Give runes numbers that depend on the slot level"
```

---

### Task 2: Тексты обмена

**Files:**
- Modify: `src/rules/announcement.ts`
- Test: `src/rules/announcement.test.ts`

**Interfaces:**
- Consumes: `exchangeHitPoints`, `ascensionTierRate`, `woundsFromExchange` из `src/rules/bloodMagic.ts`.
- Produces: `bloodExchangeAnnouncement(points: number, character: CharacterState): string`, `bloodExchangeInstructions(points: number, character: CharacterState): string[]`.

- [ ] **Step 1: Написать падающий тест**

```ts
describe("объявление обмена (FR-170, FR-177)", () => {
  it("называет и хиты, и очки", () => {
    const character = createThorne();
    expect(bloodExchangeAnnouncement(5, character)).toBe(
      "Действием обмениваю 15 хитов на 5 очков заклинаний.",
    );
  });
});

describe("инструкция обмена (FR-172, FR-174, FR-175)", () => {
  it("называет остаток хитов и снижение максимума", () => {
    const character = createThorne();
    const steps = bloodExchangeInstructions(5, character);
    expect(steps[0]).toBe("Отметьте 15 хитов: было 60, станет 45");
    expect(steps[1]).toBe(
      "Максимум тоже 45 — лечение выше не поднимет, вернуть можно только по 3 за полный час",
    );
  });

  it("напоминает, что проверка концентрации не нужна, только при активной концентрации", () => {
    const idle = createThorne();
    expect(bloodExchangeInstructions(2, idle).join(" ")).not.toMatch(/концентрац/);

    const busy = createThorne();
    // `startedAt` — строка ISO по схеме персонажа (character.ts:107-109), не число.
    busy.concentration = { spellId: "web", startedAt: "2026-07-31T20:00:00.000Z" };
    expect(bloodExchangeInstructions(2, busy).join(" ")).toMatch(
      /Проверка концентрации не нужна/,
    );
  });

  it("предупреждает о ранах, когда обмен опускает хиты в ноль", () => {
    const dying = createThorne();
    dying.hitPoints = { current: 6, maximum: 60, maximumReduction: 0 };
    expect(bloodExchangeInstructions(2, dying).join(" ")).toMatch(
      /Хиты уйдут в ноль: 1 рана за сам факт/,
    );
  });
});
```

Схема требует, чтобы у концентрации был парный активный эффект (`character.ts:231-233`), но unit-тест состояние не парсит: инструкции смотрят только на наличие `character.concentration`.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/announcement.test.ts`
Expected: FAIL — функции не экспортированы.

- [ ] **Step 3: Дописать функции в `announcement.ts`**

```ts
/**
 * Объявление обмена (FR-177). Шаблона у расовой особенности нет: она не заклинание, и текст
 * собирается из чисел состояния.
 */
export function bloodExchangeAnnouncement(points: number, character: CharacterState): string {
  const spent = points * ascensionTierRate(character.level);
  return (
    `Действием обмениваю ${withPlural(spent, ["хит", "хита", "хитов"])}` +
    ` на ${withPlural(points, ["очко", "очка", "очков"])} заклинаний.`
  );
}

/**
 * Что игрок должен сделать при обмене (FR-032 для расовой особенности).
 *
 * Напоминание о концентрации — самое ценное здесь: потеря хитов от кровавого колдовства уроном не
 * считается (FR-174), и за столом ошибаются в обе стороны. Без активной концентрации напоминание
 * молчит: оно было бы ни о чём.
 */
export function bloodExchangeInstructions(
  points: number,
  character: CharacterState,
): string[] {
  const spent = points * ascensionTierRate(character.level);
  const after = character.hitPoints.current - spent;
  const steps = [
    `Отметьте ${withPlural(spent, ["хит", "хита", "хитов"])}: было ${character.hitPoints.current}, станет ${after}`,
    `Максимум тоже ${character.hitPoints.maximum - spent} — лечение выше не поднимет,` +
      ` вернуть можно только по ${maximumRecoveryPerHour(character.level)} за полный час`,
  ];

  if (after <= 0) {
    steps.push(
      `Хиты уйдут в ноль: 1 рана за сам факт и ещё по 1 за каждые три очка —` +
        ` итого ${withPlural(woundsFromExchange(points), ["рана", "раны", "ран"])}`,
    );
  }

  if (character.concentration !== undefined) {
    steps.push(
      "Проверка концентрации не нужна: потеря хитов от кровавого колдовства уроном не считается",
    );
  }

  return steps;
}
```

Добавить в импорты `announcement.ts`: `ascensionTierRate`, `maximumRecoveryPerHour`, `woundsFromExchange` из `./bloodMagic`.

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/rules/announcement.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/rules/announcement.ts src/rules/announcement.test.ts
git commit -m "Say the blood exchange out loud in numbers of this character"
```

---

### Task 3: Оболочка мастера

**Files:**
- Create: `src/components/cast/WizardShell.tsx`
- Modify: `src/components/cast/CastWizard.tsx:347-447`
- Test: `src/components/cast/CastWizard.test.tsx` — существующие тесты должны продолжать проходить без правок

**Interfaces:**
- Produces: `WizardShell({ title, subtitle, badge, stepLabel, onCancel, children, footer })`, где `badge?: { tone: BadgeTone; icon: string; label: string }`, `footer: { onBack?: () => void; primaryLabel: string; onPrimary: () => void; primaryDisabled?: boolean }`.

- [ ] **Step 1: Вынести оболочку**

Скопировать разметку `section role="dialog"`, `header` и `footer` из `CastWizard` в новый компонент. Тело — `children`. Ничего заклинательного внутри не оставлять: `WizardShell` не импортирует ни `Spell`, ни `CastDraft`.

- [ ] **Step 2: Перевести `CastWizard` на оболочку**

`CastWizard` передаёт `title={draft.spell.nameRu}`, `subtitle={levelLabel(draft.spell.level)}`, значок времени накладывания, `stepLabel={`Шаг ${index + 1} из ${steps.length}: ${STEP_TITLES[draft.step]}`}` и футер.

- [ ] **Step 3: Прогнать существующие тесты**

Run: `npx vitest run src/components/cast src/components/combat && npm run typecheck`
Expected: PASS без правок тестов. Если тест упал — оболочка поменяла разметку, и надо чинить оболочку, а не тест: экран обязан остаться прежним.

- [ ] **Step 4: Коммит**

```bash
git add src/components/cast/WizardShell.tsx src/components/cast/CastWizard.tsx
git commit -m "Extract the wizard shell so a second wizard can wear it"
```

---

### Task 4: Мастер магии крови

**Files:**
- Create: `src/components/cast/BloodMagicWizard.tsx`
- Create: `src/components/cast/BloodMagicWizard.test.tsx`

**Interfaces:**
- Consumes: `WizardShell`, `bloodExchangeAnnouncement`, `bloodExchangeInstructions`, `ascensionTierRate`, `spellPointCost`, `MAXIMUM_PAYABLE_SPELL_LEVEL`, `bloodMagicAvailable`.
- Produces: `BloodMagicWizard({ character, economy, onConfirm, onCancel, error })`, где `onConfirm: (points: number, allowAnyway: boolean) => void`.

Черновик обмена — локальное состояние компонента: менять состояние персонажа отсюда нечем, инвариант FR-022 держится тем же способом, что и у `castDraftStore` — отсутствием доступа.

- [ ] **Step 1: Написать падающий тест**

```tsx
// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CombatScreen } from "@/components/combat/CombatScreen";
import { createThorne } from "@/data/content/thorne/character";
import { renderWithStores } from "@/testing/stores";

async function openWizard(character = createThorne()) {
  const user = userEvent.setup();
  const rendered = await renderWithStores(<CombatScreen />, character);
  await user.click(screen.getByRole("button", { name: /Магия крови/ }));
  return { user, ...rendered };
}

describe("мастер магии крови (FR-177, FR-178)", () => {
  it("до подтверждения состояние персонажа не тронуто", async () => {
    const { user, stores } = await openWizard();
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));

    const character = stores.session.getState().session?.character;
    expect(character?.hitPoints).toEqual({ current: 60, maximum: 60, maximumReduction: 0 });
    expect(character?.spellPoints.remaining).toBe(0);
  });

  it("подтверждение списывает хиты, максимум и действие", async () => {
    const { user, stores } = await openWizard();
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const character = stores.session.getState().session?.character;
    expect(character?.hitPoints).toEqual({ current: 54, maximum: 54, maximumReduction: 6 });
    expect(character?.spellPoints.remaining).toBe(2);
    expect(stores.session.getState().session?.journal.at(-1)?.actionUsed).toBe("action");
  });

  it("счётчик называет цену в хитах и остаток после обмена", async () => {
    const { user } = await openWizard();
    await user.click(screen.getByRole("button", { name: "Больше очков" }));

    expect(screen.getByText("9 хитов")).toBeDefined();
    expect(screen.getByText(/Хиты 60 → 51, максимум тоже 51/)).toBeDefined();
  });

  it("потолок счётчика — сколько хитов есть", async () => {
    const weak = createThorne();
    weak.hitPoints = { current: 7, maximum: 60, maximumReduction: 0 };
    const { user } = await openWizard(weak);

    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    expect(screen.getByRole("button", { name: "Больше очков" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("6 хитов")).toBeDefined();
  });

  it("предупреждает о ранах при обмене в ноль, но не запрещает", async () => {
    const dying = createThorne();
    dying.hitPoints = { current: 6, maximum: 60, maximumReduction: 0 };
    const { user, stores } = await openWizard(dying);
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText(/Хиты уйдут в ноль/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(0);
  });

  it("подавление показывается причиной и проходится «Применить всё равно»", async () => {
    const sunlit = createThorne();
    sunlit.suppression = { firedUpon: false, underDirectSunlight: true };
    const { user, stores } = await openWizard(sunlit);

    expect(screen.getByText(/солнечн/i)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(stores.session.getState().session?.character.spellPoints.remaining).toBe(2);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/cast/BloodMagicWizard.test.tsx`
Expected: FAIL — кнопки «Больше очков» на экране нет, открывается старая панель.

- [ ] **Step 3: Написать компонент**

Шаги — массив, как в `visibleSteps`: `availability` при непустом списке предупреждений, `amount` и `summary` всегда. Предупреждения собираются локальной функцией — `checkAvailability` принимает `Spell` и обмену не подходит:

```tsx
type ExchangeWarning = { reasonRu: string };

function exchangeWarnings(
  character: CharacterState,
  economy: TurnEconomy,
  points: number,
): ExchangeWarning[] {
  const warnings: ExchangeWarning[] = [];
  if (!bloodMagicAvailable(character.suppression)) {
    warnings.push({
      reasonRu: character.suppression.firedUpon
        ? "Кровавое колдовство подавлено уроном огнём до конца следующего хода"
        : "Кровавое колдовство не действует под прямым солнечным светом",
    });
  }
  if (turnTracked(character) && !economy.actionAvailable) {
    warnings.push({ reasonRu: ACTION_SPENT_MESSAGES.action });
  }
  const rate = ascensionTierRate(character.level);
  if (character.hitPoints.current < rate) {
    warnings.push({
      reasonRu: `${rate} хита за очко, в наличии ${character.hitPoints.current}`,
    });
  }
  return warnings;
}
```

Счётчик: `max = Math.floor(character.hitPoints.current / rate)`, начальное значение `Math.min(2, Math.max(1, max))`. Кнопки подписаны `aria-label="Больше очков"` и `"Меньше очков"`, между ними число очков и под ним цена в хитах. Обе — `min-h-11`.

Подсказка «хватит на» считается от суммы созданного и уже имеющегося:

```tsx
function affordableLevels(totalPoints: number): number[] {
  const levels: number[] = [];
  for (let level = 1; level <= MAXIMUM_PAYABLE_SPELL_LEVEL; level += 1) {
    if (spellPointCost(level) <= totalPoints) levels.push(level);
  }
  return levels;
}
```

Итоговый шаг показывает `bloodExchangeInstructions` списком под заголовком «Что сделать» и `bloodExchangeAnnouncement` абзацем под «Сказать мастеру» — той же разметкой, что `SummaryStep` в `CastWizard`. Блока отыгрыша нет.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/cast && npm run typecheck`
Expected: PASS. Тесты откроют мастер только после задачи 7 — до неё ожидаемо падают на «старая панель». Порядок: реализовать компонент, затем выполнить задачу 7 и вернуться сюда.

- [ ] **Step 5: Коммит**

```bash
git add src/components/cast/BloodMagicWizard.tsx src/components/cast/BloodMagicWizard.test.tsx
git commit -m "Put the blood exchange through the wizard, not one tap"
```

---

### Task 5: Блок руны на шаге выбора ячейки

**Files:**
- Modify: `src/store/castDraftStore.ts`
- Modify: `src/components/cast/CastWizard.tsx` — `SlotStep`
- Modify: `src/rules/announcement.ts` — фраза руны
- Test: `src/components/cast/CastWizard.test.tsx`

**Interfaces:**
- Consumes: `runeEffect`, `RUNE_KINDS`, `RUNE_NAMES` из задачи 1.
- Produces: `CastDraft.rune?: RuneKind`, `chooseRune(kind: RuneKind | undefined)` в сторе черновика, `toCastRequest` кладёт `rune` в заявку.

- [ ] **Step 1: Написать падающий тест**

```tsx
describe("руна при сотворении (FR-151, FR-152)", () => {
  it("эффект пересчитывается при смене уровня ячейки", async () => {
    const { user } = await openWizardFor("web");
    await user.click(screen.getByRole("button", { name: /Ячейка 2 уровня/ }));
    expect(screen.getByRole("button", { name: /Жизни · 10 временных хитов/ })).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Ячейка 4 уровня/ }));
    expect(screen.getByRole("button", { name: /Жизни · 20 временных хитов/ })).toBeDefined();
  });

  it("выбранная руна попадает в объявление и списывается подтверждением", async () => {
    const { user, stores } = await openWizardFor("web");
    await user.click(screen.getByRole("button", { name: /Войны/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(stores.session.getState().session?.character.runes.remaining).toBe(2);
  });

  it("при оплате кровью руна не применяется и говорит почему", async () => {
    const { user } = await openWizardFor("web");
    await user.click(screen.getByRole("button", { name: /Кровью/ }));
    expect(screen.getByText(/При оплате кровью руна не применяется/)).toBeDefined();
  });

  it("без рун объясняет, когда они вернутся", async () => {
    const spent = createThorne();
    spent.runes = { remaining: 0, maximum: 3 };
    const { user } = await openWizardFor("web", spent);
    expect(screen.getByText(/Рун не осталось, вернутся долгим отдыхом/)).toBeDefined();
  });

  it("у заговора блока руны нет вовсе", async () => {
    await openWizardFor("fire-bolt");
    expect(screen.queryByText(/Руна/)).toBeNull();
  });
});
```

`openWizardFor` написать рядом с существующими помощниками `CastWizard.test.tsx`; заговор взять тот, что есть в книге — проверить по `src/data/content/thorne/index.ts`.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/cast/CastWizard.test.tsx`
Expected: FAIL — блока руны нет.

- [ ] **Step 3: Реализовать**

В `castDraftStore`: поле `rune?: RuneKind` в `CastDraft`, действие `chooseRune`, сброс руны в `chooseCastOption`, когда выбранная оплата — не ячейка (OQ-17). В `toCastRequest` — `...(draft.rune === undefined ? {} : { rune: draft.rune })`.

В `SlotStep` — блок под списком способов. Показывается, когда `spell.level !== CANTRIP_LEVEL && draft.mode !== "ritual"`. Внутри: заголовок «Руна» со счётчиком пула; при `runes.remaining === 0` — строка «Рун не осталось, вернутся долгим отдыхом» вместо вариантов; при `draft.payment.kind !== "slot"` — строка «При оплате кровью руна не применяется» вместо вариантов; иначе «Без руны» и три варианта с `runeEffect(kind, draft.payment.slotLevel).textRu`.

В `announcement.ts` — фраза руны рядом с `paymentSentence`:

```ts
/** Эффект руны в объявлении: в шаблонах карточек руны нет, она добавляется фразой (FR-151). */
function runeSentence(context: AnnouncementContext): string {
  if (context.rune === undefined || context.payment.kind !== "slot") return "";
  const effect = runeEffect(context.rune, context.payment.slotLevel);
  return ` Применяю руну ${RUNE_NAMES[context.rune]}: ${effect.textRu}.`;
}
```

Поле `rune?: RuneKind` добавить в `AnnouncementContext`, вызов — в конец `renderAnnouncement` рядом с `paymentSentence`. В `castInstructions` — шаг «Спишется руна: <эффект>» после строки об оплате.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/cast src/rules && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит вместе со спекой**

```bash
git add src/store/castDraftStore.ts src/components/cast/CastWizard.tsx src/rules/announcement.ts \
        src/components/cast/CastWizard.test.tsx docs/features/F-13-runes.md
git commit -m "Offer the rune where the slot is chosen, with its number"
```

Правки F-13 в этом же коммите: FR-151 — «блок на шаге выбора ячейки» вместо «отдельный шаг»; FR-152 → `Готово` с указанием проверок; в «Поведение» — руна не применяется при оплате кровью (OQ-17).

---

### Task 6: Переключатель солнечного света

> Выполнять после того, как параллельная работа над `ResourceHeader.tsx` закоммичена.

**Files:**
- Modify: `src/components/combat/ResourceHeader.tsx:157-181`
- Test: `src/components/combat/CombatScreen.test.tsx`

**Interfaces:**
- Produces: параметр `onSunlight: (under: boolean) => void` у `ResourceHeader`.

- [ ] **Step 1: Написать падающий тест**

```tsx
it("переключатель солнца включает подавление и виден в шапке (FR-181, FR-183)", async () => {
  const user = userEvent.setup();
  const { stores } = await renderWithStores(<CombatScreen />);

  await user.click(screen.getByRole("button", { name: "Под прямым солнечным светом" }));
  expect(stores.session.getState().session?.character.suppression.underDirectSunlight).toBe(true);
  expect(screen.getByText(/Особенности подавлены: солнечный свет/)).toBeDefined();
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx -t "солнц"`
Expected: FAIL — кнопки в шапке нет.

- [ ] **Step 3: Реализовать**

В список «Прочие ресурсы» добавить элемент с кнопкой `aria-pressed={character.suppression.underDirectSunlight}` и подписью «Под прямым солнечным светом»; рядом — значок «Особенности подавлены: солнечный свет», когда признак включён, по образцу значка огня.

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/components/combat && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит вместе со спекой**

```bash
git add src/components/combat/ResourceHeader.tsx src/components/combat/CombatScreen.tsx \
        src/components/combat/CombatScreen.test.tsx docs/features/F-16-troll-states.md
git commit -m "Put the sunlight switch where the suppression is shown"
```

---

### Task 7: Подключение и удаление панели

> Выполнять после того, как параллельная работа над `CombatScreen.tsx` закоммичена.

**Files:**
- Modify: `src/components/combat/CombatScreen.tsx`
- Delete: `src/components/combat/BloodMagicPanel.tsx`, `src/components/combat/BloodMagicPanel.test.tsx`
- Test: `src/components/combat/CombatScreen.test.tsx`

- [ ] **Step 1: Заменить панель мастером**

`setBloodOpen` остаётся, `BloodMagicPanel` заменяется на `BloodMagicWizard` с `onConfirm: (points, allowAnyway) => apply((current) => exchangeBlood(current, points * ascensionTierRate(character.level), clock, { allowAnyway }))`.

- [ ] **Step 2: Убрать осиротевшее**

Удалить импорт `BloodMagicPanel`, обработчики `onDamage` и `onRecoverMaximum` из места вызова, а `setSunlight` передать в `ResourceHeader`. `recordDamage` и `recoverHitPointMaximum` остаются: первый нужен `HitPointsSheet`, второй — `CampActions`.

- [ ] **Step 3: Удалить панель и её тест**

```bash
git rm src/components/combat/BloodMagicPanel.tsx src/components/combat/BloodMagicPanel.test.tsx
```

Проверки из удалённого теста, которых больше нигде нет, перенести: почасовое восстановление — в тест привала, подавление огнём — в тест шапки.

- [ ] **Step 4: Прогнать всё**

Run: `npm run check:docs && npm run typecheck && npm run test:coverage && npm run build`
Expected: PASS, покрытие не ниже порога.

- [ ] **Step 5: Коммит вместе со спекой**

```bash
git add -A
git commit -m "Open the blood exchange from the list like any other action"
```

Правки в этом же коммите: F-15 — новые FR-177 и FR-178, уточнение FR-171, переписанный раздел «Поведение»; F-03 — общая оболочка и блок руны в «Поведении»; ADR-0017 в `decisions.md`; OQ-17 — пометка о реализации; `roadmap.md` — строка «Кровь и хиты» и удаление FR-152 из «чего не хватает».

---

### Task 8: Прогон сценария на телефоне

**Files:**
- Modify: `e2e/uc-01-cast-spell.spec.ts`

- [ ] **Step 1: Написать прогон**

```ts
test("blood exchange goes through the wizard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Магия крови/ }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByText("Действием обмениваю 6 хитов на 2 очка заклинаний.")).toBeVisible();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByText("Очки 2")).toBeVisible();
});
```

- [ ] **Step 2: Прогнать**

Run: `npx playwright test e2e/uc-01-cast-spell.spec.ts`
Expected: PASS в WebKit на viewport iPhone SE, страница не прокручивается.

- [ ] **Step 3: Коммит**

```bash
git add e2e/uc-01-cast-spell.spec.ts
git commit -m "Walk the blood exchange end to end on iPhone SE"
```
