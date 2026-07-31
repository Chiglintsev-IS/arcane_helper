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

## Состояние на 23:31, после параллельной работы

Пока писался план, другая сессия закрыла руны коммитом `0f4502e` — и тем же решением, что выбрано здесь: блок на шаге «Чем сотворить», отдельного шага в `WIZARD_STEPS` нет.

**Задачи 1 и 5 выполнены не мной.** Отличия от плана — в именах, не в поведении: модуль экспортирует `RUNES`, `Rune`, `RUNE_LABEL` и `runeEffect(rune, slotLevel): string` (строка, а не `{ value, textRu }`). Эти имена и используются дальше; переименовывать нечего.

Остались два расхождения со спекой, они становятся задачами 5a и 5b:

1. Блок руны исчезает при оплате кровью и при нулевом пуле ([CastWizard.tsx:458](../../../src/components/cast/CastWizard.tsx#L458)) — спека требует причину вместо исчезновения.
2. Эффект руны не попадает в объявление мастеру — этого требует строка проверки в [F-13](../../features/F-13-runes.md#проверка).

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

### Task 1: Числовые эффекты рун — сделано в `0f4502e`

`src/rules/runes.ts` и `src/rules/runes.test.ts` написаны параллельной сессией. Экспорт:
`RUNES`, `Rune`, `RUNE_LABEL`, `runeEffect(rune: Rune, slotLevel: number): string`.

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

### Task 5: Блок руны — сделано в `0f4502e`

`RuneStep` рендерится внутри шага `slot` ([CastWizard.tsx:446-466](../../../src/components/cast/CastWizard.tsx#L446-L466)),
`CastDraft.rune` и `chooseRune` есть в сторе, руна снимается при смене оплаты на не-ячейку.

---

### Task 5a: Причина вместо исчезновения блока руны

**Files:**
- Modify: `src/components/cast/CastWizard.tsx:446-466`
- Test: `src/components/cast/CastWizard.test.tsx`

- [ ] **Step 1: Написать падающий тест**

```tsx
it("при оплате кровью руна не применяется и говорит почему (OQ-17)", async () => {
  const { user } = await openWizardFor("web");
  await user.click(screen.getByRole("button", { name: /Кровью/ }));
  expect(screen.getByText("При оплате кровью руна не применяется")).toBeDefined();
});

it("без рун объясняет, когда они вернутся", async () => {
  const spent = createThorne();
  spent.runes = { remaining: 0, maximum: 3 };
  await openWizardFor("web", spent);
  expect(screen.getByText("Рун не осталось, вернутся долгим отдыхом")).toBeDefined();
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/cast/CastWizard.test.tsx -t "руна"`
Expected: FAIL — блок скрыт целиком, текста нет.

- [ ] **Step 3: Реализовать**

Условие показа блока сузить до «заклинание оплачивается ячейкой в принципе» (`draft.spell.level !== CANTRIP_LEVEL && draft.mode !== "ritual"`), а внутри `RuneStep` вместо списка вариантов показывать строку причины, когда `payment.kind !== "slot"` или `runes.remaining === 0`.

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/components/cast && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/components/cast/CastWizard.tsx src/components/cast/CastWizard.test.tsx
git commit -m "Say why the rune is unavailable instead of hiding it"
```

---

### Task 5b: Эффект руны в объявлении мастеру

**Files:**
- Modify: `src/rules/announcement.ts`
- Test: `src/rules/announcement.test.ts`

**Interfaces:**
- Produces: поле `rune?: Rune` в `AnnouncementContext`; фраза руны в конце `renderAnnouncement`; шаг «Спишется руна» в `castInstructions`.

- [ ] **Step 1: Написать падающий тест**

```ts
it("называет руну и её эффект отдельной фразой (FR-151, FR-152)", () => {
  const announcement = renderAnnouncement(web, {
    character: createThorne(),
    mode: "normal",
    payment: { kind: "slot", slotLevel: 3 },
    rune: "war",
  });
  expect(announcement.text).toContain(
    "Применяю руну войны: +2 к броскам атаки союзников в пределах 30 футов",
  );
});

it("при оплате кровью руну не называет (OQ-17)", () => {
  const announcement = renderAnnouncement(web, {
    character: createThorne(),
    mode: "normal",
    payment: { kind: "spell_points" },
    rune: "war",
  });
  expect(announcement.text).not.toMatch(/руну/);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/announcement.test.ts -t "руну"`
Expected: FAIL — поля `rune` в контексте нет.

- [ ] **Step 3: Реализовать**

```ts
/** Руна в шаблонах карточек не предусмотрена: она добавляется фразой, а не подстановкой (FR-151). */
function runeSentence(context: AnnouncementContext): string {
  if (context.rune === undefined || context.payment.kind !== "slot") return "";
  const name = RUNE_LABEL[context.rune].replace("Руна ", "руну ");
  return ` Применяю ${name}: ${runeEffect(context.rune, context.payment.slotLevel)}.`;
}
```

Вызов — рядом с `paymentSentence` в `renderAnnouncement`. В `castInstructions` — шаг `Спишется руна: ${runeEffect(...)}` после строки об оплате. `CastWizard` передаёт `rune: draft.rune ?? undefined` в контекст.

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/rules src/components/cast && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/rules/announcement.ts src/rules/announcement.test.ts \
        src/components/cast/CastWizard.tsx docs/features/F-13-runes.md
git commit -m "Let the rune reach the words said to the DM"
```

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
