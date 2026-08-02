# Единая подача способа разрешения — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Способ разрешения заклинания подаётся во всех четырёх местах одной схемой «название проверки + число», не несёт смыслового цвета, а слова и знаки, из которых он собран, существуют по одному разу.

**Architecture:** Слова правил и морфология числа переезжают в `src/core/shared/language.ts` — его видят и `core/application`, и весь интерфейс. Сборка подписи заклинания (порядок слов, иконка) переезжает в новый `src/ui/shared/lib/spellLabels.ts`, который лежит ниже слайсов сущностей: именно запрет `check:layers` на импорт между слайсами одного слоя и породил копии в `entities/concentration`. У `entities/spell/lib/format.ts` остаётся то, что нужно только строке списка.

**Tech Stack:** TypeScript, Vitest (окружение node для правил, jsdom для компонентов), React, Tailwind.

## Global Constraints

- Спека — источник истины: поведение меняется вместе с документом в том же наборе правок. Спека этой работы — `docs/superpowers/specs/2026-08-02-resolution-label-consistency-design.md`.
- Ссылки на `docs/…` и номера требований (`FR-###`, `ADR-####`) в коде **запрещены**, включая комментарии: за этим следит `npm run check:layers`. Связь спеки с кодом держат только имена прогонов.
- Имена прогонов, названные в строке «Проверка» требования, менять нельзя без правки этой строки. `resolutionBadge (FR-211)` обязан остаться именем существующего `describe`.
- `core/` не знает про `ui/`. Внутри `ui/` импорт только вниз по слоям (`app → screens → widgets → features → entities → shared`), слайсы одного слоя друг о друге не знают. Type-only импорт от этого правила освобождён.
- Русский: интерфейс и подписи. Английский: код, идентификаторы, сообщения коммитов.
- Аббревиатуры правил только «КС» и «КД». Никаких `DC`, `AC`.
- Знак модификатора: типографский минус `−` (U+2212), не дефис.
- `exactOptionalPropertyTypes` включён: необязательное поле не присваивается явным `undefined`, а не задаётся вовсе.
- Покрытие `src/core/**` и `src/ui/**/model/**` держится порогом 100% по строкам, ветвям, функциям и операторам. Всё, что добавляется в `src/core/shared/language.ts`, обязано быть покрыто целиком, включая обе ветви знака.
- Компонентный прогон объявляет окружение первой строкой файла: `// @vitest-environment jsdom`. По умолчанию окружение `node`, и без директивы `render` не находит DOM.
- Окружение `node` у прогонов правил — причина, по которой помощник `spell` из тестовых сторов не годится вне компонентных тестов: он тянет `@testing-library/react`.
- Коммит и индексацию делает игрок. Агент оставляет правки неиндексированными, показывает `git diff` и называет предложенное сообщение коммита.
- Полная проверка после каждой задачи: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`.

---

## Файловая структура

**Создаётся:**

| Файл | Ответственность |
|---|---|
| `src/ui/shared/lib/spellLabels.ts` | Подписи полей заклинания, нужные больше одному слайсу: способ разрешения с иконкой, дальность в двух формах, область. Импортирует только `core/`. |
| `src/ui/shared/lib/spellLabels.test.ts` | Прогоны этих подписей, включая `resolutionBadge (FR-211)`. |
| `src/ui/features/blood-magic/ui/BloodMagicRow.test.tsx` | Прогон строки «Магии крови»: экономия хода приходит параметром, поэтому причина недоступности проверяется здесь, а не через экран. |

**Меняется:**

| Файл | Что происходит |
|---|---|
| `src/core/shared/language.ts` | Принимает `signed`, `NO_ROLL_RU`, `AREA_SHAPES_RU`. |
| `src/core/shared/language.test.ts` | Прогоны нового содержимого. |
| `src/core/application/casting/announcement.ts` | Отдаёт свою копию `signed`; слово «Без броска» берёт из словаря. |
| `src/ui/entities/spell/lib/format.ts` | Отдаёт `signed`, `ABILITY_NAMES`, `AREA_SHAPES`, `resolutionLabel`, `resolutionBadge`, `rangeLabel`, `areaLabel`. Остаётся при роли, времени, цене, длительности, уроне, ритуале. |
| `src/ui/entities/spell/lib/format.test.ts` | Уносит `describe("signed")` и `describe("resolutionBadge (FR-211)")`. |
| `src/ui/entities/spell/ui/SpellCardCompact.tsx` | Значок разрешения нейтрален; подписи берёт из общего слоя. |
| `src/ui/widgets/spell-details/ui/SpellCardDetails.tsx` | Строка «Разрешение» печатает короткую форму. |
| `src/ui/entities/concentration/lib/summary.ts` | Отдаёт свои копии `signed`, `AREA_SHAPES`, `resolutionShortRu`, дальность. |
| `src/ui/entities/concentration/lib/summary.test.ts` | Ожидания под новую подачу. |
| `src/ui/features/blood-magic/ui/BloodMagicRow.tsx` | Значок «Без броска» и причина недоступности — из общих источников. |
| `src/ui/features/concentration-check/ui/ConcentrationCheckCard.tsx` | Знак модификатора не считается в разметке. |
| `src/ui/entities/character/lib/labels.ts` | Отдаёт свою копию `signed`. |
| `src/ui/widgets/character-sheet/model/rows.ts` | Берёт `signed` из общего ядра. |
| `src/ui/widgets/resource-header/ui/ResourceHeader.tsx` | Отдаёт свою копию `signed`; ярлык «КС закл.» становится «КС». |
| `src/ui/screens/play/ui/PlayScreen.test.tsx`, `Concentration.test.tsx` | Ожидания под новые подписи. |
| `docs/ux.md` | Правила: цвет разрешения, пара форм, знак минуса, раскрытие сокращения, целая фраза причины. |
| `docs/screens.md` | Строка о значках и текст FR-211. |
| `docs/decisions.md` | ADR-0028. |

---

## Task 1: Один знак модификатора

Шесть реализаций одного правила, две из которых печатают разный минус: `d20−3` в значке и `-3` на листе персонажа. Задача сводит их в одну.

**Files:**
- Modify: `src/core/shared/language.ts` (добавить после `withPlural`, строка 22)
- Modify: `src/core/shared/language.test.ts:3` (импорт) и конец файла
- Modify: `src/core/application/casting/announcement.ts:18,55-58`
- Modify: `src/ui/entities/spell/lib/format.ts:12-18,204-207`
- Modify: `src/ui/entities/spell/lib/format.test.ts:5-12,71-80`
- Modify: `src/ui/entities/character/lib/labels.ts:57-60`
- Modify: `src/ui/widgets/character-sheet/model/rows.ts:13-21`
- Modify: `src/ui/entities/concentration/lib/summary.ts:11,39-42`
- Modify: `src/ui/entities/concentration/lib/summary.test.ts:171-172`
- Modify: `src/ui/widgets/resource-header/ui/ResourceHeader.tsx:11-23`
- Modify: `src/ui/features/concentration-check/ui/ConcentrationCheckCard.tsx:14-15,43-46`
- Modify: `docs/ux.md` (раздел «Текст в интерфейсе», после строки 99)

**Interfaces:**
- Produces: `signed(value: number): string` из `@/core/shared/language`. Отрицательное значение печатается типографским минусом U+2212, ноль и положительное — плюсом. Этой функцией пользуются все последующие задачи.

- [ ] **Step 1: Написать падающий прогон**

В `src/core/shared/language.test.ts` заменить строку 3 на:

```ts
import { longCastingTimeRu, plural, SAVING_THROW_NAMES, signed, timeSpanAccusativeRu, withPlural } from "@/core/shared/language";
```

и добавить в конец файла:

```ts
describe("signed", () => {
  it("знак ставится всегда: «d20+8» произносят вслух именно так", () => {
    expect(signed(8)).toBe("+8");
    expect(signed(0)).toBe("+0");
  });

  it("минус типографский: дефис в этой позиции читается как перенос", () => {
    expect(signed(-2)).toBe("−2");
    expect(signed(-11)).toBe("−11");
  });
});
```

- [ ] **Step 2: Убедиться, что прогон падает**

Run: `npx vitest run src/core/shared/language.test.ts`
Expected: FAIL — `signed` не экспортируется из `@/core/shared/language`.

- [ ] **Step 3: Реализовать**

В `src/core/shared/language.ts` после `withPlural` (строка 22) добавить:

```ts
/**
 * Модификатор со знаком: «+8», «−2».
 *
 * Здесь, а не в подписях: одно и то же число печатают лист персонажа, значок строки списка,
 * объявление мастеру и блок концентрации. Минус типографский — дефис в этой позиции на узком
 * экране читается как перенос строки.
 */
export function signed(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}
```

- [ ] **Step 4: Убедиться, что прогон проходит**

Run: `npx vitest run src/core/shared/language.test.ts`
Expected: PASS.

- [ ] **Step 5: Убрать копию из объявления мастеру**

В `src/core/application/casting/announcement.ts` строку 18 заменить на:

```ts
import { SAVING_THROW_NAMES, signed, withPlural } from "@/core/shared/language";
```

и удалить строки 55–58 целиком:

```ts
/** Знак обязателен: игрок называет «плюс восемь», а не «восемь». */
function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}
```

- [ ] **Step 6: Убрать копию из подписей заклинания**

В `src/ui/entities/spell/lib/format.ts` в импорт из `@/core/shared/language` (строки 12–18) добавить `signed`:

```ts
import {
  longCastingTimeRu,
  plural,
  signed,
  timeSpanAccusativeRu,
  type LongCastingUnit,
  type TimeUnit,
} from "@/core/shared/language";
```

и удалить строки 204–207:

```ts
/** Знак перед модификатором пишется всегда: «d20+8» произносят вслух именно так. */
export function signed(modifier: number): string {
  return modifier < 0 ? `−${Math.abs(modifier)}` : `+${modifier}`;
}
```

В `src/ui/entities/spell/lib/format.test.ts` убрать `signed` из импорта (строки 5–12) и удалить целиком `describe("signed", …)` со строк 71–80: он переехал в прогоны общего ядра.

- [ ] **Step 7: Убрать копию из подписей листа**

В `src/ui/entities/character/lib/labels.ts` удалить строки 57–60:

```ts
/** Модификатор всегда со знаком: «2» и «+2» на листе читаются по-разному. */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}
```

В `src/ui/widgets/character-sheet/model/rows.ts` убрать `signed` из импорта строк 13–21 и добавить отдельной строкой:

```ts
import { signed } from "@/core/shared/language";
```

- [ ] **Step 8: Убрать копию из блока концентрации**

В `src/ui/entities/concentration/lib/summary.ts` строку 11 заменить на:

```ts
import { plural, SAVING_THROW_NAMES, signed } from "@/core/shared/language";
```

и удалить строки 39–42:

```ts
function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}
```

В `src/ui/entities/concentration/lib/summary.test.ts` строки 171–172 заменить на:

```ts
    expect(summary.mechanicsLabel).toContain("атака заклинанием −1");
    expect(summary.breakLabel).toBe("Урон → спасбросок Телосложения −2, КС от 10");
```

(Формулировка `mechanicsLabel` меняется в задаче 3 — здесь правится только знак.)

- [ ] **Step 9: Убрать копию из шапки ресурсов**

В `src/ui/widgets/resource-header/ui/ResourceHeader.tsx` после строки 19 добавить:

```ts
import { signed } from "@/core/shared/language";
```

и удалить строки 21–23:

```ts
function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}
```

- [ ] **Step 10: Убрать счёт знака из разметки проверки концентрации**

В `src/ui/features/concentration-check/ui/ConcentrationCheckCard.tsx` после строки 14 добавить:

```ts
import { signed } from "@/core/shared/language";
```

и строки 43–46 заменить на:

```tsx
        <p className="text-sm">
          Спасбросок Телосложения против КС {check.dc}, модификатор {signed(check.modifier)}
        </p>
```

- [ ] **Step 11: Записать правило в спеку**

В `docs/ux.md` в раздел «Текст в интерфейсе» после строки «Числа, которые игрок будет называть вслух, показываются готовыми: «КД 18», а не «+5 к КД».» добавить:

```markdown
- Модификатор всегда со знаком, и минус типографский: дефис в этой позиции на узком экране читается
  как перенос строки.
```

- [ ] **Step 12: Прогнать всё**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`
Expected: всё зелёное. Если падает прогон, ожидавший дефис, — это забытая копия: найти её `grep -rn "value < 0" src`.

- [ ] **Step 13: Сдать задачу**

Показать `git diff` и остановиться. Предложенное сообщение коммита:

```
refactor: single signed-modifier helper in shared language
```

---

## Task 2: Способ разрешения — одна схема, один нейтральный значок

**Files:**
- Create: `src/ui/shared/lib/spellLabels.ts`
- Create: `src/ui/shared/lib/spellLabels.test.ts`
- Modify: `src/core/shared/language.ts` (добавить `NO_ROLL_RU`)
- Modify: `src/core/shared/language.test.ts`
- Modify: `src/core/application/casting/announcement.ts:18,249`
- Modify: `src/ui/entities/spell/lib/format.ts:12-21,87-94,188-236`
- Modify: `src/ui/entities/spell/lib/format.test.ts:1-12,82-106`
- Modify: `src/ui/entities/spell/ui/SpellCardCompact.tsx:19-33,93,156-158`
- Modify: `src/ui/widgets/spell-details/ui/SpellCardDetails.tsx:17-28,155-157`
- Modify: `src/ui/features/blood-magic/ui/BloodMagicRow.tsx:13-21,65-67`
- Modify: `src/ui/screens/play/ui/PlayScreen.test.tsx:1082-1089,1236`
- Modify: `docs/ux.md` (после таблицы цветов, строка 33)
- Modify: `docs/screens.md:74,389-391`
- Modify: `docs/decisions.md` (в конец, ADR-0028)

**Interfaces:**
- Consumes: `signed` из `@/core/shared/language` (задача 1).
- Produces:
  - `NO_ROLL_RU: "Без броска"` из `@/core/shared/language`.
  - `ResolutionNumbers = Pick<Sheet, "spellSaveDc" | "spellAttackModifier">` из `@/ui/shared/lib/spellLabels`.
  - `resolutionBadge(resolution: Spell["resolution"], numbers: ResolutionNumbers): { label: string; icon: string }` из `@/ui/shared/lib/spellLabels`. Тона не возвращает: способ разрешения цвета не несёт, и тип это кодирует.

- [ ] **Step 1: Написать падающие прогоны**

Создать `src/ui/shared/lib/spellLabels.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolutionBadge } from "@/ui/shared/lib/spellLabels";

/** Числа Торна: оба включают +1 от предмета, и книга их не знает. */
const THORNE = { spellSaveDc: 16, spellAttackModifier: 8 };

describe("resolutionBadge (FR-211)", () => {
  it("все три способа устроены одной схемой: название проверки и число", () => {
    expect(resolutionBadge({ type: "spell_attack" }, THORNE).label).toBe("Атака d20+8");
    // В книге Торна спасбросковых заклинаний пока нет: значок проверяется на данных напрямую,
    // иначе он появится в приложении непроверенным вместе с первой карточкой 2 уровня.
    expect(resolutionBadge({ type: "saving_throw", savingThrow: "DEX" }, THORNE).label).toBe(
      "Спасбросок Ловкости КС 16",
    );
    expect(resolutionBadge({ type: "automatic" }, THORNE).label).toBe("Без броска");
  });

  it("числа берутся у персонажа, а не из книги", () => {
    const novice = { spellSaveDc: 13, spellAttackModifier: 5 };
    expect(resolutionBadge({ type: "spell_attack" }, novice).label).toBe("Атака d20+5");
    expect(resolutionBadge({ type: "saving_throw", savingThrow: "CON" }, novice).label).toBe(
      "Спасбросок Телосложения КС 13",
    );
  });

  it("отрицательный модификатор печатается тем же минусом, что на листе", () => {
    expect(resolutionBadge({ type: "spell_attack" }, { spellSaveDc: 9, spellAttackModifier: -1 }).label).toBe(
      "Атака d20−1",
    );
  });

  it("кто бросает, отвечает иконка, а не цвет: тона значок не несёт", () => {
    const attack = resolutionBadge({ type: "spell_attack" }, THORNE);
    const save = resolutionBadge({ type: "saving_throw", savingThrow: "DEX" }, THORNE);
    const none = resolutionBadge({ type: "automatic" }, THORNE);

    expect([attack.icon, save.icon, none.icon]).toEqual(["✶", "◇", "○"]);
    expect(Object.keys(attack)).toEqual(["label", "icon"]);
  });
});
```

- [ ] **Step 2: Убедиться, что прогоны падают**

Run: `npx vitest run src/ui/shared/lib/spellLabels.test.ts`
Expected: FAIL — модуля `@/ui/shared/lib/spellLabels` не существует.

- [ ] **Step 3: Добавить слово в общий словарь**

В `src/core/shared/language.ts` после `SAVING_THROW_NAMES` добавить:

```ts
/**
 * Способ разрешения, при котором никто ничего не бросает.
 *
 * Словом, а не отрицанием по месту: «Броска нет» и «без спасброска» на соседних экранах читались
 * как два разных факта. Инструкция игроку начинается теми же словами и продолжает свой регистр.
 */
export const NO_ROLL_RU = "Без броска";
```

В `src/core/shared/language.test.ts` добавить:

```ts
describe("NO_ROLL_RU", () => {
  it("отсутствие броска называется одним словом на все экраны", () => {
    expect(NO_ROLL_RU).toBe("Без броска");
  });
});
```

и внести `NO_ROLL_RU` в импорт строки 3.

- [ ] **Step 4: Создать общий модуль подписей**

Создать `src/ui/shared/lib/spellLabels.ts`:

```ts
/**
 * Подписи полей заклинания, нужные больше одному слайсу интерфейса.
 *
 * Лежат ниже слайсов сущностей, потому что слайсы одного слоя друг о друге не знают: пока строка
 * списка и блок концентрации держали свои копии, они разошлись и в слове, и в знаке минуса.
 *
 * Игровых формул здесь нет: числа приходят из состояния персонажа и движка правил, а модуль
 * выбирает слово и падеж.
 */

import type { Sheet } from "@/core/domain/sheet/sheet";
import type { Spell } from "@/core/domain/catalog/spell";
import { NO_ROLL_RU, SAVING_THROW_NAMES, signed } from "@/core/shared/language";

/** Числа персонажа, из которых собирается подпись разрешения. Считает их лист. */
export type ResolutionNumbers = Pick<Sheet, "spellSaveDc" | "spellAttackModifier">;

/**
 * Способ разрешения одной схемой: что бросают и против чего.
 *
 * Текст отвечает на вопрос числом, которое произносят вслух, — «d20+8», «КС 16». Иконка отвечает,
 * кто бросает: заклинатель, цель или никто. Цвета подпись не несёт: восемь смысловых цветов заняты
 * экономией хода, ролью в бою, концентрацией и ритуалом, и синий на числе атаки означал бы, что
 * заклинание тратит действие дважды.
 */
export function resolutionBadge(
  resolution: Spell["resolution"],
  numbers: ResolutionNumbers,
): { label: string; icon: string } {
  switch (resolution.type) {
    case "spell_attack":
      return { label: `Атака d20${signed(numbers.spellAttackModifier)}`, icon: "✶" };
    case "saving_throw":
      return {
        label: `Спасбросок ${SAVING_THROW_NAMES[resolution.savingThrow ?? "CON"]} КС ${numbers.spellSaveDc}`,
        icon: "◇",
      };
    default:
      return { label: NO_ROLL_RU, icon: "○" };
  }
}
```

- [ ] **Step 5: Убедиться, что прогоны проходят**

Run: `npx vitest run src/ui/shared/lib/spellLabels.test.ts src/core/shared/language.test.ts`
Expected: PASS.

- [ ] **Step 6: Убрать старые подписи разрешения**

В `src/ui/entities/spell/lib/format.ts`:

1. Удалить строки 87–94 — словарь `ABILITY_NAMES`. Он побайтово повторяет `SAVING_THROW_NAMES`.
2. Удалить строки 188–198 — `resolutionLabel`.
3. Удалить строки 200–202 — комментарий про падеж: словаря здесь больше нет.
4. Удалить строки 209–236 — `ResolutionNumbers` и `resolutionBadge`.
5. Удалить импорт `Sheet` (строка 8): его использовал только `ResolutionNumbers`. Удалить импорт `CharacterState` (строка 9): он не используется в файле уже сейчас. `type Tone` (строка 21) и `plural` (строка 14) остаются — на них держатся `COMBAT_ROLE`, `CASTING_TIME`, `ritualOnlyBadge` и `durationLabel`.

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 7: Перевести прогоны подписей заклинания**

В `src/ui/entities/spell/lib/format.test.ts` удалить `describe("resolutionBadge (FR-211)", …)` (строки 82–106) и `resolutionBadge` из импорта: прогон переехал в `spellLabels.test.ts` под тем же именем, поэтому строка «Проверка» требования остаётся верной. Убрать константу `THORNE` (строка 15), если её больше никто не использует.

- [ ] **Step 8: Строка списка — нейтральный значок**

В `src/ui/entities/spell/ui/SpellCardCompact.tsx` убрать `resolutionBadge` из импорта строк 19–29 и добавить:

```ts
import { resolutionBadge } from "@/ui/shared/lib/spellLabels";
```

Строки 156–158 заменить на:

```tsx
          <Badge tone="muted" icon={resolution.icon}>
            {resolution.label}
          </Badge>
```

- [ ] **Step 9: Подробная карточка — та же короткая форма**

В `src/ui/widgets/spell-details/ui/SpellCardDetails.tsx` убрать `resolutionLabel` из импорта строк 17–28 и добавить:

```ts
import { resolutionBadge } from "@/ui/shared/lib/spellLabels";
```

Строки 155–157 заменить на:

```tsx
          <Row label="Разрешение">
            {resolutionBadge(spell.resolution, Sheet.of(character)).label}
          </Row>
```

- [ ] **Step 10: «Магия крови» — тот же значок, а не своя строка**

В `src/ui/features/blood-magic/ui/BloodMagicRow.tsx` после строки 18 добавить:

```ts
import { resolutionBadge } from "@/ui/shared/lib/spellLabels";
import { Sheet } from "@/core/domain/sheet/sheet";
```

Перед `return` добавить:

```ts
  // Обмен хитов на очки не бросает ничего, и говорит об этом тем же значком, что заклинание:
  // собственная подпись здесь однажды разошлась со словом заклинания.
  const resolution = resolutionBadge({ type: "automatic" }, Sheet.of(character));
```

Строки 65–67 заменить на:

```tsx
          <Badge tone="muted" icon={resolution.icon}>
            {resolution.label}
          </Badge>
```

- [ ] **Step 11: Инструкция начинается тем же словом**

В `src/core/application/casting/announcement.ts` внести `NO_ROLL_RU` в импорт строки 18:

```ts
import { NO_ROLL_RU, SAVING_THROW_NAMES, signed, withPlural } from "@/core/shared/language";
```

Строку 249 заменить на:

```ts
      steps.push(`${NO_ROLL_RU}: эффект применяется сразу`);
```

Регистр инструкции при этом не меняется — она по-прежнему говорит порогами; общим становится только слово.

- [ ] **Step 12: Обновить ожидания сквозных прогонов**

В `src/ui/screens/play/ui/PlayScreen.test.tsx` строки 1082–1089 заменить на:

```tsx
  it("разрешение называет число, а не вид броска (FR-211)", async () => {
    await renderWithStores(<PlayScreen />);

    // Название проверки и число вместе: «Атака» без числа — половина ответа, «d20+8» без названия
    // не связывается с тем, что скажет мастер.
    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText("Атака d20+8")).toBeDefined();
  });
```

Строку 1236 заменить на:

```tsx
    expect(within(card).getByText("Без броска: эффект применяется сразу")).toBeDefined();
```

В `src/core/application/casting/announcement.test.ts` строку 348 заменить на:

```ts
    expect(steps).toContain("Без броска: эффект применяется сразу");
```

- [ ] **Step 13: Записать решение и правила в спеку**

В `docs/decisions.md` в конец файла добавить:

```markdown
---

## ADR-0028

**Способ разрешения не несёт смыслового цвета**

**Статус:** Принято · 2026-08-02

**Контекст.** Значок разрешения красился тонами действия и бонусного действия. В строке боевого
списка синий значил одновременно «тратит действие» и «бросьте d20+8», а жёлтый — «бонусное действие»
и «цель бросает спасбросок». Цвет обязан нести одно значение, иначе он не несёт никакого. При этом
восемь смысловых цветов уже заняты, а девятый превратил бы шкалу в радугу, в которой не выделяется
ничего.

**Варианты.**

1. Оставить как есть и объяснить цвет подписью. Подпись рядом уже стоит, и она же показывает, что
   цвет здесь ничего не добавляет, — а путаницу добавляет.
2. Выделить разрешению девятый оттенок. Свободных промежутков в палитре нет: оранжевый и бирюзовый
   уже стоят между занятыми, и десятый оттенок пришлось бы ставить между ними.
3. Признать, что разрешение — не цветное измерение. Различают его иконка и текст, а цвет остаётся за
   экономией хода, ролью в бою, концентрацией и ритуалом.

**Выбор.** Третий вариант.

**Последствия.** Значок разрешения нейтрален во всех трёх состояниях, и сборка подписи цвета не
отдаёт вовсе: тип возвращаемого значения делает ошибку невозможной, а не запрещает её на словах.
Заметность разрешения падает — но текст его и был единственным носителем смысла, а рядом остаётся
цветной значок вида действия, по которому строку и находят.
```

В `docs/ux.md` после таблицы цветов (строка 33) добавить:

```markdown
**Способ разрешения цвета не несёт** (ADR-0028). Восемь оттенков заняты, и
синий на числе атаки означал бы, что заклинание тратит действие дважды. Бросок и его порог различают
иконка и текст: кто бросает — иконка, что бросают и против чего — подпись.
```

В раздел «Текст в интерфейсе» добавить:

```markdown
- Одна идея названа одним словом. У отсутствия броска, у характеристики в спасброске и у КС
  спасброска синонимов нет: расхождение в слове на соседних экранах читается как расхождение в
  правилах.
```

В `docs/screens.md` строку 74 заменить на:

```markdown
Значки строки: роль — цвет рамки и слово в углу; вид действия и концентрация — цветные значки;
разрешение — значок без цвета; цена, дальность, длительность и урон — текстом через точку.
```

и в текст FR-211 после существующего абзаца добавить:

```markdown
Разрешение подаётся одной схемой во всех местах, где называется: название проверки и число, которое
произносят вслух. Кто бросает, отвечает иконка; цвета разрешение не несёт.
```

- [ ] **Step 14: Прогнать всё**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`
Expected: всё зелёное.

- [ ] **Step 15: Сдать задачу**

Показать `git diff` и остановиться. Предложенное сообщение коммита:

```
feat: one schema and no semantic colour for spell resolution
```

---

## Task 3: Дальность и область — одна реализация, пара форм

Блок концентрации держит собственную дальность и собственный словарь фигур. Расхождение «Особая» против «Особой дальности» — не ошибка, а то же правило, что у времени и длительности: без ярлыка рядом подпись обязана назвать себя сама. Правило переезжает в спеку, реализация — в один модуль.

**Files:**
- Modify: `src/core/shared/language.ts` (добавить `AREA_SHAPES_RU`)
- Modify: `src/ui/shared/lib/spellLabels.ts`
- Modify: `src/ui/shared/lib/spellLabels.test.ts`
- Modify: `src/ui/entities/spell/lib/format.ts:128-139,176-186`
- Modify: `src/ui/entities/spell/ui/SpellCardCompact.tsx`
- Modify: `src/ui/widgets/spell-details/ui/SpellCardDetails.tsx`
- Modify: `src/ui/entities/concentration/lib/summary.ts:1-19,44-88`
- Modify: `src/ui/entities/concentration/lib/summary.test.ts:73,154,171`
- Modify: `src/ui/screens/play/ui/Concentration.test.tsx:53-54`
- Modify: `docs/ux.md` (раздел «Текст в интерфейсе»)

**Interfaces:**
- Consumes: `resolutionBadge`, `ResolutionNumbers` из `@/ui/shared/lib/spellLabels` (задача 2); `signed` (задача 1).
- Produces из `@/ui/shared/lib/spellLabels`:
  - `rangeLabel(range: Spell["range"]): string` — короткая форма для подписанной строки: «На себя», «Касание», «150 футов», «Особая».
  - `rangePhrase(range: Spell["range"]): string` — фразовая форма для строки без ярлыка: та же, кроме «Особая дальность».
  - `areaLabel(area: NonNullable<Spell["area"]>): string` — «Сфера, 30 футов».
  - `areaPhrase(area: NonNullable<Spell["area"]>, fromSelf: boolean): string` — «Сфера 30 футов от себя».

- [ ] **Step 1: Написать падающие прогоны**

В `src/ui/shared/lib/spellLabels.test.ts` расширить существующий импорт до

```ts
import {
  areaLabel,
  areaPhrase,
  rangeLabel,
  rangePhrase,
  resolutionBadge,
} from "@/ui/shared/lib/spellLabels";
```

и добавить:

```ts
describe("дальность в двух формах", () => {
  it("подписанная строка говорит коротко: ярлык рядом уже ответил, о чём речь", () => {
    expect(rangeLabel({ type: "self" })).toBe("На себя");
    expect(rangeLabel({ type: "touch" })).toBe("Касание");
    expect(rangeLabel({ type: "distance", distanceFeet: 150 })).toBe("150 футов");
    expect(rangeLabel({ type: "special" })).toBe("Особая");
  });

  it("строка без ярлыка называет себя сама: «Особая» одна ничего не говорит", () => {
    expect(rangePhrase({ type: "special" })).toBe("Особая дальность");
    expect(rangePhrase({ type: "distance", distanceFeet: 30 })).toBe("30 футов");
    expect(rangePhrase({ type: "self" })).toBe("На себя");
  });

  it("футы склоняются", () => {
    expect(rangeLabel({ type: "distance", distanceFeet: 1 })).toBe("1 фут");
    expect(rangeLabel({ type: "distance", distanceFeet: 2 })).toBe("2 фута");
  });
});

describe("область в двух формах", () => {
  it("подписанная строка отделяет фигуру от размера запятой", () => {
    expect(areaLabel({ shape: "sphere", sizeFeet: 30 })).toBe("Сфера, 30 футов");
  });

  it("строка без ярлыка добавляет, откуда область считается", () => {
    expect(areaPhrase({ shape: "sphere", sizeFeet: 30 }, true)).toBe("Сфера 30 футов от себя");
    expect(areaPhrase({ shape: "cone", sizeFeet: 15 }, false)).toBe("Конус 15 футов");
  });
});
```

- [ ] **Step 2: Убедиться, что прогоны падают**

Run: `npx vitest run src/ui/shared/lib/spellLabels.test.ts`
Expected: FAIL — `rangeLabel` и остальные не экспортируются.

- [ ] **Step 3: Перенести словарь фигур в общее ядро**

В `src/core/shared/language.ts` после `SAVING_THROW_NAMES` добавить:

```ts
/** Фигуры области: слова правил, и в двух местах их держать нельзя. */
export const AREA_SHAPES_RU = {
  cone: "Конус",
  cube: "Куб",
  line: "Линия",
  sphere: "Сфера",
  cylinder: "Цилиндр",
} as const;
```

- [ ] **Step 4: Реализовать подписи**

В `src/ui/shared/lib/spellLabels.ts` дополнить импорт:

```ts
import { AREA_SHAPES_RU, NO_ROLL_RU, plural, SAVING_THROW_NAMES, signed } from "@/core/shared/language";
```

и добавить:

```ts
function feet(value: number): string {
  return `${value} ${plural(value, ["фут", "фута", "футов"])}`;
}

/**
 * Дальность там, где рядом стоит ярлык.
 *
 * Парная к `rangePhrase`: подпись под ярлыком «Дальность» отвечать за себя не обязана, а подпись в
 * ряду фактов через точку — обязана. То же правило действует у времени накладывания и длительности.
 */
export function rangeLabel(range: Spell["range"]): string {
  switch (range.type) {
    case "self":
      return "На себя";
    case "touch":
      return "Касание";
    case "distance":
      return feet(range.distanceFeet ?? 0);
    default:
      return "Особая";
  }
}

/** Дальность там, где ярлыка рядом нет: «Особая» одна не говорит, что именно особое. */
export function rangePhrase(range: Spell["range"]): string {
  return range.type === "special" ? "Особая дальность" : rangeLabel(range);
}

/** Область под ярлыком: запятая отделяет фигуру от размера. */
export function areaLabel(area: NonNullable<Spell["area"]>): string {
  return `${AREA_SHAPES_RU[area.shape]}, ${feet(area.sizeFeet)}`;
}

/** Область в ряду фактов: «от себя» отвечает на вопрос, откуда её отмерять. */
export function areaPhrase(area: NonNullable<Spell["area"]>, fromSelf: boolean): string {
  const shape = `${AREA_SHAPES_RU[area.shape]} ${feet(area.sizeFeet)}`;
  return fromSelf ? `${shape} от себя` : shape;
}
```

- [ ] **Step 5: Убедиться, что прогоны проходят**

Run: `npx vitest run src/ui/shared/lib/spellLabels.test.ts`
Expected: PASS.

- [ ] **Step 6: Убрать копии из подписей заклинания**

В `src/ui/entities/spell/lib/format.ts` удалить `rangeLabel` (строки 128–139) и `AREA_SHAPES` с `areaLabel` (строки 176–186). `plural` из импорта **не убирать**: на нём держится `durationLabel`.

В `src/ui/entities/spell/ui/SpellCardCompact.tsx` убрать `rangeLabel` из импорта подписей заклинания и внести в импорт общего модуля:

```ts
import { rangeLabel, resolutionBadge } from "@/ui/shared/lib/spellLabels";
```

В `src/ui/widgets/spell-details/ui/SpellCardDetails.tsx` так же:

```ts
import { areaLabel, rangeLabel, resolutionBadge } from "@/ui/shared/lib/spellLabels";
```

убрав `areaLabel` и `rangeLabel` из импорта подписей заклинания.

- [ ] **Step 7: Убрать копии из блока концентрации**

В `src/ui/entities/concentration/lib/summary.ts`:

1. Удалить строки 13–19 — словарь `AREA_SHAPES`.
2. Удалить `feet` (строки 44–46) и `reachLabel` (строки 48–63).
3. Удалить `resolutionShortRu` (строки 66–75).
4. Добавить импорт:

```ts
import { areaPhrase, rangePhrase, resolutionBadge } from "@/ui/shared/lib/spellLabels";
```

5. `mechanicsRu` (строки 77–88) заменить на:

```ts
/**
 * Механика висящего эффекта в ряду фактов через точку.
 *
 * Каждый факт назван той же подписью, что в строке боевого списка: пока блок держал свои
 * формулировки, «Луч холода» показывал «атака заклинанием +8» там, где список говорил «Атака d20+8».
 */
function mechanicsRu(spell: Spell, effect: ActiveEffect, character: CharacterState): string {
  const reach =
    spell.area === undefined
      ? rangePhrase(spell.range)
      : areaPhrase(spell.area, spell.range.type === "self");
  const damage =
    spell.damage === undefined
      ? null
      : `Урон ${effectiveDamage(spell.damage, {
          spellLevel: spell.level,
          slotLevel: effect.slotLevelUsed,
          characterLevel: character.level,
        })} (${spell.damage.type})`;

  return [reach, resolutionBadge(spell.resolution, Sheet.of(character)).label, damage]
    .filter((part) => part !== null)
    .join(" · ");
}
```

- [ ] **Step 8: Обновить ожидания прогонов концентрации**

В `src/ui/entities/concentration/lib/summary.test.ts`:

Строку 73 заменить на:

```ts
    expect(summary.mechanicsLabel).toBe("Сфера 30 футов от себя · Без броска");
```

Строку 154 заменить на:

```ts
    expect(summary.mechanicsLabel).toBe("На себя · Спасбросок Телосложения КС 16");
```

Строку 171 заменить на:

```ts
    expect(summary.mechanicsLabel).toContain("Атака d20−1");
```

В `src/ui/screens/play/ui/Concentration.test.tsx` строку 53 заменить на:

```tsx
    expect(within(block).getByText(/Сфера 30 футов от себя · Без броска/)).toBeDefined();
```

- [ ] **Step 9: Записать правило пары в спеку**

В `docs/ux.md` в раздел «Текст в интерфейсе» добавить:

```markdown
- Подпись, у которой рядом стоит ярлык, короткая. Подпись, стоящая в ряду фактов без ярлыка,
  фразовая: она сама отвечает на вопрос, ярлыка у которого нет. Так «Особая» под ярлыком
  «Дальность» становится «Особой дальностью» в ряду через точку, а «Мгновенная» — «Мгновенным
  эффектом».
```

- [ ] **Step 10: Прогнать всё**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`
Expected: всё зелёное.

- [ ] **Step 11: Сдать задачу**

Показать `git diff` и остановиться. Предложенное сообщение коммита:

```
refactor: single range and area labels with a named short/phrase pair
```

---

## Task 4: Причина недоступности — всегда целая фраза

Шаблон «Недоступно: …» подставляет у заклинания предложение, а у «Магии крови» — одно слово: «Недоступно: действие». Игрок остаётся догадываться, что с действием не так.

**Files:**
- Create: `src/ui/features/blood-magic/ui/BloodMagicRow.test.tsx`
- Modify: `src/ui/features/blood-magic/ui/BloodMagicRow.tsx:13-38`
- Modify: `docs/ux.md:35-37`

**Interfaces:**
- Consumes: `ACTION_SPENT_MESSAGES: Record<TurnResource, string>` — уже экспортирован из `@/core/application/casting/availability`, содержит «Действие уже израсходовано», «Бонусное действие уже израсходовано», «Реакция уже израсходована».
- Consumes: `TurnEconomy = { round: number; inFight: boolean; actionAvailable: boolean; bonusActionAvailable: boolean; reactionAvailable: boolean }` из `@/core/application/useCases/turn`.

- [ ] **Step 1: Написать падающий прогон**

Прогон компонентный, а не сквозной: израсходованность действия выводится из журнала боя и подстановкой в состояние не задаётся, а строка «Магии крови» принимает экономию хода параметром. Проверять её через экран значило бы творить заклинание мастером применения ради одной подписи.

Создать `src/ui/features/blood-magic/ui/BloodMagicRow.test.tsx`:

```tsx
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { TurnEconomy } from "@/core/application/useCases/turn";
import { BloodMagicRow } from "@/ui/features/blood-magic/ui/BloodMagicRow";

// Автоматической очистки нет: тесты не пользуются глобалями vitest.
afterEach(cleanup);

const IN_TURN: TurnEconomy = {
  round: 1,
  inFight: true,
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
};

function renderRow(economy: TurnEconomy): void {
  render(
    <ul>
      <BloodMagicRow character={createThorne()} economy={economy} onOpen={() => {}} />
    </ul>,
  );
}

describe("BloodMagicRow (FR-207)", () => {
  it("причина недоступности — целая фраза, как у заклинания", () => {
    renderRow({ ...IN_TURN, actionAvailable: false });

    expect(screen.getByText("Недоступно: Действие уже израсходовано")).toBeDefined();
  });

  it("доступная строка причины не называет", () => {
    renderRow(IN_TURN);

    expect(screen.queryByText(/Недоступно/)).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что прогон падает**

Run: `npx vitest run src/ui/features/blood-magic/ui/BloodMagicRow.test.tsx`
Expected: FAIL — на экране «Недоступно: действие».

- [ ] **Step 3: Реализовать**

В `src/ui/features/blood-magic/ui/BloodMagicRow.tsx` добавить импорт:

```ts
import { ACTION_SPENT_MESSAGES } from "@/core/application/casting/availability";
```

и строки 33–38 заменить на:

```ts
  // Причина — целая фраза, как у заклинания: одно слово «действие» не говорит, что с ним не так.
  const reason = !bloodMagicAvailable(character.suppression)
    ? "Особенности подавлены"
    : !economy.actionAvailable
      ? ACTION_SPENT_MESSAGES.action
      : null;
```

- [ ] **Step 4: Убедиться, что прогоны проходят**

Run: `npx vitest run src/ui/features/blood-magic/ui/BloodMagicRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Найти прогоны, ожидавшие старое слово**

Run: `grep -rn "Недоступно: действие\|Недоступно: особенности" src`
Ожидаемых совпадений быть не должно. Если есть — заменить ожидание на целую фразу.

- [ ] **Step 6: Записать правило в спеку**

В `docs/ux.md` абзац после таблицы цветов (строки 35–37) дополнить предложением:

```markdown
Причина — целая фраза, читаемая как предложение: «Действие уже израсходовано», а не «действие».
Одно слово в этой позиции называет ресурс, а не то, что с ним не так.
```

- [ ] **Step 7: Прогнать всё**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`
Expected: всё зелёное.

- [ ] **Step 8: Сдать задачу**

Показать `git diff` и остановиться. Предложенное сообщение коммита:

```
fix: blood magic explains unavailability with a whole phrase
```

---

## Task 5: КС спасброска — одно имя и правило сокращения

Одно число названо тремя способами: «КС спасброска» на листе, «КС закл.» в шапке, «КС 16» в значке. Третий синоним исчезает, а два оставшихся различает правило.

**Files:**
- Modify: `src/ui/widgets/resource-header/ui/ResourceHeader.tsx:159`
- Modify: `src/ui/screens/play/ui/PlayScreen.test.tsx:359,366`
- Modify: `docs/ux.md` (раздел «Текст в интерфейсе»)

**Interfaces:**
- Consumes: `DERIVED_LABELS.spellSaveDc === "КС спасброска"` из `@/ui/entities/character/lib/labels` — остаётся как есть, это полное имя для списка производных чисел.

- [ ] **Step 1: Написать падающий прогон**

В `src/ui/screens/play/ui/PlayScreen.test.tsx` строки 359 и 366 заменить на:

```tsx
    expect(inCombat.getByText("КС")).toBeDefined();
```

и

```tsx
    expect(screen.queryByText("КС")).toBeNull();
```

Добавить рядом:

```tsx
  it("шапка сокращает КС, потому что рядом стоит КД", async () => {
    await renderWithStores(<PlayScreen />);

    const header = within(screen.getByLabelText("Ресурсы"));
    expect(header.getByText("КС")).toBeDefined();
    expect(header.getByText("КД")).toBeDefined();
    // Третьего имени одному числу не заводится: «КС закл.» было им.
    expect(header.queryByText("КС закл.")).toBeNull();
  });
```

- [ ] **Step 2: Убедиться, что прогон падает**

Run: `npx vitest run src/ui/screens/play/ui/PlayScreen.test.tsx -t "сокращает КС"`
Expected: FAIL — в шапке «КС закл.».

- [ ] **Step 3: Реализовать**

В `src/ui/widgets/resource-header/ui/ResourceHeader.tsx` строку 159 заменить на:

```tsx
        {/* «КС» без раскрытия: рядом стоит «КД», и пара читается сама. */}
        <Stat label="КС" value={`${totals.spellSaveDc}`} />
```

- [ ] **Step 4: Убедиться, что прогоны проходят**

Run: `npx vitest run src/ui/screens/play/ui/PlayScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Записать правило в спеку**

В `docs/ux.md` в раздел «Текст в интерфейсе» добавить:

```markdown
- Сокращение раскрывается там, где рядом нет пары. «КС» рядом с «КД» понятно само; «КС спасброска» в
  списке производных чисел, где «КД» рядом нет, называется полностью. Третьего имени одному числу не
  заводится.
```

- [ ] **Step 6: Прогнать всё**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`
Expected: всё зелёное.

- [ ] **Step 7: Сдать задачу**

Показать `git diff` и остановиться. Предложенное сообщение коммита:

```
fix: one name for the spell save DC across screens
```

---

## Финальная проверка

- [ ] **Ни одной забытой копии**

Run: `grep -rn "value < 0\|modifier < 0" src | grep -v language.ts`
Expected: пусто.

Run: `grep -rn "Броска нет\|без спасброска\|КС закл\.\|ABILITY_NAMES\|AREA_SHAPES\b" src`
Expected: пусто.

- [ ] **Значок разрешения не берёт цвет экономии хода**

Run: `grep -rn "resolutionBadge" src | grep -v "\.test\."`
Expected: четыре места вызова — строка списка, подробная карточка, блок концентрации, «Магия крови». Ни в одном рядом нет `tone={` кроме `tone="muted"`.

- [ ] **Полный набор проверок**

Run: `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`
Expected: всё зелёное.
