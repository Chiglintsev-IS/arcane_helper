# Блок концентрации на экране боя — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Активная концентрация на главном экране отвечает на три вопроса — что держится, как работает, чем прерывается — и даёт снять её или провести проверку после урона, не открывая книгу правил.

**Architecture:** Текст собирает чистая функция `describeConcentration` в `src/rules/concentration.ts` из полей заклинания, активного эффекта и состояния персонажа; компоненты в `src/components/combat/` только отображают и сообщают о нажатии наверх, а состояние меняется единственной точкой `apply` в `CombatScreen`. Новых полей контент не получает, производный текст в сохранённое состояние не пишется.

**Tech Stack:** Next.js 15 (статический экспорт), TypeScript strict, Tailwind, Zustand, Vitest + Testing Library, Playwright.

Спека: [docs/superpowers/specs/2026-07-31-concentration-block-design.md](../specs/2026-07-31-concentration-block-design.md).

## Global Constraints

- **Язык.** Документация, интерфейс и контент — русский; код, идентификаторы, имена файлов, сообщения коммитов — английский. Имена в коде берутся из [glossary.md](../../glossary.md), синонимы не изобретаются.
- **Аббревиатуры в интерфейсе только русские и только сложившиеся: «КС», «КД».** «ТЕЛ», «ЛОВ», «DC» запрещены — характеристика называется полным словом: «спасбросок Телосложения» ([ux.md](../../ux.md#текст-в-интерфейсе)).
- **Числа показываются готовыми к произнесению вслух:** «КС 12», «нужно 8 и выше», а не «+4 к спасброску».
- **Информация никогда не передаётся только цветом** — цвет всегда с иконкой и подписью ([ux.md](../../ux.md#доступность)). Для меток используется существующий `Badge`.
- **Покрытие `src/rules/`, `src/store/`, `src/data/` — ровно 100 %** по строкам, функциям, ветвям и операторам (`vitest.config.ts`). Каждая новая ветвь в `src/rules/` требует теста. Компоненты в покрытие не входят и проверяются поведением.
- **Направление зависимостей.** `src/rules/` не импортирует ничего из `src/store/` и `src/components/` — иначе появится цикл (`session.ts` уже импортирует правила). Нужное от журнала описывается структурным типом внутри правил.
- **Состояние меняется только через `apply`** в [CombatScreen.tsx](../../../src/components/combat/CombatScreen.tsx) ([ADR-0003](../../decisions.md#adr-0003), [ADR-0006](../../decisions.md#adr-0006)). Новые компоненты презентационные: получают данные параметрами, наверх сообщают о нажатии.
- **Минимальная цель нажатия — 44 px** (`min-h-11` в Tailwind).
- **Приложение не бросает кубики** ([OQ-09](../../open-questions.md#oq-09)): бросает игрок, приложение фиксирует результат.
- **Не выдумывать механику.** Числа и правила — из подтверждённых источников; при сомнении запись в [open-questions.md](../../open-questions.md), а не догадка (правило 4 в [CLAUDE.md](../../../CLAUDE.md)).
- **Один коммит — код и спека вместе** (правило 2 там же). Требование появляется в спеке раньше кода, статус переводится в `Готово` в том же коммите, что делает его правдой.
- **Проверка перед каждым коммитом:** `npm run check:docs && npm run typecheck && npm run test:coverage`. Перед последним коммитом ещё и `npm run build`.

**В шапке уже есть подпись вклада эффекта в КД** — `armorClassNote` в [ResourceHeader.tsx](../../../src/components/combat/ResourceHeader.tsx) отвечает на «почему КД 17, а не 14» ([FR-093](../../features/F-08-active-effects.md#fr-093)). Задачи 5 и 9 переписывают именно те блоки, где она стоит: подпись обязана сохраниться и для концентрационного эффекта, и для остальных. Потерять её значит откатить готовое требование.

**Незакоммиченная работа в репозитории.** `playwright.config.ts`, каталог `e2e/` и правки `package.json` на момент составления плана не в git (это чужая работа в процессе). Задача 10 добавляет E2E-тест в существующий файл `e2e/uc-01-cast-spell.spec.ts`. Если файл к тому моменту всё ещё не отслеживается, **спросить владельца репозитория**, включать ли его и `playwright.config.ts` в коммит, а не решать самостоятельно.

---

### Task 1: Требование и правила в спеке

Спека идёт раньше кода (правило 1 в [CLAUDE.md](../../../CLAUDE.md)). Здесь появляется требование FR-084, список способов прерывания как правила игры и крайние случаи. Статус требования — `В работе`: он станет `Готово` в задаче 10.

**Files:**
- Modify: `docs/features/F-07-concentration.md`
- Modify: `docs/features/README.md` — строка F-07 в таблице «Состав MVP»
- Modify: `docs/rules-engine.md` — раздел «## Концентрация»

**Interfaces:**
- Consumes: ничего.
- Produces: идентификатор `FR-084`, на который ссылаются комментарии в коде задач 3, 5 и 6; раздел `rules-engine.md#что-прерывает-концентрацию`, на который ссылается комментарий в `src/rules/concentration.ts`.

- [x] **Step 1: Добавить FR-084 в F-07**

В `docs/features/F-07-concentration.md` после блока `FR-083` (перед разделом «## Поведение и крайние случаи») вставить:

```markdown
<a id="fr-084"></a>
### FR-084 — Состав блока концентрации

**Статус:** В работе · **Проверка:** unit `describeConcentration`, компонентный `Concentration`, E2E `concentration block explains the effect`, [AC-14](../quality.md#критерии-приёмки-mvp)

Пока концентрация активна, главный экран должен отвечать на три вопроса без открытия карточки
заклинания и без обращения к правилам: что именно держится, как этот эффект работает и чем он
прерывается.

Карточка в шапке показывает: название заклинания; уровень потраченной ячейки; раунд начала;
механику одной строкой (область или дальность, цель, способ разрешения с подставленными числами,
урон); чем концентрация сорвётся от урона — с модификатором спасброска персонажа.

Тап по карточке открывает лист, где к этому добавляются: длительность в исходных единицах и в
раундах; короткие правила заклинания; полный список способов прерывания; переход к полной карточке
заклинания; действия «Получил урон» и «Снять концентрацию».

Список способов прерывания — правила игры, а не текст интерфейса: он живёт в
[rules-engine.md](../rules-engine.md#что-прерывает-концентрацию).
```

- [x] **Step 2: Добавить крайние случаи в F-07**

В том же файле в раздел «## Поведение и крайние случаи» добавить четыре абзаца перед абзацем «**Незаметная потеря невозможна.**»:

```markdown
**Успех проверки не пишется в журнал.** Журнал — след изменений состояния, а успешная проверка
ничего не меняет; сам факт урона уже записан операцией получения урона. Провал пишется как
завершение концентрации с причиной «провалена проверка концентрации».

**Раунд начала выводится из журнала.** Считается так же, как его считает экономия хода: число
записей о начале хода до времени начала эффекта. Журнал обрезается
([OQ-08](../open-questions.md#oq-08)), поэтому у долгого эффекта начало может быть вытеснено — тогда
показывается «раунд ≥ N». Неточность честнее неверного числа.

**Руна предлагается до завершения.** Кнопка «Провал» сама ничего не завершает, пока доступны руна и
реакция: сначала предложение «Знаков ограждения» ([FR-154](F-13-runes.md#fr-154)), и только явный
отказ завершает эффект.

**Ввод урона доступен и без концентрации.** Урон списывает хиты независимо от того, держится ли
что-нибудь; карточка проверки появляется только при активной концентрации. Там же ставится признак
огненного урона ([FR-180](F-16-troll-states.md#fr-180)).
```

- [x] **Step 3: Расширить диапазон F-07 в реестре**

В `docs/features/README.md` в строке F-07 заменить `FR-080…083` на `FR-080…084`.

- [x] **Step 4: Добавить правила прерывания в rules-engine.md**

В `docs/rules-engine.md` в раздел «## Концентрация» после подраздела «### КС проверки концентрации» (после абзаца «Каждый экземпляр урона требует отдельной проверки; урон за раунд не суммируется.») добавить:

```markdown
### Что прерывает концентрацию

Список закрытый: это правила игры, приложение их не расширяет.

| Способ | Что делает приложение |
|---|---|
| Урон | предлагает проверку: спасбросок Телосложения против КС по формуле выше |
| Ещё одно концентрационное заклинание | предупреждает о замене и требует явного выбора ([FR-081](features/F-07-concentration.md#fr-081)) |
| Недееспособность или смерть | показывает как способ прерывания; отследить не может — состояний противника в MVP нет |
| Решение игрока | даёт снять вручную в любой момент, бесплатно |
| Истечение длительности | показывает длительность и раунд начала, но не отсчитывает ([F-08](features/F-08-active-effects.md)) |
| Сильно отвлекающая обстановка | показывает как право мастера: КС 10 по его решению, не по решению приложения |

Длительность переводится в раунды по правилу «раунд равен шести секундам»: минута — 10 раундов, час
— 600. Это перевод единиц, а не новая механика.
```

- [x] **Step 5: Проверить целостность спеки**

Run: `npm run check:docs`
Expected: `спецификация целостна`, требований определено 82.

- [x] **Step 6: Commit**

```bash
git add docs/features/F-07-concentration.md docs/features/README.md docs/rules-engine.md
git commit -m "Specify the concentration block and what breaks concentration"
```

---

### Task 2: Раунд начала и длительность в раундах

Две чистые функции, от которых зависит вся остальная сборка текста. Обе живут в правилах, потому что перевод единиц и вывод раунда — механика, а не вёрстка.

**Files:**
- Modify: `src/rules/concentration.ts`
- Test: `src/rules/concentration.test.ts`

**Interfaces:**
- Consumes: `withPlural` из `src/rules/language.ts`; тип `ActiveEffect["duration"]` из `src/data/schemas/character.ts`.
- Produces:
  - `export type TurnMark = { at: string; kind: string }`
  - `export type StartRound = { round: number; approximate: boolean }`
  - `export function startRound(marks: readonly TurnMark[], startedAt: string): StartRound`
  - `export function durationWithRoundsRu(duration: ActiveEffect["duration"]): string`
  - `export const ROUNDS_PER_MINUTE = 10`, `export const ROUNDS_PER_HOUR = 600`

- [x] **Step 1: Написать падающие тесты**

В конец `src/rules/concentration.test.ts` добавить:

```ts
describe("startRound", () => {
  const marks = [
    { at: "2026-07-31T18:00:00.000Z", kind: "turn_started" },
    { at: "2026-07-31T18:00:01.000Z", kind: "spell_cast" },
    { at: "2026-07-31T18:00:02.000Z", kind: "turn_started" },
    { at: "2026-07-31T18:00:03.000Z", kind: "turn_started" },
  ];

  it("считает начавшиеся ходы до времени начала эффекта", () => {
    expect(startRound(marks, "2026-07-31T18:00:02.500Z")).toEqual({
      round: 2,
      approximate: false,
    });
  });

  it("учитывает ход, начавшийся тем же мгновением", () => {
    expect(startRound(marks, "2026-07-31T18:00:02.000Z")).toEqual({
      round: 2,
      approximate: false,
    });
  });

  it("даёт первый раунд, пока ни один ход не отмечен", () => {
    expect(startRound([{ at: "2026-07-31T18:00:01.000Z", kind: "spell_cast" }], "2026-07-31T18:00:01.000Z")).toEqual({
      round: 1,
      approximate: false,
    });
  });

  it("помечает число неточным, если начало вытеснено из журнала", () => {
    expect(startRound(marks, "2026-07-31T17:00:00.000Z")).toEqual({
      round: 1,
      approximate: true,
    });
  });

  it("помечает число неточным при пустом журнале: состояние импортировано", () => {
    expect(startRound([], "2026-07-31T18:00:00.000Z")).toEqual({ round: 1, approximate: true });
  });
});

describe("durationWithRoundsRu", () => {
  it.each([
    [{ type: "rounds", value: 3 } as const, "3 раунда"],
    [{ type: "rounds", value: 1 } as const, "1 раунд"],
    [{ type: "minutes", value: 10 } as const, "10 минут (100 раундов)"],
    [{ type: "minutes", value: 1 } as const, "1 минута (10 раундов)"],
    [{ type: "hours", value: 1 } as const, "1 час (600 раундов)"],
    [{ type: "special" } as const, "особая длительность"],
    [{ type: "minutes" } as const, "0 минут (0 раундов)"],
  ])("%o читается как «%s»", (duration, expected) => {
    expect(durationWithRoundsRu(duration)).toBe(expected);
  });
});
```

Дописать импорты в начало файла:

```ts
import { concentrationCheckDc, describeConcentrationCheck, durationWithRoundsRu, startRound } from "./concentration";
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/rules/concentration.test.ts`
Expected: FAIL — `startRound is not a function`, `durationWithRoundsRu is not a function`.

- [x] **Step 3: Реализовать**

В `src/rules/concentration.ts` добавить импорты и код:

```ts
import type { ActiveEffect } from "@/data/schemas/character";
import { withPlural } from "./language";

/** Раунд равен шести секундам (rules-engine.md#что-прерывает-концентрацию). */
export const ROUNDS_PER_MINUTE = 10;
export const ROUNDS_PER_HOUR = 600;

const ROUND_FORMS: [string, string, string] = ["раунд", "раунда", "раундов"];

/**
 * Запись журнала в том объёме, который нужен для раунда начала.
 *
 * Структурный тип, а не импорт из стора: правила не зависят от состояния приложения, иначе
 * получится цикл — `session.ts` сам импортирует правила.
 */
export type TurnMark = { at: string; kind: string };

export type StartRound = {
  round: number;
  /** Начало вытеснено из обрезанного журнала: число — нижняя граница, а не точное значение. */
  approximate: boolean;
};

/**
 * Раунд, в котором начался эффект: столько ходов началось к его времени (FR-084).
 *
 * Считается так же, как раунд в экономии хода — по записям о начале хода. Журнал обрезается
 * (OQ-08), поэтому у долгого эффекта начало может быть потеряно: тогда число помечается неточным.
 */
export function startRound(marks: readonly TurnMark[], startedAt: string): StartRound {
  const started = marks.filter((mark) => mark.kind === "turn_started" && mark.at <= startedAt).length;
  const earliest = marks[0];
  return {
    round: Math.max(1, started),
    approximate: earliest === undefined || earliest.at > startedAt,
  };
}

/**
 * Длительность в исходных единицах и в раундах: «10 минут (100 раундов)».
 *
 * Перевод нужен потому, что за столом время считается раундами, а карточка заклинания — минутами.
 * Отсчёта здесь нет и не будет: таймеры вне MVP (F-08).
 */
export function durationWithRoundsRu(duration: ActiveEffect["duration"]): string {
  const value = duration.value ?? 0;
  switch (duration.type) {
    case "rounds":
      return withPlural(value, ROUND_FORMS);
    case "minutes":
      return `${withPlural(value, ["минута", "минуты", "минут"])} (${withPlural(value * ROUNDS_PER_MINUTE, ROUND_FORMS)})`;
    case "hours":
      return `${withPlural(value, ["час", "часа", "часов"])} (${withPlural(value * ROUNDS_PER_HOUR, ROUND_FORMS)})`;
    default:
      return "особая длительность";
  }
}
```

- [x] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/rules/concentration.test.ts`
Expected: PASS, все `describe` зелёные.

- [x] **Step 5: Проверить покрытие и типы**

Run: `npm run typecheck && npm run test:coverage`
Expected: типы без ошибок; покрытие `src/rules/` — 100 % по всем четырём метрикам.

- [x] **Step 6: Commit**

```bash
git add src/rules/concentration.ts src/rules/concentration.test.ts
git commit -m "Derive the starting round and duration in rounds"
```

---

### Task 3: Сборка описания концентрации

Главная функция: превращает заклинание, эффект и состояние в готовые строки. Сюда же переносится словарь названий спасбросков, чтобы не держать вторую копию.

**Files:**
- Modify: `src/rules/language.ts`
- Modify: `src/rules/announcement.ts` — локальные `SavingThrowAbility` и `SAVING_THROW_NAMES`
- Modify: `src/rules/concentration.ts`
- Test: `src/rules/concentration.test.ts`
- Test: `src/rules/language.test.ts`

**Interfaces:**
- Consumes: `startRound`, `durationWithRoundsRu` (задача 2); `effectiveDamage` из `src/rules/scaling.ts`; `plural`, `withPlural` из `src/rules/language.ts`; `MINIMUM_CONCENTRATION_DC` (уже в файле).
- Produces:
  - `export const SAVING_THROW_NAMES: Record<"STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA", string>` в `src/rules/language.ts`
  - `export type ConcentrationBreaker = { textRu: string; atDiscretion: boolean }`
  - `export type ConcentrationSummary` — поля `spellId`, `nameRu`, `slotLabel`, `startLabel`, `durationLabel`, `mechanicsLabel`, `breakLabel`, `shortRulesRu`, `rulesAvailable`, `breakers`
  - `export function describeConcentration(input: { spell: Spell | null; effect: ActiveEffect; character: CharacterState; journal: readonly TurnMark[] }): ConcentrationSummary`

`spell` допускает `null`: состояние могло прийти импортом из другой сборки контента, и тогда карточки заклинания в приложении нет. Показать «Концентрации нет» в этом случае нельзя — незаметная потеря концентрации запрещена ([F-07](../../features/F-07-concentration.md)), поэтому описание деградирует до того, что лежит в самом эффекте.

- [x] **Step 1: Написать падающий тест на словарь спасбросков**

В конец `src/rules/language.test.ts` добавить:

```ts
describe("SAVING_THROW_NAMES", () => {
  it("называет характеристику в родительном падеже полным словом", () => {
    expect(SAVING_THROW_NAMES.CON).toBe("Телосложения");
    expect(SAVING_THROW_NAMES.DEX).toBe("Ловкости");
  });
});
```

Дописать `SAVING_THROW_NAMES` в существующий импорт из `./language` в этом файле.

- [x] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/language.test.ts`
Expected: FAIL — `SAVING_THROW_NAMES` не экспортируется.

- [x] **Step 3: Перенести словарь в language.ts**

В `src/rules/language.ts` добавить:

```ts
/**
 * Названия характеристик в родительном падеже: «спасбросок Телосложения».
 *
 * Здесь, а не в двух местах: объявление мастеру и блок концентрации называют один и тот же
 * спасбросок, и разойтись в слове они не должны. Сокращений нет — правила интерфейса разрешают
 * только «КС» и «КД» (ux.md#текст-в-интерфейсе).
 */
export const SAVING_THROW_NAMES = {
  STR: "Силы",
  DEX: "Ловкости",
  CON: "Телосложения",
  INT: "Интеллекта",
  WIS: "Мудрости",
  CHA: "Харизмы",
} as const;
```

В `src/rules/announcement.ts` удалить локальные `type SavingThrowAbility` и `const SAVING_THROW_NAMES` (строки 159–167) и добавить `SAVING_THROW_NAMES` в существующий импорт из `./language`:

```ts
import { SAVING_THROW_NAMES, withPlural } from "./language";
```

- [x] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/rules/language.test.ts src/rules/announcement.test.ts`
Expected: PASS — объявление мастеру продолжает работать на общем словаре.

- [x] **Step 5: Написать падающий тест на describeConcentration**

В конец `src/rules/concentration.test.ts` добавить:

```ts
describe("describeConcentration (FR-084)", () => {
  const journal = [
    { at: "2026-07-31T18:00:00.000Z", kind: "turn_started" },
    { at: "2026-07-31T18:00:01.000Z", kind: "spell_cast" },
  ];

  function effect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
    return {
      id: "effect-1",
      spellId: "detect-magic",
      nameRu: "Обнаружение магии",
      type: "control",
      startedAt: "2026-07-31T18:00:01.000Z",
      duration: { type: "minutes", value: 10 },
      isConcentration: true,
      slotLevelUsed: 1,
      endConditionRu: "До конца концентрации или истечения длительности.",
      ...overrides,
    };
  }

  function summaryFor(spellId: string, overrides: Partial<ActiveEffect> = {}) {
    return describeConcentration({
      spell: spell(spellId),
      effect: effect({ spellId, ...overrides }),
      character: createThorne(),
      journal,
    });
  }

  it("описывает заклинание с областью и без спасброска", () => {
    const summary = summaryFor("detect-magic");

    expect(summary.spellId).toBe("detect-magic");
    expect(summary.rulesAvailable).toBe(true);
    expect(summary.nameRu).toBe("Обнаружение магии");
    expect(summary.slotLabel).toBe("ячейка 1 ур.");
    expect(summary.startLabel).toBe("раунд 1");
    expect(summary.durationLabel).toBe("до 10 минут (100 раундов)");
    expect(summary.mechanicsLabel).toBe("Сфера 30 футов от себя · без спасброска");
    expect(summary.breakLabel).toBe("Урон → спасбросок Телосложения +4, КС от 10");
    expect(summary.shortRulesRu).toContain("чувствует магию");
  });

  it("подставляет КС спасброска цели", () => {
    const summary = describeConcentration({
      spell: { ...withoutArea("detect-magic"), resolution: { type: "saving_throw", savingThrow: "DEX" } },
      effect: effect(),
      character: createThorne(),
      journal,
    });

    expect(summary.mechanicsLabel).toBe("На себя · спасбросок Ловкости против КС 16");
  });

  it("подставляет модификатор атаки и урон по фактической ячейке", () => {
    const summary = describeConcentration({
      spell: { ...spell("ray-of-frost"), concentration: true, duration: { type: "rounds", value: 3 } },
      effect: effect({ spellId: "ray-of-frost", slotLevelUsed: 0, duration: { type: "rounds", value: 3 } }),
      character: createThorne(),
      journal,
    });

    expect(summary.slotLabel).toBe("без ячейки");
    expect(summary.durationLabel).toBe("до 3 раундов");
    // Заговор растёт от уровня персонажа: пороги 5 и 11, у 7 уровня — два кубика.
    expect(summary.mechanicsLabel).toBe("60 футов · атака заклинанием +8 · урон 2d8 (холод)");
  });

  it("помечает раунд неточным, если начало вытеснено из журнала", () => {
    const summary = describeConcentration({
      spell: spell("detect-magic"),
      effect: effect({ startedAt: "2026-07-31T10:00:00.000Z" }),
      character: createThorne(),
      journal,
    });

    expect(summary.startLabel).toBe("раунд ≥ 1");
  });

  it("перечисляет способы прерывания, помечая право мастера", () => {
    const { breakers } = summaryFor("detect-magic");

    expect(breakers[0].textRu).toContain("спасбросок Телосложения +4");
    expect(breakers.map((breaker) => breaker.atDiscretion)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(breakers.at(-1)?.textRu).toContain("КС 10");
  });

  it("деградирует до данных эффекта, если карточки нет в контенте", () => {
    const summary = describeConcentration({
      spell: null,
      effect: effect(),
      character: createThorne(),
      journal,
    });

    // Показать «Концентрации нет» нельзя: незаметная потеря концентрации запрещена.
    expect(summary.nameRu).toBe("Обнаружение магии");
    expect(summary.rulesAvailable).toBe(false);
    expect(summary.mechanicsLabel).toBe("Правил нет в контенте: состояние из другой сборки");
    expect(summary.shortRulesRu).toBe("До конца концентрации или истечения длительности.");
    expect(summary.breakers).toHaveLength(6);
  });

  it.each([
    [{ type: "touch" } as const, "Касание"],
    [{ type: "special" } as const, "Особая дальность"],
    [{ type: "distance" } as const, "0 футов"],
  ])("описывает дальность %o как «%s»", (range, expected) => {
    const summary = describeConcentration({
      spell: { ...withoutArea("detect-magic"), range },
      effect: effect(),
      character: createThorne(),
      journal,
    });

    expect(summary.mechanicsLabel).toContain(expected);
  });

  it.each([
    ["cone" as const, "Конус"],
    ["cube" as const, "Куб"],
    ["line" as const, "Линия"],
    ["cylinder" as const, "Цилиндр"],
  ])("называет область формы %s как «%s»", (shape, expected) => {
    const summary = describeConcentration({
      spell: {
        ...spell("detect-magic"),
        area: { shape, sizeFeet: 20 },
        range: { type: "distance", distanceFeet: 60 },
      },
      effect: effect(),
      character: createThorne(),
      journal,
    });

    expect(summary.mechanicsLabel).toContain(`${expected} 20 футов`);
  });
});
```

Три последних блока закрывают ветви `reachLabel`, которых нет в контенте Торна: без них покрытие `src/rules/` не будет 100 %.

Дописать импорты в начало файла:

```ts
import { loadThorneSpells } from "@/data/content/thorne";
import { createThorne } from "@/data/content/thorne/character";
import type { ActiveEffect } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import { describeConcentration } from "./concentration";
```

и локальный помощник — сразу после импортов, до первого `describe`:

```ts
/**
 * Карточка по идентификатору прямо из контента.
 *
 * Помощник `spell` из `@/testing/stores` здесь не годится: он тянет `@testing-library/react`, а
 * тесты правил идут в окружении node без jsdom.
 */
const CONTENT = new Map(loadThorneSpells().map((item) => [item.id, item]));

function spell(id: string): Spell {
  const found = CONTENT.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

/**
 * Карточка без области.
 *
 * Ключ убирается, а не присваивается `undefined`: при `exactOptionalPropertyTypes` явный `undefined`
 * в необязательное поле не проходит проверку типов.
 */
function withoutArea(id: string): Omit<Spell, "area"> {
  const { area: _area, ...rest } = spell(id);
  return rest;
}

- [x] **Step 6: Убедиться, что тесты падают**

Run: `npx vitest run src/rules/concentration.test.ts`
Expected: FAIL — `describeConcentration is not a function`.

- [x] **Step 7: Реализовать**

В `src/rules/concentration.ts` добавить импорты и код:

```ts
import type { CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import { plural, SAVING_THROW_NAMES } from "./language";
import { effectiveDamage } from "./scaling";

const AREA_SHAPES: Record<NonNullable<Spell["area"]>["shape"], string> = {
  cone: "Конус",
  cube: "Куб",
  line: "Линия",
  sphere: "Сфера",
  cylinder: "Цилиндр",
};

/** Способ прерывания концентрации. Право мастера помечено: приложение его не применяет само. */
export type ConcentrationBreaker = {
  textRu: string;
  atDiscretion: boolean;
};

export type ConcentrationSummary = {
  /** Для перехода к полной карточке заклинания. */
  spellId: string;
  nameRu: string;
  /** «ячейка 1 ур.» или «без ячейки», если заклинание сотворено без неё. */
  slotLabel: string;
  /** «раунд 3»; «раунд ≥ 3», если начало вытеснено из журнала. */
  startLabel: string;
  /** «до 10 минут (100 раундов)»: концентрация всегда «до», её можно прервать раньше. */
  durationLabel: string;
  /** Механика одной строкой: область или дальность, разрешение, урон. */
  mechanicsLabel: string;
  /** Чем сорвётся от урона — с модификатором этого персонажа. */
  breakLabel: string;
  shortRulesRu: string;
  /** Есть ли карточка заклинания в контенте: без неё некуда вести за полными правилами. */
  rulesAvailable: boolean;
  breakers: ConcentrationBreaker[];
};

function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}

function feet(value: number): string {
  return `${value} ${plural(value, ["фут", "фута", "футов"])}`;
}

/** Куда действует: область важнее дальности, но «от себя» без неё читается неверно. */
function reachLabel(spell: Spell): string {
  if (spell.area !== undefined) {
    const shape = `${AREA_SHAPES[spell.area.shape]} ${feet(spell.area.sizeFeet)}`;
    return spell.range.type === "self" ? `${shape} от себя` : shape;
  }
  switch (spell.range.type) {
    case "self":
      return "На себя";
    case "touch":
      return "Касание";
    case "distance":
      return feet(spell.range.distanceFeet ?? 0);
    default:
      return "Особая дальность";
  }
}

/** Кто бросает и против чего. Числа готовые: игрок называет их вслух (ux.md#текст-в-интерфейсе). */
function resolutionShortRu(spell: Spell, character: CharacterState): string {
  switch (spell.resolution.type) {
    case "spell_attack":
      return `атака заклинанием ${signed(character.spellAttackModifier)}`;
    case "saving_throw":
      return `спасбросок ${SAVING_THROW_NAMES[spell.resolution.savingThrow ?? "CON"]} против КС ${character.spellSaveDc}`;
    default:
      return "без спасброска";
  }
}

/** Механика одной строкой. Урон считается по фактически потраченной ячейке, а не по уровню карточки. */
function mechanicsRu(spell: Spell, effect: ActiveEffect, character: CharacterState): string {
  const damage =
    spell.damage === undefined
      ? null
      : `урон ${effectiveDamage(spell.damage, {
          spellLevel: spell.level,
          slotLevel: effect.slotLevelUsed,
          characterLevel: character.level,
        })} (${spell.damage.type})`;

  return [reachLabel(spell), resolutionShortRu(spell, character), damage]
    .filter((part) => part !== null)
    .join(" · ");
}

/**
 * Готовое описание активной концентрации (FR-084).
 *
 * Собирается из карточки заклинания при отрисовке, а не хранится в состоянии: сохранённый текст
 * разошёлся бы с обновлённым контентом. Способы прерывания — правила игры
 * (rules-engine.md#что-прерывает-концентрацию), поэтому список закрытый.
 *
 * Карточки заклинания может не быть: состояние приходило импортом из другой сборки контента. Скрыть
 * блок в этом случае нельзя — концентрация не может исчезнуть с экрана незаметно, — поэтому
 * описание деградирует до того, что лежит в самом эффекте.
 */
export function describeConcentration(input: {
  spell: Spell | null;
  effect: ActiveEffect;
  character: CharacterState;
  journal: readonly TurnMark[];
}): ConcentrationSummary {
  const { spell, effect, character, journal } = input;
  const start = startRound(journal, effect.startedAt);
  const modifier = signed(character.constitutionSaveModifier);

  return {
    spellId: effect.spellId,
    nameRu: effect.nameRu,
    slotLabel: effect.slotLevelUsed === 0 ? "без ячейки" : `ячейка ${effect.slotLevelUsed} ур.`,
    startLabel: start.approximate ? `раунд ≥ ${start.round}` : `раунд ${start.round}`,
    durationLabel: `до ${durationWithRoundsRu(effect.duration)}`,
    mechanicsLabel:
      spell === null
        ? "Правил нет в контенте: состояние из другой сборки"
        : mechanicsRu(spell, effect, character),
    breakLabel: `Урон → спасбросок Телосложения ${modifier}, КС от ${MINIMUM_CONCENTRATION_DC}`,
    shortRulesRu: spell === null ? effect.endConditionRu : spell.shortRulesRu,
    rulesAvailable: spell !== null,
    breakers: [
      {
        textRu: `Урон — спасбросок Телосложения ${modifier}, КС = максимум(${MINIMUM_CONCENTRATION_DC}, половина урона вниз). Провал завершает и концентрацию, и эффект`,
        atDiscretion: false,
      },
      { textRu: "Ещё одно концентрационное заклинание — это заменит", atDiscretion: false },
      { textRu: "Недееспособность или смерть", atDiscretion: false },
      { textRu: "Своё решение — в любой момент, бесплатно", atDiscretion: false },
      { textRu: "Истечение длительности — приложение не отсчитывает", atDiscretion: false },
      {
        textRu: `Сильно отвлекающая обстановка — спасбросок Телосложения ${modifier} против КС ${MINIMUM_CONCENTRATION_DC}`,
        atDiscretion: true,
      },
    ],
  };
}
```

- [x] **Step 8: Убедиться, что тесты проходят**

Run: `npx vitest run src/rules/concentration.test.ts src/rules/language.test.ts src/rules/announcement.test.ts`
Expected: PASS.

- [x] **Step 9: Проверить покрытие и типы**

Run: `npm run typecheck && npm run test:coverage`
Expected: типы чистые; покрытие `src/rules/` — 100 % по строкам, функциям, ветвям и операторам. Непокрытая ветвь здесь означает недописанный тест из шага 5, а не «допустимый пробел».

- [x] **Step 10: Commit**

```bash
git add src/rules/concentration.ts src/rules/concentration.test.ts src/rules/language.ts src/rules/language.test.ts src/rules/announcement.ts
git commit -m "Describe active concentration from spell data"
```

---

### Task 4: Какой бросок проходит проверку

Карточка проверки должна говорить «нужно 8 и выше», а не «КС 12, модификатор +4»: арифметику за столом делает приложение.

**Files:**
- Modify: `src/rules/concentration.ts` — тип `ConcentrationCheck` и `describeConcentrationCheck`
- Test: `src/rules/concentration.test.ts`

**Interfaces:**
- Consumes: существующий `describeConcentrationCheck`.
- Produces: поле `minimumRoll: number` в `ConcentrationCheck`; `export function checkGuidanceRu(check: ConcentrationCheck): string`.

- [x] **Step 1: Написать падающие тесты**

В `src/rules/concentration.test.ts` в существующий `describe("describeConcentrationCheck")` дописать `minimumRoll` в оба вызова `toEqual` (иначе они упадут на лишнем поле) и добавить:

```ts
  it("считает наименьший проходящий бросок", () => {
    expect(describeConcentrationCheck(24, 4).minimumRoll).toBe(8);
    expect(describeConcentrationCheck(10, -1).minimumRoll).toBe(11);
  });
});

describe("checkGuidanceRu", () => {
  it("называет наименьший проходящий бросок", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(24, 4))).toBe("Бросьте d20, нужно 8 и выше");
  });

  it("предупреждает о преимуществе", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(24, 4, { hasAdvantage: true }))).toBe(
      "Бросьте d20 с преимуществом, нужно 8 и выше",
    );
  });

  it("говорит, что проходит любой бросок", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(10, 9))).toBe("Проходит любой бросок d20");
  });

  it("говорит, что бросок не спасёт", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(60, 4))).toBe(
      "Не проходит даже 20: концентрация держится только руной",
    );
  });
});
```

Дописать `checkGuidanceRu` в импорт из `./concentration`.

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/rules/concentration.test.ts`
Expected: FAIL — `checkGuidanceRu is not a function`, плюс несовпадение объекта без `minimumRoll`.

- [x] **Step 3: Реализовать**

В `src/rules/concentration.ts` в тип `ConcentrationCheck` добавить поле, в `describeConcentrationCheck` — его вычисление, и добавить функцию подсказки:

```ts
export type ConcentrationCheck = {
  /** Спасбросок Телосложения — единственный вид проверки концентрации. */
  ability: "CON";
  dc: number;
  modifier: number;
  /** «Боевой заклинатель» даёт преимущество на проверку. */
  hasAdvantage: boolean;
  /** Наименьший результат d20, который проходит проверку: КС минус модификатор. */
  minimumRoll: number;
};
```

В `return` функции `describeConcentrationCheck` добавить строку `minimumRoll: dc - constitutionSaveModifier,`, где `dc` — уже вычисленный `concentrationCheckDc(damage)` (вынести его в локальную константу, если он подставлен выражением).

```ts
/**
 * Что делать игроку словами: приложение считает разницу КС и модификатора, чтобы за столом не
 * считали в голове (ux.md#текст-в-интерфейсе). Кубик бросает игрок (OQ-09).
 *
 * Натуральная 20 спасбросок не проходит автоматически, поэтому непроходимая проверка называется
 * непроходимой: единственный выход — «Знаки ограждения» (FR-154).
 */
export function checkGuidanceRu(check: ConcentrationCheck): string {
  if (check.minimumRoll <= 1) return "Проходит любой бросок d20";
  if (check.minimumRoll > 20) return "Не проходит даже 20: концентрация держится только руной";
  const dice = check.hasAdvantage ? "d20 с преимуществом" : "d20";
  return `Бросьте ${dice}, нужно ${check.minimumRoll} и выше`;
}
```

- [x] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/rules/concentration.test.ts && npm run test:coverage`
Expected: PASS; покрытие 100 %.

- [x] **Step 5: Commit**

```bash
git add src/rules/concentration.ts src/rules/concentration.test.ts
git commit -m "Tell which d20 result passes the concentration check"
```

---

### Task 5: Карточка концентрации в шапке

Одна строка превращается в карточку на три строки. Кнопка, потому что она открывает лист; когда концентрации нет, остаётся прежняя строка «Концентрации нет».

**Files:**
- Create: `src/components/combat/ConcentrationCard.tsx`
- Modify: `src/components/combat/ResourceHeader.tsx` — параметры компонента и блок `<section aria-label="Концентрация">`
- Modify: `src/components/combat/CombatScreen.tsx`
- Test: `src/components/combat/Concentration.test.tsx`

**Interfaces:**
- Consumes: `ConcentrationSummary`, `describeConcentration` (задача 3).
- Produces:
  - `export function ConcentrationCard({ summary, onOpen }: { summary: ConcentrationSummary | null; onOpen: () => void })`
  - у `ResourceHeader` появляются параметры `concentration: ConcentrationSummary | null` и `onOpenConcentration: () => void`
  - в `CombatScreen` появляется `concentrationSummary` и состояние `panelOpen` (лист подключается в задаче 6)

- [x] **Step 1: Написать падающий тест**

Создать `src/components/combat/Concentration.test.tsx`:

```tsx
// @vitest-environment jsdom

/**
 * Блок концентрации (FR-084) на настоящем состоянии и настоящих операциях: моков нет.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CombatScreen } from "@/components/combat/CombatScreen";
import { createThorne } from "@/data/content/thorne/character";
import type { CharacterState } from "@/data/schemas/character";
import { renderWithStores } from "@/testing/stores";

/** Торн, держащий «Обнаружение магии» ячейкой 1 уровня. */
function concentrating(): CharacterState {
  const character = createThorne();
  character.concentration = { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" };
  character.activeEffects = [
    {
      id: "effect-1",
      spellId: "detect-magic",
      nameRu: "Обнаружение магии",
      type: "control",
      startedAt: "2026-07-31T18:00:00.000Z",
      duration: { type: "minutes", value: 10 },
      isConcentration: true,
      slotLevelUsed: 1,
      endConditionRu: "До конца концентрации или истечения длительности.",
    },
  ];
  return character;
}

describe("карточка концентрации в шапке (FR-082, FR-084)", () => {
  it("без концентрации показывает, что её нет", async () => {
    await renderWithStores(<CombatScreen />);

    expect(within(screen.getByLabelText("Концентрация")).getByText(/Концентрации нет/)).toBeDefined();
  });

  it("показывает название, ячейку, механику и чем сорвётся", async () => {
    await renderWithStores(<CombatScreen />, concentrating());

    const block = screen.getByLabelText("Концентрация");
    expect(within(block).getByText("Обнаружение магии")).toBeDefined();
    expect(within(block).getByText(/ячейка 1 ур\./)).toBeDefined();
    expect(within(block).getByText(/Сфера 30 футов от себя · без спасброска/)).toBeDefined();
    expect(within(block).getByText(/спасбросок Телосложения \+4, КС от 10/)).toBeDefined();
  });

  it("карточка нажимаема и ведёт к подробностям", async () => {
    await renderWithStores(<CombatScreen />, concentrating());

    const card = screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ });
    await userEvent.click(card);

    expect(screen.getByRole("dialog", { name: /Концентрация/ })).toBeDefined();
  });
});
```

- [x] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/combat/Concentration.test.tsx`
Expected: FAIL — «Обнаружение магии» в блоке не найдено, роли `button` с таким именем нет.

- [x] **Step 3: Создать компонент карточки**

Создать `src/components/combat/ConcentrationCard.tsx`:

```tsx
/**
 * Карточка активной концентрации в шапке экрана боя (FR-082, FR-084).
 *
 * Три строки вместо названия: что держится, как работает, чем сорвётся. Больше в нескролящуюся
 * шапку не влезает, остальное — в листе по тапу (ux.md#иерархия-экрана-боя).
 *
 * Компонент презентационный: текст приходит готовым из `describeConcentration`.
 */

import type { ConcentrationSummary } from "@/rules/concentration";

export function ConcentrationCard({
  summary,
  armorClassNote,
  onOpen,
}: {
  summary: ConcentrationSummary | null;
  /** Вклад эффекта в КД: « · КД 17» или пустая строка (FR-093). */
  armorClassNote: string;
  onOpen: () => void;
}) {
  return (
    <section aria-label="Концентрация" className="text-xs">
      {summary === null ? (
        <p className="text-slate-600 dark:text-slate-400">
          <span aria-hidden="true">✦</span> Концентрации нет
        </p>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Концентрация: ${summary.nameRu}. Подробнее`}
          className="min-h-11 w-full rounded-lg border border-concentration/50 bg-concentration/10 p-2 text-left"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-concentration-strong dark:text-concentration">
              <span aria-hidden="true">✦</span> {summary.nameRu}
            </span>
            <span className="shrink-0 text-[0.625rem] text-slate-600 dark:text-slate-400">
              {summary.slotLabel} · {summary.startLabel}
              {armorClassNote} <span aria-hidden="true">›</span>
            </span>
          </span>
          <span className="block">{summary.mechanicsLabel}</span>
          <span className="block text-slate-700 dark:text-slate-300">{summary.breakLabel}</span>
        </button>
      )}
    </section>
  );
}
```

- [x] **Step 4: Подключить карточку в шапку**

В `src/components/combat/ResourceHeader.tsx`:

1. Добавить импорты:

```tsx
import { ConcentrationCard } from "@/components/combat/ConcentrationCard";
import type { ConcentrationSummary } from "@/rules/concentration";
```

2. Расширить параметры:

```tsx
export function ResourceHeader({
  character,
  economy,
  concentration,
  onOpenConcentration,
}: {
  character: CharacterState;
  economy: TurnEconomy;
  concentration: ConcentrationSummary | null;
  onOpenConcentration: () => void;
}) {
```

3. Строку `const concentrationEffect = character.activeEffects.find((effect) => effect.isConcentration);` **оставить**: она нужна для подписи КД. Заменить только блок `<section aria-label="Концентрация">…</section>` на:

```tsx
      <ConcentrationCard
        summary={concentration}
        armorClassNote={
          concentrationEffect === undefined ? "" : armorClassNote(concentrationEffect, armorClass)
        }
        onOpen={onOpenConcentration}
      />
```

Строку `const otherEffects = …` оставить как есть.

- [x] **Step 5: Считать описание в экране боя**

В `src/components/combat/CombatScreen.tsx`:

1. Добавить импорт: `import { describeConcentration } from "@/rules/concentration";`
2. Рядом с `const [openSpellId, setOpenSpellId] = useState<string | null>(null);` добавить `const [panelOpen, setPanelOpen] = useState(false);`
3. После `useMemo` с `economy` добавить (до раннего возврата — порядок хуков не должен зависеть от загрузки):

```tsx
  /**
   * Описание концентрации собирается из контента по `spellId` эффекта. Карточки может не быть —
   * состояние пришло импортом из другой сборки — тогда описание деградирует, но не исчезает:
   * концентрация не может уйти с экрана незаметно (F-07).
   */
  const concentrationSummary = useMemo(() => {
    if (session === null) return null;
    const effect = session.character.activeEffects.find((candidate) => candidate.isConcentration);
    if (effect === undefined) return null;
    return describeConcentration({
      spell: SPELLS.find((candidate) => candidate.id === effect.spellId) ?? null,
      effect,
      character: session.character,
      journal: session.journal,
    });
  }, [session]);
```

4. Передать в шапку:

```tsx
        <ResourceHeader
          character={character}
          economy={economy}
          concentration={concentrationSummary}
          onOpenConcentration={() => setPanelOpen(true)}
        />
```

5. Чтобы тест на роль `dialog` прошёл, поставить временную заглушку листа сразу перед `<CastWizard …/>` — она будет заменена настоящим листом в задаче 6:

```tsx
      {panelOpen && concentrationSummary !== null ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-label={`Концентрация: ${concentrationSummary.nameRu}`}
          className="fixed inset-0 z-10 flex flex-col bg-slate-50 p-3 dark:bg-slate-950"
        >
          <button type="button" onClick={() => setPanelOpen(false)} className="min-h-11 self-end px-2 underline">
            Закрыть
          </button>
        </section>
      ) : null}
```

- [x] **Step 6: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/`
Expected: PASS — новый файл зелёный, `CombatScreen.test.tsx` тоже: старая проверка `screen.getByText(/Концентрации нет/)` продолжает работать.

- [x] **Step 7: Проверить типы и полный прогон**

Run: `npm run typecheck && npm run test:coverage`
Expected: без ошибок, покрытие 100 %.

- [x] **Step 8: Commit**

```bash
git add src/components/combat/ConcentrationCard.tsx src/components/combat/ResourceHeader.tsx src/components/combat/CombatScreen.tsx src/components/combat/Concentration.test.tsx
git commit -m "Show what concentration is holding in the combat header"
```

---

### Task 6: Лист концентрации и снятие вручную

Заглушка из задачи 5 заменяется настоящим листом: короткие правила, список прерывания, переход к карточке заклинания и снятие концентрации. Подтверждения нет — [ux.md](../../ux.md#предупреждения-и-подтверждения) разрешает их только в трёх местах, а ошибка отменяется журналом.

**Files:**
- Create: `src/components/combat/ConcentrationPanel.tsx`
- Modify: `src/components/combat/CombatScreen.tsx`
- Test: `src/components/combat/Concentration.test.tsx`

**Interfaces:**
- Consumes: `ConcentrationSummary` (задача 3); `endConcentration` из `src/store/session.ts`.
- Produces: `export function ConcentrationPanel({ summary, onOpenSpell, onDrop, onClose }: { summary: ConcentrationSummary; onOpenSpell: () => void; onDrop: () => void; onClose: () => void })`. Кнопка «Получил урон» добавляется в подвал листа задачей 7 — вместе с самим вводом урона, чтобы здесь не появлялось состояния без потребителя.

- [x] **Step 1: Написать падающие тесты**

В `src/components/combat/Concentration.test.tsx` добавить:

```tsx
describe("лист концентрации (FR-084, FR-091)", () => {
  async function openPanel(): Promise<void> {
    await renderWithStores(<CombatScreen />, concentrating());
    await userEvent.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));
  }

  it("объясняет, как работает и чем прерывается", async () => {
    await openPanel();

    const panel = screen.getByRole("dialog", { name: /Концентрация/ });
    expect(within(panel).getByText(/до 10 минут \(100 раундов\)/)).toBeDefined();
    expect(within(panel).getByText(/чувствует магию/)).toBeDefined();

    const breakers = within(panel).getByLabelText("Чем прерывается");
    expect(within(breakers).getAllByRole("listitem")).toHaveLength(6);
    expect(within(breakers).getByText(/Недееспособность или смерть/)).toBeDefined();
    expect(within(breakers).getByText(/На усмотрение мастера/)).toBeDefined();
  });

  it("ведёт к полной карточке заклинания", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: /Полные правила/ }));

    expect(screen.getByRole("dialog", { name: /Заклинание «Обнаружение магии»/ })).toBeDefined();
  });

  it("снимает концентрацию вручную и пишет это в журнал", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: "Снять концентрацию" }));

    expect(screen.getByText(/Концентрации нет/)).toBeDefined();
    expect(screen.queryByRole("dialog", { name: /Концентрация/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Отменить: Концентрация завершена: снята вручную/ }),
    ).toBeDefined();
  });
});
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/components/combat/Concentration.test.tsx`
Expected: FAIL — в заглушке нет ни текста правил, ни кнопок.

- [x] **Step 3: Создать лист**

Создать `src/components/combat/ConcentrationPanel.tsx`:

```tsx
/**
 * Лист активной концентрации (FR-084).
 *
 * Отвечает на два вопроса, за которыми игрок иначе полез бы в книгу: как работает этот эффект и чем
 * он прерывается. Полные правила заклинания здесь не дублируются — к ним ведёт переход в его
 * карточку.
 *
 * Компонент презентационный: текст приходит готовым, состояние меняет экран боя.
 */

import type { ConcentrationSummary } from "@/rules/concentration";

export function ConcentrationPanel({
  summary,
  onOpenSpell,
  onDrop,
  onClose,
}: {
  summary: ConcentrationSummary;
  onOpenSpell: () => void;
  onDrop: () => void;
  onClose: () => void;
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Концентрация: ${summary.nameRu}`}
      className="fixed inset-0 z-10 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold leading-tight text-concentration-strong dark:text-concentration">
            <span aria-hidden="true">✦</span> {summary.nameRu}
          </h2>
          <p className="text-xs text-slate-500">
            {summary.slotLabel} · начата в {summary.startLabel} · {summary.durationLabel}
          </p>
          <p className="text-xs text-slate-500">Отсчёта нет — за длительностью следит игрок</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-slate-500 underline">
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 text-sm">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase text-slate-500">Как работает</h3>
          <p>{summary.shortRulesRu}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{summary.mechanicsLabel}</p>
          {summary.rulesAvailable ? (
            <button
              type="button"
              onClick={onOpenSpell}
              className="min-h-11 self-start rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
            >
              Полные правила <span aria-hidden="true">›</span>
            </button>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase text-slate-500">Прерывается</h3>
          <ul aria-label="Чем прерывается" className="flex flex-col gap-1">
            {summary.breakers.map((breaker) => (
              <li key={breaker.textRu} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>
                  {breaker.atDiscretion ? (
                    <span className="text-slate-500">На усмотрение мастера: </span>
                  ) : null}
                  {breaker.textRu}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onDrop}
          className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700"
        >
          Снять концентрацию
        </button>
      </footer>
    </section>
  );
}
```

- [x] **Step 4: Заменить заглушку в экране боя**

В `src/components/combat/CombatScreen.tsx`:

1. Добавить импорты:

```tsx
import { ConcentrationPanel } from "@/components/combat/ConcentrationPanel";
```

и `endConcentration` в существующий импорт из `@/store/session`.

2. Заменить блок-заглушку из задачи 5 на:

```tsx
      {panelOpen && concentrationSummary !== null ? (
        <ConcentrationPanel
          summary={concentrationSummary}
          onOpenSpell={() => {
            setPanelOpen(false);
            setOpenSpellId(concentrationSummary.spellId);
          }}
          onDrop={() => {
            // Подтверждения нет: ошибка отменяется журналом (FR-111, ux.md).
            if (apply((current) => endConcentration(current, "manual", clock)) === null) {
              setPanelOpen(false);
            }
          }}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}
```

Лист закрывается сам, когда концентрация кончилась: условие рендера требует непустого `concentrationSummary`, поэтому отдельного эффекта на закрытие не нужно.

- [x] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/`
Expected: PASS.

- [x] **Step 6: Проверить типы и покрытие**

Run: `npm run typecheck && npm run test:coverage`
Expected: без ошибок, 100 %.

- [x] **Step 7: Commit**

```bash
git add src/components/combat/ConcentrationPanel.tsx src/components/combat/CombatScreen.tsx src/components/combat/Concentration.test.tsx
git commit -m "Explain and drop concentration from a detail sheet"
```

---

### Task 7: Ввод урона и признак огня

Первая точка ввода урона в приложении: до сих пор хиты в шапке показывались и никогда не менялись. Кнопка общая — урон бывает и без концентрации.

**Files:**
- Create: `src/components/combat/DamagePrompt.tsx`
- Modify: `src/components/combat/CombatScreen.tsx`
- Modify: `src/components/combat/ResourceHeader.tsx` — список `<ul aria-label="Прочие ресурсы">`
- Modify: `src/components/combat/ConcentrationPanel.tsx` — в подвал добавляется вторая кнопка
- Test: `src/components/combat/Concentration.test.tsx`

**Interfaces:**
- Consumes: `takeDamage` из `src/store/session.ts`; `ConcentrationPanel` (задача 6).
- Produces: `export function DamagePrompt({ onSubmit, onCancel }: { onSubmit: (damage: number, fire: boolean) => void; onCancel: () => void })`; у `ConcentrationPanel` появляется параметр `onTakeDamage: () => void`; в `CombatScreen` — вызов `takeDamage` и состояния `damageOpen`, `pendingCheck` (карточка проверки появляется в задаче 8).

- [x] **Step 1: Написать падающие тесты**

В `src/components/combat/Concentration.test.tsx` добавить:

```tsx
describe("ввод урона (FR-083, FR-180, FR-183)", () => {
  it("списывает хиты и без активной концентрации", async () => {
    await renderWithStores(<CombatScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText("48/60")).toBeDefined();
    expect(screen.queryByText(/Проверка концентрации/)).toBeNull();
  });

  it("отмечает подавление особенностей огнём", async () => {
    await renderWithStores(<CombatScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "5");
    await userEvent.click(screen.getByLabelText("Урон огнём"));
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText(/Особенности подавлены: урон огнём/)).toBeDefined();
  });

  it("при активной концентрации предлагает проверку с готовой КС", async () => {
    await renderWithStores(<CombatScreen />, concentrating());

    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "24");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    const check = screen.getByRole("dialog", { name: "Проверка концентрации" });
    expect(within(check).getByText(/КС 12/)).toBeDefined();
    expect(within(check).getByText(/нужно 8 и выше/)).toBeDefined();
  });

  it("не принимает ноль и не пишет пустую запись", async () => {
    await renderWithStores(<CombatScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText("60/60")).toBeDefined();
  });
});
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/components/combat/Concentration.test.tsx`
Expected: FAIL — кнопки «Получил урон» в шапке нет.

- [x] **Step 3: Создать форму ввода**

Создать `src/components/combat/DamagePrompt.tsx`:

```tsx
/**
 * Ввод полученного урона (FR-083, FR-180).
 *
 * Одно место на два следствия: хиты уменьшаются, а огненный урон подавляет расовые особенности.
 * Признак огня стоит здесь, потому что спрашивать про него отдельно значит спрашивать дважды об
 * одном событии (F-16).
 *
 * Кнопка «Записать» неактивна при пустом или нулевом вводе: пустая запись журнала — мусор в отмене.
 */

import { useState } from "react";

export function DamagePrompt({
  onSubmit,
  onCancel,
}: {
  onSubmit: (damage: number, fire: boolean) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [fire, setFire] = useState(false);
  const damage = Number.parseInt(value, 10);
  const valid = Number.isInteger(damage) && damage > 0;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Полученный урон"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Полученный урон</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-base tabular-nums dark:border-slate-800 dark:bg-slate-900"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fire}
          onChange={(event) => setFire(event.target.checked)}
          className="size-5"
        />
        <span>Урон огнём</span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSubmit(damage, fire)}
          className="min-h-11 flex-1 rounded-xl bg-reaction-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Записать
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          Отмена
        </button>
      </div>
    </section>
  );
}
```

> `bg-reaction-strong` в теме есть: `--color-reaction-strong` объявлен в [globals.css](../../../src/app/globals.css). Подмена класса не требуется.

- [x] **Step 4: Добавить кнопку и значок подавления в шапку**

В `src/components/combat/ResourceHeader.tsx` в список «Прочие ресурсы» после `<li>` с максимумом хитов добавить:

```tsx
        {character.suppression.firedUpon ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Особенности подавлены: урон огнём
            </Badge>
          </li>
        ) : null}
```

- [x] **Step 5: Подключить ввод урона в экране боя**

В `src/components/combat/CombatScreen.tsx`:

1. Добавить импорты: `import { DamagePrompt } from "@/components/combat/DamagePrompt";`, `describeConcentrationCheck` и тип `ConcentrationCheck` из `@/rules/concentration`, `takeDamage` в существующий импорт из `@/store/session`.
2. Добавить состояние рядом с `panelOpen`:

```tsx
  const [damageOpen, setDamageOpen] = useState(false);
  const [pendingCheck, setPendingCheck] = useState<ConcentrationCheck | null>(null);
```

3. Передать листу обработчик — `onTakeDamage={() => setDamageOpen(true)}` — и добавить в его подвал первую кнопку, перед «Снять концентрацию»:

```tsx
        <button
          type="button"
          onClick={onTakeDamage}
          className="min-h-11 flex-1 rounded-xl border border-reaction px-3 text-sm font-semibold text-reaction-strong dark:text-reaction"
        >
          Получил урон
        </button>
```

а в параметры `ConcentrationPanel` — `onTakeDamage: () => void;`.

3. В ряд кнопок после «Учёт хода» добавить:

```tsx
          <button
            type="button"
            onClick={() => setDamageOpen(true)}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-xl border border-reaction px-3 text-xs text-reaction-strong dark:text-reaction"
          >
            Получил урон
          </button>
```

4. Перед `<CastWizard …/>` добавить обработку ввода:

```tsx
      {damageOpen ? (
        <DamagePrompt
          onCancel={() => setDamageOpen(false)}
          onSubmit={(damage, fire) => {
            const failure = apply((current) => takeDamage(current, damage, clock, { fire }));
            if (failure !== null) return;
            setDamageOpen(false);
            setPanelOpen(false);
            // Проверка предлагается только если есть что терять (FR-083).
            if (character.concentration !== undefined) {
              setPendingCheck(describeConcentrationCheck(damage, character.constitutionSaveModifier));
            }
          }}
        />
      ) : null}
```

5. Временная заглушка карточки проверки — будет заменена в задаче 8:

```tsx
      {pendingCheck === null ? null : (
        <section role="dialog" aria-modal="true" aria-label="Проверка концентрации" className="fixed inset-x-0 bottom-0 z-20 bg-slate-50 p-3 dark:bg-slate-950">
          <p>
            КС {pendingCheck.dc} · нужно {pendingCheck.minimumRoll} и выше
          </p>
          <button type="button" onClick={() => setPendingCheck(null)} className="min-h-11 underline">
            Закрыть
          </button>
        </section>
      )}
```

- [x] **Step 6: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/`
Expected: PASS.

- [x] **Step 7: Проверить типы и покрытие**

Run: `npm run typecheck && npm run test:coverage`
Expected: без ошибок, 100 %.

- [x] **Step 8: Commit**

```bash
git add src/components/combat/DamagePrompt.tsx src/components/combat/ResourceHeader.tsx src/components/combat/CombatScreen.tsx src/components/combat/Concentration.test.tsx
git commit -m "Enter damage and mark fire suppression from the header"
```

---

### Task 8: Карточка проверки и руна при провале

Заглушка заменяется настоящей карточкой. Ключевой порядок: пока руна и реакция доступны, «Провал» не завершает эффект, а предлагает «Знаки ограждения» ([FR-154](../../features/F-13-runes.md#fr-154)).

**Files:**
- Create: `src/components/combat/ConcentrationCheckCard.tsx`
- Modify: `src/components/combat/CombatScreen.tsx`
- Test: `src/components/combat/Concentration.test.tsx`

**Interfaces:**
- Consumes: `ConcentrationCheck`, `checkGuidanceRu` (задача 4); `endConcentration`, `spendRuneOnWardingSigil`, `wardingSigilAvailable` из `src/store/session.ts`.
- Produces: `export function ConcentrationCheckCard({ check, spellNameRu, runeAvailable, onSuccess, onSpendRune, onFail }: { check: ConcentrationCheck; spellNameRu: string; runeAvailable: boolean; onSuccess: () => void; onSpendRune: () => void; onFail: () => void })`.

- [x] **Step 1: Написать падающие тесты**

В `src/components/combat/Concentration.test.tsx` добавить:

```tsx
describe("проверка концентрации (FR-083, FR-154)", () => {
  async function damage(amount: string, character: CharacterState = concentrating()): Promise<void> {
    await renderWithStores(<CombatScreen />, character);
    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), amount);
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));
  }

  it("успех оставляет концентрацию и не пишет запись", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Успех" }));

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.queryByRole("dialog", { name: "Проверка концентрации" })).toBeNull();
    // Последняя запись журнала — урон, а не результат проверки.
    expect(screen.getByRole("button", { name: /Отменить: Получено урона: 24/ })).toBeDefined();
  });

  it("провал при доступной руне сначала предлагает Знаки ограждения", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.getByText(/Знаки ограждения/)).toBeDefined();
    // Эффект ещё держится: предложение обязано появиться до завершения (FR-154).
    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
  });

  it("руна сохраняет концентрацию, списывая реакцию", async () => {
    await damage("24");
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Потратить руну" }));

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.getByText(/Руны 2\/3/)).toBeDefined();
    expect(screen.getByLabelText(/Реакция израсходована/)).toBeDefined();
  });

  it("отказ от руны завершает концентрацию и эффект", async () => {
    await damage("24");
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(screen.getByText(/Концентрации нет/)).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: /Отменить: Концентрация завершена: провалена проверка концентрации/,
      }),
    ).toBeDefined();
  });

  it("без руны провал завершает концентрацию сразу", async () => {
    const character = concentrating();
    character.runes = { remaining: 0, maximum: 3 };
    await damage("24", character);

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.getByText(/Концентрации нет/)).toBeDefined();
  });
});
```

> Числа рун сверены с [character.ts](../../../src/data/content/thorne/character.ts): у Торна `runes: { maximum: 3, remaining: 3 }`, поэтому после траты одной шапка показывает «Руны 2/3».

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/components/combat/Concentration.test.tsx`
Expected: FAIL — кнопок «Успех», «Провал» в заглушке нет.

- [x] **Step 3: Создать карточку проверки**

Создать `src/components/combat/ConcentrationCheckCard.tsx`:

```tsx
/**
 * Карточка проверки концентрации после урона (FR-083).
 *
 * Кубик бросает игрок (OQ-09), приложение говорит, что бросить и что нужно выбросить, и фиксирует
 * результат. Успех состояние не меняет — записи в журнале у него нет.
 *
 * Провал не завершает эффект сразу, пока доступны руна и реакция: «Знаки ограждения» превращают
 * провал спасброска в успех, и предложить их обязательно до завершения (FR-154). Забытая руна стоит
 * игроку и эффекта, и ячейки.
 */

import { useState } from "react";

import { checkGuidanceRu, type ConcentrationCheck } from "@/rules/concentration";

export function ConcentrationCheckCard({
  check,
  spellNameRu,
  runeAvailable,
  onSuccess,
  onSpendRune,
  onFail,
}: {
  check: ConcentrationCheck;
  spellNameRu: string;
  runeAvailable: boolean;
  onSuccess: () => void;
  onSpendRune: () => void;
  onFail: () => void;
}) {
  const [runeOffered, setRuneOffered] = useState(false);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Проверка концентрации"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <div>
        <h2 className="text-sm font-semibold">Проверка концентрации: «{spellNameRu}»</h2>
        <p className="text-sm">
          Спасбросок Телосложения против КС {check.dc}, модификатор{" "}
          {check.modifier < 0 ? check.modifier : `+${check.modifier}`}
        </p>
        <p className="text-base font-semibold">{checkGuidanceRu(check)}</p>
      </div>

      {runeOffered ? (
        <>
          <p className="rounded-lg border border-ritual/50 bg-ritual/10 p-2 text-sm">
            <span aria-hidden="true">❖</span> Знаки ограждения: реакция и руна превратят провал в
            успех
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSpendRune}
              className="min-h-11 flex-1 rounded-xl border border-ritual px-3 text-sm font-semibold"
            >
              Потратить руну
            </button>
            <button
              type="button"
              onClick={onFail}
              className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700"
            >
              Всё равно провал
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSuccess}
            className="min-h-11 flex-1 rounded-xl border border-action px-3 text-sm font-semibold"
          >
            Успех
          </button>
          <button
            type="button"
            onClick={() => (runeAvailable ? setRuneOffered(true) : onFail())}
            className="min-h-11 flex-1 rounded-xl border border-reaction px-3 text-sm font-semibold"
          >
            Провал
          </button>
        </div>
      )}
    </section>
  );
}
```

- [x] **Step 4: Заменить заглушку в экране боя**

В `src/components/combat/CombatScreen.tsx`:

1. Добавить импорт `import { ConcentrationCheckCard } from "@/components/combat/ConcentrationCheckCard";` и в импорт из `@/store/session` — `spendRuneOnWardingSigil`, `wardingSigilAvailable`.
2. Заменить заглушку на:

```tsx
      {pendingCheck === null || concentrationSummary === null ? null : (
        <ConcentrationCheckCard
          check={pendingCheck}
          spellNameRu={concentrationSummary.nameRu}
          runeAvailable={wardingSigilAvailable(character)}
          onSuccess={() => setPendingCheck(null)}
          onSpendRune={() => {
            if (apply((current) => spendRuneOnWardingSigil(current, clock)) === null) {
              setPendingCheck(null);
            }
          }}
          onFail={() => {
            if (apply((current) => endConcentration(current, "failed_check", clock)) === null) {
              setPendingCheck(null);
            }
          }}
        />
      )}
```

- [x] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/`
Expected: PASS.

- [x] **Step 6: Проверить типы и покрытие**

Run: `npm run typecheck && npm run test:coverage`
Expected: без ошибок, 100 %.

- [x] **Step 7: Commit**

```bash
git add src/components/combat/ConcentrationCheckCard.tsx src/components/combat/CombatScreen.tsx src/components/combat/Concentration.test.tsx
git commit -m "Run the concentration check and offer the warding rune"
```

---

### Task 9: Завершение любого активного эффекта

`endEffect` умеет закрыть любой эффект, а интерфейс до сих пор не давал закрыть ни один. Без этого [FR-091](../../features/F-08-active-effects.md#fr-091) закрыт только для концентрации.

**Files:**
- Modify: `src/components/combat/ResourceHeader.tsx` — список `<ul aria-label="Активные эффекты">`
- Modify: `src/components/combat/CombatScreen.tsx`
- Test: `src/components/combat/Concentration.test.tsx`

**Interfaces:**
- Consumes: `endEffect` из `src/store/session.ts`.
- Produces: у `ResourceHeader` появляется параметр `onEndEffect: (effectId: string) => void`.

- [x] **Step 1: Написать падающий тест**

В `src/components/combat/Concentration.test.tsx` добавить:

```tsx
describe("завершение активного эффекта (FR-091)", () => {
  it("закрывает неконцентрационный эффект и пишет это в журнал", async () => {
    const character = createThorne();
    character.activeEffects = [
      {
        id: "effect-2",
        spellId: "mage-armor",
        nameRu: "Доспехи мага",
        type: "buff",
        startedAt: "2026-07-31T18:00:00.000Z",
        duration: { type: "hours", value: 8 },
        isConcentration: false,
        slotLevelUsed: 1,
        endConditionRu: "До истечения длительности.",
      },
    ];
    await renderWithStores(<CombatScreen />, character);

    await userEvent.click(screen.getByRole("button", { name: "Завершить: Доспехи мага" }));

    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Отменить: Эффект завершён: Доспехи мага/ }),
    ).toBeDefined();
  });
});
```

- [x] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/combat/Concentration.test.tsx`
Expected: FAIL — кнопки «Завершить: Доспехи мага» нет.

- [x] **Step 3: Добавить кнопку в список эффектов**

В `src/components/combat/ResourceHeader.tsx` заменить блок `otherEffects` на:

```tsx
      {otherEffects.length > 0 ? (
        <ul aria-label="Активные эффекты" className="flex flex-col gap-0.5 text-xs">
          {otherEffects.map((effect) => (
            <li
              key={effect.id}
              className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
            >
              <span>
                <span aria-hidden="true">◈</span> {effect.nameRu}
                {armorClassNote(effect, armorClass)} · {effect.endConditionRu}
              </span>
              <button
                type="button"
                onClick={() => onEndEffect(effect.id)}
                aria-label={`Завершить: ${effect.nameRu}`}
                className="min-h-11 shrink-0 px-2 text-slate-500"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
```

и добавить `onEndEffect: (effectId: string) => void;` в параметры компонента.

Подпись `armorClassNote(effect, armorClass)` сохраняется дословно: она отвечает на «почему КД 17»
(FR-093), и это уже готовое требование.

- [x] **Step 4: Подключить операцию**

В `src/components/combat/CombatScreen.tsx` добавить `endEffect` в импорт из `@/store/session` и передать в шапку:

```tsx
          onEndEffect={(effectId) => apply((current) => endEffect(current, effectId, clock))}
```

- [x] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/ && npm run typecheck && npm run test:coverage`
Expected: PASS, типы чистые, покрытие 100 %.

- [x] **Step 6: Commit**

```bash
git add src/components/combat/ResourceHeader.tsx src/components/combat/CombatScreen.tsx src/components/combat/Concentration.test.tsx
git commit -m "End an active effect from the header"
```

---

### Task 10: E2E, статусы и закрытие задачи

Последний коммит переводит требования в `Готово`, а критерий приёмки — в `Проверено`. Раньше этого делать нельзя: статус, не соответствующий коду, скрипт не поймает, его ловят только глазами.

**Files:**
- Modify: `e2e/uc-01-cast-spell.spec.ts`
- Modify: `docs/features/F-07-concentration.md`
- Modify: `docs/features/F-08-active-effects.md` — блок FR-091
- Modify: `docs/features/F-16-troll-states.md` — блоки FR-180 и FR-183
- Modify: `docs/features/F-01-combat-screen.md` — блок FR-001
- Modify: `docs/quality.md` — таблица критериев приёмки и матрица трассировки
- Modify: `docs/roadmap.md` — «Текущее состояние» и «Чего не хватает в логике»

**Interfaces:**
- Consumes: всё поведение задач 1–9.
- Produces: ничего для кода — это закрывающая задача.

- [x] **Step 1: Проверить незакоммиченную работу**

Run: `git status --short e2e playwright.config.ts`
Если файлы не отслеживаются — **спросить владельца репозитория**, включать ли их в коммит вместе с новым тестом, и дальше действовать по ответу.

- [x] **Step 2: Написать E2E-тест**

В `e2e/uc-01-cast-spell.spec.ts` добавить перед тестом axe-core:

```ts
test("concentration block explains the effect", async ({ page }) => {
  // «Обнаружение магии» держится концентрацией; ритуальный режим её тоже требует.
  await page.getByRole("button", { name: /Обнаружение магии/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: /Ячейка 1 уровня/ }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  // Виден после закрытия карточки заклинания (AC-14).
  const card = page.getByRole("button", { name: /Концентрация: Обнаружение магии/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Сфера 30 футов от себя");
  await expect(card).toContainText("спасбросок Телосложения");

  // Ключевая механика по-прежнему без прокрутки страницы (F-01).
  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);

  await card.click();
  const panel = page.getByRole("dialog", { name: /Концентрация/ });
  await expect(panel.getByLabel("Чем прерывается")).toContainText("Недееспособность или смерть");

  // КС считается по введённому урону (AC-15).
  await panel.getByRole("button", { name: "Получил урон" }).click();
  await page.getByLabel("Полученный урон").fill("24");
  await page.getByRole("button", { name: "Записать" }).click();
  await expect(page.getByRole("dialog", { name: "Проверка концентрации" })).toContainText("КС 12");
});
```

> Подписи сверены с кодом. «Обнаружение магии» — ритуал ([detect-magic.json](../../../src/data/content/thorne/spells/detect-magic.json)), поэтому шаг «Чем сотворить» предлагает и «Ячейка 1 уровня · осталось 4 из 4», и «Ритуалом · +10 минут, ячейка не расходуется» ([CastWizard.tsx:42-49](../../../src/components/cast/CastWizard.tsx#L42-L49)). Нажатие по регулярному выражению `/Ячейка 1 уровня/` выбирает обычный режим — он и нужен: концентрацию ритуал требует тоже, но проверять надо тот путь, которым заклинание творят в бою.

- [x] **Step 3: Прогнать E2E**

Run: `npm run test:e2e`
Expected: PASS, включая существующие тесты и проверку axe-core.

- [x] **Step 4: Перевести статусы требований**

- `docs/features/F-07-concentration.md`: у `FR-084` статус `В работе` → `Готово`; в шапке файла обновить дату; в разделе «Проверка» добавить строки: «Блок объясняет механику и способы прерывания — E2E `concentration block explains the effect`» и «Провал при доступной руне предлагает её раньше завершения — компонентный».
- `docs/features/F-08-active-effects.md`: у `FR-091` в «Проверку» добавить компонентный `завершение активного эффекта`.
- `docs/features/F-16-troll-states.md`: у `FR-180` и `FR-183` в «Проверку» добавить компонентные тесты ввода урона и значка подавления.
- `docs/features/F-01-combat-screen.md`: в `FR-001` пункт «текущую концентрацию» дополнить ссылкой «состав — [FR-084](F-07-concentration.md#fr-084)»; в «Поведение и крайние случаи» добавить абзац о кнопке «Получил урон» как единственной точке ввода урона.
- `docs/quality.md`: `AC-15` — `План` → `Проверено`, в третьей колонке добавить ссылку на `FR-084`; в матрице трассировки заполнить строку `FR-083` колонкой E2E `concentration block explains the effect` и добавить строку `FR-084`.

- [x] **Step 5: Обновить роадмап**

В `docs/roadmap.md`:
- из таблицы «Чего не хватает в логике» удалить строки `FR-091` и `FR-154`;
- в строке `FR-170…FR-173` убрать упоминание, что тратить кровь негде, только если это стало неверным — иначе оставить как есть;
- в «Текущем состоянии» в строку таблицы «Интерфейс» добавить «блок концентрации с проверкой после урона»;
- обновить дату в шапке файла.

- [x] **Step 6: Полная проверка**

Run: `npm run check:docs && npm run typecheck && npm run test:coverage && npm run build`
Expected: спецификация целостна; типы чистые; тесты зелёные, покрытие 100 %; статический экспорт собирается.

- [x] **Step 7: Commit**

```bash
git add docs e2e/uc-01-cast-spell.spec.ts
git commit -m "Verify the concentration block end to end and close its requirements"
```

---

## Итог

| Задача | Что появляется | Требование |
|---|---|---|
| 1 | требование и правила прерывания в спеке | FR-084 |
| 2 | раунд начала, длительность в раундах | FR-084 |
| 3 | сборка описания концентрации | FR-084 |
| 4 | «нужно 8 и выше» | FR-083 |
| 5 | карточка в шапке | FR-082, FR-084 |
| 6 | лист, снятие вручную | FR-084, FR-091 |
| 7 | ввод урона, признак огня, значок подавления | FR-083, FR-180, FR-183 |
| 8 | карточка проверки, руна при провале | FR-083, FR-154 |
| 9 | завершение любого эффекта | FR-091 |
| 10 | E2E и статусы | AC-14, AC-15 |
