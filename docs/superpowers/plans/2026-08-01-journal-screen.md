# Журнал как четвёртый режим экрана — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Журнал становится четвёртым режимом экрана и единственным местом, где отменяют действия.

**Architecture:** `SCREEN_MODES` получает четвёртое значение `journal`. Новый презентационный
компонент `JournalScreen` показывает записи журнала плоским списком, свежее сверху, и даёт кнопку
отмены только на верхней записи. Кнопка «Отменить» уходит из шапки `CombatScreen` во всех режимах.
Состояние, движок отмены и глубина журнала не меняются вовсе — меняется только то, где это видно.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind 4, Zustand, Vitest + Testing
Library, Playwright (WebKit, viewport iPhone SE).

## Global Constraints

- Дизайн-спека: [2026-08-01-journal-screen-design.md](../specs/2026-08-01-journal-screen-design.md).
  Расхождение с ней — ошибка реализации, а не уточнение.
- **Спека — источник истины.** Код без FR не пишется. Задача 1 записывает требования, остальные их
  исполняют.
- **Один коммит — код и спека вместе.** Статус требования правится тем же коммитом, что и код.
- Документация, интерфейс и контент — по-русски. Код, идентификаторы, имена файлов и сообщения
  коммитов — по-английски.
- Имена в коде берутся из [glossary.md](../../glossary.md). Синонимов не заводить.
- Порог покрытия — 100 %. Непокрытая ветка роняет `npm run test:coverage`.
- Зона нажатия — не меньше 44 пикселей: `min-h-11` на каждой кнопке.
- Состояние `apply` — единственная точка изменения ([ADR-0003](../../decisions.md#adr-0003),
  [ADR-0006](../../decisions.md#adr-0006)). Компоненты состояние не трогают.
- Проверка целостности после любой правки `docs/`: `npm run check:docs`.
- Полная проверка перед последним коммитом:
  `npm run check:docs && npm run typecheck && npm run test:coverage && npm run build`.
- **Не коммитить без разрешения игрока.** Шаги «Commit» в этом плане выполняются только если игрок
  сказал коммитить; иначе правки остаются неиндексированными.

---

## Файлы

| Файл | Ответственность | Что с ним делаем |
|---|---|---|
| `docs/decisions.md` | принятые решения | +ADR-0022 |
| `docs/features/F-10-journal-undo.md` | журнал и отмена | +FR-113, +FR-114, правка FR-111 |
| `docs/features/F-18-screen-modes.md` | режимы экрана | +FR-220, правка FR-200, FR-212 |
| `docs/features/README.md` | реестр фич | диапазоны FR у F-10 и F-18 |
| `docs/glossary.md` | связь русского термина и имени в коде | строка про режим «Журнал» |
| `docs/roadmap.md` | состояние на сегодня | абзац «экрана журнала нет» заменяется |
| `docs/quality.md` | матрица трассировки | строки FR-113, FR-114, FR-220 |
| `src/rules/modes.ts` | отбор по режиму | `SCREEN_MODES`, явный case в `belongsToMode` |
| `src/components/combat/ModeSwitcher.tsx` | переключатель | четвёртая метка, прокрутка ряда |
| `src/components/combat/JournalScreen.tsx` | **новый**: список записей и кнопка отмены | создаётся |
| `src/components/combat/CombatScreen.tsx` | сборка экрана | кнопка отмены убирается, журнал рендерится |
| `src/components/combat/ResourceHeader.tsx` | шапка ресурсов | номер раунда в журнале |
| `src/components/combat/SpellFilters.tsx` | полоса фильтров | «Сбросить» не показывается в «Книге» |
| `e2e/uc-01-cast-spell.spec.ts` | сценарии на сборке | прогон отмены через журнал, axe |

Экран журнала кладётся **отдельным компонентом**: `CombatScreen.tsx` — 664 строки, и ветка внутри
него сделала бы файл ещё менее обозримым.

---

## Task 1: Спека — ADR-0022 и требования

Работа начинается с документации, потому что [roadmap.md](../../roadmap.md) сейчас утверждает
обратное тому, что мы делаем. Пока это не исправлено, любой код противоречит спеке.

**Files:**
- Modify: `docs/decisions.md` (в конец, после ADR-0021)
- Modify: `docs/features/F-10-journal-undo.md`
- Modify: `docs/features/F-18-screen-modes.md:47-56` (FR-200), `:332-347` (FR-212)
- Modify: `docs/features/README.md:24,32`
- Modify: `docs/glossary.md`
- Modify: `docs/roadmap.md:47-49`

**Interfaces:**
- Produces: идентификаторы `FR-113`, `FR-114`, `FR-220`, `ADR-0022` и якоря `#fr-113`, `#fr-114`,
  `#fr-220`, `#adr-0022`. Все последующие задачи ссылаются на них из комментариев в коде.

- [ ] **Step 1: Записать ADR-0022 в конец `docs/decisions.md`**

```markdown
## ADR-0022

### Журнал становится экраном, а отмена живёт только в нём

**Статус:** Принято · 2026-08-01

**Контекст.** Отмена стоит кнопкой в шапке и отменяет последнюю запись журнала. Что именно вернётся,
на экране не написано: название последнего события лежит только в `aria-label`, а игрок видит слово
«Отменить» и жмёт его на веру. Роадмап при этом прямо утверждал, что отдельного места журналу не
нужно: «отмена живёт кнопкой рядом с ходом, а журнал глубиной 100 — механизм обратимости, а не
история кампании».

Замечание игрока после четвёртой примерки: журнал нужен и чтобы отменять осознанно, и чтобы
ориентироваться — «что я успел», «когда сгорела ячейка», «отдыхали или нет».

**Варианты.**

1. **Оставить кнопку в шапке, добавить подпись с последним событием.** Дёшево, но ряд шапки на
   iPhone SE — пятая часть карточки, а на вопрос «что было до этого» подпись не отвечает.
2. **Лист поверх экрана, как «Реакции».** Не меняет режимы, но лист — место для одной операции, а
   журнал просматривают.
3. **Четвёртый режим экрана.** Выбран.

**Решение.** Журнал становится четвёртым режимом переключателя наравне с «Боем», «Вне боя» и
«Книгой». Кнопка отмены уходит из шапки во всех режимах: отменяют только в журнале, где видно, что
именно отменяется.

**Следствия.**

- Отмена в бою стоит двух касаний вместо одного плюс возврат в «Бой». Размен принят сознательно:
  слепое нажатие дороже.
- [FR-112](features/F-10-journal-undo.md#fr-112) не отменяется. Глубина 100 и вытеснение остаются,
  журнал не становится логом кампании: вытесненного экран показать не может и не обещает.
- [FR-111](features/F-10-journal-undo.md#fr-111) не меняется по существу — отменяется по-прежнему
  только последнее действие.
- Уход в «Журнал» бой не заканчивает: `inFight` и номер раунда выводятся из записей журнала, а не из
  режима экрана ([ADR-0008](#adr-0008)).
```

- [ ] **Step 2: Дописать FR-113 и FR-114 в `docs/features/F-10-journal-undo.md`**

Вставить после FR-112, перед разделом «Поведение и крайние случаи»:

```markdown
<a id="fr-113"></a>
### FR-113 — Экран журнала

**Статус:** План · **Проверка:** компонентные прогоны экрана журнала — порядок записей, кнопка только на верхней, пустой журнал

Система должна показывать журнал отдельным экраном — режимом «Журнал»
([FR-220](F-18-screen-modes.md#fr-220)).

Список плоский, свежее сверху: отменяемая запись всегда первая и не требует прокрутки. Строка
называет событие и время в формате «ЧЧ:ММ».

Кнопка отмены стоит только на верхней записи. На остальных её нет: отменяется лишь последнее
действие ([FR-111](#fr-111)), а кнопка, обещающая недоступное, — обещание несуществующего
([FR-002](F-01-combat-screen.md#fr-002)).

Пустой журнал говорит, что ничего не произошло, и кнопки не показывает.

<a id="fr-114"></a>
### FR-114 — Отмена только из журнала

**Статус:** План · **Проверка:** компонентный прогон об отсутствии кнопки отмены в остальных режимах, E2E-прогон отмены через журнал

Кнопки отмены не должно быть нигде, кроме режима «Журнал».

Одно действие — одно место. Кнопка в шапке отменяла вслепую: игрок видел слово «Отменить», а что
вернётся — нет. Решение записано в [ADR-0022](../decisions.md#adr-0022) вместе с ценой: в бою отмена
стоит двух касаний вместо одного.
```

- [ ] **Step 3: Поправить FR-111 и «Поведение» в том же файле**

В FR-111 после строки «Пользователь должен иметь возможность отменить последнее действие.» дописать
абзац:

```markdown
Кнопка отмены живёт в режиме «Журнал» и нигде больше ([FR-114](#fr-114)).
```

В разделе «Поведение и крайние случаи» абзац **«Отмена только последнего»** дополнить фразой:

```markdown
Многократное нажатие отменяет по одному действию назад: экран журнала при этом не закрывается, и
после каждой отмены видно, что осталось.
```

- [ ] **Step 4: Дописать FR-220 в `docs/features/F-18-screen-modes.md`**

Вставить в конец раздела требований, после FR-219:

```markdown
<a id="fr-220"></a>
### FR-220 — Режим «Журнал»

**Статус:** План · **Проверка:** unit-прогон отбора по режиму, компонентные прогоны состава экрана и шапки журнала

Четвёртый режим должен называться **«Журнал»** и содержать только записи журнала и отмену
([FR-113](F-10-journal-undo.md#fr-113)). Списка заклинаний, полосы фильтров, кнопок хода и кнопки
«Реакции» в нём нет.

Шапка режима ведёт себя как во «Вне боя»: хиты, КД, КС и атака, ячейки, руны, очки, кости хитов,
концентрация и активные эффекты на месте, значков экономии хода нет. Полная шапка — по доводу
[FR-217](#fr-217): отмена меняет именно эти числа, и её результат обязан быть виден там же, где
нажали кнопку.

Номер раунда показывается, пока бой идёт: в отличие от «Вне боя» журнал открывают посреди боя, чтобы
понять, что уже случилось, и номер отвечает на тот же вопрос.

**Ряд переключателя прокручивается по горизонтали.** Кнопок стало четыре, и они больше не делят
ширину поровну. На iPhone SE четыре коротких слова помещаются без прокрутки; прокрутка — запас, а не
обычный способ работы: режим за краем экрана — режим, которого для игрока нет.

**Уход в «Журнал» бой не заканчивает.** Признак «бой идёт» и номер раунда выводятся из записей
журнала, а не из режима ([ADR-0008](../decisions.md#adr-0008)), поэтому возврат в «Бой» застаёт тот
же раунд и то же потраченное.
```

- [ ] **Step 5: Поправить FR-200 и FR-212 в том же файле**

Заголовок FR-200 «### FR-200 — Три режима» заменить на «### FR-200 — Режимы экрана».

Первый абзац FR-200 заменить на:

```markdown
Система должна работать в четырёх режимах: **Бой**, **Вне боя**, **Книга**, **Журнал**. Режим
определяет состав списка заклинаний, состав шапки и набор доступных операций.
```

Во втором абзаце FR-200 фразу «Фильтр сужает список внутри режима и снимается кнопкой «Сбросить»»
заменить на «Фильтр сужает список внутри режима и снимается повторным нажатием».

В FR-212 фразу «„Сбросить“ появляется, только когда есть что сбрасывать.» заменить абзацем:

```markdown
**Кнопки «Сбросить» в «Книге» нет.** Решение игрока: переключателей там немного, и снять их проще
повторным нажатием, чем держать в полосе кнопку ради редкого случая. В «Бою» она остаётся — там
полосу оглядывают под чужой ход, и разбирать три переключателя по одному в этот момент некогда.
Появляется она по-прежнему, только когда есть что сбрасывать.
```

- [ ] **Step 6: Поправить реестр, глоссарий и роадмап**

В `docs/features/README.md` в таблице «Состав MVP»:

- строка F-10: `FR-110…112` → `FR-110…114`;
- строка F-18: `FR-200…219` → `FR-200…220`.

В `docs/glossary.md` рядом со строкой «Журнал боя» добавить:

```markdown
| Режим «Журнал» | `journal`, `JournalScreen` | Экран, где видны записи журнала и живёт отмена. Четвёртый режим наравне с боем, «Вне боя» и книгой |
```

В `docs/roadmap.md` абзац «Экрана журнала как отдельного места нет и не планируется…» заменить на:

```markdown
Журнал получил собственный экран — четвёртый режим наравне с «Боем», «Вне боя» и «Книгой»
([ADR-0022](decisions.md#adr-0022)). Прежнее решение было обратным, и заменено оно замечанием
игрока: отмена кнопкой в шапке срабатывала вслепую — что именно вернётся, на экране не было написано
нигде. Глубина 100 при этом не изменилась: журнал остался механизмом обратимости, а не историей
кампании ([FR-112](features/F-10-journal-undo.md#fr-112)).
```

- [ ] **Step 7: Проверить целостность спеки**

Run: `npm run check:docs`
Expected: `спецификация целостна`. Частые причины падения: не проставлен якорь `<a id="fr-113"></a>`,
диапазон в реестре не покрывает новый номер, ссылка на несуществующий якорь.

**Почему в строках «Проверка» нет имён прогонов в обратных кавычках.** Седьмое правило
`check-docs.py` требует, чтобы каждое имя в обратных кавычках уже встречалось в `src/**` или
`e2e/*.spec.ts`: строка, называющая несуществующий прогон, читается как доказательство. На этом шаге
прогонов ещё нет, поэтому проверка описывается словами. Точные имена подставит задача 6 — тем же
шагом, которым переводит статусы в «Готово».

- [ ] **Step 8: Commit**

```bash
git add docs/
git commit -m "docs: make the journal a screen mode and the only place to undo (ADR-0022)"
```

---

## Task 2: Четвёртый режим в правилах и переключателе

`SCREEN_MODES` и `ModeSwitcher` меняются одной задачей вынужденно: метки в переключателе объявлены
как `Record<ScreenMode, …>`, и добавление значения без метки не проходит `tsc`.

**Files:**
- Modify: `src/rules/modes.ts:23`, `:51-60`
- Modify: `src/components/combat/ModeSwitcher.tsx:21-26`, `:38-42`, `:50-58`
- Test: `src/rules/modes.test.ts`

**Interfaces:**
- Produces: `ScreenMode` со значением `"journal"`; `belongsToMode(spell, "journal") === false`;
  кнопка переключателя с доступным именем `Журнал: что случилось и что можно отменить`.

- [ ] **Step 1: Написать падающий тест отбора**

Дописать в `src/rules/modes.test.ts`:

```ts
it("журнал — списка заклинаний нет (FR-220)", () => {
  const spells = loadThorneSpells();

  expect(spellsForMode(spells, "journal")).toEqual([]);
});
```

Если `loadThorneSpells` и `spellsForMode` в файле ещё не импортированы — добавить их в существующие
импорты, новых строк импорта не заводить.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/modes.test.ts -t "журнал"`
Expected: FAIL. Ошибка типов на строке `"journal"` — значения ещё нет в `ScreenMode`.

- [ ] **Step 3: Добавить режим в правила**

В `src/rules/modes.ts` строку 23 заменить на:

```ts
export const SCREEN_MODES = ["combat", "camp", "book", "journal"] as const;
```

В шапке-комментарии файла первое предложение «Экран один, а ситуаций три, и они хотят разного: в бою
— то, что творится внутри хода; вне боя — отдых и восстановление без единого заклинания; в книге —
всё подряд, для чтения, сверки и применения не под таймер.» заменить на:

```
 * Экран один, а ситуаций четыре, и они хотят разного: в бою — то, что творится внутри хода; вне боя
 * — отдых и восстановление без единого заклинания; в книге — всё подряд, для чтения, сверки и
 * применения не под таймер; в журнале — случившееся и отмена лишнего.
```

В `belongsToMode` добавить явную ветку — **это обязательный шаг, а не уборка**: функция кончается
`default: return true`, и без ветки журнал показал бы всю книгу.

```ts
export function belongsToMode(spell: Spell, mode: ScreenMode): boolean {
  switch (mode) {
    case "combat":
      return castableWithinTurn(spell);
    // Вне боя и в журнале списка нет вовсе: там отдыхают и разбирают случившееся (FR-202, FR-220).
    case "camp":
    case "journal":
      return false;
    default:
      return true;
  }
}
```

- [ ] **Step 4: Добавить метку и прокрутку в переключатель**

В `src/components/combat/ModeSwitcher.tsx` дописать четвёртую метку в `LABELS`:

```ts
  journal: { title: "Журнал", hint: "что случилось и что можно отменить" },
```

Заменить `className` контейнера на:

```tsx
      className="flex flex-nowrap gap-1 overflow-x-auto rounded-xl bg-slate-100 p-0.5 dark:bg-slate-900"
```

В кнопке заменить `flex-1` на `shrink-0 grow basis-auto`:

```tsx
            className={`min-h-11 shrink-0 grow basis-auto rounded-lg px-2 text-sm font-medium ${
```

Дописать в комментарий-шапку компонента абзац:

```
 * Кнопок четыре, и ряд прокручивается по горизонтали (FR-220): равная ширина на четверых сжала бы
 * «Вне боя» до переноса. Кнопки растут по содержимому и не сжимаются — на iPhone SE четыре коротких
 * слова помещаются целиком, а прокрутка остаётся запасом.
```

- [ ] **Step 5: Убедиться, что тест проходит**

Run: `npx vitest run src/rules/modes.test.ts && npm run typecheck`
Expected: PASS, `tsc` без ошибок.

Схему персонажа править не нужно: `screenMode` объявлен как `z.enum(SCREEN_MODES)`
([character.ts:138](../../../src/data/schemas/character.ts)) и расширяется вместе с массивом. Старые
сохранённые состояния остаются валидными — значение только добавилось (NFR-003).

- [ ] **Step 6: Commit**

```bash
git add src/rules/modes.ts src/rules/modes.test.ts src/components/combat/ModeSwitcher.tsx
git commit -m "feat: add the journal screen mode to rules and the mode switcher (FR-220)"
```

---

## Task 3: Компонент JournalScreen

**Files:**
- Create: `src/components/combat/JournalScreen.tsx`
- Test: `src/components/combat/JournalScreen.test.tsx`

**Interfaces:**
- Consumes: `JournalEntry` из `@/store/session` — поля `id`, `at` (ISO-строка), `summaryRu`.
- Produces: `JournalScreen({ entries, onUndo })`, где `entries: readonly JournalEntry[]` в порядке
  хранения (старое первым), `onUndo: () => void`. Список получает
  `aria-label="Журнал событий"`, кнопка отмены — `aria-label={`Отменить: ${summaryRu}`}`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/components/combat/JournalScreen.test.tsx`:

```tsx
// @vitest-environment jsdom

/**
 * Экран журнала (FR-113) проверяется отдельно от экрана боя: компонент презентационный, записи
 * подаются параметром, и обе стороны каждого условия видны сразу — пустой журнал на настоящем
 * состоянии пришлось бы ещё добыть.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JournalScreen } from "@/components/combat/JournalScreen";
import type { JournalEntry } from "@/store/session";

afterEach(cleanup);

function entry(id: string, summaryRu: string): JournalEntry {
  return { id, at: "2026-07-31T18:00:00.000Z", kind: "spell_cast", summaryRu, undoPatch: {} };
}

describe("экран журнала (FR-113)", () => {
  it("свежее сверху", () => {
    render(
      <JournalScreen
        entries={[entry("id-1", "Бой начался"), entry("id-2", "Огненный шар — ячейка 3 уровня")]}
        onUndo={() => {}}
      />,
    );

    const rows = within(screen.getByRole("list", { name: "Журнал событий" })).getAllByRole(
      "listitem",
    );
    expect(rows[0]?.textContent).toContain("Огненный шар");
    expect(rows[1]?.textContent).toContain("Бой начался");
  });

  it("кнопка отмены только на верхней записи", () => {
    render(
      <JournalScreen
        entries={[entry("id-1", "Бой начался"), entry("id-2", "Огненный шар — ячейка 3 уровня")]}
        onUndo={() => {}}
      />,
    );

    // Одна кнопка на весь список: отменяется только последнее (FR-111), и кнопка на остальных
    // записях обещала бы недоступное.
    expect(screen.getAllByRole("button", { name: /^Отменить/ })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Отменить: Огненный шар — ячейка 3 уровня" }),
    ).toBeDefined();
  });

  it("нажатие зовёт отмену", async () => {
    const onUndo = vi.fn();
    render(<JournalScreen entries={[entry("id-1", "Бой начался")]} onUndo={onUndo} />);

    await userEvent.click(screen.getByRole("button", { name: /^Отменить/ }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("строка называет время", () => {
    render(<JournalScreen entries={[entry("id-1", "Бой начался")]} onUndo={() => {}} />);

    // Час не сверяется с числом: он зависит от часового пояса прогона, а проверяется здесь формат.
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeDefined();
  });

  it("пустой журнал объясняет, а не показывает кнопку", () => {
    render(<JournalScreen entries={[]} onUndo={() => {}} />);

    expect(screen.getByText("Пока ничего не произошло.")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/combat/JournalScreen.test.tsx`
Expected: FAIL — модуль `JournalScreen` не найден.

- [ ] **Step 3: Написать компонент**

Создать `src/components/combat/JournalScreen.tsx`:

```tsx
/**
 * Экран журнала (FR-113) — единственное место, где отменяют (FR-114, ADR-0022).
 *
 * Список плоский и свежее сверху: отменяемая запись всегда первая и не требует прокрутки. Кнопка
 * стоит только на ней — отменяется лишь последнее действие (FR-111), а кнопка на остальных записях
 * была бы обещанием несуществующего.
 *
 * Компонент презентационный: записи приходят параметром, отмена — обратным вызовом. Состояние он не
 * трогает, как и остальные компоненты экрана (ADR-0003).
 */

import type { JournalEntry } from "@/store/session";

/**
 * Время записи как «ЧЧ:ММ». Дата не показывается: журнал глубиной 100 живёт одну игру за столом, а
 * второй строкой на iPhone SE платят ровно ничем не оправданной подробностью (FR-112).
 */
function timeRu(at: string): string {
  const at_ = new Date(at);
  const hours = `${at_.getHours()}`.padStart(2, "0");
  const minutes = `${at_.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function JournalScreen({
  entries,
  onUndo,
}: {
  /** Записи в порядке хранения: старое первым, как их держит журнал. */
  entries: readonly JournalEntry[];
  onUndo: () => void;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">Пока ничего не произошло.</p>;
  }

  const newestFirst = [...entries].reverse();

  return (
    <ul aria-label="Журнал событий" className="flex flex-col gap-2">
      {newestFirst.map((entry, index) => (
        <li
          key={entry.id}
          className="flex flex-col gap-1 rounded-lg border border-slate-200 p-2 dark:border-slate-800"
        >
          <span className="text-sm leading-tight">{entry.summaryRu}</span>
          <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
            {timeRu(entry.at)}
          </span>
          {index === 0 ? (
            <button
              type="button"
              onClick={onUndo}
              aria-label={`Отменить: ${entry.summaryRu}`}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
            >
              Отменить
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/JournalScreen.test.tsx`
Expected: PASS, все пять.

- [ ] **Step 5: Commit**

```bash
git add src/components/combat/JournalScreen.tsx src/components/combat/JournalScreen.test.tsx
git commit -m "feat: add the journal screen component (FR-113)"
```

---

## Task 4: Экран — отмена уезжает в журнал

Самая большая задача: кнопка исчезает из шапки, журнал встаёт на место списка, и вместе с этим
ломаются девять существующих проверок, которые отменяли из шапки. Они переписываются здесь же —
иначе задача оставит красные тесты.

**Files:**
- Modify: `src/components/combat/CombatScreen.tsx:193-194`, `:244`, `:384-406`, `:428`, `:448`
- Modify: `src/components/combat/ResourceHeader.tsx:147`, `:166`
- Test: `src/components/combat/CombatScreen.test.tsx:139`, `:482`, `:1009`, `:1196-1204`
- Test: `src/components/combat/Concentration.test.tsx:101`, `:167`, `:192`, `:205`, `:243`

**Interfaces:**
- Consumes: `JournalScreen({ entries, onUndo })` из задачи 3; режим `"journal"` из задачи 2.
- Produces: доступное имя кнопки переключателя `Журнал: что случилось и что можно отменить` —
  на него опираются тесты и E2E-прогон задачи 6.

- [ ] **Step 1: Написать падающие тесты экрана**

Дописать в `src/components/combat/CombatScreen.test.tsx` новый блок в конец файла:

```tsx
describe("режим «Журнал» (FR-114, FR-220)", () => {
  /** Уйти в журнал: кнопка переключателя названа по режиму и подсказке. */
  async function openJournal(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
  }

  it("в «Бою», «Вне боя» и «Книге» кнопки отмены нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, withTurnTracking());
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Вне боя/ }));
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });

  it("переключение в «Журнал» показывает записи", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, withTurnTracking());

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await openJournal(user);

    expect(
      within(screen.getByRole("list", { name: "Журнал событий" })).getByText(/Бой начался/),
    ).toBeDefined();
  });

  it("отмена из журнала возвращает потраченную ячейку", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />, withTurnTracking());

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);

    await openJournal(user);
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
    // Экран не закрылся: кнопка переехала на запись «Бой начался», и её тоже можно отменить.
    expect(screen.getByRole("button", { name: "Отменить: Бой начался" })).toBeDefined();
  });

  it("списка, фильтров и кнопок хода в журнале нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, withTurnTracking());

    await openJournal(user);

    expect(screen.queryByLabelText("Фильтры")).toBeNull();
    expect(screen.queryByRole("list", { name: /Заклинания/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Реакции" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Мой ход" })).toBeNull();
  });

  it("шапка журнала показывает ячейки и не показывает экономию хода (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, withTurnTracking());

    await openJournal(user);

    expect(within(screen.getByLabelText("Ячейки заклинаний")).getByText("4/4")).toBeDefined();
    expect(screen.queryByLabelText("Действие доступно")).toBeNull();
  });

  it("номер раунда виден в журнале, пока бой идёт (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, withTurnTracking());

    // Бой не начат — раунда нет: считать не от чего, и число было бы выдумкой.
    await openJournal(user);
    expect(screen.queryByText(/раунд/)).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Бой/ }));
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await openJournal(user);

    expect(screen.getByText(/раунд 1/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx -t "Журнал"`
Expected: FAIL — кнопки переключателя «Журнал» ещё нет в разметке экрана (задача 2 добавила метку, но
экран пока рендерит список и кнопку отмены по-старому). Первым упадёт `в «Бою», «Вне боя» и «Книге»
кнопки отмены нет`: кнопка в шапке ещё на месте.

- [ ] **Step 3: Убрать кнопку отмены и подключить журнал в `CombatScreen.tsx`**

Добавить импорт рядом с остальными импортами компонентов:

```tsx
import { JournalScreen } from "@/components/combat/JournalScreen";
```

После строки `const preparing = character.screenMode === "book";` дописать:

```tsx
  // Журнал — экран одной задачи (FR-220): ни списка, ни фильтров, ни кнопок хода. Список есть ровно
  // там, где есть что выбирать, — в «Бою» и в «Книге».
  const showsSpellList = character.screenMode === "combat" || character.screenMode === "book";
```

Заменить условие `bloodShown` (строки 193-194):

```tsx
  const bloodShown = showsSpellList && matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
```

Удалить строку `const lastEntry = session.journal.at(-1);` — после удаления кнопки она не нужна.

Удалить блок кнопки «Отменить» целиком (`<button … disabled={lastEntry === undefined} …>Отменить</button>`).

Заменить условие показа кнопки «Реакции» с `character.screenMode !== "book"` на:

```tsx
          {character.screenMode === "combat" || character.screenMode === "camp" ? (
```

Заменить условие полосы фильтров с `character.screenMode === "camp" ? null : (` на:

```tsx
      {showsSpellList ? (
```

— и закрывающую скобку блока привести к `) : null}`.

В прокручиваемой области заменить условие списка с `character.screenMode === "camp" ? null : (` на
два соседних блока:

```tsx
        {character.screenMode === "journal" ? (
          <JournalScreen entries={session.journal} onUndo={() => apply(undoLast)} />
        ) : null}

        {showsSpellList ? (
```

— и закрывающую скобку списка привести к `) : null}`.

В комментарии-шапке `CombatScreen.tsx` дописать абзац:

```
 * Отмены на этом экране нет: она живёт в режиме «Журнал» и только там (FR-114, ADR-0022). Прежняя
 * кнопка в шапке отменяла вслепую — что вернётся, было написано только в доступном имени.
```

- [ ] **Step 4: Показать номер раунда в журнале — `ResourceHeader.tsx`**

Рядом со строкой `const inBook = character.screenMode === "book";` дописать:

```tsx
  const inJournal = character.screenMode === "journal";
```

Заменить выражение с номером раунда:

```tsx
            {turnTracked(character) || (inJournal && economy.inFight) ? ` · раунд ${economy.round}` : ""}
```

Комментарий над строкой заменить на:

```tsx
          {/*
            Счётчик раундов — в бою и в журнале, пока бой идёт (FR-220). Вне боя раундов не идёт, и
            число застыло бы; журнал же открывают посреди боя, и «какой сейчас раунд» — тот же
            вопрос, ради которого туда пришли.
          */}
```

- [ ] **Step 5: Проверить, что новые тесты прошли**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx -t "Журнал"`
Expected: PASS, все шесть.

- [ ] **Step 6: Переписать сломанные проверки в `CombatScreen.test.tsx`**

Прогнать файл целиком и убедиться, что падают ровно четыре места:

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx`
Expected: FAIL в тестах `отмена применения возвращает КД к 14`, `руны правятся вручную и правка
обратима (FR-111)`, `отмена возвращает потраченную ячейку`, `значок очков и кнопка отмены остаются…`.

Правки:

1. В `отмена применения возвращает КД к 14` (строка ~139) перед нажатием отмены уйти в журнал, а
   после — вернуться в бой, потому что проверяемое число живёт в шапке обоих режимов:

```tsx
    await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));
    expect(within(numbers).getByText("14")).toBeDefined();
```

2. В `руны правятся вручную и правка обратима (FR-111)` (строка ~482) заменить нажатие отмены на:

```tsx
    await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));
```

3. Тест `отмена возвращает потраченную ячейку` (строка ~998) удалить целиком: его заменил
   `отмена из журнала возвращает потраченную ячейку` из шага 1, проверяющий то же самое на новом
   пути.

4. Тест `значок очков и кнопка отмены остаются: обе — решение игрока, а не недоделка` (строка ~1196)
   переименовать и оставить в нём только значок очков — кнопка отмены из «Книги» ушла по FR-114:

```tsx
  it("значок очков остаётся: это решение игрока, а не недоделка", async () => {
    await renderWithStores(<CombatScreen />, inBookMode());

    expect(
      within(screen.getByRole("region", { name: "Ресурсы" })).getByText(/Очки 0/),
    ).toBeDefined();
    // Кнопки отмены здесь больше нет: отменяют только в журнале (FR-114).
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });
```

- [ ] **Step 7: Переписать пять проверок в `Concentration.test.tsx`**

Все пять проверяют, что событие попало в журнал, через доступное имя кнопки отмены. Путь к нему
удлинился на одно нажатие. Перед **каждой** из пяти проверок (строки ~101, ~167, ~192, ~205, ~243)
вставить переход в журнал:

```tsx
    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
```

Само утверждение не меняется: имя кнопки в журнале то же — `Отменить: <событие>`. В проверке на
строке ~167 переход вставляется **после** утверждений о карточке концентрации и диалоге: они
относятся к прежнему экрану.

Дописать в шапку файла абзац:

```
 * Записи журнала проверяются через экран журнала: отмена живёт только там (FR-114), и доступное имя
 * кнопки — то же самое «Отменить: <событие>».
```

- [ ] **Step 8: Прогнать всё и проверить покрытие**

Run: `npm run typecheck && npm run test:coverage`
Expected: PASS, покрытие 100 %. Если непокрытой окажется ветка `entries.length === 0` в
`JournalScreen` — она закрыта тестом задачи 3; если ветка `inJournal && economy.inFight` — её
закрывает `номер раунда виден в журнале, пока бой идёт`.

- [ ] **Step 9: Commit**

```bash
git add src/components/combat/CombatScreen.tsx src/components/combat/ResourceHeader.tsx src/components/combat/CombatScreen.test.tsx src/components/combat/Concentration.test.tsx
git commit -m "feat: move undo out of the header into the journal mode (FR-114, FR-220)"
```

---

## Task 5: «Сбросить» уходит из «Книги»

**Files:**
- Modify: `src/components/combat/SpellFilters.tsx:95-104`, `:181-189`
- Test: `src/components/combat/SpellFilters.test.tsx:166-178`

**Interfaces:**
- Consumes: параметр `mode: ScreenMode`, уже приходящий в компонент.
- Produces: поведение — кнопка `Сбросить` есть в «Бою», нет в «Книге». Параметр `onReset`
  сохраняется: в «Бою» он по-прежнему вызывается.

- [ ] **Step 1: Переписать блок тестов «Сбросить»**

Заменить существующий `describe("«Сбросить» появляется, когда есть что сбрасывать", …)` (строки
166-178) на:

```tsx
describe("«Сбросить» — только в бою (FR-212)", () => {
  it("без выбранного фильтра кнопки нет и в бою", () => {
    renderFilters(EVERYTHING, { mode: "combat" });

    expect(screen.queryByRole("button", { name: "Сбросить" })).toBeNull();
  });

  it("в бою с выбранным фильтром кнопка есть", () => {
    renderFilters(EVERYTHING, { mode: "combat", filters: { ...NO_FILTERS, concentration: true } });

    expect(screen.getByRole("button", { name: "Сбросить" })).toBeDefined();
  });

  it("в «Книге» кнопки нет даже с выбранным фильтром", () => {
    // Решение игрока: переключателей немного, и снять их проще повторным нажатием.
    renderFilters(EVERYTHING, { mode: "book", filters: { ...NO_FILTERS, concentration: true } });

    expect(screen.queryByRole("button", { name: "Сбросить" })).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что третий тест падает**

Run: `npx vitest run src/components/combat/SpellFilters.test.tsx -t "Книге"`
Expected: FAIL — кнопка находится, ожидался `null`.

- [ ] **Step 3: Убрать кнопку в «Книге»**

В `src/components/combat/SpellFilters.tsx` заменить комментарий над `anySelected` на:

```tsx
  // «Сбросить» живёт только в бою (FR-212): там полосу оглядывают под чужой ход, и снимать
  // переключатели по одному в этот момент некогда. В «Книге» их немного и время есть — кнопка
  // забирала бы место в полосе ради редкого случая. Появляется она по-прежнему, только когда есть
  // что сбрасывать: кнопка, которая ничего не делает, обещает действие (FR-002).
  const resettable =
    inCombat &&
    (filters.castingTimes.length > 0 ||
```

— то есть выражение `anySelected` переименовывается в `resettable` и получает `inCombat &&` первым
слагаемым. Остальные условия и скобки не меняются.

Заменить использование в разметке:

```tsx
        {resettable ? (
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/components/combat/SpellFilters.test.tsx && npm run typecheck`
Expected: PASS.

Кнопку «Сбросить фильтры» из пустого списка в `CombatScreen.tsx` **не трогать**: это другая кнопка и
другой случай — выход из тупика, когда под фильтры не подошло ничего. Она остаётся во всех режимах,
где есть список.

- [ ] **Step 5: Commit**

```bash
git add src/components/combat/SpellFilters.tsx src/components/combat/SpellFilters.test.tsx
git commit -m "feat: drop the reset-filters button in book mode (FR-212)"
```

---

## Task 6: E2E, матрица трассировки и статусы

**Files:**
- Modify: `e2e/uc-01-cast-spell.spec.ts` (новый прогон + добавление в прогон axe)
- Modify: `docs/quality.md` (матрица трассировки)
- Modify: `docs/features/F-10-journal-undo.md`, `docs/features/F-18-screen-modes.md` (статусы)
- Modify: `docs/features/README.md` (шапка реестра)

**Interfaces:**
- Consumes: доступные имена из задач 3 и 4 — радио `Журнал: …`, список `Журнал событий`, кнопка
  `Отменить: <событие>`.

- [ ] **Step 1: Написать E2E-прогон отмены через журнал**

Дописать в `e2e/uc-01-cast-spell.spec.ts` после прогона о применении заклинания:

```ts
test("undo returns the slot through the journal screen", async ({ page }) => {
  const slots = page.getByLabel("Ячейки заклинаний");

  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(slots.getByText("3/4")).toBeVisible();

  // Отмена живёт только в журнале (FR-114): в бою кнопки нет вовсе.
  await expect(page.getByRole("button", { name: /^Отменить/ })).toBeHidden();
  await switchMode(page, /^Журнал/);
  await page.getByRole("button", { name: /^Отменить/ }).click();
  await expect(slots.getByText("4/4")).toBeVisible();

  // Возврат в бой застаёт тот же бой: журнал его не заканчивает (FR-220).
  await switchMode(page, /^Бой/);
  await expect(page.getByRole("button", { name: "Мой ход" })).toBeVisible();
});
```

- [ ] **Step 2: Добавить журнал в прогон axe**

В тесте `combat screen, spell card and wizard pass axe-core` после проверки экрана реакций дописать:

```ts
  await switchMode(page, /^Журнал/);
  await expect(page.getByRole("list", { name: "Журнал событий" })).toBeVisible();
  await scan("экран журнала");
```

- [ ] **Step 3: Прогнать E2E**

Run: `npm run test:e2e`
Expected: PASS. Сборка выполняется этой же командой, поэтому шаг заодно проверяет `next build`.

- [ ] **Step 4: Дописать строки в матрицу трассировки `docs/quality.md`**

В таблицу «Матрица трассировки» после строки FR-112 и после FR-219 добавить:

```markdown
| FR-113 | — | `свежее сверху`, `кнопка отмены только на верхней записи`, `пустой журнал объясняет, а не показывает кнопку` | — | AC-17 |
| FR-114 | — | `в «Бою», «Вне боя» и «Книге» кнопки отмены нет` | `undo returns the slot through the journal screen` | AC-17 |
| FR-220 | `журнал — списка заклинаний нет (FR-220)` | `переключение в «Журнал» показывает записи`, `шапка журнала показывает ячейки и не показывает экономию хода (FR-220)` | `undo returns the slot through the journal screen` | AC-14 |
```

- [ ] **Step 5: Перевести статусы требований в «Готово» и назвать прогоны**

Задача 1 оставила строки «Проверка» без имён прогонов: седьмое правило `check-docs.py` требует,
чтобы имя в обратных кавычках уже существовало в коде, а прогонов тогда не было. Теперь они есть, и
строки заменяются целиком.

В `docs/features/F-10-journal-undo.md`:

```markdown
**Статус:** Готово · **Проверка:** компонентный `свежее сверху`, `кнопка отмены только на верхней записи`, `пустой журнал объясняет, а не показывает кнопку`
```

— это строка FR-113. Строка FR-114:

```markdown
**Статус:** Готово · **Проверка:** компонентный `в «Бою», «Вне боя» и «Книге» кнопки отмены нет`, E2E `undo returns the slot through the journal screen`
```

В `docs/features/F-18-screen-modes.md` строка FR-220:

```markdown
**Статус:** Готово · **Проверка:** unit `журнал — списка заклинаний нет (FR-220)`, компонентный `переключение в «Журнал» показывает записи`, `шапка журнала показывает ячейки и не показывает экономию хода (FR-220)`
```

Имена прогонов приводятся дословно, как они записаны в коде: `npm run check:docs` сверяет их со
всеми файлами `src/**` и `e2e/*.spec.ts` и падает на выдуманном имени.

**Вернуть в «Готово» то, что задача 1 перевела в «В работе».** Пока кода не было, требования,
описывающие несуществующее поведение, стояли «В работе» — правило проекта видно на F-03. Теперь код
есть, и статусы возвращаются:

- `docs/features/F-18-screen-modes.md`: FR-200 и FR-212 → `**Статус:** Готово`;
- `docs/features/F-10-journal-undo.md:3`: шапка файла → `Статус: Готово`;
- `docs/features/README.md`: строки F-10 и F-18 → колонка статуса `Готово`.

В шапках обоих файлов фич обновить строку `> Обновлено:` на `2026-08-02`. Диапазоны требований в
шапках (`FR-110…FR-114`, `FR-200…FR-220`) уже проставлены задачей 1 — проверить и не трогать, если
верны.

В шапке `docs/features/README.md` обновить строку «Обновлено» и приписку о состоянии.

- [ ] **Step 6: Полная проверка**

Run: `npm run check:docs && npm run typecheck && npm run test:coverage && npm run build`
Expected: всё зелёное, покрытие 100 %.

- [ ] **Step 7: Commit**

```bash
git add docs/ e2e/
git commit -m "test: cover the journal screen end to end and trace the new requirements"
```

---

## Что в работе не делается

- Откат до выбранной записи и повтор отменённого (`redo`).
- Заголовки раундов, фильтр по типу события, поиск по журналу.
- Расшифровка `undoPatch` словами («отмена вернёт ячейку 3 уровня, действие, концентрацию»).
- Пересмотр глубины журнала: [OQ-08](../../open-questions.md#oq-08) остаётся открытым.
- Переименование значения `camp` в `outOfCombat`: миграция сохранённых состояний — отдельная работа
  ([modes.ts:8-11](../../../src/rules/modes.ts)).
</content>
