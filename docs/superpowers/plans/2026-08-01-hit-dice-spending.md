# Расход костей хитов и короткий отдых Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать «Мистической бодрости» тратить кости хитов и лечить из мастера применения, а магическому
восстановлению — предупреждать об отсутствии короткого отдыха.

**Architecture:** Заклинание объявляет расход данными (`hitDiceCost` в схеме), мастер применения
показывает шаг по наличию поля, `castSpell` списывает и лечит одной операцией — значит одна отмена
возвращает всё. Движок по-прежнему не знает ни одного заклинания по имени. Дизайн —
[2026-08-01-hit-dice-spending-design.md](../specs/2026-08-01-hit-dice-spending-design.md).

**Tech Stack:** TypeScript, Zod, Zustand, React, Vitest, `scripts/check-docs.py`.

## Global Constraints

- **Не коммитить и не индексировать.** Правки остаются в рабочем дереве неиндексированными: игрок сам
  валидирует, сам выбирает стейдж и коммитит. Там, где шаблон плана обычно требует коммит, здесь стоит
  остановка на валидацию.
- **Сначала спека, потом код** ([CLAUDE.md](../../../CLAUDE.md)). Задача 1 идёт первой не для порядка:
  на ADR-0021 и FR-135 ссылаются комментарии в коде из остальных задач.
- **Порог покрытия 100 %.** `vitest.config.ts` роняет прогон ниже порога, поэтому ветка без теста
  ломает сборку. Это относится и к веткам вида «поля нет — шага нет».
- **Язык:** контент, документация и интерфейс — русский; код, идентификаторы — английский.
- **Схема общая с пользовательским импортом** ([ADR-0004](../../decisions.md#adr-0004)): новые поля
  обязаны быть необязательными, иначе файл прежней версии перестанет открываться
  ([NFR-003](../../features/F-12-offline-pwa.md)).
- **Числа механики не выдумывать.** Значения `hitDiceCost` «Мистической бодрости» берутся из её
  собственного `higherLevelsRu`, а не из памяти.

## Структура файлов

| Файл | Что делает |
|---|---|
| `docs/decisions.md` | ADR-0021 — приложение принимает результат броска |
| `docs/features/F-06-resources.md` | FR-135 новое, FR-131 и FR-134 дополняются |
| `src/data/schemas/spell.ts` | `hitDiceCostSchema`, необязательное поле заклинания |
| `src/data/schemas/character.ts` | `shortRestSinceLongRest`, необязательный флаг |
| `src/rules/hitDice.ts` | `maximumHitDiceForCast`, `hitDiceHealing` |
| `src/data/content/thorne/spells/arcane-vigor.json` | `hitDiceCost` |
| `src/store/session.ts` | `CastRequest.hitDice`, расход и лечение в `castSpell`, флаг в отдыхах |
| `src/store/castDraftStore.ts` | шаг `hitDice`, поля черновика, `visibleSteps`, `toCastRequest` |
| `src/components/cast/CastWizard.tsx` | экран шага с проверкой диапазона |
| `src/components/combat/ArcaneRecoverySheet.tsx` | предупреждение об отдыхе |
| `src/components/combat/CampActions.tsx` | кнопка перестаёт исчезать |

---

### Задача 1: Спека

**Files:**
- Modify: `docs/decisions.md` — ADR-0021
- Modify: `docs/features/F-06-resources.md` — FR-135, правки FR-131 и FR-134
- Modify: `src/rules/hitDice.ts:5`, `src/store/session.ts:1508` — ссылка ADR-0007 → OQ-09

**Interfaces:**
- Produces: якоря `#adr-0021` и `#fr-135`, на которые ссылаются комментарии кода в Задачах 2–6.

- [ ] **Шаг 1: Проверить свободный номер ADR**

Run: `grep -n "^## ADR-" docs/decisions.md | tail -2`
Expected: последний — ADR-0020, значит следующий 0021. Если нет — взять фактически следующий и
поправить ссылки в этом плане.

- [ ] **Шаг 2: Написать ADR-0021**

Заголовок: «Приложение принимает результат броска и складывает за игрока».

Контекст: [OQ-09](../../open-questions.md#oq-09) запретил броски, но оставил дверь — «если ручной
подсчёт при масштабировании окажется медленным, калькулятор урона — компромисс между подсказкой и
броском». «Мистическая бодрость» требует сложения за столом: выпавшее на 1–6 костях плюс модификатор.

Варианты: (1) не считать вовсе, игрок вводит готовые хиты; (2) принимать выпавшее и складывать;
(3) бросать самому — отвергнут, это прямо запрещено OQ-09.

Выбор: второй. Кубик бросает игрок, приложение принимает результат и складывает.

Последствия: граница «что делает приложение» сдвинулась с «называет, что бросить» на «называет, что
бросить, и считает по результату». Введённое проверяется диапазоном возможного — не меньше числа
костей и не больше числа костей на размер, — потому что приложение обязано отличать опечатку от броска,
но не вправе оспаривать возможный результат. OQ-09 остаётся открытым: калькулятор урона в это решение
не входит.

- [ ] **Шаг 3: Написать FR-135**

В `docs/features/F-06-resources.md` после FR-134. Статус `План`, проверка — имена прогонов из Задач 2–6.

Текст: приложение должно давать потратить кости хитов из карточки заклинания, если заклинание их
тратит. Число костей выбирает игрок в пределах, заданных заклинанием и остатком; результат броска
вводит он же; приложение прибавляет модификатор заклинательной характеристики, если заклинание его
прибавляет, списывает кости и ячейку и лечит — одной операцией, обратимой журналом
([FR-111](F-10-journal-undo.md#fr-111)).

Отдельно назвать: при нуле неистраченных костей шаг не прячется, а объясняет — правило запрещает
бросать несуществующие кости, но не запрещает потратить ячейку зря
([FR-034](F-03-cast-wizard.md#fr-034)).

- [ ] **Шаг 4: Дополнить FR-131 и FR-134**

FR-131: добавить абзац о предупреждении. Отсутствие короткого отдыха не запрещает восстановление, а
называется причиной в листе. Записать асимметрию: израсходованность приложение знает наверняка —
оно само её списало, — а короткий отдых мог случиться за столом без нажатия кнопки, и запрещать по
неполному знанию приложение права не имеет.

FR-134: снять абзац «**Чего пока нет**» и сослаться на [FR-135](#fr-135).

- [ ] **Шаг 5: Исправить три ссылки на ADR-0007**

ADR-0007 — про CLI компилятора TypeScript, а не про броски. Заменить на
[OQ-09](../../open-questions.md#oq-09) в:

```bash
grep -rn "ADR-0007" docs/features/F-06-resources.md src/rules/hitDice.ts src/store/session.ts
```

- [ ] **Шаг 6: Прогнать проверку спеки**

Run: `npm run check:docs`
Expected: «спецификация целостна». Скрипт поймает висячий якорь, если ADR-0021 сослался не туда.

- [ ] **Шаг 7: Остановка на валидацию**

Не коммитить. Показать игроку, что изменилось в спеке, и продолжить.

---

### Задача 2: Схема, правило и контент

**Files:**
- Modify: `src/data/schemas/spell.ts`
- Modify: `src/rules/hitDice.ts`
- Modify: `src/data/content/thorne/spells/arcane-vigor.json`
- Test: `src/data/schemas/spell.test.ts`, `src/rules/hitDice.test.ts`, `src/data/content/thorne/content.test.ts`

**Interfaces:**
- Produces: `HitDiceCost` (тип), `maximumHitDiceForCast(cost, spellLevel, slotLevel, remaining): number`,
  `hitDiceHealing(cost, rolled, spellcastingModifier): number`. Ими пользуются Задачи 3 и 5.

- [ ] **Шаг 1: Написать падающий тест правила**

В `src/rules/hitDice.test.ts`:

```ts
const cost = { maximumDice: 2, extraDicePerSlotLevel: 2, addsSpellcastingModifier: true };

it("ячейкой своего уровня даёт базовое число костей", () => {
  expect(maximumHitDiceForCast(cost, 2, 2, 7)).toBe(2);
});

it("каждый уровень ячейки выше добавляет свои кости", () => {
  expect(maximumHitDiceForCast(cost, 2, 3, 7)).toBe(4);
  expect(maximumHitDiceForCast(cost, 2, 4, 7)).toBe(6);
});

it("остаток режет сверху", () => {
  expect(maximumHitDiceForCast(cost, 2, 4, 2)).toBe(2);
});

it("без костей бросать нечего", () => {
  expect(maximumHitDiceForCast(cost, 2, 2, 0)).toBe(0);
});

it("лечение прибавляет модификатор один раз", () => {
  expect(hitDiceHealing(cost, 9, 4)).toBe(13);
});

it("заклинание без модификатора лечит на выпавшее", () => {
  expect(hitDiceHealing({ ...cost, addsSpellcastingModifier: false }, 9, 4)).toBe(9);
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `npx vitest run src/rules/hitDice.test.ts`
Expected: FAIL — `maximumHitDiceForCast is not a function`.

- [ ] **Шаг 3: Реализовать правило**

В `src/rules/hitDice.ts`:

```ts
export function maximumHitDiceForCast(
  cost: HitDiceCost,
  spellLevel: number,
  slotLevel: number,
  remaining: number,
): number {
  const allowed = cost.maximumDice + cost.extraDicePerSlotLevel * Math.max(0, slotLevel - spellLevel);
  return Math.min(allowed, remaining);
}

export function hitDiceHealing(cost: HitDiceCost, rolled: number, spellcastingModifier: number): number {
  return rolled + (cost.addsSpellcastingModifier ? spellcastingModifier : 0);
}
```

`Math.max(0, …)` не декоративен: ячейка ниже уровня заклинания невозможна в интерфейсе, но схема
импорта её не запрещает, а отрицательный множитель дал бы максимум меньше базового.

- [ ] **Шаг 4: Добавить поле в схему заклинания**

В `src/data/schemas/spell.ts` рядом с `armorClassEffect`:

```ts
export const hitDiceCostSchema = z.object({
  maximumDice: z.number().int().positive(),
  extraDicePerSlotLevel: z.number().int().nonnegative(),
  addsSpellcastingModifier: z.boolean(),
});
```

В `spellShape`: `hitDiceCost: hitDiceCostSchema.optional(),`. Экспортировать
`export type HitDiceCost = z.infer<typeof hitDiceCostSchema>;`.

Комментарием — то же, что у `armorClassEffect`: отсутствие поля означает «костей не тратит», а не ноль,
и различие видно в данных ([FR-135](../../features/F-06-resources.md#fr-135)).

- [ ] **Шаг 5: Тест схемы**

В `src/data/schemas/spell.test.ts`: заклинание с корректным `hitDiceCost` проходит; `maximumDice: 0`
отвергается; заклинание без поля проходит.

- [ ] **Шаг 6: Внести поле в карточку**

В `arcane-vigor.json` после `resolution`:

```json
"hitDiceCost": {
  "maximumDice": 2,
  "extraDicePerSlotLevel": 2,
  "addsSpellcastingModifier": true
}
```

Сверить с `higherLevelsRu` карточки: «растёт на две за каждый уровень ячейки выше второго: до четырёх
ячейкой 3 уровня и до шести ячейкой 4. Модификатор характеристики всё равно прибавляется один раз».

- [ ] **Шаг 7: Тест контента**

В `content.test.ts`: у «Мистической бодрости» поле есть; ни у одной другой карточки его нет.
Второе — защита от копипасты, а не догма: если поле появится у нового заклинания, тест меняют осознанно.

- [ ] **Шаг 8: Прогнать тесты**

Run: `npx vitest run src/rules/hitDice.test.ts src/data/schemas/spell.test.ts src/data/content/thorne/content.test.ts`
Expected: PASS

---

### Задача 3: Расход и лечение в `castSpell`

**Files:**
- Modify: `src/store/session.ts`
- Test: `src/store/session.test.ts`

**Interfaces:**
- Consumes: `maximumHitDiceForCast`, `hitDiceHealing` (Задача 2).
- Produces: `CastRequest.hitDice?: { count: number; rolled: number }`. Им пользуется Задача 5.

- [ ] **Шаг 1: Написать падающий тест**

В `src/store/session.test.ts`:

```ts
it("сотворение тратит кости хитов и лечит (FR-135)", () => {
  const wounded = /* персонаж с hitPoints.current = 30, hitDice.remaining = 7 */;
  const after = castSpell(
    wounded,
    { spell: arcaneVigor, mode: "normal", payment: { kind: "slot", level: 2 }, hitDice: { count: 2, rolled: 9 } },
    clock,
  );
  expect(after.character.hitDice?.remaining).toBe(5);
  expect(after.character.hitPoints.current).toBe(43); // 30 + 9 + 4
  expect(after.journal[0]?.summaryRu).toContain("2 кости");
});

it("отмена возвращает ячейку, кости и хиты разом (FR-111)", () => {
  /* undoLast(after) возвращает 30 хитов, 7 костей и ячейку */
});

it("на полных хитах сотворение проходит, но не лечит", () => {
  /* current === maximum: кости списаны, хиты не изменились, ошибки нет */
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `npx vitest run src/store/session.test.ts -t "кости хитов"`
Expected: FAIL — поля `hitDice` в `CastRequest` нет.

- [ ] **Шаг 3: Расширить `CastRequest`**

```ts
  /** Потраченные кости хитов и выпавшее на них (FR-135). Только у заклинания с `hitDiceCost`. */
  hitDice?: { count: number; rolled: number };
```

- [ ] **Шаг 4: Списать кости и вылечить внутри `castSpell`**

Внутри уже существующего построения `after`, до `commit`.

**`heal` переиспользовать нельзя** — она пишет собственную запись журнала и бросает ошибку при полном
здоровье; сотворение на полных хитах обязано проходить, просто впустую. Считать в той же операции:

```ts
const restored = Math.min(
  character.hitPoints.maximum - character.hitPoints.current,
  hitDiceHealing(cost, request.hitDice.rolled, spellcastingModifier(character)),
);
```

Проверить, как называется готовая функция модификатора заклинательной характеристики в `src/rules/`,
и взять её, а не считать из `abilities` заново.

Отказаться, если костей меньше запрошенного: это не выбор игрока, а несогласованность —
`SessionError` с числом в тексте.

- [ ] **Шаг 5: Дописать запись журнала**

Одна запись на всё сотворение. К существующему тексту добавить кости и восстановленные хиты; при нуле
восстановленного — сказать это словами, а не молчать.

- [ ] **Шаг 6: Прогнать тесты**

Run: `npx vitest run src/store/session.test.ts`
Expected: PASS

---

### Задача 4: Флаг короткого отдыха

**Files:**
- Modify: `src/data/schemas/character.ts`
- Modify: `src/store/session.ts` — `shortRest`, `longRest`
- Test: `src/data/schemas/character.test.ts`, `src/store/session.test.ts`

**Interfaces:**
- Produces: `character.shortRestSinceLongRest?: boolean`. Им пользуется Задача 6.

- [ ] **Шаг 1: Написать падающий тест**

```ts
it("короткий отдых отмечается флагом (FR-131)", () => {
  expect(shortRest(session, clock).character.shortRestSinceLongRest).toBe(true);
});

it("долгий отдых флаг снимает (FR-131)", () => {
  expect(longRest(shortRest(session, clock), clock).character.shortRestSinceLongRest).toBe(false);
});

it("сохранение прежней версии открывается без флага (NFR-003)", () => {
  /* объект без поля проходит characterStateSchema */
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `npx vitest run src/store/session.test.ts -t "короткий отдых отмечается"`
Expected: FAIL — поля нет.

- [ ] **Шаг 3: Добавить поле в схему**

В `src/data/schemas/character.ts` рядом с `arcaneRecoveryAvailable`:

```ts
  /**
   * Был ли короткий отдых с последнего долгого (FR-131).
   *
   * Необязательное намеренно: обязательное отвергло бы сохранения прежних версий, а обновление не
   * имеет права терять данные (NFR-003). `undefined` читается как «отдыха не было» — это честнее
   * молчаливого разрешения, а цена ошибки всего одно лишнее предупреждение.
   */
  shortRestSinceLongRest: z.boolean().optional(),
```

- [ ] **Шаг 4: Ставить и снимать флаг**

В `shortRest` — `shortRestSinceLongRest: true` в объекте `after`. В `longRest` — `false`.
`useArcaneRecovery` **не трогать**: проверки там не появляется, предупреждение живёт в интерфейсе.

- [ ] **Шаг 5: Прогнать тесты**

Run: `npx vitest run src/store/session.test.ts src/data/schemas/character.test.ts`
Expected: PASS

---

### Задача 5: Шаг мастера применения

**Files:**
- Modify: `src/store/castDraftStore.ts`
- Modify: `src/components/cast/CastWizard.tsx`
- Test: `src/store/castDraftStore.test.ts`, `src/components/cast/CastWizard.test.tsx`

**Interfaces:**
- Consumes: `maximumHitDiceForCast`, `hitDiceHealing` (Задача 2), `CastRequest.hitDice` (Задача 3).

- [ ] **Шаг 1: Написать падающий тест черновика**

```ts
it("шаг костей хитов есть только у заклинания с расходом (FR-135)", () => {
  expect(visibleSteps(draftFor(arcaneVigor), context)).toContain("hitDice");
  expect(visibleSteps(draftFor(magicMissileLike), context)).not.toContain("hitDice");
});

it("шаг встаёт после выбора ячейки", () => {
  const steps = visibleSteps(draftFor(arcaneVigor), context);
  expect(steps.indexOf("hitDice")).toBeGreaterThan(steps.indexOf("slot"));
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `npx vitest run src/store/castDraftStore.test.ts -t "костей хитов"`
Expected: FAIL — шага нет в `WIZARD_STEPS`.

- [ ] **Шаг 3: Завести шаг и поля черновика**

`WIZARD_STEPS`: вставить `"hitDice"` **между** `"slot"` и `"components"` — порядок массива задаёт
порядок экранов, а максимум костей зависит от выбранной ячейки.

`CastDraft`: `hitDiceCount: number | null` и `hitDiceRolled: number | null`, оба `null` по умолчанию.

`visibleSteps`, ветка `case "hitDice"`: `return spell.hitDiceCost !== undefined;`.

`toCastRequest`: включать `hitDice`, только когда оба поля заполнены.

- [ ] **Шаг 4: Экран шага**

В `CastWizard.tsx` — `HitDiceStep` по образцу `SlotStep`.

Содержит: выбор числа костей от 1 до `maximumHitDiceForCast(...)`; поле выпавшего; строку итога
«выпавшее плюс 4 — столько хитов вернётся».

Проверка диапазона выпавшего: не меньше числа костей, не больше `число × character.hitDice.size`.
Вне диапазона — «Далее» недоступно с причиной; это опечатка, а не спорный бросок.

Нулевой остаток костей: шаг **не прячется**, а объясняет — бросать нечего, ячейка уйдёт впустую.
Предупреждение, а не запрет ([FR-034](../../features/F-03-cast-wizard.md#fr-034)).

Добавить заголовок шага в `STEP_TITLES`.

- [ ] **Шаг 5: Компонентные тесты**

Шаг показывается у «Мистической бодрости» и не показывается у «Молнии»; ячейка 4 уровня даёт выбрать
до шести костей; выпавшее 1 на двух костях отвергается; выпавшее 13 на двух d6 отвергается; при нуле
костей виден текст объяснения; подтверждение доводит `hitDice` до `castSpell`.

- [ ] **Шаг 6: Прогнать тесты**

Run: `npx vitest run src/store/castDraftStore.test.ts src/components/cast/CastWizard.test.tsx`
Expected: PASS

---

### Задача 6: Предупреждение в магическом восстановлении

**Files:**
- Modify: `src/components/combat/ArcaneRecoverySheet.tsx`
- Modify: `src/components/combat/CampActions.tsx`
- Test: `src/components/combat/CombatScreen.test.tsx`

**Interfaces:**
- Consumes: `character.shortRestSinceLongRest` (Задача 4).

- [ ] **Шаг 1: Написать падающий тест**

Без короткого отдыха лист восстановления показывает причину и **всё равно даёт подтвердить**; после
короткого отдыха причины нет. Кнопка в «Лагере» видна и после того, как восстановление израсходовано,
и называет причину недоступности.

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx -t "короткий отдых"`
Expected: FAIL

- [ ] **Шаг 3: Предупреждение в листе**

В `ArcaneRecoverySheet.tsx` — строка причины, когда `shortRestSinceLongRest` не `true`. Текст называет
правило, а не команду: восстановление берётся после короткого отдыха, а его не было. Кнопка
подтверждения остаётся включённой.

- [ ] **Шаг 4: Кнопка перестаёт исчезать**

В `CampActions.tsx:53` сейчас `character.arcaneRecoveryAvailable ? <Action …/> : null` — кнопка
пропадает молча. Показывать её всегда, а израсходованность называть причиной рядом, как это уже
сделано у заклинаний в списке.

- [ ] **Шаг 5: Прогнать тесты**

Run: `npx vitest run src/components/combat/CombatScreen.test.tsx`
Expected: PASS

---

### Задача 7: Полная проверка и статусы

**Files:**
- Modify: `docs/features/F-06-resources.md` — статусы FR-131, FR-134, FR-135
- Modify: `docs/features/README.md`, `docs/roadmap.md` — если статус F-06 меняется

- [ ] **Шаг 1: Полная проверка**

Run: `npm run check:docs && npm run typecheck && npm run test:coverage && npm run build`
Expected: PASS во всех четырёх, покрытие 100 %.

- [ ] **Шаг 2: Перевести статусы**

FR-135 — `Готово` с именами прогонов. FR-131 — остаётся `Готово`, но теперь честно. FR-134 — снять
упоминание пробела.

Убрать обе строки из таблицы «Чего не хватает в логике» в [roadmap.md](../../roadmap.md) вместе с
абзацем о расхождении статусов: он написан про этот самый пробел и переживёт его только как враньё.

- [ ] **Шаг 3: Посмотреть в приложении**

Run: `npm run dev`

Открыть «Мистическую бодрость» вне боя, пройти мастер ячейкой 2 уровня: выбрать 2 кости, ввести
выпавшее, подтвердить. Проверить, что шапка показала меньше костей и больше хитов, а отмена вернула
обе величины. Затем открыть магическое восстановление без короткого отдыха и убедиться, что причина
названа, а подтвердить всё равно можно.

- [ ] **Шаг 4: Остановка на валидацию**

Не коммитить. Показать игроку сводку изменений и `git status`; стейдж и коммит за ним.

---

## Самопроверка плана

**Покрытие дизайна.** Поле `hitDiceCost` — Задача 2; шаг мастера — Задача 5; расход и лечение одной
операцией с отменой — Задача 3; флаг отдыха — Задача 4; предупреждение и кнопка — Задача 6; ADR-0021,
FR-135, правки FR-131/FR-134 и три ссылки на ADR-0007 — Задача 1; статусы — Задача 7.

**Согласованность имён.** `maximumHitDiceForCast` и `hitDiceHealing` объявлены в Задаче 2 и
используются под теми же именами в Задачах 3 и 5. `CastRequest.hitDice` объявлен в Задаче 3 и
заполняется в Задаче 5. `shortRestSinceLongRest` объявлен в Задаче 4 и читается в Задаче 6.

**Известная неточность.** В Задаче 3 имя функции модификатора заклинательной характеристики не
названо: в `src/rules/` она есть, но под каким именем — проверяется на месте, а не угадывается здесь.
Шаг это оговаривает.

**Чего в плане нет.** Расхода костей коротким отдыхом, общего «расхода ресурса» и пересмотра OQ-09 —
всё это дизайн вынес за границы работы.
