# Одна реплика и схема ритуала — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реплика заклинания показывается одной цельной фразой, а у каждого ритуала появляется схема — рисунок в духе гримуара, который игрок повторяет на листе А4.

**Architecture:** Часть 1 сводит три поля профиля отыгрыша из массивов в строки: массив существовал только затем, чтобы склеиться через ` · ` в карточке. Часть 2 добавляет фичу F-17: схема ритуала хранится описанием слоёв (кольца, деления, рунная надпись, звёздчатый многоугольник, знаки на вершинах, числовой квадрат, печать в центре, угловые знаки), чистая геометрия и таблицы штрихов живут в `src/diagram/`, отрисовка — в `src/components/ritual/`, показ — полноэкранным видом поверх карточки и мастера.

**Tech Stack:** TypeScript (strict), Zod 4, React 19 / Next 15 (статический экспорт, всё клиентское), Tailwind 4, Vitest 4 + Testing Library, SVG без внешних библиотек.

**Спека:** [2026-07-31-ritual-diagram-and-incantations-design.md](../specs/2026-07-31-ritual-diagram-and-incantations-design.md)

## Global Constraints

- Документация, интерфейс и контент — русский; код, идентификаторы, имена файлов и сообщения коммитов — английский.
- Имена в коде берутся только из [глоссария](../../glossary.md). Синонимы (`sigil`/`diagram`/`scheme` для одного и того же) запрещены. Слово `sigil` уже занято «Знаками ограждения» из [F-13](../../features/F-13-runes.md) — для схемы ритуала используется `RitualDiagram`.
- Один коммит несёт код и спеку вместе: изменилось поведение — в том же коммите изменился `docs/`.
- Спека первична: требование появляется в файле фичи до того, как появится код (Task 2 идёт раньше Task 3–8).
- Покрытие 100 % (строки, ветви, функции, операторы) обязательно для путей из `coverage.include` в `vitest.config.ts`: `src/rules/**`, `src/data/schemas/**`, `src/store/**`, `src/data/content/**` и добавляемый в Task 3 `src/diagram/**`. `src/components/**` в покрытие не входит намеренно и проверяется поведением.
- Художественный текст не влияет на механику (ADR-0005): схема ритуала ничего не блокирует, ничего не расходует и не хранится в состоянии персонажа.
- Числа игровых правил не выдумываются. Схема ритуала правилами D&D не описана вовсе — это художественный слой, и её содержание ограничено профилем персонажа: руны, алхимия, холод, молнии, **без огня** ([FR-052](../../features/F-04-roleplay.md#fr-052)).
- Система координат схемы: `viewBox="0 0 1000 1000"`, центр `(500, 500)`, внешний радиус `460`. Все радиусы в данных — доли внешнего радиуса, число в диапазоне (0, 1]. Штрихи глифов и печатей задаются в собственном боксе 100×100 с центром `(50, 50)`.
- Свободные идентификаторы на момент написания плана: `FR-190`…, `ADR-0014`, `AC-21`. **`ADR-0013` уже занят** вкладом заклинания в Класс Доспеха (`armorClassEffect`, `FR-093`) — это незакоммиченная работа в рабочем дереве, не переиспользовать.

## Перед началом

Зафиксировать базовую линию — три команды, ни одной правки:

```bash
python3 scripts/check-docs.py   # 4 ошибки, перечислены ниже
npm run typecheck               # чисто
npx vitest run                  # всё зелёное
```

`check:docs` сейчас красный **не из-за этой работы**. Четыре ошибки пришли из незакоммиченных правок в рабочем дереве:

```
✗ docs/decisions.md: неразрешимый якорь — rules-engine.md#класс-доспеха
✗ docs/open-questions.md: неразрешимый якорь — rules-engine.md#класс-доспеха
✗ docs/features/F-08-active-effects.md: неразрешимый якорь — ../rules-engine.md#класс-доспеха
✗ FR-093 определено в F-08-active-effects.md, но не входит в её диапазон в реестре
```

Это чужая работа в полёте, и план её не трогает. Критерий приёмки для каждой задачи ниже: **ровно эти четыре ошибки и ни одной новой**. Если владелец репозитория починит их по ходу — критерий становится «ноль ошибок».

---

## Task 1: Одна реплика, один жест, один визуальный эффект

Часть 1 целиком. Задача атомарна не по желанию, а по устройству: типы `Spell` выводятся из Zod-схемы, поэтому смена схемы ломает компиляцию контента, тестов и компонента одновременно. Разделить на «сначала схема, потом контент» нельзя — между коммитами репозиторий был бы нерабочим.

Глоссарий править не нужно: там уже `incantation`, `gesture`, `visualEffect` в единственном числе — массивы в коде были расхождением с глоссарием, а не наоборот.

**Files:**
- Modify: `src/data/schemas/spell.ts` — `roleplaySchema`, `roleplayTexts`
- Modify: `src/data/schemas/spell.test.ts` — заготовки `web()`, `rayOfFrost()`, тест «без реплики»
- Modify: `src/data/content/thorne/spells/*.json` — все 12 файлов
- Modify: `src/data/content/thorne/content.test.ts` — `roleplayTexts`, тест длины реплики, тест минимума контента
- Modify: `src/rules/announcement.test.ts` — сбор художественных текстов
- Modify: `src/components/spell/RoleplaySection.tsx` — блок `dl`
- Create: `src/components/spell/RoleplaySection.test.tsx`
- Modify: `docs/features/F-04-roleplay.md` — FR-050
- Modify: `docs/domain-model.md` — структура `roleplay`

**Interfaces:**
- Consumes: ничего.
- Produces: `Spell["roleplay"]` = `{ incantation: string; gesture: string; visualEffect: string; completeVariants: { short: string[]; atmospheric: string[]; sarcastic: string[] } }`. Все последующие задачи читают `spell.roleplay.incantation` как строку.

- [ ] **Step 1: Написать падающий тест схемы**

В `src/data/schemas/spell.test.ts` заменить в заготовке `web()` три строки профиля отыгрыша:

```ts
    roleplay: {
      incantation: "Стой.",
      gesture: "Чертит мелом знак связи.",
      visualEffect: "Из воздуха проступают ледяные нити.",
      completeVariants: {
```

То же в заготовке `rayOfFrost()`:

```ts
    roleplay: {
      incantation: "Холодно.",
      gesture: "Ведёт пальцем короткую руну.",
      visualEffect: "Тонкий белый луч оставляет иней на камне.",
      completeVariants: {
```

Заменить тест «отклоняет заклинание без реплики» на два — пустую строку и массив:

```ts
  it("отклоняет пустую реплику", () => {
    expect(
      spellSchema.safeParse(
        mutate(web(), (draft) => {
          const roleplay = draft.roleplay as Record<string, unknown>;
          roleplay.incantation = "   ";
        }),
      ).success,
    ).toBe(false);
  });

  it("отклоняет список реплик: реплика ровно одна (FR-050)", () => {
    expect(
      spellSchema.safeParse(
        mutate(web(), (draft) => {
          const roleplay = draft.roleplay as Record<string, unknown>;
          roleplay.incantation = ["Стой.", "Холодно."];
        }),
      ).success,
    ).toBe(false);
  });
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/data/schemas/spell.test.ts`
Expected: FAIL — заготовки не проходят схему, потому что схема всё ещё требует `incantations`.

- [ ] **Step 3: Перевести схему в единственное число**

В `src/data/schemas/spell.ts` заменить `roleplaySchema`:

```ts
const roleplaySchema = z.object({
  // Ровно одна реплика, один жест, один эффект (FR-050): список из двух склеивался в карточке
  // через « · » и читался обрывками. Разнообразие живёт в completeVariants, где оно и задумано.
  incantation: nonEmpty,
  gesture: nonEmpty,
  visualEffect: nonEmpty,
  completeVariants: z.object({
    short: z.array(nonEmpty),
    atmospheric: z.array(nonEmpty),
    sarcastic: z.array(nonEmpty),
  }),
});
```

И `roleplayTexts` в том же файле:

```ts
/** Все художественные тексты заклинания одним списком — для проверки FR-042. */
function roleplayTexts(roleplay: z.infer<typeof roleplaySchema>): string[] {
  return [
    roleplay.incantation,
    roleplay.gesture,
    roleplay.visualEffect,
    ...roleplay.completeVariants.short,
    ...roleplay.completeVariants.atmospheric,
    ...roleplay.completeVariants.sarcastic,
  ];
}
```

- [ ] **Step 4: Проверить, что тесты схемы проходят**

Run: `npx vitest run src/data/schemas/spell.test.ts`
Expected: PASS.

- [ ] **Step 5: Перевести 12 файлов контента**

В каждом `src/data/content/thorne/spells/*.json` три поля профиля отыгрыша становятся строками. Реплика — та, что несёт механику заклинания; вторая удаляется без переноса куда-либо.

| Файл | `incantation` |
|---|---|
| `ray-of-frost.json` | `"Стой на месте."` |
| `shocking-grasp.json` | `"Заземления не будет."` |
| `mending.json` | `"Как было."` |
| `message.json` | `"Слушай."` |
| `shield.json` | `"Нет."` |
| `absorb-elements.json` | `"Мне пригодится."` |
| `mage-armor.json` | `"Так надёжнее."` |
| `disguise-self.json` | `"Другое лицо."` |
| `detect-magic.json` | `"Покажи."` |
| `identify.json` | `"Рассказывай."` |
| `unseen-servant.json` | `"Работай."` |
| `find-familiar.json` | `"Иди сюда."` |

`gestures` → `gesture` и `visualEffects` → `visualEffect`: во всех двенадцати файлах в этих массивах ровно один элемент, он и становится значением. Пример готового результата для `ray-of-frost.json`:

```json
  "roleplay": {
    "incantation": "Стой на месте.",
    "gesture": "Ведёт указательным пальцем короткую прямую руну в воздухе, будто прочерчивает линию до цели.",
    "visualEffect": "Тонкий белый луч тянется от пальца, оставляя на камне полосу изморози.",
    "completeVariants": {
      "short": ["Короткий росчерк пальцем — и по цели проходит изморозь."],
      "atmospheric": [
        "Руна на пальце наливается синим, воздух между Торном и целью звенит от сухого холода, а на земле остаётся белая полоса."
      ],
      "sarcastic": ["«Остынь», — советует Торн и чертит линию в воздухе."]
    }
  },
```

- [ ] **Step 6: Обновить тесты контента и объявления**

В `src/data/content/thorne/content.test.ts` — сбор текстов:

```ts
function roleplayTexts(spell: (typeof spells)[number]): string[] {
  return [
    spell.roleplay.incantation,
    spell.roleplay.gesture,
    spell.roleplay.visualEffect,
    ...spell.roleplay.completeVariants.short,
    ...spell.roleplay.completeVariants.atmospheric,
    ...spell.roleplay.completeVariants.sarcastic,
  ];
}
```

Тест длины реплики — без цикла по списку:

```ts
  it.each(spells.map((spell) => [spell.nameRu, spell] as const))(
    "реплика «%s» не длиннее 15 слов",
    (_name, spell) => {
      const words = spell.roleplay.incantation.split(/\s+/).filter(Boolean);
      expect(words.length, `${spell.nameRu}: «${spell.roleplay.incantation}»`).toBeLessThanOrEqual(
        MAXIMUM_PHRASE_WORDS,
      );
    },
  );
```

Тест минимума контента: проверки длин массивов реплик, жестов и эффектов удаляются — единственность теперь держится типом, а не длиной. Остаётся счёт вариантов:

```ts
  it.each(spells.map((spell) => [spell.nameRu, spell] as const))(
    "«%s» имеет минимум контента по FR-050",
    (_name, spell) => {
      const variants =
        spell.roleplay.completeVariants.short.length +
        spell.roleplay.completeVariants.atmospheric.length +
        spell.roleplay.completeVariants.sarcastic.length;
      expect(variants).toBeGreaterThanOrEqual(MINIMUM_COMPLETE_VARIANTS);
    },
  );
```

В `src/rules/announcement.test.ts` три строки сбора (около строки 226) — в единственное число:

```ts
        card.roleplay.incantation,
        card.roleplay.gesture,
        card.roleplay.visualEffect,
```

- [ ] **Step 7: Прогнать всё и убедиться, что падает только карточка**

Run: `npx vitest run`
Expected: PASS во всём, кроме компиляции `RoleplaySection.tsx` — он всё ещё вызывает `.join(" · ")` на строке.

- [ ] **Step 8: Написать падающий тест карточки**

Create `src/components/spell/RoleplaySection.test.tsx`:

```tsx
// @vitest-environment jsdom

/**
 * Блок отыгрыша: одна реплика цельной фразой (FR-050).
 *
 * Тест сторожит именно склейку: до этой работы карточка показывала «Стой на месте. · Холодно.» —
 * весь список реплик разом, будто персонаж произносит обе подряд.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { spell } from "@/testing/stores";
import { RoleplaySection } from "./RoleplaySection";

describe("реплика и жест", () => {
  it("показывает одну реплику в кавычках", () => {
    render(<RoleplaySection spell={spell("ray-of-frost")} />);
    expect(screen.getByText("«Стой на месте.»")).toBeDefined();
  });

  it("не склеивает художественные строки через разделитель", () => {
    const { container } = render(<RoleplaySection spell={spell("ray-of-frost")} />);
    expect(container.textContent).not.toContain(" · ");
  });

  it("показывает жест как отдельную строку", () => {
    render(<RoleplaySection spell={spell("shield")} />);
    expect(screen.getByText(spell("shield").roleplay.gesture)).toBeDefined();
  });
});
```

- [ ] **Step 9: Убедиться, что тест падает**

Run: `npx vitest run src/components/spell/RoleplaySection.test.tsx`
Expected: FAIL — типовая ошибка на `.join` либо текст с ` · `.

- [ ] **Step 10: Поправить карточку**

В `src/components/spell/RoleplaySection.tsx` заменить блок `dl` (сейчас с `.join(" · ")`):

```tsx
      <dl className="flex flex-col gap-1 text-xs italic text-slate-600 dark:text-slate-400">
        <div>
          <dt className="not-italic">Реплика</dt>
          {/* Кавычки-ёлочки отличают прямую речь от описания жеста рядом. */}
          <dd>«{spell.roleplay.incantation}»</dd>
        </div>
        <div>
          <dt className="not-italic">Жест</dt>
          <dd>{spell.roleplay.gesture}</dd>
        </div>
      </dl>
```

- [ ] **Step 11: Прогнать тесты и типы**

Run: `npx vitest run && npm run typecheck`
Expected: PASS, PASS.

- [ ] **Step 12: Поправить спеку**

В `docs/features/F-04-roleplay.md`, требование FR-050 — заменить абзац требования:

```markdown
Для каждого заклинания должны храниться: ровно одна короткая реплика; ровно одно описание жеста;
ровно одно описание визуального эффекта; минимум три готовых варианта полного отыгрыша.

Реплика, жест и эффект — по одному, а не «минимум по одному»: список из двух реплик показывался в
карточке целиком, через разделитель, и читался как одна бессвязная фраза. Разнообразие живёт в
вариантах отыгрыша, где оно и задумано выбором категории.
```

В `docs/domain-model.md` (около строки 89) — структура профиля отыгрыша:

```
    incantation: string;
    gesture: string;
    visualEffect: string;
```

- [ ] **Step 13: Проверить целостность спеки**

Run: `python3 scripts/check-docs.py`
Expected: те же четыре ошибки базовой линии, ни одной новой.

- [ ] **Step 14: Коммит**

```bash
git add src/data/schemas/spell.ts src/data/schemas/spell.test.ts \
        src/data/content/thorne/spells src/data/content/thorne/content.test.ts \
        src/rules/announcement.test.ts \
        src/components/spell/RoleplaySection.tsx src/components/spell/RoleplaySection.test.tsx \
        docs/features/F-04-roleplay.md docs/domain-model.md
git commit -m "Show one incantation instead of a joined list"
```

---

## Task 2: Спека фичи F-17

Спека раньше кода — правило репозитория. Задача не пишет ни строки TypeScript и проверяется скриптом целостности.

**Files:**
- Create: `docs/features/F-17-ritual-diagram.md`
- Modify: `docs/features/README.md` — строка реестра
- Modify: `docs/glossary.md` — четыре термина
- Modify: `docs/decisions.md` — ADR-0014
- Modify: `docs/content.md` — схема в составе контента ритуала
- Modify: `docs/domain-model.md` — поле `ritualDiagram`
- Modify: `docs/roadmap.md` — F-17 в вехе 3

**Interfaces:**
- Consumes: ничего.
- Produces: требования `FR-190`…`FR-193`, на которые ссылаются Task 5–8; имена `RitualDiagram`, `centralSeal`, `inscription`, `GlyphId` из глоссария.

- [ ] **Step 1: Создать файл фичи**

Create `docs/features/F-17-ritual-diagram.md`:

```markdown
# F-17 — Схема ритуала

> Статус: План · Этап: 3 · Обновлено: 2026-07-31
> Требования: FR-190…FR-193 · Источник: решение игрока, добавлено спецификацией ([ADR-0014](../decisions.md#adr-0014))

## Зачем

У ритуала есть то, чего нет у боевого заклинания: время. Десять лишних минут по правилам — это десять
минут за столом, которые нечем занять. Игрок хочет занять их рисованием: взять лист А4 и повторить
схему ритуала рукой. Тогда «сотворить ритуал» перестаёт быть словами в объявлении мастеру и становится
тем, что игрок действительно делает.

Требование к рисунку сформулировал игрок: сложный, тематический, в духе магических книг — и при этом
воспроизводимый рукой, иначе смысл теряется.

## Требования

<a id="fr-190"></a>
### FR-190 — Схема у каждого ритуала

**Статус:** План · **Проверка:** unit на схеме заклинания в обе стороны, `content.test.ts`

Каждое ритуальное заклинание должно иметь схему ритуала. Неритуальное заклинание схемы не имеет.

Инвариант двусторонний: схема у заговора или у обычного заклинания — ошибка контента, а не
необязательное украшение. Рисунок существует ради десяти минут ритуала, которых у боевого заклинания
нет.

<a id="fr-191"></a>
### FR-191 — Схема хранится описанием слоёв

**Статус:** План · **Проверка:** unit на инвариантах слоёв, unit на геометрии

Схема должна храниться описанием слоёв из закрытого словаря: концентрические кольца, деления по
обводу, рунная надпись, звёздчатый многоугольник, знаки на вершинах, оси, числовой квадрат, печать в
центре, угловые знаки.

Слои проверяются как остальной контент: кольца убывают, знаки стоят на вершинах звезды, числовой
квадрат действительно магический, каждая руна и каждый знак есть в реестре. Схема, нарисованная
свободной рукой, дала бы ту же плотность, но её нельзя ни проверить в ревью, ни повторить на бумаге
([ADR-0014](../decisions.md#adr-0014)).

Порядок слоёв в данных — он же порядок рисования на листе.

<a id="fr-192"></a>
### FR-192 — Схема открывается на полный экран

**Статус:** План · **Проверка:** компонентный тест на карточке и на мастере применения

Схема должна открываться на полный экран из подробной карточки заклинания и из мастера применения при
выбранном ритуальном способе сотворения.

На полный экран, а не блоком в карточке: по схеме рисуют, а на экране iPhone SE мелкий рисунок
бесполезен. Кнопки печати нет — смысл в том, чтобы вести линию рукой.

<a id="fr-193"></a>
### FR-193 — Схема не влияет на механику

**Статус:** План · **Проверка:** unit: подмена `ritualDiagram` не меняет результат применения

Схема не должна влиять на механику и не должна быть обязательным шагом применения.

Приложение не спрашивает, нарисовал ли игрок схему, и не хранит этого в состоянии персонажа. Это
художественный слой в смысле [ADR-0005](../decisions.md#adr-0005).

## Поведение и крайние случаи

**Схема без ритуального режима.** Ритуальное заклинание можно сотворить и обычным способом, с расходом
ячейки. Кнопка в мастере появляется только при способе «ритуалом»: рисовать десять минут в бою нельзя,
а обычное сотворение занимает действие.

**Ритуал не в бою.** Ритуалы по умолчанию скрыты в боевом списке
([F-09](F-09-preparation.md#fr-103)) и доступны через фильтр «ритуал». Схема открывается из карточки,
поэтому путь к ней не зависит от того, идёт бой или нет.

**Тематика ограничена персонажем.** Словарь знаков — руны, алхимические металлы, стихии без огня
([FR-052](F-04-roleplay.md#fr-052)). Религиозных имён и формул в надписях нет: надписи — аттестованные
рунные слова, а не транслитерация русского текста ([ADR-0014](../decisions.md#adr-0014)).

**Схема не редактируется.** Свои схемы, редактор и экспорт в MVP не входят. Пользовательские данные
схема не создаёт, поэтому в экспорт ([FR-120](F-11-data-io.md#fr-120)) не попадает.

## Зависимости

- [F-02](F-02-spell-card.md) — кнопка входа в подробной карточке.
- [F-03](F-03-cast-wizard.md) — кнопка входа на итоговом шаге мастера при ритуальном способе.
- [content.md](../content.md) — схема входит в состав контента ритуального заклинания.
- [domain-model.md](../domain-model.md#заклинание) — поле `ritualDiagram` внутри `Spell`.

## Проверка

| Что проверяем | Как |
|---|---|
| У ритуала есть схема, у неритуального заклинания её нет | Unit в обе стороны |
| Кольца убывают, внешнее равно 1 | Unit |
| Знаки стоят на вершинах звезды: их число равно числу вершин | Unit |
| Числовой квадрат магический по строкам, столбцам и диагоналям | Unit |
| Неизвестная руна и неизвестный знак отклоняются | Unit |
| Звезда 7/3 рисуется одним обходом, 6/2 — двумя треугольниками | Unit на геометрии |
| Все четыре схемы контента валидны | `content.test.ts` |
| Кнопка есть только у ритуального заклинания | Компонентный |
| Кнопка в мастере есть только при ритуальном способе | Компонентный |
| Схема видна целиком без прокрутки на 375 px | Ручная на iPhone SE |
| Схему можно перерисовать на А4 за время ритуала | Игровая сессия, все четыре схемы |

Последняя строка — единственная настоящая проверка этой фичи: если рисунок не получается повторить
рукой или получается, но не радует, ни один unit об этом не скажет.
```

- [ ] **Step 2: Добавить строку в реестр фич**

В `docs/features/README.md`, в таблицу «Состав MVP» после строки F-16:

```markdown
| [F-17](F-17-ritual-diagram.md) | Схема ритуала | FR-190…193 | 3 | План |
```

- [ ] **Step 3: Добавить термины в глоссарий**

В `docs/glossary.md`, в таблицу терминов проекта после строки «Профиль отыгрыша»:

```markdown
| Схема ритуала | `RitualDiagram` | Рисунок ритуала из слоёв, который игрок повторяет на бумаге. Не `sigil`: это слово занято «Знаками ограждения» |
| Печать | `centralSeal` | Центральная фигура схемы ритуала: глаз, сфера, треугольник вызова, пустая рука |
| Надпись | `inscription` | Рунная надпись по обводу схемы, с переводом в `meaningRu` |
| Знак | `GlyphId`, `glyphs` | Элемент закрытого словаря схемы: руна, алхимический металл или стихия |
```

- [ ] **Step 4: Записать ADR-0014**

В конец `docs/decisions.md`:

```markdown
---

## ADR-0014

**Схема ритуала собирается из слоёв, а не рисуется свободно**

**Статус:** Принято · 2026-07-31

**Контекст.** Игрок хочет занять десять минут ритуала делом: перерисовывать схему ритуала на лист А4.
Требование к рисунку — сложный, тематический, в духе магических книг. Требование к способу — рисунок
должен повторяться рукой, иначе занятие не имеет смысла. Эти два требования тянут в разные стороны:
сложное обычно означает свободную линию, а свободную линию рукой не повторить.

**Варианты.**

1. Свой SVG на каждый ритуал, нарисованный целиком. Максимум выразительности, но пути невозможно
   вычитать в ревью, стиль четырёх схем разъедется, и повторить их на бумаге тем труднее, чем лучше
   они нарисованы.
2. Растровая картинка, отсканированная с настоящего рисунка. Обратный порядок работы, вес в precache
   офлайна, не масштабируется и не живёт в тёмной теме.
3. Описание слоёв из закрытого словаря: кольца, деления, рунная надпись, звёздчатый многоугольник,
   знаки на вершинах, числовой квадрат, печать. Отрисовка собирает SVG по описанию.

**Выбор.** Третий вариант.

**Последствия.** Сложность берётся не от свободы линии, а от количества слоёв — как в настоящих
гримуарах, где круг собран из повторяющихся элементов и потому рисовался циркулем и линейкой. Данные
проверяются схемой: кольца убывают, знаки стоят на вершинах, числовой квадрат действительно магический.
Порядок слоёв в данных совпадает с порядком рисования на бумаге. Плата — родство всех четырёх схем:
они узнаваемо из одной книги, и уникальной среди них не будет ни одна.

Отдельное следствие для надписей. Транслитерация русских фраз старшим футарком отвергнута: в футарке
нет звуков «ж», «ч», «ш», и надпись получилась бы придуманным алфавитом вместо настоящего. Надписи —
аттестованные рунные формульные слова (`alu`, `laukaz`, `auja`) и полный футарк по обводу, как на камне
из Кюльвера, где перечисление всех рун само было надписью силы. Рядом с надписью хранится её перевод
(`meaningRu`), иначе содержание невозможно вычитать.

Расширение области MVP этой записью тоже фиксируется: F-17 не следует из ТЗ, а появляется решением
игрока. Фича относится к этапу 3, но реализуется вне очереди — до установки на телефон, потому что
интерес игрока к ритуалам есть сейчас, а порядок вех не обещан никому, кроме нас самих.
```

- [ ] **Step 5: Дополнить content.md и domain-model.md**

В `docs/content.md`, в раздел про состав контента — после абзаца про первую партию:

```markdown
Ритуальное заклинание несёт ещё один блок контента — схему ритуала
([F-17](features/F-17-ritual-diagram.md)): описание слоёв рисунка и перевод рунной надписи. В первой
партии таких четыре: «Поиск фамильяра», «Обнаружение магии», «Опознание», «Незримый слуга».
```

В `docs/domain-model.md`, в структуру `Заклинание` — после `roleplay`:

```
    /** Схема ритуала: только у ritual: true (FR-190). */
    ritualDiagram?: RitualDiagram;
```

- [ ] **Step 6: Отметить F-17 в роадмапе**

В `docs/roadmap.md`, в раздел «Веха 3 — художественный слой», в конец абзаца:

```markdown
Схема ритуала ([F-17](features/F-17-ritual-diagram.md)) относится к этой вехе, но делается вне
очереди — решением игрока, зафиксированным в [ADR-0014](decisions.md#adr-0014).
```

- [ ] **Step 7: Проверить целостность**

Run: `python3 scripts/check-docs.py`
Expected: те же четыре ошибки базовой линии. Требований определено стало на 4 больше. Если появилась ошибка «FR-190 определено в F-17…, но не входит в её диапазон» — диапазон в реестре записан неверно, поправить строку из шага 2.

- [ ] **Step 8: Коммит**

```bash
git add docs/features/F-17-ritual-diagram.md docs/features/README.md docs/glossary.md \
        docs/decisions.md docs/content.md docs/domain-model.md docs/roadmap.md
git commit -m "Specify F-17 ritual diagram"
```

---

## Task 3: Геометрия схемы

Чистые вычисления без React: точки на окружности, обходы звёздчатого многоугольника, деления, места знаков надписи, дуги. Каталог входит в покрытие 100 %.

**Files:**
- Create: `src/diagram/geometry.ts`
- Create: `src/diagram/geometry.test.ts`
- Modify: `vitest.config.ts` — `coverage.include`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `CENTER = 500`, `OUTER_RADIUS = 460`, `VIEW_BOX = "0 0 1000 1000"`
  - `type Point = { x: number; y: number }`
  - `absolute(fraction: number): number` — доля внешнего радиуса в единицы схемы
  - `pointAt(radius: number, index: number, count: number): Point` — радиус в единицах схемы, отсчёт от верха по часовой
  - `starPolygons(points: number, skip: number, radius: number): Point[][]`
  - `tickMarks(count: number, radius: number, length: number): [Point, Point][]`
  - `inscriptionPlacements(count: number, radius: number): { at: Point; rotation: number }[]`
  - `arcPath(cx: number, cy: number, r: number, fromDegrees: number, toDegrees: number): string`
  - `squareSide(radius: number): number` — сторона вписанного в окружность квадрата

- [ ] **Step 1: Написать падающие тесты**

Create `src/diagram/geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  CENTER,
  OUTER_RADIUS,
  absolute,
  arcPath,
  inscriptionPlacements,
  pointAt,
  squareSide,
  starPolygons,
  tickMarks,
} from "./geometry";

describe("единицы и точки", () => {
  it("доля внешнего радиуса переводится в единицы схемы", () => {
    expect(absolute(1)).toBe(OUTER_RADIUS);
    expect(absolute(0.5)).toBe(OUTER_RADIUS / 2);
  });

  it("отсчёт идёт от верха по часовой стрелке", () => {
    // Четыре точки: верх, право, низ, лево. Так же, как рука ведёт круг.
    expect(pointAt(100, 0, 4)).toEqual({ x: CENTER, y: CENTER - 100 });
    expect(pointAt(100, 1, 4)).toEqual({ x: CENTER + 100, y: CENTER });
    expect(pointAt(100, 2, 4)).toEqual({ x: CENTER, y: CENTER + 100 });
    expect(pointAt(100, 3, 4)).toEqual({ x: CENTER - 100, y: CENTER });
  });

  it("координаты округляются до двух знаков: в разметке не нужны шестнадцать", () => {
    const { x } = pointAt(100, 1, 3);
    expect(x).toBe(586.6);
  });
});

describe("звёздчатый многоугольник", () => {
  it("гептаграмма 7/3 — один обход через все семь вершин", () => {
    const cycles = starPolygons(7, 3, 100);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(7);
  });

  it("гексаграмма 6/2 — два треугольника, а не один обход", () => {
    const cycles = starPolygons(6, 2, 100);
    expect(cycles).toHaveLength(2);
    expect(cycles.map((cycle) => cycle.length)).toEqual([3, 3]);
  });

  it("октаграмма 8/3 — один обход через все восемь вершин", () => {
    expect(starPolygons(8, 3, 100)).toHaveLength(1);
  });

  it("вершины лежат на окружности заданного радиуса", () => {
    for (const point of starPolygons(7, 3, 100)[0]) {
      const distance = Math.hypot(point.x - CENTER, point.y - CENTER);
      expect(distance).toBeCloseTo(100, 1);
    }
  });
});

describe("деления и надпись", () => {
  it("делений столько, сколько заказано, и каждое — пара точек", () => {
    const ticks = tickMarks(36, 400, 20);
    expect(ticks).toHaveLength(36);
    expect(ticks[0][0]).toEqual({ x: CENTER, y: CENTER - 400 });
    expect(ticks[0][1]).toEqual({ x: CENTER, y: CENTER - 380 });
  });

  it("знаки надписи расставлены по кругу и повёрнуты наружу", () => {
    const places = inscriptionPlacements(4, 400);
    expect(places).toHaveLength(4);
    expect(places[0]).toEqual({ at: { x: CENTER, y: CENTER - 400 }, rotation: 0 });
    expect(places[1].rotation).toBe(90);
    expect(places[3].rotation).toBe(270);
  });
});

describe("квадрат и дуга", () => {
  it("сторона вписанного квадрата — радиус на корень из двух", () => {
    expect(squareSide(100)).toBeCloseTo(141.42, 1);
  });

  it("дуга описывается путём с командой A", () => {
    const path = arcPath(50, 50, 30, 0, 180);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain("A 30 30");
  });

  it("дуга больше полуокружности помечается флагом large-arc", () => {
    expect(arcPath(50, 50, 30, 0, 270)).toContain(" 1 1 ");
    expect(arcPath(50, 50, 30, 0, 90)).toContain(" 0 1 ");
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/diagram/geometry.test.ts`
Expected: FAIL — модуля `./geometry` нет.

- [ ] **Step 3: Написать геометрию**

Create `src/diagram/geometry.ts`:

```ts
/**
 * Геометрия схемы ритуала (FR-191).
 *
 * Единицы: viewBox 1000×1000, центр (500, 500), внешний радиус 460 — остаток отдан знакам вне круга.
 * Отсчёт углов начинается сверху и идёт по часовой стрелке: так же, как рука ведёт круг по бумаге,
 * и поэтому порядок вершин в данных совпадает с порядком рисования.
 */

export const CENTER = 500;
export const OUTER_RADIUS = 460;
export const VIEW_BOX = "0 0 1000 1000";

export type Point = { x: number; y: number };

/** Два знака после запятой: в разметке лишняя точность только мешает читать. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Доля внешнего радиуса в единицы схемы. */
export function absolute(fraction: number): number {
  return round(fraction * OUTER_RADIUS);
}

export function pointAt(radius: number, index: number, count: number): Point {
  const angle = ((index / count) * 2 - 0.5) * Math.PI;
  return { x: round(CENTER + radius * Math.cos(angle)), y: round(CENTER + radius * Math.sin(angle)) };
}

/**
 * Обходы звёздчатого многоугольника {points}/{skip}.
 *
 * При НОД(points, skip) > 1 фигура составная: гексаграмма 6/2 — это два треугольника, а не один
 * обход. Возвращается список обходов, потому что рисуются они раздельно — и рукой тоже.
 */
export function starPolygons(points: number, skip: number, radius: number): Point[][] {
  const cycles: Point[][] = [];
  const visited = new Set<number>();

  for (let start = 0; start < points; start += 1) {
    if (visited.has(start)) continue;
    const cycle: Point[] = [];
    let index = start;
    do {
      visited.add(index);
      cycle.push(pointAt(radius, index, points));
      index = (index + skip) % points;
    } while (index !== start);
    cycles.push(cycle);
  }

  return cycles;
}

/** Деления по обводу: пара точек на каждое, от внешнего радиуса внутрь. */
export function tickMarks(count: number, radius: number, length: number): [Point, Point][] {
  return Array.from({ length: count }, (_unused, index) => [
    pointAt(radius, index, count),
    pointAt(radius - length, index, count),
  ]);
}

/** Место и поворот каждого знака надписи: верх знака смотрит из центра. */
export function inscriptionPlacements(
  count: number,
  radius: number,
): { at: Point; rotation: number }[] {
  return Array.from({ length: count }, (_unused, index) => ({
    at: pointAt(radius, index, count),
    rotation: round((index / count) * 360),
  }));
}

/** Сторона квадрата, вписанного в окружность. */
export function squareSide(radius: number): number {
  return round(radius * Math.SQRT2);
}

/** Дуга от угла к углу в градусах, отсчёт как у pointAt. */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromDegrees: number,
  toDegrees: number,
): string {
  const at = (degrees: number): Point => {
    const angle = ((degrees / 360) * 2 - 0.5) * Math.PI;
    return { x: round(cx + r * Math.cos(angle)), y: round(cy + r * Math.sin(angle)) };
  };
  const start = at(fromDegrees);
  const end = at(toDegrees);
  const sweep = toDegrees > fromDegrees ? 1 : 0;
  const largeArc = Math.abs(toDegrees - fromDegrees) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}
```

- [ ] **Step 4: Включить каталог в покрытие**

В `vitest.config.ts`, в `coverage.include` добавить `src/diagram/**`:

```ts
      include: [
        "src/rules/**",
        "src/data/schemas/**",
        "src/store/**",
        "src/data/content/**",
        // Геометрия и таблицы штрихов — вычисления, а не разметка: ошибка здесь выглядит как
        // испорченная схема, по которой игрок будет рисовать.
        "src/diagram/**",
      ],
```

- [ ] **Step 5: Проверить тесты и покрытие**

Run: `npx vitest run --coverage src/diagram`
Expected: PASS, покрытие `src/diagram/geometry.ts` — 100 % по всем четырём метрикам.

- [ ] **Step 6: Коммит**

```bash
git add src/diagram/geometry.ts src/diagram/geometry.test.ts vitest.config.ts
git commit -m "Add ritual diagram geometry"
```

---

## Task 4: Штрихи, руны и знаки

Таблицы форм: из чего состоит каждый знак. Штрих — окружность, отрезок, ломаная или дуга в боксе 100×100 с центром (50, 50). Руны старшего футарка состоят только из отрезков, поэтому рисуются и на экране, и пером по бумаге одинаково.

Формы рун и алхимических знаков — внешнее знание, а не проектное решение: числа ниже задают начальные формы по таблице старшего футарка и алхимическим символам металлов. Тест сторожит структуру (все 24 руны на месте, штрихи внутри бокса), а пропорции доводятся глазом в браузере — на это есть шаг в Task 7.

**Files:**
- Create: `src/diagram/strokes.ts`
- Create: `src/diagram/runes.ts`
- Create: `src/diagram/glyphs.ts`
- Create: `src/diagram/glyphs.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `type Stroke` — `circle | line | polyline | arc`, поле `dashed?: true`
  - `RUNES: Record<RuneId, { char: string; strokes: Stroke[] }>`, `RUNE_IDS`, `type RuneId`, `RUNE_BY_CHAR: Map<string, RuneId>`
  - `GLYPHS: Record<GlyphId, Stroke[]>`, `GLYPH_IDS`, `type GlyphId` (руны входят в `GlyphId`)
  - `SEALS: Record<SealKind, Stroke[]>`, `SEAL_KINDS`, `type SealKind`
  - `isRune(char: string): boolean`

- [ ] **Step 1: Описать штрих**

Create `src/diagram/strokes.ts`:

```ts
/**
 * Штрих схемы ритуала: минимальная единица формы (FR-191).
 *
 * Всё задаётся в боксе 100×100 с центром (50, 50) — знак не знает, куда его поставят и как
 * масштабируют. Заливок нет: рисунок должен быть повторим пером, а перо не заливает.
 */

export type Stroke =
  | { kind: "circle"; cx: number; cy: number; r: number; dashed?: true }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; dashed?: true }
  | { kind: "polyline"; points: readonly (readonly [number, number])[]; closed?: true; dashed?: true }
  | {
      kind: "arc";
      cx: number;
      cy: number;
      r: number;
      fromDegrees: number;
      toDegrees: number;
      dashed?: true;
    };

export const BOX = 100;

/** Отрезок: самая частая форма, руны состоят только из них. */
export function line(x1: number, y1: number, x2: number, y2: number): Stroke {
  return { kind: "line", x1, y1, x2, y2 };
}

/** Вертикальный стебель руны: общая часть большинства знаков футарка. */
export function stem(): Stroke {
  return line(50, 8, 50, 92);
}
```

- [ ] **Step 2: Записать таблицу рун**

Create `src/diagram/runes.ts`:

```ts
/**
 * Старший футарк: 24 руны отрезками (FR-191).
 *
 * Рисуются собственными путями, а не текстом: шрифта с рунным блоком на устройстве может не
 * оказаться, а схема должна выглядеть одинаково всегда — по ней рисуют. Символ Unicode хранится
 * рядом, чтобы надписи в JSON контента читались глазом.
 */

import { line, stem, type Stroke } from "./strokes";

export const RUNE_IDS = [
  "rune-fehu",
  "rune-uruz",
  "rune-thurisaz",
  "rune-ansuz",
  "rune-raidho",
  "rune-kaunan",
  "rune-gebo",
  "rune-wunjo",
  "rune-hagalaz",
  "rune-naudiz",
  "rune-isaz",
  "rune-jera",
  "rune-iwaz",
  "rune-perth",
  "rune-algiz",
  "rune-sowilo",
  "rune-tiwaz",
  "rune-berkanan",
  "rune-ehwaz",
  "rune-mannaz",
  "rune-laguz",
  "rune-ingwaz",
  "rune-dagaz",
  "rune-othala",
] as const;

export type RuneId = (typeof RUNE_IDS)[number];

export const RUNES: Record<RuneId, { char: string; strokes: Stroke[] }> = {
  "rune-fehu": { char: "ᚠ", strokes: [stem(), line(50, 22, 84, 8), line(50, 52, 84, 38)] },
  "rune-uruz": { char: "ᚢ", strokes: [line(26, 92, 26, 22), line(26, 22, 74, 34), line(74, 34, 74, 92)] },
  "rune-thurisaz": { char: "ᚦ", strokes: [stem(), line(50, 24, 78, 42), line(78, 42, 50, 60)] },
  "rune-ansuz": { char: "ᚨ", strokes: [stem(), line(50, 12, 82, 30), line(50, 42, 82, 60)] },
  "rune-raidho": {
    char: "ᚱ",
    strokes: [stem(), line(50, 10, 80, 28), line(80, 28, 50, 46), line(50, 46, 80, 90)],
  },
  "rune-kaunan": { char: "ᚲ", strokes: [line(30, 50, 68, 14), line(30, 50, 68, 86)] },
  "rune-gebo": { char: "ᚷ", strokes: [line(20, 14, 80, 86), line(80, 14, 20, 86)] },
  "rune-wunjo": { char: "ᚹ", strokes: [stem(), line(50, 12, 78, 32), line(78, 32, 50, 52)] },
  "rune-hagalaz": {
    char: "ᚺ",
    strokes: [line(28, 8, 28, 92), line(72, 8, 72, 92), line(28, 38, 72, 62)],
  },
  "rune-naudiz": { char: "ᚾ", strokes: [stem(), line(26, 68, 74, 32)] },
  "rune-isaz": { char: "ᛁ", strokes: [stem()] },
  "rune-jera": {
    char: "ᛃ",
    strokes: [line(32, 16, 56, 38), line(56, 38, 32, 60), line(68, 40, 44, 62), line(44, 62, 68, 84)],
  },
  "rune-iwaz": { char: "ᛇ", strokes: [stem(), line(50, 12, 74, 4), line(50, 88, 26, 96)] },
  "rune-perth": {
    char: "ᛈ",
    strokes: [
      line(30, 8, 30, 92),
      line(30, 22, 66, 34),
      line(66, 34, 30, 46),
      line(30, 54, 66, 66),
      line(66, 66, 30, 78),
    ],
  },
  "rune-algiz": { char: "ᛉ", strokes: [stem(), line(50, 34, 22, 10), line(50, 34, 78, 10)] },
  "rune-sowilo": {
    char: "ᛊ",
    strokes: [line(70, 12, 34, 34), line(34, 34, 68, 56), line(68, 56, 32, 88)],
  },
  "rune-tiwaz": { char: "ᛏ", strokes: [stem(), line(50, 8, 24, 34), line(50, 8, 76, 34)] },
  "rune-berkanan": {
    char: "ᛒ",
    strokes: [
      line(30, 8, 30, 92),
      line(30, 12, 70, 30),
      line(70, 30, 30, 48),
      line(30, 52, 70, 70),
      line(70, 70, 30, 88),
    ],
  },
  "rune-ehwaz": {
    char: "ᛖ",
    strokes: [line(28, 8, 28, 92), line(72, 8, 72, 92), line(28, 40, 50, 24), line(50, 24, 72, 40)],
  },
  "rune-mannaz": {
    char: "ᛗ",
    strokes: [line(28, 8, 28, 92), line(72, 8, 72, 92), line(28, 20, 72, 52), line(72, 20, 28, 52)],
  },
  "rune-laguz": { char: "ᛚ", strokes: [stem(), line(50, 20, 76, 44)] },
  "rune-ingwaz": {
    char: "ᛜ",
    strokes: [{ kind: "polyline", points: [[50, 22], [76, 50], [50, 78], [24, 50]], closed: true }],
  },
  "rune-dagaz": {
    char: "ᛞ",
    strokes: [line(26, 12, 26, 88), line(74, 12, 74, 88), line(26, 12, 74, 88), line(74, 12, 26, 88)],
  },
  "rune-othala": {
    char: "ᛟ",
    strokes: [
      { kind: "polyline", points: [[50, 10], [74, 34], [50, 58], [26, 34]], closed: true },
      line(50, 58, 30, 92),
      line(50, 58, 70, 92),
    ],
  },
};

/** Символ Unicode → идентификатор: надписи в контенте хранятся рунами, а рисуются штрихами. */
export const RUNE_BY_CHAR: Map<string, RuneId> = new Map(
  RUNE_IDS.map((id) => [RUNES[id].char, id]),
);

export function isRune(char: string): boolean {
  return RUNE_BY_CHAR.has(char);
}

/** Полный футарк в каноническом порядке — надпись сама по себе (камень из Кюльвера). */
export const FULL_FUTHARK: string = RUNE_IDS.map((id) => RUNES[id].char).join("");
```

- [ ] **Step 3: Записать знаки и печати**

Create `src/diagram/glyphs.ts`:

```ts
/**
 * Знаки схемы ритуала: алхимические металлы, стихии, руны — и печати центра (FR-191).
 *
 * Словарь закрытый: знак вне списка нечем нарисовать, поэтому схема с ним не проходит проверку.
 * Огня в стихиях нет — его нет у персонажа (FR-052). Молния и мороз добавлены вместо него: это
 * темы Торна.
 */

import { RUNES, RUNE_IDS, type RuneId } from "./runes";
import { line, type Stroke } from "./strokes";

/** Семь металлов алхимии: они же планетарные знаки. Порядок — от Сатурна к Луне. */
export const METAL_IDS = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"] as const;

/** Стихии и темы персонажа. */
export const ELEMENT_IDS = ["air", "water", "earth", "lightning", "frost"] as const;

export const GLYPH_IDS = [...METAL_IDS, ...ELEMENT_IDS, ...RUNE_IDS] as const;

export type GlyphId = (typeof GLYPH_IDS)[number];

const METALS: Record<(typeof METAL_IDS)[number], Stroke[]> = {
  // ♄ свинец: крюк с перекладиной.
  saturn: [line(30, 24, 30, 70), line(18, 30, 46, 30), { kind: "arc", cx: 48, cy: 70, r: 20, fromDegrees: 180, toDegrees: 20 }],
  // ♃ олово: цифра «4» одним росчерком.
  jupiter: [line(24, 34, 24, 62), line(24, 62, 62, 62), line(52, 30, 52, 84)],
  // ♂ железо: круг со стрелой.
  mars: [
    { kind: "circle", cx: 42, cy: 60, r: 22 },
    line(58, 44, 84, 18),
    line(84, 18, 62, 18),
    line(84, 18, 84, 40),
  ],
  // ☉ золото: круг с точкой.
  sun: [{ kind: "circle", cx: 50, cy: 50, r: 26 }, { kind: "circle", cx: 50, cy: 50, r: 4 }],
  // ♀ медь: круг с крестом.
  venus: [
    { kind: "circle", cx: 50, cy: 36, r: 20 },
    line(50, 56, 50, 88),
    line(34, 74, 66, 74),
  ],
  // ☿ ртуть: рожки, круг, крест.
  mercury: [
    { kind: "arc", cx: 50, cy: 28, r: 14, fromDegrees: 210, toDegrees: 330 },
    { kind: "circle", cx: 50, cy: 52, r: 18 },
    line(50, 70, 50, 92),
    line(38, 82, 62, 82),
  ],
  // ☽ серебро: полумесяц.
  moon: [{ kind: "arc", cx: 62, cy: 50, r: 32, fromDegrees: 40, toDegrees: 320 }],
};

const ELEMENTS: Record<(typeof ELEMENT_IDS)[number], Stroke[]> = {
  // 🜁 воздух: треугольник вверх с перекладиной.
  air: [
    { kind: "polyline", points: [[50, 16], [84, 80], [16, 80]], closed: true },
    line(28, 56, 72, 56),
  ],
  // 🜄 вода: треугольник вниз.
  water: [{ kind: "polyline", points: [[16, 20], [84, 20], [50, 84]], closed: true }],
  // 🜃 земля: треугольник вниз с перекладиной.
  earth: [
    { kind: "polyline", points: [[16, 20], [84, 20], [50, 84]], closed: true },
    line(30, 48, 70, 48),
  ],
  // Молния: тема персонажа, своего алхимического знака у неё нет.
  lightning: [{ kind: "polyline", points: [[58, 10], [32, 48], [52, 48], [26, 90], [70, 42], [48, 42], [66, 10]] }],
  // Мороз: шестилучевая снежинка.
  frost: [
    line(50, 12, 50, 88),
    line(17, 31, 83, 69),
    line(17, 69, 83, 31),
    line(50, 24, 40, 34),
    line(50, 24, 60, 34),
  ],
};

const RUNE_GLYPHS = Object.fromEntries(
  RUNE_IDS.map((id) => [id, RUNES[id].strokes]),
) as Record<RuneId, Stroke[]>;

export const GLYPHS: Record<GlyphId, Stroke[]> = { ...METALS, ...ELEMENTS, ...RUNE_GLYPHS };

/** Печати центра. Порядок штрихов — порядок рисования. */
export const SEAL_KINDS = ["eye", "sphere", "summoning-triangle", "empty-hand"] as const;

export type SealKind = (typeof SEAL_KINDS)[number];

export const SEALS: Record<SealKind, Stroke[]> = {
  // Глаз: миндаль из двух дуг, зрачок, точка.
  eye: [
    { kind: "arc", cx: 50, cy: 50, r: 46, fromDegrees: 60, toDegrees: 120 },
    { kind: "arc", cx: 50, cy: 50, r: 46, fromDegrees: 240, toDegrees: 300 },
    { kind: "circle", cx: 50, cy: 50, r: 16 },
    { kind: "circle", cx: 50, cy: 50, r: 4 },
  ],
  // Сфера: расходящиеся кольца.
  sphere: [
    { kind: "circle", cx: 50, cy: 50, r: 44 },
    { kind: "circle", cx: 50, cy: 50, r: 28 },
    { kind: "circle", cx: 50, cy: 50, r: 12 },
  ],
  // Треугольник вызова: внутри круг — место под уголь и травы.
  "summoning-triangle": [
    { kind: "polyline", points: [[50, 8], [92, 84], [8, 84]], closed: true },
    { kind: "circle", cx: 50, cy: 62, r: 14 },
  ],
  // Пустая рука: контур пунктиром, внутри намеренно ничего.
  "empty-hand": [
    {
      kind: "polyline",
      points: [
        [34, 92], [30, 62], [22, 46], [26, 42], [34, 54], [32, 24], [38, 22], [42, 52],
        [46, 18], [52, 18], [54, 52], [60, 26], [66, 28], [62, 58], [70, 46], [74, 50],
        [66, 66], [66, 92],
      ],
      closed: true,
      dashed: true,
    },
  ],
};
```

- [ ] **Step 4: Написать тесты таблиц**

Create `src/diagram/glyphs.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { GLYPHS, GLYPH_IDS, SEALS, SEAL_KINDS } from "./glyphs";
import { BOX, type Stroke } from "./strokes";
import { FULL_FUTHARK, RUNES, RUNE_BY_CHAR, RUNE_IDS, isRune } from "./runes";

/** Все координаты штриха: любой знак обязан жить в своём боксе. */
function coordinates(stroke: Stroke): number[] {
  if (stroke.kind === "circle") return [stroke.cx, stroke.cy, stroke.cx + stroke.r, stroke.cy + stroke.r];
  if (stroke.kind === "line") return [stroke.x1, stroke.y1, stroke.x2, stroke.y2];
  if (stroke.kind === "arc") return [stroke.cx - stroke.r, stroke.cy - stroke.r, stroke.cx + stroke.r, stroke.cy + stroke.r];
  return stroke.points.flatMap(([x, y]) => [x, y]);
}

describe("старший футарк", () => {
  it("содержит все 24 руны", () => {
    expect(RUNE_IDS).toHaveLength(24);
    expect(new Set(RUNE_IDS).size).toBe(24);
  });

  it("у каждой руны есть символ и хотя бы один штрих", () => {
    for (const id of RUNE_IDS) {
      expect(RUNES[id].char, id).toHaveLength(1);
      expect(RUNES[id].strokes.length, id).toBeGreaterThan(0);
    }
  });

  it("символы уникальны и узнаются", () => {
    expect(RUNE_BY_CHAR.size).toBe(24);
    expect(isRune("ᚨ")).toBe(true);
    expect(isRune("ж")).toBe(false);
  });

  it("полный футарк — строка из 24 рун", () => {
    expect([...FULL_FUTHARK]).toHaveLength(24);
  });
});

describe("знаки и печати", () => {
  it("каждый знак словаря нарисован", () => {
    for (const id of GLYPH_IDS) {
      expect(GLYPHS[id].length, id).toBeGreaterThan(0);
    }
  });

  it("руны входят в словарь знаков", () => {
    expect(GLYPH_IDS).toContain("rune-ansuz");
    expect(GLYPH_IDS).toContain("saturn");
    expect(GLYPH_IDS).toContain("frost");
  });

  it("огня среди стихий нет: его нет у персонажа (FR-052)", () => {
    expect(GLYPH_IDS as readonly string[]).not.toContain("fire");
  });

  it("все четыре печати нарисованы", () => {
    expect(SEAL_KINDS).toHaveLength(4);
    for (const kind of SEAL_KINDS) {
      expect(SEALS[kind].length, kind).toBeGreaterThan(0);
    }
  });

  it("штрихи не выходят за свой бокс", () => {
    const everything = [...GLYPH_IDS.map((id) => GLYPHS[id]), ...SEAL_KINDS.map((kind) => SEALS[kind])];
    for (const strokes of everything) {
      for (const stroke of strokes) {
        for (const value of coordinates(stroke)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(BOX);
        }
      }
    }
  });
});
```

- [ ] **Step 5: Прогнать тесты и покрытие**

Run: `npx vitest run --coverage src/diagram`
Expected: PASS. Покрытие 100 %: у `runes.ts` и `glyphs.ts` исполняемого кода почти нет, но функции `line`, `stem`, `isRune` должны быть вызваны — они вызываются таблицами и тестом.

- [ ] **Step 6: Коммит**

```bash
git add src/diagram/strokes.ts src/diagram/runes.ts src/diagram/glyphs.ts src/diagram/glyphs.test.ts
git commit -m "Add rune, glyph and seal stroke tables"
```

---

## Task 5: Схема данных `ritualDiagram`

Реализует FR-190 и FR-191 в части проверок. Контента ещё нет — он в Task 6, поэтому здесь тесты работают на заготовках.

**Files:**
- Modify: `src/data/schemas/spell.ts`
- Modify: `src/data/schemas/spell.test.ts`
- Modify: `docs/features/F-17-ritual-diagram.md` — статусы FR-190, FR-191 в «В работе»

**Interfaces:**
- Consumes: `GLYPH_IDS`, `GlyphId`, `SEAL_KINDS`, `SealKind` из `@/diagram/glyphs`; `isRune` из `@/diagram/runes`.
- Produces: `ritualDiagramSchema`, `type RitualDiagram = z.infer<typeof ritualDiagramSchema>`, поле `Spell["ritualDiagram"]?: RitualDiagram`.

- [ ] **Step 1: Написать падающие тесты**

В `src/data/schemas/spell.test.ts` добавить заготовку ритуала и блок проверок. Заготовка кладётся рядом с `web()` и `rayOfFrost()`:

```ts
/** Заготовка ритуального заклинания со схемой: минимальный набор слоёв. */
function ritualCard(): unknown {
  return mutate(web(), (draft) => {
    draft.ritual = true;
    draft.concentration = false;
    draft.ritualDiagram = {
      rings: [1, 0.7],
      centralSeal: { kind: "eye", radius: 0.3 },
      captionRu: "Двойное кольцо и глаз в центре",
    };
  });
}
```

И проверки:

```ts
describe("схема ритуала (FR-190, FR-191)", () => {
  it("принимает ритуал со схемой", () => {
    expect(spellSchema.safeParse(ritualCard()).success).toBe(true);
  });

  it("отклоняет ритуал без схемы", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          delete draft.ritualDiagram;
        }),
      ),
    ).toContain("Ритуальное заклинание обязано иметь схему");
  });

  it("отклоняет схему у неритуального заклинания", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          draft.ritual = false;
        }),
      ),
    ).toContain("Схема ритуала есть только у ритуального заклинания");
  });

  it("отклоняет кольца не по убыванию", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.rings = [0.7, 1];
        }),
      ),
    ).toContain("Кольца перечисляются снаружи внутрь");
  });

  it("отклоняет внешнее кольцо меньше единицы", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.rings = [0.9, 0.5];
        }),
      ),
    ).toContain("Внешнее кольцо равно 1");
  });

  it("отклоняет skip, не дающий звезды", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.star = { points: 6, skip: 3, radius: 0.6 };
        }),
      ),
    ).toContain("Шаг звезды");
  });

  it("отклоняет число знаков, не равное числу вершин на том же радиусе", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.star = { points: 7, skip: 3, radius: 0.6 };
          diagram.radialGlyphs = { glyphs: ["sun", "moon", "mars"], radius: 0.6 };
        }),
      ),
    ).toContain("Знаки стоят на вершинах звезды");
  });

  it("принимает знаки на своём радиусе без звезды", () => {
    const withGlyphs = mutate(ritualCard(), (draft) => {
      const diagram = draft.ritualDiagram as Record<string, unknown>;
      diagram.radialGlyphs = { glyphs: ["sun", "moon", "mars", "venus"], radius: 0.6 };
    });
    expect(spellSchema.safeParse(withGlyphs).success).toBe(true);
  });

  it("отклоняет неизвестный знак", () => {
    expect(
      spellSchema.safeParse(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.radialGlyphs = { glyphs: ["sun", "moon", "phlogiston"], radius: 0.6 };
        }),
      ).success,
    ).toBe(false);
  });

  it("отклоняет надпись с символом вне футарка", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.inscription = { runes: "ᚨжᚢ", meaningRu: "проверка", radius: 0.9 };
        }),
      ),
    ).toContain("не руна старшего футарка");
  });

  it("принимает надпись из рун", () => {
    const withInscription = mutate(ritualCard(), (draft) => {
      const diagram = draft.ritualDiagram as Record<string, unknown>;
      diagram.inscription = { runes: "ᚨᛚᚢ", meaningRu: "«алу» — освящение", radius: 0.9 };
    });
    expect(spellSchema.safeParse(withInscription).success).toBe(true);
  });

  it("отклоняет немагический числовой квадрат", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.magicSquare = { rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], radius: 0.44 };
          diagram.centralSeal = { kind: "eye", radius: 0.14 };
        }),
      ),
    ).toContain("Квадрат не магический");
  });

  it("принимает квадрат Сатурна", () => {
    const withSquare = mutate(ritualCard(), (draft) => {
      const diagram = draft.ritualDiagram as Record<string, unknown>;
      diagram.magicSquare = { rows: [[4, 9, 2], [3, 5, 7], [8, 1, 6]], radius: 0.44 };
      diagram.centralSeal = { kind: "eye", radius: 0.14 };
    });
    expect(spellSchema.safeParse(withSquare).success).toBe(true);
  });

  it("отклоняет печать, не влезающую в центральную клетку квадрата", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.magicSquare = { rows: [[4, 9, 2], [3, 5, 7], [8, 1, 6]], radius: 0.44 };
          diagram.centralSeal = { kind: "eye", radius: 0.4 };
        }),
      ),
    ).toContain("Печать не помещается");
  });

  it("отклоняет угловые знаки числом, отличным от четырёх", () => {
    expect(
      spellSchema.safeParse(
        mutate(ritualCard(), (draft) => {
          const diagram = draft.ritualDiagram as Record<string, unknown>;
          diagram.cornerMarks = ["air", "water", "earth"];
        }),
      ).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/data/schemas/spell.test.ts`
Expected: FAIL — схема ещё не знает поля `ritualDiagram` и не проверяет ни одного инварианта.

- [ ] **Step 3: Написать схему схемы ритуала**

В `src/data/schemas/spell.ts` — импорты сверху:

```ts
import { GLYPH_IDS, SEAL_KINDS } from "@/diagram/glyphs";
import { isRune } from "@/diagram/runes";
```

Перед `spellShape` добавить:

```ts
/** Доля внешнего радиуса схемы: 1 — внешнее кольцо, 0 — центр. */
const diagramRadius = z.number().gt(0).max(1);

const glyphIdSchema = z.enum(GLYPH_IDS);

const magicSquareSchema = z.object({
  rows: z.array(z.array(z.number().int().positive()).length(3)).length(3),
  radius: diagramRadius,
});

/**
 * Схема ритуала (FR-190, FR-191, ADR-0014).
 *
 * Слои перечисляются снаружи внутрь — этот же порядок игрок повторяет на бумаге. Обязательны только
 * кольца, печать и подпись: остальное набирается по вкусу ритуала.
 */
export const ritualDiagramSchema = z.object({
  rings: z.array(diagramRadius).min(2).max(4),
  tickRing: z.object({ count: z.union([z.literal(36), z.literal(72)]), radius: diagramRadius }).optional(),
  inscription: z
    .object({ runes: nonEmpty, meaningRu: nonEmpty, radius: diagramRadius })
    .optional(),
  star: z
    .object({
      points: z.number().int().min(5).max(12),
      skip: z.number().int().min(2),
      radius: diagramRadius,
    })
    .optional(),
  radialGlyphs: z.object({ glyphs: z.array(glyphIdSchema).min(3), radius: diagramRadius }).optional(),
  crossAxes: z.object({ count: z.number().int().min(2).max(8), radius: diagramRadius }).optional(),
  magicSquare: magicSquareSchema.optional(),
  centralSeal: z.object({ kind: z.enum(SEAL_KINDS), radius: diagramRadius }),
  cornerMarks: z.array(glyphIdSchema).length(4).optional(),
  captionRu: nonEmpty,
});

export type RitualDiagram = z.infer<typeof ritualDiagramSchema>;

/** Сумма строки, столбца и диагонали у магического квадрата одна и та же. */
function isMagicSquare(rows: number[][]): boolean {
  const target = rows[0].reduce((sum, value) => sum + value, 0);
  const columns = [0, 1, 2].map((index) => rows.reduce((sum, row) => sum + row[index], 0));
  const diagonals = [
    rows[0][0] + rows[1][1] + rows[2][2],
    rows[0][2] + rows[1][1] + rows[2][0],
  ];
  return [...rows.map((row) => row.reduce((sum, value) => sum + value, 0)), ...columns, ...diagonals]
    .every((sum) => sum === target);
}

type DiagramIssue = { path: (string | number)[]; message: string };

/**
 * Проверки слоёв, которые типами не выражаются. Возвращает список нарушений, а не пишет их сама:
 * так функция остаётся чистой и не зависит от типа контекста Zod.
 */
function ritualDiagramIssues(diagram: RitualDiagram): DiagramIssue[] {
  const issues: DiagramIssue[] = [];
  const issue = (message: string, where: (string | number)[]): void => {
    issues.push({ message, path: where });
  };

  if (diagram.rings[0] !== 1) {
    issue("Внешнее кольцо равно 1: схема рисуется от обвода", ["rings", 0]);
  }
  for (const [index, radius] of diagram.rings.entries()) {
    if (index > 0 && radius >= diagram.rings[index - 1]) {
      issue("Кольца перечисляются снаружи внутрь и строго убывают", ["rings", index]);
    }
  }

  if (diagram.star !== undefined && diagram.star.skip >= diagram.star.points / 2) {
    issue(
      `Шаг звезды ${diagram.star.skip} при ${diagram.star.points} вершинах повторяет уже нарисованное`,
      ["star", "skip"],
    );
  }

  if (
    diagram.star !== undefined &&
    diagram.radialGlyphs !== undefined &&
    diagram.radialGlyphs.radius === diagram.star.radius &&
    diagram.radialGlyphs.glyphs.length !== diagram.star.points
  ) {
    issue("Знаки стоят на вершинах звезды: их число равно числу вершин", ["radialGlyphs", "glyphs"]);
  }

  if (diagram.inscription !== undefined) {
    for (const char of diagram.inscription.runes) {
      if (!isRune(char)) {
        issue(`«${char}» — не руна старшего футарка`, ["inscription", "runes"]);
        break;
      }
    }
  }

  if (diagram.magicSquare !== undefined) {
    if (!isMagicSquare(diagram.magicSquare.rows)) {
      issue("Квадрат не магический: суммы строк, столбцов и диагоналей расходятся", [
        "magicSquare",
        "rows",
      ]);
    }
    // Печать садится в центральную клетку квадрата, иначе они наложатся друг на друга.
    if (diagram.centralSeal.radius > diagram.magicSquare.radius / 2) {
      issue("Печать не помещается в центральную клетку квадрата", ["centralSeal", "radius"]);
    }
  }

  return issues;
}
```

В `spellShape` добавить поле после `roleplay`:

```ts
  ritualDiagram: ritualDiagramSchema.optional(),
```

В `superRefine` добавить двусторонний инвариант и вызов проверок:

```ts
  // FR-190: схема ритуала есть ровно у ритуального заклинания.
  if (spell.ritual && spell.ritualDiagram === undefined) {
    context.addIssue({
      code: "custom",
      path: ["ritualDiagram"],
      message: "Ритуальное заклинание обязано иметь схему ритуала",
    });
  }
  if (!spell.ritual && spell.ritualDiagram !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["ritualDiagram"],
      message: "Схема ритуала есть только у ритуального заклинания",
    });
  }
  if (spell.ritualDiagram !== undefined) {
    for (const issue of ritualDiagramIssues(spell.ritualDiagram)) {
      context.addIssue({
        code: "custom",
        path: ["ritualDiagram", ...issue.path],
        message: issue.message,
      });
    }
  }
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run src/data/schemas`
Expected: FAIL — контент четырёх ритуалов ещё без схем, поэтому `content.test.ts` красный. Тесты схемы должны быть зелёными; если красный тест схемы — читать сообщение и править схему, а не тест.

- [ ] **Step 5: Отметить требования в работе**

В `docs/features/F-17-ritual-diagram.md` у FR-190 и FR-191 заменить `**Статус:** План` на `**Статус:** В работе`.

- [ ] **Step 6: Коммит**

```bash
git add src/data/schemas/spell.ts src/data/schemas/spell.test.ts docs/features/F-17-ritual-diagram.md
git commit -m "Validate ritual diagram layers"
```

---

## Task 6: Четыре схемы в контенте

Данные схем для четырёх ритуалов. После этой задачи всё зелёное: и схема, и контент.

**Files:**
- Modify: `src/data/content/thorne/spells/identify.json`
- Modify: `src/data/content/thorne/spells/detect-magic.json`
- Modify: `src/data/content/thorne/spells/find-familiar.json`
- Modify: `src/data/content/thorne/spells/unseen-servant.json`
- Modify: `src/data/content/thorne/content.test.ts`
- Modify: `docs/features/F-17-ritual-diagram.md` — FR-190, FR-191 в «Готово»

**Interfaces:**
- Consumes: `ritualDiagramSchema` из Task 5, идентификаторы знаков из Task 4.
- Produces: у четырёх карточек заполнено `ritualDiagram`.

- [ ] **Step 1: Написать падающий тест контента**

В `src/data/content/thorne/content.test.ts` добавить блок:

```ts
describe("схемы ритуалов (FR-190)", () => {
  it("схема есть у каждого ритуала и только у ритуала", () => {
    for (const spell of spells) {
      expect(spell.ritualDiagram !== undefined, spell.nameRu).toBe(spell.ritual);
    }
  });

  it("у каждой схемы есть подпись и печать", () => {
    for (const spell of spells.filter((candidate) => candidate.ritual)) {
      expect(spell.ritualDiagram?.captionRu, spell.nameRu).toBeTruthy();
      expect(spell.ritualDiagram?.centralSeal.kind, spell.nameRu).toBeTruthy();
    }
  });

  it("надпись сопровождается переводом: иначе её содержание не вычитать", () => {
    for (const spell of spells.filter((candidate) => candidate.ritualDiagram?.inscription)) {
      expect(spell.ritualDiagram?.inscription?.meaningRu, spell.nameRu).toBeTruthy();
    }
  });

  it("схемы не повторяют друг друга: у каждой свой набор слоёв", () => {
    const shapes = spells
      .filter((spell) => spell.ritual)
      .map((spell) => JSON.stringify(spell.ritualDiagram));
    expect(new Set(shapes).size).toBe(4);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/data/content`
Expected: FAIL — «Ритуальное заклинание обязано иметь схему ритуала» из загрузчика контента.

- [ ] **Step 3: Схема «Опознания»**

В `src/data/content/thorne/spells/identify.json` после блока `roleplay` добавить:

```json
  "ritualDiagram": {
    "rings": [1, 0.92, 0.6],
    "tickRing": { "count": 72, "radius": 0.9 },
    "inscription": {
      "runes": "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ",
      "meaningRu": "Полный старший футарк по обводу: перечисление всех рун само считалось надписью силы — так вырезано на камне из Кюльвера",
      "radius": 0.96
    },
    "star": { "points": 7, "skip": 3, "radius": 0.58 },
    "radialGlyphs": {
      "glyphs": ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"],
      "radius": 0.58
    },
    "magicSquare": { "rows": [[4, 9, 2], [3, 5, 7], [8, 1, 6]], "radius": 0.44 },
    "centralSeal": { "kind": "eye", "radius": 0.14 },
    "captionRu": "Семь металлов алхимии на вершинах гептаграммы, квадрат Сатурна и глаз в его средней клетке: опознать — значит спросить, из чего предмет был до того, как стал собой"
  },
```

- [ ] **Step 4: Схема «Обнаружения магии»**

В `src/data/content/thorne/spells/detect-magic.json`:

```json
  "ritualDiagram": {
    "rings": [1, 0.86, 0.7, 0.54],
    "tickRing": { "count": 36, "radius": 0.93 },
    "inscription": {
      "runes": "ᛚᚨᚢᚲᚨᛉ",
      "meaningRu": "«лауказ» — формульное слово рунных брактеатов, знак роста и оберега: надпись, которая проявляет скрытое",
      "radius": 0.96
    },
    "star": { "points": 8, "skip": 3, "radius": 0.66 },
    "radialGlyphs": {
      "glyphs": [
        "rune-ansuz",
        "rune-raidho",
        "rune-kaunan",
        "rune-hagalaz",
        "rune-isaz",
        "rune-sowilo",
        "rune-tiwaz",
        "rune-laguz"
      ],
      "radius": 0.66
    },
    "crossAxes": { "count": 4, "radius": 0.86 },
    "centralSeal": { "kind": "sphere", "radius": 0.34 },
    "captionRu": "Четыре кольца-волны и восемь лучей: сфера 30 футов, расходящаяся от заклинателя"
  },
```

- [ ] **Step 5: Схема «Поиска фамильяра»**

В `src/data/content/thorne/spells/find-familiar.json`:

```json
  "ritualDiagram": {
    "rings": [1, 0.93, 0.86],
    "inscription": {
      "runes": "ᚨᛚᚢ",
      "meaningRu": "«алу» — самое частое формульное слово рунных надписей: освящение места и зов",
      "radius": 0.895
    },
    "star": { "points": 6, "skip": 2, "radius": 0.72 },
    "crossAxes": { "count": 4, "radius": 0.86 },
    "cornerMarks": ["air", "water", "earth", "lightning"],
    "centralSeal": { "kind": "summoning-triangle", "radius": 0.44 },
    "captionRu": "Круг вызова: гексаграмма из двух наложенных триад, четыре стороны света по углам листа, уголь и травы за 10 зм — в круг внутри треугольника"
  },
```

- [ ] **Step 6: Схема «Незримого слуги»**

В `src/data/content/thorne/spells/unseen-servant.json`:

```json
  "ritualDiagram": {
    "rings": [1, 0.72],
    "tickRing": { "count": 36, "radius": 0.94 },
    "inscription": {
      "runes": "ᚨᚢᛃᚨ",
      "meaningRu": "«ауйа» — «благо, удача» с рунных брактеатов: просьба о помощи, а не приказ",
      "radius": 0.86
    },
    "crossAxes": { "count": 4, "radius": 0.72 },
    "radialGlyphs": {
      "glyphs": ["rune-wunjo", "rune-gebo", "rune-mannaz", "rune-laguz"],
      "radius": 0.6
    },
    "centralSeal": { "kind": "empty-hand", "radius": 0.4 },
    "captionRu": "Четыре сектора поручений и пустой контур руки: слуга незрим, и в центре нарочно ничего нет"
  },
```

- [ ] **Step 7: Закрепить, что схема не влияет на механику (FR-193)**

В `src/store/session.test.ts` добавить блок. Двое одинаковых часов вместо одних общих — чтобы
идентификаторы и время у обоих применений совпали и сравнение шло по существу:

```ts
describe("схема ритуала не влияет на механику (FR-193)", () => {
  it("подмена схемы не меняет результат применения", () => {
    const ritual = spell("unseen-servant");
    const repainted: Spell = {
      ...ritual,
      ritualDiagram: {
        ...ritual.ritualDiagram!,
        captionRu: "Другая подпись",
        centralSeal: { kind: "sphere", radius: 0.2 },
      },
    };
    const request = { mode: "ritual", payment: { kind: "none" } } as const;

    const original = castSpell(session, { spell: ritual, ...request }, testClock());
    const other = castSpell(session, { spell: repainted, ...request }, testClock());

    expect(other.character).toEqual(original.character);
    expect(other.journal.map((entry) => entry.summaryRu)).toEqual(
      original.journal.map((entry) => entry.summaryRu),
    );
  });
});
```

- [ ] **Step 8: Прогнать всё**

Run: `npx vitest run && npm run typecheck`
Expected: PASS, PASS. Если схема отвергла данные — читать сообщение: скорее всего радиус слоя больше внешнего кольца или знаки не совпали с вершинами.

- [ ] **Step 9: Отметить требования готовыми**

В `docs/features/F-17-ritual-diagram.md` у FR-190, FR-191 и FR-193 — `**Статус:** Готово`.

- [ ] **Step 10: Коммит**

```bash
git add src/data/content/thorne/spells/identify.json \
        src/data/content/thorne/spells/detect-magic.json \
        src/data/content/thorne/spells/find-familiar.json \
        src/data/content/thorne/spells/unseen-servant.json \
        src/data/content/thorne/content.test.ts src/store/session.test.ts \
        docs/features/F-17-ritual-diagram.md
git commit -m "Add ritual diagrams for four rituals"
```

---

## Task 7: Отрисовка схемы

Компонент собирает SVG по описанию: слой на функцию, порядок отрисовки — порядок рисования на бумаге. Каталог `src/components/**` в покрытие не входит: проверяется поведением.

**Files:**
- Create: `src/components/ritual/RitualDiagram.tsx`
- Create: `src/components/ritual/RitualDiagram.test.tsx`

**Interfaces:**
- Consumes: `RitualDiagram` из `@/data/schemas/spell`; `VIEW_BOX`, `CENTER`, `absolute`, `pointAt`, `starPolygons`, `tickMarks`, `inscriptionPlacements`, `arcPath`, `squareSide` из `@/diagram/geometry`; `GLYPHS`, `SEALS` из `@/diagram/glyphs`; `RUNE_BY_CHAR`, `RUNES` из `@/diagram/runes`.
- Produces: `RitualDiagram` (компонент) — принимает `{ diagram: RitualDiagramData }`, рисует `<svg>` с атрибутами `data-layer` на каждой группе: `ring`, `ticks`, `inscription`, `star`, `radial-glyphs`, `cross-axes`, `magic-square`, `central-seal`, `corner-marks`.

Имя компонента совпадает с типом данных, поэтому тип импортируется под псевдонимом: `import type { RitualDiagram as RitualDiagramData } from "@/data/schemas/spell"`.

- [ ] **Step 1: Написать падающий тест**

Create `src/components/ritual/RitualDiagram.test.tsx`:

```tsx
// @vitest-environment jsdom

/**
 * Отрисовка схемы (FR-191). Проверяется состав слоёв, а не красота: пропорции доводятся глазом.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { spell } from "@/testing/stores";
import { RitualDiagram } from "./RitualDiagram";

function diagramOf(id: string) {
  const found = spell(id).ritualDiagram;
  if (found === undefined) throw new Error(`у ${id} нет схемы`);
  return found;
}

function layers(container: HTMLElement, layer: string): Element[] {
  return [...container.querySelectorAll(`[data-layer="${layer}"]`)];
}

describe("слои схемы", () => {
  it("рисует все кольца «Опознания»", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "ring")).toHaveLength(3);
  });

  it("рисует 72 деления", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "tick")).toHaveLength(72);
  });

  it("рисует надпись по руне на знак", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "inscription-rune")).toHaveLength(24);
  });

  it("гептаграмма — один обход, гексаграмма — два", () => {
    const seven = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(seven.container, "star-cycle")).toHaveLength(1);

    const six = render(<RitualDiagram diagram={diagramOf("find-familiar")} />);
    expect(layers(six.container, "star-cycle")).toHaveLength(2);
  });

  it("рисует семь знаков металлов на вершинах", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "radial-glyph")).toHaveLength(7);
  });

  it("рисует числовой квадрат с девятью числами", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "magic-square")).toHaveLength(1);
    expect([...container.querySelectorAll("text")].map((node) => node.textContent)).toEqual([
      "4", "9", "2", "3", "5", "7", "8", "1", "6",
    ]);
  });

  it("рисует печать центра", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("unseen-servant")} />);
    expect(layers(container, "central-seal")).toHaveLength(1);
  });

  it("рисует четыре угловых знака у круга вызова", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("find-familiar")} />);
    expect(layers(container, "corner-mark")).toHaveLength(4);
  });

  it("не рисует слоёв, которых в данных нет", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("find-familiar")} />);
    expect(layers(container, "tick")).toHaveLength(0);
    expect(layers(container, "magic-square")).toHaveLength(0);
  });

  it("цвет берётся у текста, заливки нет: рисунок повторим пером", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("fill")).toBe("none");
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/ritual`
Expected: FAIL — компонента нет.

- [ ] **Step 3: Написать компонент**

Create `src/components/ritual/RitualDiagram.tsx`:

```tsx
/**
 * Отрисовка схемы ритуала (FR-191, ADR-0014).
 *
 * Слои рисуются в том порядке, в котором их выводят рукой: обвод, деления, надпись, звезда, знаки,
 * оси, квадрат, печать, угловые знаки. Заливок нет и цвет наследуется от текста — схема живёт в обеих
 * темах и повторяется пером.
 *
 * Атрибуты data-layer существуют для тестов: состав слоёв проверяется поведением, потому что
 * компоненты в покрытие не входят.
 */

import type { RitualDiagram as RitualDiagramData } from "@/data/schemas/spell";
import {
  CENTER,
  VIEW_BOX,
  absolute,
  arcPath,
  inscriptionPlacements,
  pointAt,
  squareSide,
  starPolygons,
  tickMarks,
} from "@/diagram/geometry";
import { GLYPHS, SEALS, type GlyphId, type SealKind } from "@/diagram/glyphs";
import { RUNES, RUNE_BY_CHAR } from "@/diagram/runes";
import type { Stroke } from "@/diagram/strokes";

const DASH = "10 8";

/** Штрих в своём боксе 100×100 — превращается в элемент SVG. */
function StrokeShape({ stroke }: { stroke: Stroke }) {
  const dash = stroke.dashed === true ? { strokeDasharray: DASH } : {};

  if (stroke.kind === "circle") {
    return <circle cx={stroke.cx} cy={stroke.cy} r={stroke.r} {...dash} />;
  }
  if (stroke.kind === "line") {
    return <line x1={stroke.x1} y1={stroke.y1} x2={stroke.x2} y2={stroke.y2} {...dash} />;
  }
  if (stroke.kind === "arc") {
    return (
      <path
        d={arcPath(stroke.cx, stroke.cy, stroke.r, stroke.fromDegrees, stroke.toDegrees)}
        {...dash}
      />
    );
  }
  const points = stroke.points.map(([x, y]) => `${x},${y}`).join(" ");
  return stroke.closed === true ? (
    <polygon points={points} {...dash} />
  ) : (
    <polyline points={points} {...dash} />
  );
}

/** Набор штрихов, поставленный в точку и масштабированный под размер. */
function Shape({
  strokes,
  x,
  y,
  size,
  rotation = 0,
}: {
  strokes: Stroke[];
  x: number;
  y: number;
  size: number;
  rotation?: number;
}) {
  const scale = size / 100;
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale}) translate(-50 -50)`}
      vectorEffect="non-scaling-stroke"
    >
      {strokes.map((stroke, index) => (
        <StrokeShape key={index} stroke={stroke} />
      ))}
    </g>
  );
}

function Glyph({ id, x, y, size, rotation }: { id: GlyphId; x: number; y: number; size: number; rotation?: number }) {
  return <Shape strokes={GLYPHS[id]} x={x} y={y} size={size} rotation={rotation ?? 0} />;
}

function Seal({ kind, radius }: { kind: SealKind; radius: number }) {
  return (
    <g data-layer="central-seal">
      <Shape strokes={SEALS[kind]} x={CENTER} y={CENTER} size={absolute(radius) * 2} />
    </g>
  );
}

function MagicSquare({ rows, radius }: { rows: number[][]; radius: number }) {
  const side = squareSide(absolute(radius));
  const cell = side / 3;
  const left = CENTER - side / 2;
  const top = CENTER - side / 2;

  return (
    <g data-layer="magic-square">
      {[0, 1, 2, 3].map((index) => (
        <line key={`h${index}`} x1={left} y1={top + cell * index} x2={left + side} y2={top + cell * index} />
      ))}
      {[0, 1, 2, 3].map((index) => (
        <line key={`v${index}`} x1={left + cell * index} y1={top} x2={left + cell * index} y2={top + side} />
      ))}
      {rows.flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => (
          <text
            key={`${rowIndex}-${columnIndex}`}
            x={left + cell * (columnIndex + 0.5)}
            y={top + cell * (rowIndex + 0.5)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={cell * 0.42}
            fill="currentColor"
            stroke="none"
          >
            {value}
          </text>
        )),
      )}
    </g>
  );
}

export function RitualDiagram({ diagram }: { diagram: RitualDiagramData }) {
  const runeSize = diagram.inscription === undefined ? 0 : absolute(0.06);

  return (
    <svg
      viewBox={VIEW_BOX}
      role="img"
      aria-label="Схема ритуала"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      className="h-auto w-full"
    >
      {diagram.rings.map((fraction) => (
        <circle key={fraction} data-layer="ring" cx={CENTER} cy={CENTER} r={absolute(fraction)} />
      ))}

      {diagram.tickRing === undefined
        ? null
        : tickMarks(diagram.tickRing.count, absolute(diagram.tickRing.radius), absolute(0.03)).map(
            ([outer, inner], index) => (
              <line
                key={index}
                data-layer="tick"
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
              />
            ),
          )}

      {diagram.inscription === undefined
        ? null
        : inscriptionPlacements(
            [...diagram.inscription.runes].length,
            absolute(diagram.inscription.radius),
          ).map((place, index) => {
            const char = [...diagram.inscription!.runes][index];
            const id = RUNE_BY_CHAR.get(char);
            if (id === undefined) return null;
            return (
              <g key={index} data-layer="inscription-rune">
                <Shape
                  strokes={RUNES[id].strokes}
                  x={place.at.x}
                  y={place.at.y}
                  size={runeSize}
                  rotation={place.rotation}
                />
              </g>
            );
          })}

      {diagram.star === undefined
        ? null
        : starPolygons(diagram.star.points, diagram.star.skip, absolute(diagram.star.radius)).map(
            (cycle, index) => (
              <polygon
                key={index}
                data-layer="star-cycle"
                points={cycle.map((point) => `${point.x},${point.y}`).join(" ")}
              />
            ),
          )}

      {diagram.radialGlyphs === undefined
        ? null
        : diagram.radialGlyphs.glyphs.map((id, index) => {
            const at = pointAt(
              absolute(diagram.radialGlyphs!.radius),
              index,
              diagram.radialGlyphs!.glyphs.length,
            );
            return (
              <g key={`${id}-${index}`} data-layer="radial-glyph">
                <Glyph id={id} x={at.x} y={at.y} size={absolute(0.09)} />
              </g>
            );
          })}

      {diagram.crossAxes === undefined
        ? null
        : Array.from({ length: diagram.crossAxes.count }, (_unused, index) => {
            const at = pointAt(absolute(diagram.crossAxes!.radius), index, diagram.crossAxes!.count);
            return (
              <line key={index} data-layer="cross-axis" x1={CENTER} y1={CENTER} x2={at.x} y2={at.y} />
            );
          })}

      {diagram.magicSquare === undefined ? null : (
        <MagicSquare rows={diagram.magicSquare.rows} radius={diagram.magicSquare.radius} />
      )}

      <Seal kind={diagram.centralSeal.kind} radius={diagram.centralSeal.radius} />

      {diagram.cornerMarks === undefined
        ? null
        : diagram.cornerMarks.map((id, index) => {
            // По углам листа, а не на осях: диагонали — это index * 2 + 1 из восьми направлений.
            const corner = pointAt(absolute(1.06), index * 2 + 1, 8);
            return (
              <g key={`${id}-${index}`} data-layer="corner-mark">
                <Glyph id={id} x={corner.x} y={corner.y} size={absolute(0.07)} />
              </g>
            );
          })}
    </svg>
  );
}
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/components/ritual && npm run typecheck`
Expected: PASS, PASS.

- [ ] **Step 5: Посмотреть глазами**

Run: `npm run dev`, открыть страницу, дойти до ритуала — либо, если кнопки ещё нет (она в Task 8), временно отрендерить `<RitualDiagram diagram={...} />` на странице и удалить перед коммитом.

Смотреть на четыре вещи: круг вписан в экран целиком; руны надписи стоят ровно и не заваливаются; звезда не сливается с кольцами; числа квадрата попадают в свои клетки. Пропорции правятся числами в `runes.ts`, `glyphs.ts` и размерами в этом компоненте — тесты состава слоёв от этого не ломаются.

- [ ] **Step 6: Коммит**

```bash
git add src/components/ritual/RitualDiagram.tsx src/components/ritual/RitualDiagram.test.tsx
git commit -m "Render ritual diagram from layers"
```

---

## Task 8: Полный экран и кнопки входа

Реализует FR-192 и FR-193. Вход из карточки и из мастера при ритуальном способе.

**Files:**
- Create: `src/components/ritual/RitualDiagramView.tsx`
- Create: `src/components/ritual/RitualDiagramView.test.tsx`
- Modify: `src/components/spell/SpellCardDetails.tsx`
- Modify: `src/components/cast/CastWizard.tsx`
- Modify: `src/components/combat/CombatScreen.test.tsx`
- Modify: `docs/features/F-17-ritual-diagram.md` — FR-192, FR-193 в «Готово»; заголовок фичи в «Готово»
- Modify: `docs/features/README.md` — статус F-17
- Modify: `docs/roadmap.md` — состояние и следующий шаг

**Interfaces:**
- Consumes: `RitualDiagram` (компонент) из Task 7; `Spell` из `@/data/schemas/spell`.
- Produces: `RitualDiagramView({ spell, onClose })` — полноэкранный `role="dialog"`, `z-30`.

- [ ] **Step 1: Написать падающий тест вида**

Create `src/components/ritual/RitualDiagramView.test.tsx`:

```tsx
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { spell } from "@/testing/stores";
import { RitualDiagramView } from "./RitualDiagramView";

describe("полноэкранный вид схемы (FR-192)", () => {
  it("показывает название ритуала, схему и подпись", () => {
    render(<RitualDiagramView spell={spell("identify")} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: /Схема ритуала «Опознание»/ })).toBeDefined();
    expect(screen.getByRole("img", { name: "Схема ритуала" })).toBeDefined();
    expect(screen.getByText(spell("identify").ritualDiagram!.captionRu)).toBeDefined();
  });

  it("закрывается кнопкой", async () => {
    const onClose = vi.fn();
    render(<RitualDiagramView spell={spell("identify")} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("у заклинания без схемы не показывает ничего (FR-190)", () => {
    const { container } = render(
      <RitualDiagramView spell={spell("ray-of-frost")} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("кнопки печати нет: смысл в том, чтобы вести линию рукой", () => {
    render(<RitualDiagramView spell={spell("identify")} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /Печать|Печатать/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/ritual/RitualDiagramView.test.tsx`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Написать полноэкранный вид**

Create `src/components/ritual/RitualDiagramView.tsx`:

```tsx
/**
 * Полноэкранный вид схемы ритуала (FR-192).
 *
 * Полный экран, а не блок в карточке: по схеме рисуют, и на 375 px мелкий рисунок бесполезен.
 * Прокрутки нет — схема видна целиком. Кнопки печати нет намеренно (FR-192): смысл занятия в том,
 * чтобы вести линию рукой.
 *
 * Механики вид не касается (FR-193): ничего не расходует, ничего не подтверждает, закрывается в любой
 * момент.
 */

"use client";

import { RitualDiagram } from "@/components/ritual/RitualDiagram";
import type { Spell } from "@/data/schemas/spell";

export function RitualDiagramView({ spell, onClose }: { spell: Spell; onClose: () => void }) {
  const diagram = spell.ritualDiagram;
  if (diagram === undefined) return null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Схема ритуала «${spell.nameRu}»`}
      className="fixed inset-0 z-30 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold leading-tight">{spell.nameRu}</h2>
          <p className="text-xs text-slate-500">Перерисуйте на лист — это и есть ритуал</p>
        </div>
        <button type="button" onClick={onClose} className="px-2 text-sm text-slate-500 underline">
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 p-3">
        <RitualDiagram diagram={diagram} />
        <p className="text-center text-xs italic text-slate-600 dark:text-slate-400">
          {diagram.captionRu}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Прогнать тест вида**

Run: `npx vitest run src/components/ritual/RitualDiagramView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Написать падающие тесты кнопок**

В `src/components/combat/CombatScreen.test.tsx` добавить блок:

```tsx
describe("схема ритуала (FR-192)", () => {
  it("карточка ритуала открывает схему на полный экран", async () => {
    await renderWithStores(<CombatScreen />);
    await userEvent.click(screen.getByRole("button", { name: /Опознание/ }));
    await userEvent.click(screen.getByRole("button", { name: "Схема ритуала" }));
    expect(screen.getByRole("dialog", { name: /Схема ритуала «Опознание»/ })).toBeDefined();
  });

  it("у неритуального заклинания кнопки схемы нет", async () => {
    await renderWithStores(<CombatScreen />);
    await userEvent.click(screen.getByRole("button", { name: /Луч холода/ }));
    expect(screen.queryByRole("button", { name: "Схема ритуала" })).toBeNull();
  });
});
```

Ритуалы в боевом списке по умолчанию скрыты ([F-09](../../features/F-09-preparation.md#fr-103)); если кнопка «Опознание» в списке не находится, сначала включить фильтр «Ритуал» — так же, как это делают существующие тесты фильтров в этом файле.

- [ ] **Step 6: Убедиться, что тесты падают**

Run: `npx vitest run src/components/combat`
Expected: FAIL — кнопки «Схема ритуала» нет.

- [ ] **Step 7: Добавить кнопку в карточку**

В `src/components/spell/SpellCardDetails.tsx`:

```tsx
import { useState } from "react";

import { RitualDiagramView } from "@/components/ritual/RitualDiagramView";
```

Внутри компонента, рядом с остальным состоянием:

```tsx
  const [diagramOpen, setDiagramOpen] = useState(false);
```

Кнопка — сразу после блока значков (`<div className="flex flex-wrap gap-1">…</div>`), чтобы её было видно без прокрутки:

```tsx
        {spell.ritualDiagram === undefined ? null : (
          <button
            type="button"
            onClick={() => setDiagramOpen(true)}
            className="min-h-11 rounded-lg border border-ritual/60 px-3 text-sm font-medium text-ritual"
          >
            Схема ритуала
          </button>
        )}
```

И вид — перед закрывающим тегом `</section>`, после `<footer>`:

```tsx
      {diagramOpen ? (
        <RitualDiagramView spell={spell} onClose={() => setDiagramOpen(false)} />
      ) : null}
```

Файл уже помечен `"use client"` через дерево страницы; если TypeScript пожалуется на `useState` в серверном компоненте, добавить `"use client"` первой строкой после блока комментария.

Цвета `text-ritual` и `border-ritual` есть в теме: `--color-ritual` объявлена в `src/app/globals.css` и уже используется значком «Ритуал».

- [ ] **Step 8: Добавить кнопку в мастер**

В `src/components/cast/CastWizard.tsx` — импорты:

```tsx
import { useState } from "react";

import { RitualDiagramView } from "@/components/ritual/RitualDiagramView";
```

В `SummaryStep` — состояние и кнопка после блока «Сказать мастеру», до `<RoleplaySection>`:

```tsx
  const [diagramOpen, setDiagramOpen] = useState(false);
```

```tsx
      {/* Схема только в ритуальном режиме: рисовать десять минут в бою нельзя (FR-192). */}
      {draft.mode === "ritual" && draft.spell.ritualDiagram !== undefined ? (
        <button
          type="button"
          onClick={() => setDiagramOpen(true)}
          className="min-h-11 rounded-lg border border-ritual/60 px-3 text-sm font-medium text-ritual"
        >
          Схема ритуала
        </button>
      ) : null}

      {diagramOpen ? (
        <RitualDiagramView spell={draft.spell} onClose={() => setDiagramOpen(false)} />
      ) : null}
```

- [ ] **Step 9: Прогнать всё**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS, PASS, сборка статического экспорта проходит.

- [ ] **Step 10: Проверить на узком экране**

Run: `npm run dev`, в браузере поставить ширину 375 px (iPhone SE), открыть схему каждого из четырёх ритуалов.

Проверить: круг целиком в экране, горизонтальной прокрутки нет, подпись читается, кнопка «Закрыть» достаётся большим пальцем. Если круг обрезан — уменьшить внешний радиус в вёрстке контейнера, а не в `OUTER_RADIUS`: единицы схемы одни и те же для всех схем.

- [ ] **Step 11: Обновить статусы спеки**

В `docs/features/F-17-ritual-diagram.md`: FR-192 и FR-193 — `**Статус:** Готово`; в шапке файла `Статус: Готово`.

В `docs/features/README.md` — строку F-17 в `Готово`.

В `docs/roadmap.md`, в раздел «Текущее состояние» — строку в таблицу слоёв:

```markdown
| Схема ритуала | четыре схемы из слоёв, полноэкранный вид, вход из карточки и мастера | `src/diagram/`, `src/components/ritual/` |
```

- [ ] **Step 12: Проверить целостность и закоммитить**

Run: `python3 scripts/check-docs.py`
Expected: те же четыре ошибки базовой линии, ни одной новой.

```bash
git add src/components/ritual src/components/spell/SpellCardDetails.tsx \
        src/components/cast/CastWizard.tsx src/components/combat/CombatScreen.test.tsx \
        docs/features/F-17-ritual-diagram.md docs/features/README.md docs/roadmap.md
git commit -m "Open ritual diagram full screen from card and wizard"
```

---

## Отклонения от спеки

Одно, и оно осознанное. Спека предполагала надписи по кругу как транслитерацию русских фраз («расскажи чьими руками», «покажи») старшим футарком. В плане надписи — аттестованные рунные формульные слова (`alu`, `laukaz`, `auja`) и полный футарк по обводу.

Причина: в старшем футарке нет звуков «ж», «ч», «ш», поэтому транслитерация русского даёт придуманный алфавит вместо настоящего — прямо против требования «связано с реальной магией». Решение фиксируется в ADR-0014 (Task 2, шаг 4), где перечислены оба варианта.

## Проверка после всех задач

```bash
npm run check:docs && npm run typecheck && npm run test:coverage && npm run build
```

Покрытие: `src/diagram/**` — 100 % по всем метрикам, как и остальные пути из `coverage.include`.

Остаётся ручная проверка, которую не заменяет ни один тест: перерисовать все четыре схемы на А4 и понять, получается ли это за время ритуала и радует ли результат. Замечания после этого — изменения спеки, а не прямые правки кода.
