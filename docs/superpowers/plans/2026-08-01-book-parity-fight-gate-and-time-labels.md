# Паритет «Книги», начало боя и два времени — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Снять четыре дефекта третьей примерки: «Книга» получает строку «Магия крови» и счётчик очков, «Знаки ограждения» становятся доступны вне боя, применение до начала боя помечается причиной, а время накладывания перестаёт путаться с длительностью.

**Architecture:** Правки идут по слоям снизу вверх и ровно там, где живёт смысл: морфология в `src/rules/language.ts`, подписи в `src/components/spell/format.ts`, отбор в `src/rules/filters.ts`, проверка доступности в `src/rules/availability.ts`, режимы в компонентах. Ни одна проверка не дублируется в интерфейсе: список и мастер применения обязаны считаться одной функцией.

**Tech Stack:** Next.js 16, TypeScript (strict), Tailwind 4, Zustand, Zod, Vitest + Testing Library, Playwright (WebKit).

**Спека:** [2026-08-01-book-parity-fight-gate-and-time-labels-design.md](../specs/2026-08-01-book-parity-fight-gate-and-time-labels-design.md)

## Global Constraints

- **Спека — источник истины.** Правка `docs/` и правка кода идут **одним коммитом**. Требование без кода и код без требования — оба считаются отклонением ([CLAUDE.md](../../../CLAUDE.md)).
- **Язык.** Документация, интерфейс, тексты заклинаний — русский. Код, идентификаторы, имена файлов, сообщения коммитов — английский.
- **Имена в коде берутся из [глоссария](../../glossary.md).** Синонимы не изобретаются: `duration` — длительность, `castingTime` — время накладывания.
- **Покрытие 100 %** по движку правил, схемам, состоянию и контенту. Каждая новая ветка нуждается в тесте, иначе `npm run test:coverage` падает.
- **Проверка целостности спеки** после каждой правки `docs/`: `npm run check:docs`.
- **Полный прогон перед завершением:** `npm run check:docs && npm run typecheck && npm run test:coverage && npm run build`.
- **Инварианты, которые нельзя нарушать:** до подтверждения в мастере состояние персонажа не меняется (FR-022); любое расходование ресурса обратимо журналом (FR-111); одновременно активна не более одной концентрации (FR-080); обновление приложения не удаляет данные (NFR-003).
- **Приложение не запрещает, а предупреждает** (FR-031). Единственное непроходимое предупреждение — замена концентрации.
- **Ветка:** `agent/book-parity-and-time-labels`, уже создана, спека на ней закоммичена.

## Файлы

| Файл | Ответственность | Задача |
|---|---|---|
| `src/rules/language.ts` | морфология: формы слов при числе | 1 |
| `src/components/spell/format.ts` | подписи полей заклинания | 1 |
| `src/components/spell/SpellCardCompact.tsx` | строка списка | 1 |
| `src/components/spell/SpellCardDetails.tsx` | подробная карточка | 1 |
| `src/components/cast/CastWizard.tsx` | значок времени в мастере | 1 |
| `src/rules/filters.ts` | отбор строки, не являющейся заклинанием | 2 |
| `src/components/combat/CombatScreen.tsx` | режим → состав экрана | 2, 3, 4 |
| `src/components/combat/ResourceHeader.tsx` | шапка ресурсов по режиму | 3 |
| `src/rules/availability.ts` | проверка доступности | 5 |
| `src/rules/bloodMagic.ts` | причины недоступности обмена | 5 |

---

### Task 1: FR-014 — накладывание и длительность называются по-разному

**Files:**
- Modify: `src/rules/language.ts` (добавить винительный падеж)
- Modify: `src/components/spell/format.ts:54-84` (`castingTimePhrase`), `:238-243` (`durationBadge` → `durationPhrase`)
- Modify: `src/components/spell/SpellCardCompact.tsx:95-100`, `:150-161`
- Modify: `src/components/spell/SpellCardDetails.tsx:104-151`
- Modify: `src/components/cast/CastWizard.tsx:462`
- Modify: `docs/features/F-02-spell-card.md` (новое FR-014)
- Modify: `docs/features/F-18-screen-modes.md` (FR-211: строка «Длительность» в таблице сведений)
- Test: `src/components/spell/format.test.ts`, `src/components/combat/CombatScreen.test.tsx:861`

**Interfaces:**
- Produces: `timeSpanAccusativeRu(unit: TimeUnit, value: number): string`, `TimeUnit = "round" | "minute" | "hour"` в `@/rules/language`; `castingTimePhrase(castingTime: Spell["castingTime"]): string` и `durationPhrase(duration: Spell["duration"]): string` в `@/components/spell/format`.
- Consumes: существующие `withPlural`, `longCastingTimeRu`, `durationLabel`, `castingTimeLabel`.

**Почему две функции на каждое время, а не одна.** `castingTimeLabel` и `durationLabel` возвращают голое значение в именительном падеже — они нужны там, где рядом стоит подпись строки (`<Row label="Длительность">`). `castingTimePhrase` и `durationPhrase` возвращают самоописывающую фразу — они нужны там, где подписи нет: в значке и в строке фактов. Одна функция на оба случая дала бы либо «Длительность: Держится 1 час», либо безымянное «1 час» в значке.

- [ ] **Step 1: Написать падающие тесты морфологии**

В `src/rules/language.test.ts` дописать:

```ts
describe("timeSpanAccusativeRu: винительный падеж (FR-014)", () => {
  it("минута склоняется: «держится 1 минуту», а не «1 минута»", () => {
    expect(timeSpanAccusativeRu("minute", 1)).toBe("1 минуту");
    expect(timeSpanAccusativeRu("minute", 2)).toBe("2 минуты");
    expect(timeSpanAccusativeRu("minute", 10)).toBe("10 минут");
  });

  it("час и раунд в винительном совпадают с именительным", () => {
    expect(timeSpanAccusativeRu("hour", 1)).toBe("1 час");
    expect(timeSpanAccusativeRu("hour", 8)).toBe("8 часов");
    expect(timeSpanAccusativeRu("round", 1)).toBe("1 раунд");
    expect(timeSpanAccusativeRu("round", 3)).toBe("3 раунда");
  });
});
```

Импорт дописать в существующий блок импортов файла: `import { ..., timeSpanAccusativeRu } from "./language";`

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/language.test.ts`
Expected: FAIL — `timeSpanAccusativeRu is not a function` (или ошибка типов на импорте).

- [ ] **Step 3: Добавить винительный падеж в `language.ts`**

Дописать в конец `src/rules/language.ts`:

```ts
/**
 * Единица отрезка времени: раунд, минута, час.
 *
 * Шире `LongCastingUnit`: раунды бывают у длительности, но не у накладывания.
 */
export type TimeUnit = "round" | "minute" | "hour";

/**
 * Винительный падеж: «держится 1 минуту», «накладывать 1 минуту».
 *
 * Отдельно от `LONG_CASTING_FORMS` (именительный), потому что после глагола падеж другой ровно у
 * одного слова из трёх: «1 минута» → «1 минуту», а «1 час» и «1 раунд» не меняются. Одна таблица на
 * оба падежа означала бы «держится 1 минута» — за столом это читается как ошибка приложения, а
 * значит и как повод сомневаться в его числах (FR-014).
 */
const TIME_FORMS_ACCUSATIVE: Record<TimeUnit, [string, string, string]> = {
  round: ["раунд", "раунда", "раундов"],
  minute: ["минуту", "минуты", "минут"],
  hour: ["час", "часа", "часов"],
};

export function timeSpanAccusativeRu(unit: TimeUnit, value: number): string {
  return withPlural(value, TIME_FORMS_ACCUSATIVE[unit]);
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/rules/language.test.ts`
Expected: PASS.

- [ ] **Step 5: Написать падающие тесты подписей**

В `src/components/spell/format.test.ts` дописать:

```ts
describe("castingTimePhrase (FR-014)", () => {
  it("действие, бонусное и реакция остаются одним словом: их не с чем спутать", () => {
    expect(castingTimePhrase({ type: "action" })).toBe("Действие");
    expect(castingTimePhrase({ type: "bonus_action" })).toBe("Бонусное");
    expect(castingTimePhrase({ type: "reaction", reactionTrigger: "в вас попали" })).toBe("Реакция");
  });

  it("минуты и часы называют себя глаголом: «Накладывать», а не голое число", () => {
    expect(castingTimePhrase({ type: "minute", value: 1 })).toBe("Накладывать 1 минуту");
    expect(castingTimePhrase({ type: "minute", value: 10 })).toBe("Накладывать 10 минут");
    expect(castingTimePhrase({ type: "hour", value: 1 })).toBe("Накладывать 1 час");
  });

  it("без числа остаётся категория: врать о времени хуже, чем назвать приблизительно", () => {
    expect(castingTimePhrase({ type: "minute" })).toBe("Минуты");
  });
});

describe("durationPhrase (FR-014)", () => {
  it("мгновенная длительность названа эффектом, а не временем", () => {
    expect(durationPhrase({ type: "instant" })).toBe("Мгновенный эффект");
  });

  it("длящаяся называет себя глаголом и склоняется", () => {
    expect(durationPhrase({ type: "minutes", value: 1 })).toBe("Держится 1 минуту");
    expect(durationPhrase({ type: "minutes", value: 10 })).toBe("Держится 10 минут");
    expect(durationPhrase({ type: "hours", value: 1 })).toBe("Держится 1 час");
    expect(durationPhrase({ type: "rounds", value: 1 })).toBe("Держится 1 раунд");
  });

  it("особая длительность и длительность без числа названы особой", () => {
    expect(durationPhrase({ type: "special" })).toBe("Длительность особая");
    expect(durationPhrase({ type: "minutes" })).toBe("Длительность особая");
  });
});
```

Импорт дописать: `import { castingTimeLabel, castingTimePhrase, durationPhrase, preparationBadge, resolutionBadge, signed } from "./format";`

- [ ] **Step 6: Убедиться, что тесты падают**

Run: `npx vitest run src/components/spell/format.test.ts`
Expected: FAIL — `castingTimePhrase is not a function`, `durationPhrase is not a function`.

- [ ] **Step 7: Добавить фразы в `format.ts`**

Импорт в шапке файла: заменить
```ts
import { longCastingTimeRu, plural, type LongCastingUnit } from "@/rules/language";
```
на
```ts
import {
  longCastingTimeRu,
  plural,
  timeSpanAccusativeRu,
  type LongCastingUnit,
  type TimeUnit,
} from "@/rules/language";
```

Сразу после `castingTimeLabel` (после строки 84) дописать:

```ts
/**
 * Время накладывания там, где подписи рядом нет: в значке строки списка и в мастере (FR-014).
 *
 * «Действие», «Бонусное» и «Реакция» остаются одним словом — они называют ресурс хода, и спутать их
 * с длительностью нельзя. Минуты и часы — единственный случай, где значок и текст на одной строке
 * оба означали время и ни один не говорил какое: «Починка» показывала «1 минута» рядом с
 * «Мгновенно». Глагол отвечает на вопрос сразу.
 */
export function castingTimePhrase(castingTime: Spell["castingTime"]): string {
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) {
    return castingTimeLabel(castingTime);
  }
  return `Накладывать ${timeSpanAccusativeRu(unit, castingTime.value)}`;
}
```

Заменить `durationBadge` (строки 238-243) на:

```ts
/** Единицы длительности в терминах морфологии. `instant` и `special` числа не несут. */
const DURATION_UNITS: Partial<Record<Spell["duration"]["type"], TimeUnit>> = {
  rounds: "round",
  minutes: "minute",
  hours: "hour",
};

/**
 * Длительность там, где подписи рядом нет: строка фактов краткой карточки (FR-014).
 *
 * Парная к `castingTimePhrase`: одна говорит, сколько заклинание накладывают, вторая — сколько оно
 * держится. До FR-014 обе печатались голым числом, и «Паутина» показывала «Действие» рядом с «1 час»
 * — второе читалось как время накладывания.
 *
 * «Мгновенный эффект», а не «Мгновенно»: наречие отвечает на вопрос «как быстро творится», то есть
 * ровно на тот вопрос, от которого длительность и нужно отличить.
 */
export function durationPhrase(duration: Spell["duration"]): string {
  if (duration.type === "instant") return "Мгновенный эффект";
  const unit = DURATION_UNITS[duration.type];
  if (unit === undefined || duration.value === undefined) return "Длительность особая";
  return `Держится ${timeSpanAccusativeRu(unit, duration.value)}`;
}
```

- [ ] **Step 8: Убедиться, что тесты подписей проходят**

Run: `npx vitest run src/components/spell/format.test.ts src/rules/language.test.ts`
Expected: PASS.

- [ ] **Step 9: Применить фразы в краткой карточке и выделить длительность контрастом**

В `src/components/spell/SpellCardCompact.tsx` заменить импорт `castingTimeLabel` и `durationBadge` на `castingTimePhrase` и `durationPhrase`.

Заменить блок `facts` (строки 95-100) на:

```tsx
  /**
   * Нейтральные сведения строки. Длительность выделена контрастом: рядом с ней в значке стоит время
   * накладывания, и два времени на одной строке обязаны отличаться не только словом (FR-014).
   *
   * Девятого смыслового цвета для неё не заводится: все восемь заняты, и девятый превратил бы шкалу
   * в радугу, в которой не выделяется ничего (ux.md#цветовая-система). Контраст внутри нейтрального
   * такого запрета не нарушает — он не обещает нового смысла.
   */
  const facts: { text: string; strong: boolean }[] = [
    { text: slotCost, strong: false },
    { text: rangeLabel(spell.range), strong: false },
    { text: durationPhrase(spell.duration), strong: true },
    ...(damage === null ? [] : [{ text: `Урон ${damage}`, strong: false }]),
  ];
```

Заменить значок времени накладывания (строка 127) `{castingTimeLabel(spell.castingTime)}` на `{castingTimePhrase(spell.castingTime)}`.

Заменить отрисовку фактов (строки 150-161) на:

```tsx
        <span className="flex flex-wrap items-center gap-x-1 text-[0.6875rem] leading-4 text-slate-600 dark:text-slate-400">
          {facts.map((fact, index) => (
            <Fragment key={fact.text}>
              {index === 0 ? null : (
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
              )}
              <span className={fact.strong ? "font-medium text-slate-800 dark:text-slate-200" : ""}>
                {fact.text}
              </span>
            </Fragment>
          ))}
        </span>
```

Заодно убрать мёртвую ветку строки 85-96: `slotCost` собирается как `slotCostLabel(spell) ?? "Без ячейки"` и `null` быть не может, а `...(slotCost === null ? [] : [slotCost])` это проверял. Ветка недостижима, и тест на неё написать нельзя.

- [ ] **Step 10: Применить фразы в подробной карточке и мастере**

В `src/components/spell/SpellCardDetails.tsx`:
- в импорте из `./format` заменить `castingTimeLabel` на `castingTimeLabel, castingTimePhrase`;
- строка 107: `{castingTimeLabel(spell.castingTime)}` → `{castingTimePhrase(spell.castingTime)}`;
- в `dl` перед строкой «Длительность» (строка 148) вставить пару, чтобы два времени стояли рядом и оба были подписаны:

```tsx
          {/* Пара строк подряд: подписанные, они сравниваются глазом и не путаются (FR-014). */}
          <Row label="Накладывание">{castingTimeLabel(spell.castingTime)}</Row>
```

В строках таблицы падеж именительный — подпись слева уже сказала, о чём речь, и глагол был бы третьим ответом на тот же вопрос.

В `src/components/cast/CastWizard.tsx` строка 462: `castingTimeLabel(draft.spell.castingTime)` → `castingTimePhrase(draft.spell.castingTime)`; поправить импорт на строке 18.

- [ ] **Step 11: Починить тест краткой карточки**

`src/components/combat/CombatScreen.test.tsx:861` ожидает `"1 минута"`. Заменить на:

```ts
    expect(within(row).getByText("Накладывать 1 минуту")).toBeDefined();
```

- [ ] **Step 12: Прогнать весь набор тестов**

Run: `npm run test`
Expected: PASS. Если падает что-то ещё — это места, где длительность или накладывание печатались голым числом; поправить ожидание на новую фразу, поведение не менять.

- [ ] **Step 13: Записать требование в спеку**

В `docs/features/F-02-spell-card.md` дописать после последнего требования:

```markdown
<a id="fr-014"></a>
### FR-014 — Два времени называются по-разному

**Статус:** Готово · **Проверка:** unit `castingTimePhrase (FR-014)`, `durationPhrase (FR-014)`, `timeSpanAccusativeRu: винительный падеж (FR-014)`, компонентный `краткая карточка`

Время накладывания и длительность на одной карточке должны различаться подписью и цветом.

Замечание игрока: «в лейблах и описании очень тяжело ориентировать что такое длительность — это
длительность каста или длительность действия заклинания». Так и было: «Починка» показывала значок
«1 минута» и текст «Мгновенно», «Паутина» — «Действие» и «1 час». Оба числа означали время, ни одно
не говорило какое, и различить их можно было только зная заклинание наизусть — то есть в том
единственном случае, когда приложение не нужно.

**Там, где подписи нет, время называет себя само.** В значке и в строке фактов стоят «Накладывать 1
минуту» и «Держится 1 час». «Действие», «Бонусное» и «Реакция» остаются одним словом: они называют
ресурс хода, и с отрезком времени их спутать нельзя. «Мгновенный эффект» вместо «Мгновенно» —
наречие отвечало на вопрос «как быстро творится», то есть ровно на тот, от которого длительность и
нужно отличить.

**Там, где подпись есть, стоит голое число.** В подробной карточке «Накладывание» и «Длительность» —
две соседние строки таблицы, и глагол в них был бы третьим ответом на тот же вопрос. Пара стоит
подряд, чтобы сравниваться глазом.

**Цвет — контраст внутри нейтрального, а не девятый оттенок.** Длительность в строке фактов печатается
темнее цены, дальности и урона. Все восемь смысловых цветов заняты, и девятый превратил бы шкалу в
радугу, в которой не выделяется ничего ([ux.md](../ux.md#цветовая-система)); контраст такого запрета
не нарушает, потому что нового смысла не обещает.
```

В `docs/features/F-18-screen-modes.md`, в таблице FR-211, строку «Длительность» изложить так:

```markdown
| Длительность | мгновенно или сколько держится | строкой текста через точку, контрастом и словом «Держится» ([FR-014](F-02-spell-card.md#fr-014)) |
```

Там же в FR-211, в абзаце «Цветных значка три, остальное — текст», после первого предложения добавить:

```markdown
Длительность среди них выделена контрастом: рядом с ней стоит время накладывания, и два времени на
одной строке обязаны отличаться не только словом ([FR-014](F-02-spell-card.md#fr-014)).
```

В `docs/features/README.md` строку F-02 привести к `FR-010…014`.

- [ ] **Step 14: Проверить целостность спеки**

Run: `npm run check:docs`
Expected: `спецификация целостна`.

- [ ] **Step 15: Коммит**

```bash
git add src/rules/language.ts src/rules/language.test.ts \
        src/components/spell/format.ts src/components/spell/format.test.ts \
        src/components/spell/SpellCardCompact.tsx src/components/spell/SpellCardDetails.tsx \
        src/components/cast/CastWizard.tsx src/components/combat/CombatScreen.test.tsx \
        docs/features/F-02-spell-card.md docs/features/F-18-screen-modes.md docs/features/README.md
git commit -m "Tell casting time apart from duration on the card (FR-014)"
```

---

### Task 2: FR-207 — «Магия крови» встаёт в список «Книги»

**Files:**
- Modify: `src/rules/filters.ts:154-162` (рядом с `matchesTraits`)
- Modify: `src/components/combat/CombatScreen.tsx:186-230`
- Modify: `docs/features/F-18-screen-modes.md` (FR-207, FR-212)
- Test: `src/rules/filters.test.ts`, `src/components/combat/CombatScreen.test.tsx`

**Interfaces:**
- Consumes: `BLOOD_MAGIC_TRAITS`, `matchesTraits`, `compareCombatTraits`, `traitsOf`.
- Produces: `matchesActionRow(traits: ActionTraits, filters: SpellFilters): boolean` в `@/rules/filters`.

**Почему новая функция, а не расширение `matchesTraits`.** `matchesTraits` вызывается и для заклинаний — из `matches`. В `ActionTraits` поле `level` для заклинания означает уровень заклинания, а для «Магии крови» — цену в ячейках (ноль, потому что ячейку обмен не тратит). Отбор по уровню внутри `matchesTraits` отсёк бы заклинания их собственным фильтром дважды и сломал бы боевой список.

- [ ] **Step 1: Написать падающий unit-тест отбора**

В `src/rules/filters.test.ts` дописать:

```ts
describe("matchesActionRow: книжные фильтры для строки-действия (FR-207, FR-212)", () => {
  it("«Подготовлено» её не прячет: подготовка к обмену не относится", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ prepared: true }))).toBe(true);
  });

  it("«Ритуал» прячет: обмен ритуалом не творится", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ ritual: true }))).toBe(false);
  });

  it("любой уровень прячет: у обмена уровня заклинания нет вовсе", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ levels: [0] }))).toBe(false);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ levels: [1] }))).toBe(false);
  });

  it("общие фильтры работают так же, как раньше", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ castingTimes: ["action"] }))).toBe(true);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ roles: ["offense"] }))).toBe(false);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, NO_FILTERS)).toBe(true);
  });
});
```

Импорт дописать: `matchesActionRow` в существующий блок импорта из `./filters`.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/filters.test.ts`
Expected: FAIL — `matchesActionRow is not a function`.

- [ ] **Step 3: Добавить `matchesActionRow` в `filters.ts`**

Сразу после `matchesTraits` (после строки 162) дописать:

```ts
/**
 * Полный отбор строки, заклинанием не являющейся, — включая фильтры, которых в бою нет
 * ([FR-207](../../docs/features/F-18-screen-modes.md#fr-207), FR-212).
 *
 * Отдельно от `matchesTraits`, потому что ту зовут и для заклинаний: поле `level` у заклинания
 * означает его уровень, а у «Магии крови» — цену в ячейках, и отбор по уровню внутри общей функции
 * отсёк бы заклинания их собственным фильтром.
 *
 * «Подготовлено» строку не прячет: подготовка к обмену не относится вовсе, а игрок ждёт в этом
 * списке того же состава, что в бою. «Ритуал» и уровень прячут: обмен не ритуал, и уровня
 * заклинания у него нет — под фильтром «1 ур.» строка обещала бы заклинание первого уровня.
 */
export function matchesActionRow(traits: ActionTraits, filters: SpellFilters): boolean {
  if (!matchesTraits(traits, filters)) return false;
  if (filters.ritual) return false;
  if (filters.levels.length > 0) return false;
  return true;
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/rules/filters.test.ts`
Expected: PASS.

- [ ] **Step 5: Написать падающий компонентный тест**

В `src/components/combat/CombatScreen.test.tsx` дописать:

```ts
describe("«Магия крови» в «Книге» (FR-207)", () => {
  it("стоит в списке книги сразу за заговорами", async () => {
    await renderWithStores(<CombatScreen />, inBookMode());

    const list = screen.getByRole("list", { name: "Заклинания и действия" });
    const names = within(list)
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "");

    const blood = names.findIndex((text) => text.startsWith("Магия крови"));
    const firstLevelled = names.findIndex((text) => text.startsWith("Щит"));
    expect(blood).toBeGreaterThan(-1);
    expect(blood).toBeLessThan(firstLevelled);
  });

  it("«Подготовлено» оставляет тот же состав, что в бою: заговоры и магия крови на месте", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, inBookMode());

    await user.click(screen.getByRole("button", { name: "✓Подготовлено" }));

    const list = screen.getByRole("list", { name: "Заклинания и действия" });
    const text = list.textContent ?? "";
    expect(text).toContain("Магия крови");
    expect(text).toContain("Электрошок");
    expect(text).toContain("Молния");
  });

  it("фильтр уровня её прячет: уровня заклинания у обмена нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, inBookMode());

    await user.click(screen.getByRole("button", { name: "1 ур." }));

    expect(screen.queryByText("Магия крови")).toBeNull();
  });
});
```

- [ ] **Step 6: Убедиться, что тесты падают**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx -t "Магия крови в «Книге»"`
Expected: FAIL — списка с именем «Заклинания и действия» в «Книге» нет, строка не найдена.

- [ ] **Step 7: Показать строку в «Книге»**

В `src/components/combat/CombatScreen.tsx` заменить импорт `matchesTraits` на `matchesActionRow` в блоке импорта из `@/rules/filters` (строки 46-52).

Заменить вычисление `bloodShown` (строки 187-189) на:

```tsx
  // «Магия крови» — конкурент за то же действие и потому подчиняется тем же фильтрам (FR-207).
  // Она стоит и в «Книге»: очки заклинаний покупают вне боя, а «Книга» — единственный вход к
  // заклинаниям вне боя (FR-203). Во «Вне боя» её нет, потому что списка там нет вовсе (FR-202).
  const bloodShown =
    character.screenMode !== "camp" && matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
```

Вставку строки в список (строки 216-228) оставить как есть: ключ `compareCombatTraits` ставит её перед первой строкой с уровнем выше нуля, а книжный порядок — «уровень, затем алфавит», поэтому «сразу за заговорами» получается сам.

- [ ] **Step 8: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx`
Expected: PASS.

- [ ] **Step 9: Записать требование в спеку**

В `docs/features/F-18-screen-modes.md`, в FR-207:

Заголовок «**Строка подчиняется фильтрам наравне с заклинаниями.**» оставить, а после него вставить абзац:

```markdown
**Строка стоит и в «Книге».** Замечание игрока: «на вкладке "книга" есть не все заклинания — нет
ничего про кровную магию; без этого вне боя нельзя кастовать часть заклинаний». Замечание верное не
про заклинания, а про действия: карточек в «Книге» 29 против 14 в бою, а вот строки «Магия крови»
там не было — и очки заклинаний вне боя купить было нечем, хотя способ оплаты «за очки» мастер
применения предлагает в любом режиме. «Книга» — единственный вход к заклинаниям вне боя
([FR-203](#fr-203)), значит и вход к их оплате должен быть там же. Во «Вне боя» строки нет: там нет
списка вовсе ([FR-202](#fr-202)).

Из этого же следует и второе замечание — «в книге по фильтру "Подготовлено" я жду тот же список,
что в бою». Заговоры в этот список входили и раньше, а «Магия крови» — нет; со строкой составы
сходятся, и расходятся дальше ровно на то, что различает сами режимы: «Починка» творится минуту и в
бой не попадает ([FR-201](#fr-201)).

Фильтры, которых в бою не существует, строка читает так: «Подготовлено» её не прячет — подготовка к
обмену не относится; «Ритуал» и уровень прячут — обмен не ритуал, а уровня заклинания у него нет
вовсе, и под «1 ур.» строка обещала бы заклинание первого уровня.
```

В том же файле в FR-212, в абзаце «**Набор фильтров один на все режимы…**» дописать в конец:

```markdown
Строка «Магия крови» отзывается и на книжные переключатели ([FR-207](#fr-207)): список, обещающий
«вот всё, что подходит», не может показывать то, что не подходит, ни в одном режиме.
```

- [ ] **Step 10: Проверить целостность спеки**

Run: `npm run check:docs`
Expected: `спецификация целостна`.

- [ ] **Step 11: Коммит**

```bash
git add src/rules/filters.ts src/rules/filters.test.ts \
        src/components/combat/CombatScreen.tsx src/components/combat/CombatScreen.test.tsx \
        docs/features/F-18-screen-modes.md
git commit -m "Put the blood magic row in the book list (FR-207)"
```

---

### Task 3: FR-217 — счётчик очков возвращается в шапку «Книги»

**Files:**
- Modify: `src/components/combat/ResourceHeader.tsx:154`, `:192-219`
- Modify: `docs/features/F-18-screen-modes.md` (FR-217)
- Test: `src/components/combat/CombatScreen.test.tsx`, `e2e/uc-01-cast-spell.spec.ts:119-129`

**Interfaces:**
- Consumes: `character.spellPoints.remaining`, `character.screenMode`.
- Produces: ничего для других задач.

- [ ] **Step 1: Написать падающий компонентный тест**

В `src/components/combat/CombatScreen.test.tsx` дописать:

```ts
describe("шапка «Книги»: очки видны, руны нет (FR-217)", () => {
  it("показывает счётчик очков — ими в книге платят и их же в книге покупают", async () => {
    await renderWithStores(<CombatScreen />, inBookMode());

    const header = screen.getByRole("region", { name: "Ресурсы" });
    expect(within(header).getByText(/Очки 0/)).toBeDefined();
  });

  it("не показывает рун, костей хитов и чисел боя", async () => {
    await renderWithStores(<CombatScreen />, inBookMode());

    const header = screen.getByRole("region", { name: "Ресурсы" });
    expect(within(header).queryByText(/Руны/)).toBeNull();
    expect(within(header).queryByText(/Кости хитов/)).toBeNull();
    expect(within(header).queryByText("КС закл.")).toBeNull();
  });

  it("в бою состав ряда прежний: и руны, и очки", async () => {
    await renderWithStores(<CombatScreen />);

    const header = screen.getByRole("region", { name: "Ресурсы" });
    expect(within(header).getByText(/Руны 3\/3/)).toBeDefined();
    expect(within(header).getByText(/Очки 0/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx -t "шапка «Книги»"`
Expected: FAIL на первом тесте — в «Книге» ряда «Прочие ресурсы» нет вовсе.

- [ ] **Step 3: Показать один значок в «Книге»**

В `src/components/combat/ResourceHeader.tsx` заменить строку 154 и комментарий над ней на:

```tsx
  const inBook = character.screenMode === "book";
  /**
   * Числа боя — везде, кроме «Книги»: там выбирают состав на день, и КС спасброска, модификатор
   * атаки, КД и остаток хитов на вопрос «чем сегодня платить» не отвечают (FR-217).
   */
  const combatNumbers = !inBook;
```

Заменить открытие ряда «Прочие ресурсы» (строка 192-193) на:

```tsx
      {/*
        Ряд прочих ресурсов есть во всех режимах, но в «Книге» он состоит из одного значка — очков
        (FR-217). Очки заклинаний это способ оплаты, а в «Книге» их с недавних пор ещё и покупают
        строкой «Магия крови» (FR-207): вопрос «сколько их стало» там теперь возникает. Руны в книге
        не покупают и отдельно не тратят — их значок остаётся вне её.
      */}
      <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-1 text-xs">
```

Обернуть значок рун (строки 205-214) в проверку режима:

```tsx
          {/*
            Значок рун — не кнопка: правило 44 пикселей на зону нажатия сделало бы весь ряд значков
            вдвое выше. Правка рун открывается плиткой ячейки — там же, где правятся ячейки (FR-155).
          */}
          {inBook ? null : (
            <li>
              <Badge tone="ritual" icon="❖">
                Руны {character.runes.remaining}/{character.runes.maximum}
              </Badge>
            </li>
          )}
```

Значок «Кости хитов» (строки 198-204) уже стоит под `turnTracked(character) ? null : (…)`, что в «Книге» истинно. Добавить к его условию режим:

```tsx
          {turnTracked(character) || inBook ? null : (
```

Значок «Очки» (строки 215-219) оставить без условия — он и есть то, ради чего ряд появляется.

Значки «Максимум снижен», «Особенности подавлены» и блок экономии хода обернуть в `combatNumbers`, чтобы в «Книге» ряд остался однозначковым: заменить строку 220 `{character.hitPoints.maximumReduction > 0 ? (` на `{combatNumbers && character.hitPoints.maximumReduction > 0 ? (`, строку 227 `{character.suppression.firedUpon ? (` на `{combatNumbers && character.suppression.firedUpon ? (`, строку 238 `{character.suppression.underDirectSunlight ? (` на `{combatNumbers && character.suppression.underDirectSunlight ? (`.

Закрывающий `) : null}` прежнего внешнего `combatNumbers ? (` перед `<ul aria-label="Прочие ресурсы">` удалить вместе с открытием — ряд больше не под условием целиком.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Поправить E2E-проверку состава шапки**

В `e2e/uc-01-cast-spell.spec.ts` заменить строку 128:

```ts
  await expect(header.getByLabel("Прочие ресурсы")).toHaveCount(0);
```

на:

```ts
  // Ряд прочих ресурсов в «Книге» состоит из одного значка: очки — способ оплаты, и их же здесь
  // покупают строкой «Магия крови» (FR-207, FR-217). Рун и чисел боя в нём нет.
  const other = header.getByLabel("Прочие ресурсы");
  await expect(other).toContainText("Очки");
  await expect(other).not.toContainText("Руны");
```

- [ ] **Step 6: Перемерить бюджет вёрстки**

Run: `npm run test:e2e`
Expected: PASS, включая `combat keeps the first card whole, the book keeps the header`.

Если замер не сошёлся — сокращать в порядке, названном самим FR-218, и шапка в него не входит: сначала поле поиска (оно уже открывается кнопкой), затем полоса фильтров, затем ряд «Данные». Значок очков не убирать: он и есть предмет этой задачи. Результат замера записать в FR-218 числом.

- [ ] **Step 7: Записать требование в спеку**

В `docs/features/F-18-screen-modes.md`, в FR-217 после абзаца «Второе замечание разрешило противоречие…» вставить:

```markdown
**Очки заклинаний вернулись третьей правкой, и причина у неё новая.** Прежний состав шапки был верен
для книги, из которой только читают. С тех пор как «Магия крови» стоит строкой в списке «Книги»
([FR-207](#fr-207)), очки здесь не только тратят, но и **покупают** — а шапка о них молчала, и
результат покупки было негде увидеть. Ряд «Прочие ресурсы» в «Книге» появляется ровно ради этого и
состоит из одного значка: рун, костей хитов, снижения максимума, подавления и экономии хода в нём
нет. Руны в книге не покупают и отдельно не тратят — трата на заклинание живёт внутри мастера
применения и работает в любом режиме, а ручная правка открывается плиткой ячейки, которая здесь есть
([FR-155](F-13-runes.md#fr-155)).
```

Строку «**Проверка:**» в заголовке FR-217 дополнить компонентным тестом `шапка «Книги»: очки видны, руны нет (FR-217)`.

- [ ] **Step 8: Проверить целостность спеки**

Run: `npm run check:docs`
Expected: `спецификация целостна`.

- [ ] **Step 9: Коммит**

```bash
git add src/components/combat/ResourceHeader.tsx src/components/combat/CombatScreen.test.tsx \
        e2e/uc-01-cast-spell.spec.ts docs/features/F-18-screen-modes.md
git commit -m "Show the spell points badge in the book header (FR-217)"
```

---

### Task 4: FR-153 — «Знаки ограждения» доступны вне боя

**Files:**
- Modify: `src/components/combat/CombatScreen.tsx:356-389`
- Modify: `docs/features/F-13-runes.md` (FR-153), `docs/features/F-05-reactions.md` (FR-060)
- Test: `src/components/combat/CombatScreen.test.tsx`

**Interfaces:**
- Consumes: `ReactionsSheet`, `wardingSigilAvailable`, `spendRuneOnWardingSigil`.
- Produces: ничего для других задач.

**Что уже работает и переделке не подлежит.** `availableTriggers([])` возвращает `["failed_save"]`: триггер «Я провалил спасбросок» стоит в списке всегда, потому что отвечает на него не заклинание, а руна. Значит лист с пустым списком заклинаний — а во «Вне боя» он именно такой — уже показывает одну кнопку события и за ней блок «Знаки ограждения». Менять `ReactionsSheet` не нужно; задача сводится к тому, чтобы кнопка, открывающая лист, перестала быть боевой.

- [ ] **Step 1: Написать падающий компонентный тест**

В `src/components/combat/CombatScreen.test.tsx` дописать:

```ts
describe("«Знаки ограждения» вне боя (FR-153)", () => {
  it("кнопка «Реакции» есть во всех трёх режимах", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    expect(screen.getByRole("button", { name: "Реакции" })).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.getByRole("button", { name: "Реакции" })).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /^Вне боя/ }));
    expect(screen.getByRole("button", { name: "Реакции" })).toBeDefined();
  });

  it("вне боя лист предлагает руну, хотя списка заклинаний в режиме нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("radio", { name: /^Вне боя/ }));
    await user.click(screen.getByRole("button", { name: "Реакции" }));

    const sheet = screen.getByRole("dialog", { name: "Реакции" });
    await user.click(within(sheet).getByRole("radio", { name: /провалил спасбросок/i }));

    await user.click(within(sheet).getByRole("button", { name: /Потратить руну/ }));

    expect(screen.getByLabelText(/Ячейки заклинаний/).textContent).toBeDefined();
    const header = screen.getByRole("region", { name: "Ресурсы" });
    expect(within(header).getByText(/Руны 2\/3/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx -t "Знаки ограждения вне боя"`
Expected: FAIL — в «Книге» и «Вне боя» кнопки «Реакции» нет.

- [ ] **Step 3: Вынести кнопку из боевого блока**

В `src/components/combat/CombatScreen.tsx` в блоке `{character.screenMode === "combat" ? (…) : null}` (строки 356-389) оставить внутри только кнопку «Начать бой» / «Мой ход», а кнопку «Реакции» переместить наружу — сразу после закрытия этого блока, перед кнопкой «Отменить»:

```tsx
          {/*
            Реакции — отдельный вход, видимый независимо от фильтров и прокрутки списка (FR-060):
            триггер приходит в чужой ход, и искать заклинание по списку в этот момент некогда.

            Кнопка стоит во всех режимах, а не только в бою (FR-153): провалить спасбросок Ловкости
            или Телосложения можно и от ловушки в коридоре, а руна превращает провал в успех
            независимо от того, идёт ли бой. Состав листа при этом задаёт режим: во «Вне боя» списка
            заклинаний нет, и в листе остаются одни «Знаки ограждения».
          */}
          <button
            type="button"
            onClick={() => setReactionsOpen(true)}
            className="min-h-11 shrink-0 rounded-xl border border-reaction px-3 text-sm font-semibold text-reaction-strong dark:text-reaction"
          >
            Реакции
          </button>
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Записать требование в спеку**

В `docs/features/F-13-runes.md`, в FR-153 после абзаца «Реакция расходует руну, но не расходует ячейку заклинания.» вставить:

```markdown
**Вход к реакции есть во всех режимах.** Спасбросок Силы, Ловкости или Телосложения бросают не только
в бою: ловушка в коридоре, порыв ветра на мосту и ядовитый газ в склепе — всё это спасброски, и руна
превращает провал в успех независимо от того, ведётся ли счёт раундов. Пока кнопка «Реакции» стояла
только в режиме «Бой», единственная особенность подкласса, работающая вне инициативы, была
недоступна ровно тогда, когда о ней вспоминают.

Состав листа при этом определяет режим, а не отдельное правило: он строится от списка заклинаний
этого режима. В «Бою» это реакции боевого списка, в «Книге» — реакции всей книги, во «Вне боя»
списка нет вовсе ([FR-202](F-18-screen-modes.md#fr-202)), и в листе остаются одни «Знаки ограждения».
Вопрос «Я провалил спасбросок» стоит в списке событий всегда: на него отвечает не заклинание, а руна.
```

Строку «**Проверка:**» в заголовке FR-153 дополнить: компонентный `«Знаки ограждения» вне боя (FR-153)`.

В `docs/features/F-05-reactions.md`, в FR-060 дописать в конец:

```markdown
Кнопка видна во всех трёх режимах. В бою причина этому — чужой ход, в котором некогда листать список;
вне боя — «Знаки ограждения», единственная реакция, которая срабатывает без инициативы
([FR-153](F-13-runes.md#fr-153)).
```

- [ ] **Step 6: Проверить целостность спеки**

Run: `npm run check:docs`
Expected: `спецификация целостна`.

- [ ] **Step 7: Коммит**

```bash
git add src/components/combat/CombatScreen.tsx src/components/combat/CombatScreen.test.tsx \
        docs/features/F-13-runes.md docs/features/F-05-reactions.md
git commit -m "Open the reactions sheet outside combat for the warding sigil (FR-153)"
```

---

### Task 5: FR-034 — применение до начала боя помечается причиной

**Files:**
- Modify: `src/rules/availability.ts:23-45` (`TurnResources`), `:53-66` (`AvailabilityCode`), `:344-363` (`checkAvailability`)
- Modify: `src/rules/bloodMagic.ts:60-82` (`exchangeWarnings`)
- Modify: `docs/features/F-03-cast-wizard.md` (новое FR-034), `docs/features/F-06-resources.md` (FR-140)
- Test: `src/rules/availability.test.ts`, `src/rules/bloodMagic.test.ts`, `src/components/combat/CombatScreen.test.tsx`, `src/components/cast/CastWizard.test.tsx`, `e2e/uc-01-cast-spell.spec.ts`

**Interfaces:**
- Consumes: `TurnEconomy.inFight` из `@/store/session` (уже существует), `character.screenMode`.
- Produces: код доступности `"combat_not_started"` в объединении `AvailabilityCode`; поле `inFight: boolean` в типе `TurnResources`.

**Цена этого изменения, названная заранее.** Предупреждение попадает в `checkAvailability`, а `visibleSteps` показывает шаг «доступность», когда есть непроходное предупреждение. Значит до нажатия «Начать бой» каждое применение в режиме «Бой» становится на один шаг длиннее. Это и есть намерение — приложение подталкивает начать бой, — но около восемнадцати существующих сценариев творят заклинание, не начав боя, и упадут. Их правка входит в эту задачу: нажать «Начать бой» перед применением, потому что теперь это и есть настоящий порядок за столом. Бюджет M-03 (не более четырёх шагов) не нарушается: после начала боя шаг исчезает.

- [ ] **Step 1: Написать падающий unit-тест доступности**

В `src/rules/availability.test.ts` дописать:

```ts
describe("бой не начат (FR-034)", () => {
  const shield = allSpells.find((candidate) => candidate.id === "shield");

  it("в режиме «Бой» до начала боя причина названа и проходима", () => {
    const character = createThorne();
    const availability = checkAvailability({
      spell: shield!,
      character,
      turn: { ...ALL_TURN_RESOURCES, inFight: false },
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    });

    expect(reasonsOf(availability, "combat_not_started")).toEqual([
      "Бой не начат — сначала «Начать бой»",
    ]);
    expect(availability.available).toBe(false);
    expect(availability.overridable).toBe(true);
  });

  it("после начала боя причины нет", () => {
    const availability = checkAvailability({
      spell: shield!,
      character: createThorne(),
      turn: { ...ALL_TURN_RESOURCES, inFight: true },
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    });

    expect(reasonsOf(availability, "combat_not_started")).toEqual([]);
  });

  it("вне режима «Бой» проверка молчит: ходов там не идёт и начинать нечего", () => {
    const availability = checkAvailability({
      spell: shield!,
      character: { ...createThorne(), screenMode: "book" },
      turn: { ...ALL_TURN_RESOURCES, inFight: false },
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    });

    expect(reasonsOf(availability, "combat_not_started")).toEqual([]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/availability.test.ts -t "бой не начат"`
Expected: FAIL — `combat_not_started` не входит в `AvailabilityCode`, поле `inFight` в `TurnResources` не объявлено.

- [ ] **Step 3: Добавить признак и проверку в `availability.ts`**

Расширить `TurnResources` (строки 26-38):

```ts
/** Доступность ресурсов хода. Структурно совпадает с `TurnEconomy` — её можно передавать как есть. */
export type TurnResources = {
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
  /**
   * Отмечен ли бой начатым (FR-034, FR-140). Выводится из журнала, а не хранится, — поэтому
   * приходит параметром, как и остальные три признака (ADR-0008).
   */
  inFight: boolean;
};

/**
 * Всё доступно: начало хода и выключенный учёт хода (FR-143) выглядят одинаково.
 *
 * `inFight: false` здесь безопасно: проверка начала боя сначала смотрит на режим и вне «Боя» молчит
 * вовсе — так же устроен `checkCastingTime`.
 */
export const ALL_TURN_RESOURCES: TurnResources = {
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
  inFight: false,
};
```

Дописать код в объединение `AvailabilityCode` (после `"long_casting_time"`):

```ts
  | "combat_not_started"
```

Добавить проверку рядом с `checkCastingTime`:

```ts
/**
 * Применение до начала боя ([FR-034](../../docs/features/F-03-cast-wizard.md#fr-034)).
 *
 * Пока бой не отмечен начатым, счёт раундов и экономия действий ни на чём не основаны: приложение
 * показывает «раунд 1» и три целых ресурса, потому что журналу не от чего считать, а не потому, что
 * так обстоят дела. Заклинание при этом творится, ячейка списывается, и игрок узнаёт о расхождении
 * позже — когда числа перестанут сходиться с тем, что называет мастер.
 *
 * Причина, а не запрет (FR-031): бой мог начаться до того, как игрок взял телефон, и тупик здесь
 * дороже лишнего нажатия.
 *
 * Молчит вне режима «Бой»: там ходов не идёт (FR-143), начинать нечего, и предупреждение стояло бы
 * на каждой строке «Книги».
 */
function checkCombatStarted(input: AvailabilityInput): AvailabilityWarning[] {
  if (input.character.screenMode !== "combat" || input.turn.inFight) return [];
  return [
    {
      code: "combat_not_started",
      reasonRu: "Бой не начат — сначала «Начать бой»",
      overridable: true,
    },
  ];
}
```

Включить её в `checkAvailability`, сразу после `checkCastingTime(input)`:

```ts
    ...checkCastingTime(input),
    ...checkCombatStarted(input),
```

- [ ] **Step 4: Убедиться, что unit-тест проходит**

Run: `npx vitest run src/rules/availability.test.ts`
Expected: PASS. Если падают соседние тесты — они строят `turn` литералом без `inFight`; дописать `inFight: true` там, где тест про бой, и `inFight: false` там, где про его отсутствие.

- [ ] **Step 5: Написать падающий тест причины у обмена**

В `src/rules/bloodMagic.test.ts` дописать:

```ts
describe("обмен до начала боя (FR-034)", () => {
  it("называет ту же причину, что и заклинание: обмен тратит то же действие", () => {
    const economy = { ...ALL_AVAILABLE_ECONOMY, inFight: false };
    expect(exchangeWarnings(createThorne(), economy)).toContain(
      "Бой не начат — сначала «Начать бой»",
    );
  });

  it("после начала боя причины нет", () => {
    const economy = { ...ALL_AVAILABLE_ECONOMY, inFight: true };
    expect(exchangeWarnings(createThorne(), economy)).not.toContain(
      "Бой не начат — сначала «Начать бой»",
    );
  });
});
```

`ALL_AVAILABLE_ECONOMY` — вспомогательная константа теста; если в файле такой нет, объявить рядом с остальными помощниками:

```ts
/** Экономия хода «всё цело»: тесты обмена интересуются не ходом, а хитами и очками. */
const ALL_AVAILABLE_ECONOMY: TurnEconomy = {
  round: 1,
  started: true,
  inFight: true,
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
  reactionReturns: null,
};
```

- [ ] **Step 6: Убедиться, что тест падает**

Run: `npx vitest run src/rules/bloodMagic.test.ts -t "обмен до начала боя"`
Expected: FAIL — причины в списке нет.

- [ ] **Step 7: Добавить причину в `exchangeWarnings`**

В `src/rules/bloodMagic.ts`, в `exchangeWarnings` после блока подавления и перед проверкой действия:

```ts
  // Та же причина и та же формулировка, что у заклинания (FR-034): обмен тратит то же действие, и
  // два разных текста об одном и том же читались бы как два разных правила.
  if (turnTracked(character) && !economy.inFight) {
    warnings.push(COMBAT_NOT_STARTED_MESSAGE);
  }
```

В `src/rules/availability.ts` вынести формулировку в экспортируемую константу рядом с `ACTION_SPENT_MESSAGES` и использовать её в `checkCombatStarted`:

```ts
/** Одна формулировка на оба мастера: у заклинания и у обмена причина буквально одна (FR-034). */
export const COMBAT_NOT_STARTED_MESSAGE = "Бой не начат — сначала «Начать бой»";
```

Импортировать её в `bloodMagic.ts` из `./availability` рядом с `ACTION_SPENT_MESSAGES`.

- [ ] **Step 8: Убедиться, что тест проходит**

Run: `npx vitest run src/rules/bloodMagic.test.ts src/rules/availability.test.ts`
Expected: PASS.

- [ ] **Step 9: Прогнать весь набор и увидеть список упавших сценариев**

Run: `npm run test`
Expected: FAIL примерно в восемнадцати местах — это сценарии, которые творят заклинание, не начав боя. Список нужен целиком, поэтому прогон делается до правок.

- [ ] **Step 10: Привести упавшие сценарии к настоящему порядку**

В каждом упавшем компонентном тесте, который творит заклинание в режиме «Бой», перед открытием карточки нажать «Начать бой»:

```ts
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
```

В `e2e/uc-01-cast-spell.spec.ts` — то же самое:

```ts
  await page.getByRole("button", { name: "Начать бой" }).click();
```

Два случая правятся иначе, а не нажатием:

- тесты, которые проверяют **саму** новую причину, оставляют бой не начатым и проходят шаг доступности кнопкой «Применить всё равно»;
- тесты в режимах «Книга» и «Вне боя» не трогаются вовсе: там проверка молчит.

Ничего, кроме порядка нажатий, в этих тестах не менять: если тест перестаёт проверять то, ради чего написан, — это не правка теста, а его потеря.

- [ ] **Step 11: Написать тест на сам шаг доступности**

В `src/components/combat/CombatScreen.test.tsx` дописать:

```ts
describe("применение до начала боя (FR-034)", () => {
  it("строка списка называет причину", async () => {
    await renderWithStores(<CombatScreen />);

    const row = screen.getByRole("button", { name: /Луч холода/ });
    expect(within(row).getByText(/Недоступно: Бой не начат/)).toBeDefined();
  });

  it("причина проходится «Применить всё равно» и ячейка списывается", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));

    expect(screen.getByText(/Бой не начат/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: /Применить всё равно/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByLabelText(/Ячейки 1 уровня/).textContent).toContain("3/4");
  });

  it("после «Начать бой» причина уходит", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));

    const row = screen.getByRole("button", { name: /Луч холода/ });
    expect(within(row).queryByText(/Бой не начат/)).toBeNull();
  });
});
```

Точные имена кнопок мастера («Применить всё равно», «Далее», «Подтвердить») сверить с `src/components/cast/CastWizard.tsx` и `src/components/cast/WizardShell.tsx` до запуска: подпись должна браться из компонента, а не из этого плана.

- [ ] **Step 12: Прогнать весь набор**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 13: Прогнать E2E**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 14: Записать требование в спеку**

В `docs/features/F-03-cast-wizard.md` дописать после FR-033:

```markdown
<a id="fr-034"></a>
### FR-034 — Применение до начала боя

**Статус:** Готово · **Проверка:** unit `бой не начат (FR-034)`, `обмен до начала боя (FR-034)`, компонентный `применение до начала боя (FR-034)`

В режиме «Бой», пока бой не отмечен начатым ([FR-140](F-06-resources.md#fr-140)), применение должно
помечаться причиной «Бой не начат — сначала «Начать бой»». Запрета нет: причина проходится кнопкой
«Применить всё равно» ([FR-031](#fr-031)).

Замечание игрока: «мы можем колдовать и делать что-то на вкладке "Бой" даже без старта боя — нам
точно нужно сначала уметь стартовать». Так и было: карточка открывалась, «Сотворить» срабатывало,
ячейка списывалась. Приложение при этом показывало «раунд 1» и три целых ресурса хода — не потому,
что так обстоят дела, а потому, что журналу не от чего было считать. Расхождение всплывало позже,
когда числа переставали сходиться с тем, что называет мастер, и уже нельзя было понять, чьи они.

**Причина, а не запрет.** Бой мог начаться до того, как игрок взял телефон, и заклинание могло
понадобиться раньше, чем кнопка. Так устроены все прочие проверки этой фичи ([FR-031](#fr-031)):
единственное непроходимое предупреждение — замена концентрации, где цена ошибки другая.

**Обмен хитов на очки предупреждает тем же текстом** ([FR-207](F-18-screen-modes.md#fr-207)): он
тратит то же действие, и две формулировки об одном читались бы как два разных правила.

**Вне режима «Бой» проверка молчит.** Ходов там не идёт ([FR-143](F-06-resources.md#fr-143)),
начинать нечего, и причина стояла бы на каждой строке «Книги».

**Шаг мастера появляется и исчезает вместе с боем.** Пока бой не начат, применение занимает на шаг
больше — это и есть подталкивание. После нажатия «Начать бой» шаг уходит, и бюджет
[M-03](../product.md#метрики) в четыре шага остаётся невыбранным.
```

В `docs/features/F-06-resources.md`, в FR-140 дописать в конец:

```markdown
Пока отметки нет, применение помечается причиной ([FR-034](F-03-cast-wizard.md#fr-034)): счёт раундов
и экономия действий до неё ни на чём не основаны.
```

В `docs/features/README.md` строку F-03 привести к `FR-020…023, 030…034, 040…042`.

- [ ] **Step 15: Проверить целостность спеки**

Run: `npm run check:docs`
Expected: `спецификация целостна`.

- [ ] **Step 16: Коммит**

```bash
git add src/rules/availability.ts src/rules/availability.test.ts \
        src/rules/bloodMagic.ts src/rules/bloodMagic.test.ts \
        src/components/ src/store/ e2e/ \
        docs/features/F-03-cast-wizard.md docs/features/F-06-resources.md docs/features/README.md
git commit -m "Flag casting before the fight has started (FR-034)"
```

---

### Task 6: Полная проверка и обновление карты

**Files:**
- Modify: `docs/roadmap.md`
- Modify: `docs/features/README.md` (дата и строка состояния)
- Modify: `docs/superpowers/specs/2026-08-01-book-parity-fight-gate-and-time-labels-design.md` (статус)

- [ ] **Step 1: Прогнать полную проверку**

Run: `npm run check:docs && npm run typecheck && npm run test:coverage && npm run build`
Expected: всё зелёное, покрытие 100 % по движку правил, схемам, состоянию и контенту.

Если покрытие просело — новая ветка осталась без теста. Найти её в отчёте и закрыть тестом, а не порогом.

- [ ] **Step 2: Прогнать E2E**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 3: Посмотреть глазами**

Run: `npm run dev`

Пройти по списку и сверить с ожиданием:

| Что открыть | Что должно быть видно |
|---|---|
| «Бой», бой не начат | на каждой строке «Недоступно: Бой не начат», кнопка «Начать бой» |
| «Бой» после «Начать бой» | причина ушла, список работает как прежде |
| «Книга» | 30 строк: 29 заклинаний и «Магия крови» сразу за заговорами; в шапке «Очки 0» и никаких рун |
| «Книга» → «Подготовлено» | 16 строк: 4 заговора, 11 подготовленных, «Магия крови» |
| «Книга» → «1 ур.» | «Магии крови» нет |
| «Вне боя» | кнопка «Реакции» есть, за ней «Знаки ограждения» |
| Любая карточка | «Накладывать 1 минуту» и «Держится 1 час» различимы словом и контрастом |

- [ ] **Step 4: Обновить дорожную карту**

В `docs/roadmap.md` в разделе «Замечания по первой сборке» дописать абзац о третьей примерке — что она дала и чем закрыта; строку «Обновлено» и строку состояния в шапке привести к сегодняшней дате. В `docs/features/README.md` обновить дату и строку состояния.

В спеке `docs/superpowers/specs/2026-08-01-book-parity-fight-gate-and-time-labels-design.md` заменить `Статус: спроектировано, реализация не начата` на `Статус: реализовано`.

- [ ] **Step 5: Проверить целостность спеки и закоммитить**

```bash
npm run check:docs
git add docs/
git commit -m "Record the fourth fitting in the roadmap"
```

## Самопроверка плана

**Покрытие спеки.** Пять изменений спеки → пять задач: изменение 1 → задача 2, изменение 2 → задача 3, изменение 3 → задача 4, изменение 4 → задача 5, изменение 5 → задача 1. Шестая задача закрывает общий прогон и карту. Раздел спеки «Проверка» — 11 строк; каждая имеет тест в задачах 1-5, кроме двух E2E-замеров, которые выполняются шагами 6 задачи 3 и 13 задачи 5.

**Одно отклонение от спеки, уже внесённое в неё.** Спека обещала длительности собственную иконку `⧗`. При проработке выяснилось, что в краткой карточке длительность стоит не значком, а простым текстом — это и есть выбранный размен, — и иконке негде встать; `durationBadge` при этом возвращал иконку, которую не рисовал ни один компонент. План заменяет `durationBadge` на `durationPhrase`, возвращающую строку, различие несут слово и контраст, а столкновение `◷/◷` исчезает само. Спека исправлена тем же коммитом.

**Слово «Каст» в план не попало намеренно.** Оно стояло в наброске варианта при выборе, но не в спеке: «каст» не входит в [глоссарий](../../glossary.md), а правило проекта — брать слова оттуда. И спека, и план говорят «Накладывать».

**Согласованность имён.** `timeSpanAccusativeRu`, `TimeUnit`, `castingTimePhrase`, `durationPhrase`, `matchesActionRow`, `COMBAT_NOT_STARTED_MESSAGE`, `checkCombatStarted`, поле `inFight` в `TurnResources` — каждое объявлено ровно в одной задаче и используется под тем же именем в остальных.
